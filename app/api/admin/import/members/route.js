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

    // Expected headers (simplified):
    // member_id, full_name, grade, savings, loans, global_limit

    if (!rows.length) return NextResponse.json({ ok: false, error: 'No rows found' }, { status: 400 })

    // Load grade-based default limits once
    const { data: gradeRows, error: glErr } = await supabase
      .from('grade_limits')
      .select('grade, global_limit')
    if (glErr) return NextResponse.json({ ok: false, error: glErr.message }, { status: 500 })
    const gradeLimitByName = new Map(
      (gradeRows || []).map(g => [String(g.grade || '').trim().toLowerCase(), Number(g.global_limit || 0)])
    )

    // Build upsert rows from simplified template.
    // IMPORTANT: Do not overwrite branch_id/department_id/phone/email when not provided.
    const upsertRows = rows.map(r => {
      const member_id = String(r.member_id || '').trim()
      const full_name = String(r.full_name || '').trim()
      const grade = String(r.grade || '').trim()
      const savings = Number(String(r.savings || '0').replace(/[, ]/g, '')) || 0
      const loans = Number(String(r.loans || '0').replace(/[, ]/g, '')) || 0
      let global_limit = Number(String(r.global_limit || '0').replace(/[, ]/g, '')) || 0

      // If global_limit not provided, default from grade_limits table
      if (!global_limit && grade) {
        const key = grade.toLowerCase().replace(/\s+/g, ' ').trim()
        const defaultLimit = gradeLimitByName.get(key)
        if (typeof defaultLimit === 'number') global_limit = defaultLimit
      }

      // Derive category from first character of member_id if available; default 'A'
      const category = (member_id ? member_id[0].toUpperCase() : 'A')

      // Only include fields present in simplified template to avoid clearing existing data
      const row = {
        member_id,
        full_name,
        category,
        grade,
        savings,
        loans,
        global_limit
      }

      return row
    })

    // Upsert in chunks
    let total = 0
    for (const part of chunk(upsertRows, 500)) {
      const { error: uErr, count } = await supabase
        .from('members')
        .upsert(part, { onConflict: 'member_id', ignoreDuplicates: false, count: 'exact' })
      if (uErr) return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 })
      total += count || part.length
    }

    return NextResponse.json({ ok: true, imported: total })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Unknown error' }, { status: 500 })
  }
}