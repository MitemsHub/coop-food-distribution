// app/rep/orders/edit/[id]/page.jsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '../../../../contexts/AuthContext'
import ProtectedRoute from '../../../../components/ProtectedRoute'

function RepEditOrderPageContent() {
  const [order, setOrder] = useState(null)
  const [orderLines, setOrderLines] = useState([])
  const [departments, setDepartments] = useState([])
  const [items, setItems] = useState([])
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const params = useParams()
  const orderId = params.id

  useEffect(() => {
    if (!orderId) return
    loadOrder()
    loadDepartments()
    loadItems()
  }, [orderId])

  const loadOrder = async () => {
    try {
      const res = await fetch(`/api/rep/orders/get?id=${orderId}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Failed to load order')
      
      setOrder(json.order)
      setOrderLines(json.order.order_lines || [])
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    } finally {
      setLoading(false)
    }
  }

  const loadDepartments = async () => {
    try {
      const res = await fetch('/api/departments/list', { cache: 'no-store' })
      const json = await res.json()
      if (json?.ok) setDepartments(json.departments || [])
    } catch {}
  }

  const loadItems = async () => {
    try {
      const res = await fetch('/api/items/list', { cache: 'no-store' })
      const json = await res.json()
      if (json?.ok) setItems(json.items || [])
    } catch {}
  }

  const updateOrderLine = (index, field, value) => {
    const updated = [...orderLines]
    updated[index] = { ...updated[index], [field]: value }
    
    // Recalculate amount if qty or unit_price changed
    if (field === 'qty' || field === 'unit_price') {
      updated[index].amount = (updated[index].qty || 0) * (updated[index].unit_price || 0)
    }
    
    setOrderLines(updated)
  }

  const addOrderLine = () => {
    setOrderLines([...orderLines, {
      item_id: '',
      qty: 1,
      unit_price: 0,
      amount: 0
    }])
  }

  const removeOrderLine = (index) => {
    setOrderLines(orderLines.filter((_, i) => i !== index))
  }

  const saveOrder = async () => {
    if (!order || orderLines.length === 0) {
      setMsg({ type: 'error', text: 'Order must have at least one item' })
      return
    }

    setSaving(true)
    setMsg(null)
    
    try {
      const totalAmount = orderLines.reduce((sum, line) => sum + (line.amount || 0), 0)
      
      const res = await fetch('/api/rep/orders/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderId,
          orderLines: orderLines.filter(line => line.item_id && line.qty > 0),
          totalAmount
        })
      })
      
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Failed to update order')
      
      setMsg({ type: 'success', text: 'Order updated successfully' })
      setTimeout(() => router.push('/rep/pending'), 1500)
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-8">Loading order...</div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-8 text-red-600">Order not found</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Edit Order #{order.order_id}</h1>
        <button 
          onClick={() => router.push('/rep/pending')}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Back to Pending
        </button>
      </div>

      {msg && (
        <div className={`mb-4 p-3 rounded ${msg.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {msg.text}
        </div>
      )}

      {/* Order Details Card */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Member</label>
            <div className="p-3 bg-gray-50 rounded-lg font-medium">{order.member_name_snapshot}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Option</label>
            <div className="p-3 bg-gray-50 rounded-lg">{order.payment_option}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Order Status</label>
            <div className="p-3 bg-blue-50 text-blue-800 rounded-lg font-medium">{order.status || 'Pending'}</div>
          </div>
        </div>
      </div>

      {/* Order Items Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 border-b bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900">Order Items</h3>
          <p className="text-sm text-gray-600 mt-1">Manage items in this order</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-4 font-medium text-gray-700">Item</th>
                <th className="text-center p-4 font-medium text-gray-700">Quantity</th>
                <th className="text-right p-4 font-medium text-gray-700">Unit Price</th>
                <th className="text-right p-4 font-medium text-gray-700">Amount</th>
                <th className="text-center p-4 font-medium text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {orderLines.map((line, index) => {
                const selectedItem = items.find(item => item.id === line.item_id)
                // Use line.id if available (existing lines), otherwise use index with item_id for uniqueness
                const uniqueKey = line.id ? `line-${line.id}` : `new-${index}-${line.item_id || 'empty'}`
                return (
                  <tr key={uniqueKey} className="hover:bg-gray-50">
                    <td className="p-4">
                      <select
                        value={line.item_id || ''}
                        onChange={(e) => {
                          const item = items.find(i => i.id === e.target.value)
                          updateOrderLine(index, 'item_id', e.target.value)
                          if (item) {
                            updateOrderLine(index, 'unit_price', item.price)
                          }
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select item...</option>
                        {items.map(item => (
                          <option key={item.id} value={item.id}>
                            {item.sku} - {item.name} (₦{Number(item.price).toLocaleString()})
                          </option>
                        ))}
                      </select>
                      {selectedItem && (
                        <div className="text-xs text-gray-500 mt-1">
                          SKU: {selectedItem.sku} | Unit: {selectedItem.unit}
                        </div>
                      )}
                    </td>
                    
                    <td className="p-4 text-center">
                      <input
                        type="number"
                        value={line.qty || ''}
                        onChange={(e) => updateOrderLine(index, 'qty', Number(e.target.value))}
                        className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        min="1"
                      />
                    </td>
                    
                    <td className="p-4 text-right">
                      <input
                        type="number"
                        value={line.unit_price || ''}
                        onChange={(e) => updateOrderLine(index, 'unit_price', Number(e.target.value))}
                        className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        min="0"
                        step="0.01"
                      />
                    </td>
                    
                    <td className="p-4 text-right font-semibold text-gray-900">
                      ₦{Number(line.amount || 0).toLocaleString()}
                    </td>
                    
                    <td className="p-4 text-center">
                      <button
                        onClick={() => removeOrderLine(index)}
                        className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200 text-sm font-medium"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        
        {/* Add Item and Total Section */}
        <div className="p-6 border-t bg-gray-50">
          <div className="flex justify-between items-center">
            <button
              onClick={addOrderLine}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Item
            </button>
            
            <div className="text-right">
              <div className="text-sm text-gray-600">Order Total</div>
              <div className="text-2xl font-bold text-gray-900">
                ₦{orderLines.reduce((sum, line) => sum + (line.amount || 0), 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex gap-4 justify-end">
        <button
          onClick={() => router.push('/rep/pending')}
          className="px-8 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200 font-medium"
        >
          Cancel
        </button>
        <button
          onClick={saveOrder}
          disabled={saving || orderLines.length === 0}
          className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 font-medium flex items-center gap-2"
        >
          {saving ? (
            <>
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default function RepEditOrderPage() {
  return (
    <ProtectedRoute allowedRoles={['rep']}>
      <RepEditOrderPageContent />
    </ProtectedRoute>
  )
}