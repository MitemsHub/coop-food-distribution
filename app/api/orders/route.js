// app/api/orders/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(url, serviceKey)

export async function GET() {
  return NextResponse.json({ ok: true, message: 'orders API alive' })
}

export async function POST(req) {
  try {
    const body = await req.json()
    const { memberId, deliveryBranchCode, departmentName, paymentOption, lines } = body || {}

    if (!memberId || !deliveryBranchCode || !departmentName || !paymentOption || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 })
    }

    // Member (home branch + balances)
    const { data: member, error: mErr } = await admin
      .from('members')
      .select('member_id, full_name, category, savings, loans, global_limit, branch_id')
      .eq('member_id', memberId)
      .single()
    if (mErr || !member) return NextResponse.json({ ok: false, error: 'Member not found' }, { status: 404 })

    // Delivery branch (pricing & inventory)
    const { data: deliveryBranch, error: bErr } = await admin
      .from('branches').select('id, code, name')
      .eq('code', deliveryBranchCode)
      .single()
    if (bErr || !deliveryBranch) return NextResponse.json({ ok: false, error: 'Delivery branch not found' }, { status: 400 })

    // Department
    const { data: deptRow, error: dErr } = await admin
      .from('departments').select('id, name')
      .eq('name', departmentName).single()
    if (dErr || !deptRow) return NextResponse.json({ ok: false, error: 'Department not found' }, { status: 400 })

    // Exposure (Pending + Posted + Delivered)
    const statuses = ['Pending','Posted','Delivered'];
    const sumAmt = (rows) => (rows || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);

    const { data: loanRows, error: le } = await admin
      .from('orders')
      .select('total_amount')
      .eq('member_id', memberId)
      .eq('payment_option', 'Loan')
      .in('status', statuses);
    if (le) return NextResponse.json({ ok:false, error: le.message }, { status:500 });

    const { data: savRows, error: se } = await admin
      .from('orders')
      .select('total_amount')
      .eq('member_id', memberId)
      .eq('payment_option', 'Savings')
      .in('status', statuses);
    if (se) return NextResponse.json({ ok:false, error: se.message }, { status:500 });

    const loanExposure = sumAmt(loanRows);
    const savingsExposure = sumAmt(savRows);

    const memberLoans = Number(member.loans || 0);       // core loans
    const memberSavings = Number(member.savings || 0);
    const globalLimit = Number(member.global_limit || 0);

    // Any outstanding loan (core + exposure) blocks Savings
    const outstandingLoansTotal = memberLoans + loanExposure;

    const savingsBase = 0.5 * memberSavings;
    const savingsEligible = outstandingLoansTotal > 0 ? 0 : Math.max(0, savingsBase - savingsExposure);

    const rawLoanLimit = memberSavings * 5 - outstandingLoansTotal;
    const loanEligible = Math.min(Math.max(rawLoanLimit, 0), globalLimit);

    // Price lines from DELIVERY branch
    let total = 0
    const pricedLines = []
    for (const l of lines) {
      const sku = l?.sku
      const qty = Number(l?.qty || 0)
      if (!sku || qty <= 0) return NextResponse.json({ ok:false, error:'Invalid line item' }, { status:400 })

      const { data: item, error: iErr } = await admin.from('items').select('item_id, sku').eq('sku', sku).single()
      if (iErr || !item) return NextResponse.json({ ok:false, error:`Item not found: ${sku}` }, { status:400 })

      const { data: bip, error: pErr } = await admin
        .from('branch_item_prices').select('id, price')
        .eq('branch_id', deliveryBranch.id)
        .eq('item_id', item.item_id)
        .single()
      if (pErr || !bip) return NextResponse.json({ ok:false, error:`No price for ${sku} in ${deliveryBranchCode}` }, { status:400 })

      const unit_price = Number(bip.price)
      const amount = unit_price * qty
      total += amount

      pricedLines.push({ item_id: item.item_id, branch_item_price_id: bip.id, unit_price, qty, amount })
    }

    // Enforce limits
    if (paymentOption === 'Savings') {
      if (outstandingLoansTotal > 0) return NextResponse.json({ ok:false, error:'Savings not allowed while loans outstanding (incl. pending/posted loan apps)' }, { status:400 })
      if (total > savingsEligible)   return NextResponse.json({ ok:false, error:`Total ₦${total.toLocaleString()} exceeds Savings available ₦${savingsEligible.toLocaleString()}` }, { status:400 })
    } else if (paymentOption === 'Loan') {
      if (total > loanEligible)      return NextResponse.json({ ok:false, error:`Total ₦${total.toLocaleString()} exceeds Loan available ₦${loanEligible.toLocaleString()}` }, { status:400 })
    } else if (paymentOption !== 'Cash') {
      return NextResponse.json({ ok:false, error:'Invalid payment option' }, { status:400 })
    }

    // Insert order (home + delivery branches)
    const { data: order, error: oErr } = await admin
      .from('orders')
      .insert({
        member_id: member.member_id,
        member_name_snapshot: member.full_name,
        member_category_snapshot: member.category,
        branch_id: member.branch_id,                 // member/home branch
        delivery_branch_id: deliveryBranch.id,       // delivery location
        department_id: deptRow.id,
        payment_option: paymentOption,
        total_amount: total,
        status: 'Pending'
      })
      .select('order_id')
      .single()
    if (oErr || !order) return NextResponse.json({ ok:false, error:oErr?.message || 'Insert failed' }, { status:500 })

    const rows = pricedLines.map(pl => ({ order_id: order.order_id, ...pl }))
    const { error: lErr } = await admin.from('order_lines').insert(rows)
    if (lErr) return NextResponse.json({ ok:false, error:lErr.message }, { status:500 })

    return NextResponse.json({ ok:true, order_id: order.order_id, total, paymentOption, eligibility: { savingsEligible, loanEligible } })
  } catch (e) {
    return NextResponse.json({ ok:false, error:e.message || 'Unknown error' }, { status:500 })
  }
}