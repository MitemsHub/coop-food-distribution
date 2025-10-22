// app/shop/success/[id]/page.jsx
'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

function SuccessContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id
  const mid = searchParams?.get('mid') || '' // memberId passed from /shop

  const [order, setOrder] = useState(null)
  const [error, setError] = useState(null)
  const [downloading, setDownloading] = useState(false)

  const currency = (n) => `₦${Number(n || 0).toLocaleString()}`

  // Safe JSON helper
  const safeJson = async (res, label) => {
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) return await res.json()
    const text = await res.text()
    throw new Error(`Non-JSON response from ${label} (${res.status}): ${text.slice(0, 300)}`)
  }

  const loadOrder = async () => {
    setError(null)
    try {
      // 1) Primary fetch by order id
      const res = await fetch(`/api/orders/${id}`, { cache: 'no-store' })
      if (res.ok) {
        const json = await safeJson(res, `/api/orders/${id}`)
        if (json.ok) { setOrder(json.order); return }
      }

      // 2) Fallback: latest order by member (if mid present)
      if (mid) {
        const qs = new URLSearchParams({ id: mid, limit: '1' }).toString()
        const r2 = await fetch(`/api/members/orders?${qs}`, { cache: 'no-store' })
        const j2 = await safeJson(r2, `/api/members/orders?${qs}`)
        if (j2.ok && Array.isArray(j2.orders) && j2.orders.length > 0) {
          setOrder(j2.orders[0]); return
        }
      }

      setError('Order not found')
    } catch (e) {
      setError(e.message || 'Failed to load order')
    }
  }

  useEffect(() => {
    if (id) loadOrder()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mid])

  const downloadPDF = async () => {
    if (!order) return
    setDownloading(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF()

      doc.setFontSize(16)
      doc.text('CBN Coop Food Distribution - Order Receipt', 10, 12)
      doc.setFontSize(10)
      doc.text(`Order ID: ${order.order_id}`, 10, 20)
      doc.text(`Status: ${order.status}`, 60, 20)
      doc.text(`Date: ${new Date(order.created_at).toLocaleString()}`, 10, 26)

      doc.text(`Member: ${order.member_name_snapshot} (${order.member_id})`, 10, 34)
      doc.text(`Member Branch: ${order.member_branch?.name || '-'}`, 10, 40)
      doc.text(`Delivery: ${order.delivery?.name || '-'}`, 10, 46)
      doc.text(`Department: ${order.departments?.name || '-'}`, 10, 52)
      doc.text(`Payment: ${order.payment_option}`, 10, 58)

      let y = 70
      doc.setFontSize(11)
      doc.text('Items', 10, y); y += 6
      doc.setFontSize(10)
      // Removed SKU column for member-facing receipt
      doc.text('Item', 10, y)
      doc.text('Qty', 120, y)
      doc.text('Unit', 140, y)
      doc.text('Amount', 165, y)
      y += 5
      doc.line(10, y, 200, y); y += 4

      ;(order.order_lines || []).forEach((l) => {
        // No SKU shown
        doc.text(l.items?.name || '', 10, y)
        doc.text(String(l.qty), 125, y, { align: 'right' })
        doc.text(currency(l.unit_price), 140, y)
        doc.text(currency(l.amount), 165, y)
        y += 6
        if (y > 270) { doc.addPage(); y = 20 }
      })

      y += 4
      doc.line(120, y, 200, y); y += 6
      doc.setFontSize(12)
      doc.text(`Total: ${currency(order.total_amount)}`, 165, y, { align: 'right' })

      doc.save(`Order_${order.order_id}.pdf`)
    } catch (e) {
      alert(`PDF error: ${e.message}`)
    } finally {
      setDownloading(false)
    }
  }

  const downloadExcel = async () => {
    if (!order) return
    setDownloading(true)
    try {
      const xlsxMod = await import('xlsx')
      const XLSX = xlsxMod?.default ?? xlsxMod

      // Removed SKU column for member-facing export
      const rows = (order.order_lines || []).map((l) => ({
        OrderID: order.order_id,
        CreatedAt: order.created_at,
        PostedAt: order.posted_at,
        Status: order.status,
        MemberID: order.member_id,
        MemberName: order.member_name_snapshot,
        MemberBranch: order.member_branch?.name || '',
        Delivery: order.delivery?.name || '',
        Department: order.departments?.name || '',
        Payment: order.payment_option,
        Item: l.items?.name || '',
        Qty: l.qty,
        UnitPrice: Number(l.unit_price || 0),
        Amount: Number(l.amount || 0),
      }))
      rows.push({
        OrderID: order.order_id,
        CreatedAt: '',
        PostedAt: '',
        Status: '',
        MemberID: '',
        MemberName: '',
        MemberBranch: '',
        Delivery: '',
        Department: '',
        Payment: '',
        Item: 'TOTAL',
        Qty: '',
        UnitPrice: '',
        Amount: Number(order.total_amount || 0),
      })

      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Order')
      XLSX.writeFile(wb, `Order_${order.order_id}.xlsx`)
    } catch (e) {
      alert(`Excel error: ${e.message}`)
    } finally {
      setDownloading(false)
    }
  }

  if (error) return <div className="p-6">Error: {error}</div>
  if (!order) return <div className="p-6">Loading…</div>

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Order Confirmed</h1>
      <p className="text-sm text-gray-600 mb-4">
        Order #{order.order_id} • {order.status} • {new Date(order.created_at).toLocaleString()}
      </p>

      <div className="mb-3 text-sm">
        <div><b>Member:</b> {order.member_name_snapshot} ({order.member_id})</div>
        <div><b>Member Branch:</b> {order.member_branch?.name || '-'}</div>
        <div><b>Delivery:</b> {order.delivery?.name || '-'}</div>
        <div><b>Department:</b> {order.departments?.name || '-'}</div>
        <div><b>Payment:</b> {order.payment_option}</div>
      </div>

      <table className="w-full text-sm border mb-3">
        <thead className="bg-gray-50">
          <tr>
            {/* Removed SKU column for member-facing view */}
            <th className="p-2 border text-left">Item</th>
            <th className="p-2 border text-right">Qty</th>
            <th className="p-2 border text-right">Unit Price</th>
            <th className="p-2 border text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {(order.order_lines || []).map((l, idx) => (
            <tr key={idx}>
              {/* Removed SKU cell */}
              <td className="p-2 border">{l.items?.name}</td>
              <td className="p-2 border text-right">{l.qty}</td>
              <td className="p-2 border text-right">{currency(l.unit_price)}</td>
              <td className="p-2 border text-right">{currency(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="text-right text-lg font-semibold mb-6">
        Total: {currency(order.total_amount)}
      </div>

      <div className="flex gap-2">
        <a href={`/shop${mid ? `?mid=${encodeURIComponent(mid)}` : ''}`} className="px-4 py-2 border rounded">Back to Shop</a>
        <button onClick={downloadPDF} className="px-4 py-2 bg-blue-600 text-white rounded" disabled={downloading}>
          {downloading ? 'Preparing…' : 'Download PDF'}
        </button>
        <button onClick={downloadExcel} className="px-4 py-2 bg-emerald-600 text-white rounded" disabled={downloading}>
          {downloading ? 'Preparing…' : 'Download Excel'}
        </button>
      </div>
    </div>
  )
}

export default function Success() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <SuccessContent />
    </Suspense>
  )
}