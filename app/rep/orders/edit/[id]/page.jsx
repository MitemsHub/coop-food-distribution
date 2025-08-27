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

      <div className="bg-white border rounded-lg p-6">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Member</label>
            <div className="p-2 bg-gray-50 rounded">{order.member_name_snapshot}</div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Payment Option</label>
            <div className="p-2 bg-gray-50 rounded">{order.payment_option}</div>
          </div>
        </div>

        <h3 className="text-lg font-medium mb-4">Order Items</h3>
        
        <div className="space-y-3">
          {orderLines.map((line, index) => {
            const selectedItem = items.find(item => item.id === line.item_id)
            return (
              <div key={index} className="flex gap-3 items-center p-3 border rounded">
                <select
                  value={line.item_id || ''}
                  onChange={(e) => {
                    const item = items.find(i => i.id === e.target.value)
                    updateOrderLine(index, 'item_id', e.target.value)
                    if (item) {
                      updateOrderLine(index, 'unit_price', item.price)
                    }
                  }}
                  className="flex-1 border rounded px-3 py-2"
                >
                  <option value="">Select item...</option>
                  {items.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.sku} - {item.name} (₦{Number(item.price).toLocaleString()})
                    </option>
                  ))}
                </select>
                
                <input
                  type="number"
                  value={line.qty || ''}
                  onChange={(e) => updateOrderLine(index, 'qty', Number(e.target.value))}
                  placeholder="Qty"
                  className="w-20 border rounded px-3 py-2"
                  min="1"
                />
                
                <input
                  type="number"
                  value={line.unit_price || ''}
                  onChange={(e) => updateOrderLine(index, 'unit_price', Number(e.target.value))}
                  placeholder="Price"
                  className="w-24 border rounded px-3 py-2"
                  min="0"
                  step="0.01"
                />
                
                <div className="w-24 text-right font-medium">
                  ₦{Number(line.amount || 0).toLocaleString()}
                </div>
                
                <button
                  onClick={() => removeOrderLine(index)}
                  className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Remove
                </button>
              </div>
            )
          })}
        </div>

        <div className="mt-4 flex justify-between items-center">
          <button
            onClick={addOrderLine}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Add Item
          </button>
          
          <div className="text-lg font-semibold">
            Total: ₦{orderLines.reduce((sum, line) => sum + (line.amount || 0), 0).toLocaleString()}
          </div>
        </div>

        <div className="mt-6 flex gap-3 justify-end">
          <button
            onClick={() => router.push('/rep/pending')}
            className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={saveOrder}
            disabled={saving}
            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
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