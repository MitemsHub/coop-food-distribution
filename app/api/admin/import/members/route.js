// app/api/admin/import/members/route.js
import { NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabaseServer'
import * as XLSX from 'xlsx/xlsx.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// chunk helper
const chunk = (arr, size = 500) => {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export async function POST(req) {
  try {
    console.log('Members import request received')
    const supabase = createClient()
    const formData = await req.formData()
    const file = formData.get('file')
    console.log('File received:', file ? file.name : 'No file')
    if (!file) return NextResponse.json({ ok: false, error: 'file is required' }, { status: 400 })

    const buf = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buf, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

    // Expected headers:
    // member_id, full_name, branch_code, department_name, category, grade, savings, loans, global_limit, phone, email

    if (!rows.length) return NextResponse.json({ ok: false, error: 'No rows found' }, { status: 400 })

    // Fetch branches once (we do NOT create new branches here; enforce known codes)
    const { data: branches, error: bErr } = await supabase.from('branches').select('id,code')
    if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 })
    const branchByCode = new Map(branches.map(b => [String(b.code).trim().toUpperCase(), b.id]))

    // Prepare departments: upsert all unique names
    const deptNames = [...new Set(rows.map(r => String(r.department_name || '').trim()).filter(Boolean))]
    if (deptNames.length) {
      const deptRows = deptNames.map(n => ({ name: n }))
      const { error: duErr } = await supabase.from('departments').upsert(deptRows, { onConflict: 'name' })
      if (duErr) return NextResponse.json({ ok: false, error: duErr.message }, { status: 500 })
    }
    // Re-fetch departments to map ids
    const { data: depts, error: dErr } = await supabase.from('departments').select('id,name')
    if (dErr) return NextResponse.json({ ok: false, error: dErr.message }, { status: 500 })
    const deptByName = new Map(depts.map(d => [String(d.name).trim(), d.id]))

    const invalidBranch = new Set()
    const invalidDept = new Set()

    // Build upsert rows
    const upsertRows = rows.map(r => {
      const member_id = String(r.member_id || '').trim()
      const full_name = String(r.full_name || '').trim()
      const branch_code = String(r.branch_code || '').trim().toUpperCase()
      const department_name = String(r.department_name || '').trim()
      const category = String(r.category || '').trim().toUpperCase() || (member_id ? member_id[0].toUpperCase() : 'A')
      const grade = String(r.grade || '').trim()
      const savings = Number(String(r.savings || '0').replace(/[, ]/g, '')) || 0
      const loans = Number(String(r.loans || '0').replace(/[, ]/g, '')) || 0
      const global_limit = Number(String(r.global_limit || '0').replace(/[, ]/g, '')) || 0
      const phone = String(r.phone || '').trim()
      const email = String(r.email || '').trim()

      const branch_id = branchByCode.get(branch_code)
      if (!branch_id) invalidBranch.add(branch_code)

      const department_id = deptByName.get(department_name)
      if (!department_id && department_name) invalidDept.add(department_name)

      return {
        member_id,
        full_name,
        category: category || 'A',
        grade,
        savings,
        loans,
        global_limit,
        branch_id: branch_id || null,
        department_id: department_id || null,
        phone,
        email
      }
    })

    if (invalidBranch.size) {
      console.log('Invalid branch codes found:', [...invalidBranch])
      console.log('Available branches:', branches.map(b => b.code))
      return NextResponse.json({ ok: false, error: `Unknown branch_code(s): ${[...invalidBranch].join(', ')}` }, { status: 400 })
    }

    // Upsert in chunks
    let total = 0
    for (const part of chunk(upsertRows, 500)) {
      const { error: uErr, count } = await supabase
        .from('members')
        .upsert(part, { onConflict: 'member_id', ignoreDuplicates: false, count: 'exact' })
      if (uErr) return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 })
      total += count || part.length
    }

    return NextResponse.json({ ok: true, imported: total, invalidDept: [...invalidDept] })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Unknown error' }, { status: 500 })
  }
}