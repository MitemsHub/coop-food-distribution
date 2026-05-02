'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import ProtectedRoute from '../../../components/ProtectedRoute'
import { Suspense } from 'react'
import { supabase } from '@/lib/supabaseClient'

function RamSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const params = useParams()

  const orderId = useMemo(() => (Array.isArray(params?.id) ? params.id[0] : params?.id), [params])

  useEffect(() => {
    const mid = (searchParams.get('mid') || '').trim()
    if (!mid) return
    if (!orderId) return
    router.replace(`/ram/success/${encodeURIComponent(orderId)}`)
  }, [orderId, router, searchParams])

  const [order, setOrder] = useState(null)
  const [member, setMember] = useState(null)
  const [location, setLocation] = useState(null)
  const [error, setError] = useState(null)
  const [downloading, setDownloading] = useState(false)

  const currency = (n) => `₦${Number(n || 0).toLocaleString()}`
  const currencyPDF = (n) => `NGN ${Number(n || 0).toLocaleString()}`

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!orderId) return
      setError(null)
      setOrder(null)
      setMember(null)
      setLocation(null)
      try {
        const { data: o, error: oErr } = await supabase
          .from('ram_orders')
          .select(
            'id,member_id,status,created_at,payment_option,qty,unit_price,principal_amount,interest_amount,total_amount,ram_delivery_location_id'
          )
          .eq('id', Number(orderId))
          .single()
        if (oErr || !o) throw new Error(oErr?.message || 'Order not found')

        const [mRes, lRes] = await Promise.all([
          supabase.from('members').select('member_id,full_name,branch_id').eq('member_id', o.member_id).maybeSingle(),
          o.ram_delivery_location_id
            ? supabase
                .from('ram_delivery_locations')
                .select('id,delivery_location,name,phone,address')
                .eq('id', o.ram_delivery_location_id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ])

        if (!cancelled) {
          setOrder(o)
          setMember(mRes?.data || null)
          setLocation(lRes?.data || null)
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load order')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [orderId])

  const downloadPDF = async () => {
    if (!order) return
    setDownloading(true)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTableMod = await import('jspdf-autotable')
      const autoTable = autoTableMod?.default ?? autoTableMod
      const doc = new jsPDF()

      const pageWidth = doc.internal.pageSize.getWidth()
      const marginX = 12
      const headerY = 10
      const headerH = 18

      doc.setFillColor(21, 128, 61)
      doc.rect(marginX, headerY, pageWidth - marginX * 2, headerH, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(14)
      doc.text('CBN Coop — Ram Sales Receipt', marginX + 6, headerY + 12)

      doc.setTextColor(0, 0, 0)
      doc.setFontSize(9)
      doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - marginX, headerY + 12, { align: 'right' })

      const detailsBody = [
        ['Order ID', `#${order.id}`, 'Status', String(order.status || '—')],
        ['Date', new Date(order.created_at).toLocaleString(), 'Payment', String(order.payment_option || '—')],
        ['Member', `${member?.full_name || '—'} (${order.member_id})`, 'Quantity', String(Number(order.qty || 0).toLocaleString())],
        ['Unit Price', currencyPDF(order.unit_price), 'Total', currencyPDF(order.total_amount)],
      ]

      autoTable(doc, {
        head: [['Order Details', '', '', '']],
        body: detailsBody,
        startY: headerY + headerH + 6,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 2, lineWidth: 0.1, lineColor: [220, 220, 220] },
        headStyles: { fillColor: [240, 253, 244], textColor: [21, 128, 61], fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 26 }, 1: { cellWidth: 66 }, 2: { cellWidth: 26 }, 3: { cellWidth: 66 } },
        margin: { left: marginX, right: marginX },
      })

      const principal = Number(order.principal_amount || 0)
      const interest = Number(order.interest_amount || 0)
      const total = Number(order.total_amount || 0)

      autoTable(doc, {
        head: [['Amount Breakdown', '', '']],
        body: [
          ['Principal', currencyPDF(principal), ''],
          ['Interest', currencyPDF(interest), ''],
          ['Total', currencyPDF(total), ''],
        ],
        startY: (doc.lastAutoTable?.finalY || 0) + 6,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 2, lineWidth: 0.1, lineColor: [220, 220, 220] },
        headStyles: { fillColor: [240, 253, 244], textColor: [21, 128, 61], fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 40 }, 1: { halign: 'right', cellWidth: 60 }, 2: { cellWidth: 84 } },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === 2) {
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.fillColor = [240, 253, 244]
          }
        },
        margin: { left: marginX, right: marginX },
      })

      const vendorRows = [
        ['Delivery Location', String(location?.delivery_location || location?.name || '—')],
        ['Vendor Name', String(location?.name || '—')],
        ['Vendor Phone No', String(location?.phone || '—')],
      ]
      if (location?.address) vendorRows.push(['Vendor Address', String(location.address)])

      autoTable(doc, {
        head: [['Vendor Details', '']],
        body: vendorRows,
        startY: (doc.lastAutoTable?.finalY || 0) + 6,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 2, lineWidth: 0.1, lineColor: [220, 220, 220] },
        headStyles: { fillColor: [240, 253, 244], textColor: [21, 128, 61], fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 44 }, 1: { cellWidth: 166 } },
        margin: { left: marginX, right: marginX },
      })

      doc.save(`RamOrder_${order.id}.pdf`)
    } catch (e) {
      alert(`PDF error: ${e?.message || 'Failed to generate PDF'}`)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-10 md:py-14">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 md:p-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Ram Order Submitted</h1>
          <div className="mt-3 text-sm md:text-base text-gray-700">
            Order ID: <span className="font-semibold">{String(orderId || '')}</span>
          </div>
          {!!memberId && (
            <div className="mt-1 text-sm md:text-base text-gray-700">
              Member ID: <span className="font-semibold">{memberId}</span>
            </div>
          )}

          {!!error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
          )}

          {!!order && (
            <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
              <div className="flex items-center justify-between gap-3">
                <div className="text-gray-600">Member</div>
                <div className="font-semibold text-right">{member?.full_name || '—'}</div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="text-gray-600">Payment</div>
                <div className="font-semibold text-right">{order.payment_option || '—'}</div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="text-gray-600">Quantity</div>
                <div className="font-semibold text-right">{Number(order.qty || 0).toLocaleString()}</div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="text-gray-600">Unit Price</div>
                <div className="font-semibold text-right">{currency(order.unit_price)}</div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="text-gray-600">Principal</div>
                <div className="font-semibold text-right">{currency(order.principal_amount)}</div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="text-gray-600">Interest</div>
                <div className="font-semibold text-right">{currency(order.interest_amount)}</div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 border-t border-gray-200 pt-2">
                <div className="font-semibold">Total</div>
                <div className="font-bold text-right">{currency(order.total_amount)}</div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-gray-600">Delivery Location</div>
                <div className="font-semibold text-right break-words">{location?.delivery_location || location?.name || '—'}</div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="text-gray-600">Vendor Name</div>
                <div className="font-semibold text-right break-words">{location?.name || '—'}</div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="text-gray-600">Vendor Phone No</div>
                <div className="font-semibold text-right break-words">{location?.phone || '—'}</div>
              </div>
            </div>
          )}

          <div className="mt-6">
            <button
              type="button"
              onClick={downloadPDF}
              disabled={!order || downloading}
              className={`w-full inline-flex items-center justify-center px-4 py-3 text-white text-sm md:text-base font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl ${
                !order || downloading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'
              }`}
            >
              {downloading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Preparing PDF...</span>
                </span>
              ) : (
                'Download PDF'
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => router.push('/ram/shop')}
            className="mt-3 w-full inline-flex items-center justify-center px-4 py-3 text-gray-700 text-sm md:text-base font-semibold rounded-xl transition-all duration-200 border border-gray-300 hover:bg-gray-50"
          >
            Back to Shop
          </button>
        </div>
      </div>
    </main>
  )
}

export default function RamSuccessPage() {
  return (
    <ProtectedRoute allowedRoles={['member']}>
      <Suspense>
        <RamSuccessContent />
      </Suspense>
    </ProtectedRoute>
  )
}
