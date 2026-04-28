'use client'

import { useEffect, useMemo, useState } from 'react'
import ProtectedRoute from '../../../components/ProtectedRoute'
import DraggableModal from '../../../components/DraggableModal'

function safeJsonFactory() {
  return async (res, label) => {
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) return await res.json()
    const text = await res.text()
    throw new Error(`Non-JSON response from ${label} (${res.status}): ${text.slice(0, 300)}`)
  }
}

function emptyForm() {
  return { delivery_location: '', name: '', phone: '', address: '', rep_code: '', is_active: true, sort_order: '' }
}

function RamDataContent() {
  const [locations, setLocations] = useState([])
  const [form, setForm] = useState(emptyForm())
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null)
  const [shoppingOpen, setShoppingOpen] = useState(true)
  const [shoppingLoading, setShoppingLoading] = useState(false)
  const [shoppingMsg, setShoppingMsg] = useState('')
  const safeJson = useMemo(() => safeJsonFactory(), [])

  const [cycles, setCycles] = useState([])
  const [loadingCycles, setLoadingCycles] = useState(false)
  const [activeCycleId, setActiveCycleId] = useState(null)
  const [selectedCycleId, setSelectedCycleId] = useState(null)

  const [newCycleCode, setNewCycleCode] = useState('')
  const [newCycleName, setNewCycleName] = useState('')
  const [newCycleStartsAt, setNewCycleStartsAt] = useState('')
  const [newCycleEndsAt, setNewCycleEndsAt] = useState('')
  const [newCycleMakeActive, setNewCycleMakeActive] = useState(true)
  const [creatingCycle, setCreatingCycle] = useState(false)
  const [activatingCycle, setActivatingCycle] = useState(false)

  const loadCycles = async () => {
    try {
      setLoadingCycles(true)
      const res = await fetch('/api/admin/ram/cycles', { cache: 'no-store', credentials: 'same-origin' })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Failed to load cycles')
      setCycles(json.cycles || [])
      setActiveCycleId(json.active_cycle_id ?? null)
      setSelectedCycleId(prev => {
        if (prev != null) return prev
        if (json.active_cycle_id != null) return json.active_cycle_id
        if ((json.cycles || []).length > 0) return json.cycles[0].id
        return null
      })
    } catch (e) {
      setMsg({ type: 'error', text: e?.message || 'Failed to load cycles' })
    } finally {
      setLoadingCycles(false)
    }
  }

  const fetchLocations = async () => {
    setLoading(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/ram/delivery-locations', { cache: 'no-store' })
      const json = await safeJson(res, '/api/admin/ram/delivery-locations')
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to load')
      setLocations(json.locations || [])
    } catch (e) {
      setLocations([])
      setMsg({ type: 'error', text: e?.message || 'Failed to load' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCycles()
    fetchLocations()
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setShoppingLoading(true)
        setShoppingMsg('')
        const res = await fetch('/api/admin/system/ram-shopping', { cache: 'no-store', credentials: 'same-origin' })
        const json = await res.json()
        if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to load status')
        if (!cancelled) setShoppingOpen(!!json.open)
      } catch (e) {
        if (!cancelled) setShoppingMsg(`Error: ${e?.message || 'Failed to load status'}`)
      } finally {
        if (!cancelled) setShoppingLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const saveShoppingStatus = async () => {
    try {
      setShoppingLoading(true)
      setShoppingMsg('')
      const res = await fetch('/api/admin/system/ram-shopping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ open: shoppingOpen }),
      })
      const json = await res.json()
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to save')
      setShoppingMsg('Ram shopping status saved successfully')
    } catch (e) {
      setShoppingMsg(`Error: ${e?.message || 'Failed to save'}`)
    } finally {
      setShoppingLoading(false)
    }
  }

  const createCycle = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (creatingCycle) return
    setCreatingCycle(true)
    setMsg(null)
    try {
      const payload = {
        code: newCycleCode.trim(),
        name: newCycleName.trim(),
        make_active: !!newCycleMakeActive
      }
      if (newCycleStartsAt) payload.starts_at = newCycleStartsAt
      if (newCycleEndsAt) payload.ends_at = newCycleEndsAt

      const res = await fetch('/api/admin/ram/cycles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Failed to create cycle')
      setMsg({ type: 'success', text: `Cycle created: ${json.cycle?.name || json.cycle?.code || 'New cycle'}` })
      setNewCycleCode('')
      setNewCycleName('')
      setNewCycleStartsAt('')
      setNewCycleEndsAt('')
      await loadCycles()
      if (json.active_cycle_id != null) setSelectedCycleId(json.active_cycle_id)
    } catch (e2) {
      setMsg({ type: 'error', text: e2?.message || 'Failed to create cycle' })
    } finally {
      setCreatingCycle(false)
    }
  }

  const setActiveCycle = async () => {
    if (activatingCycle) return
    if (selectedCycleId == null) return
    setActivatingCycle(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/ram/cycles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ id: selectedCycleId })
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Failed to set active cycle')
      setMsg({ type: 'success', text: 'Active cycle updated successfully' })
      await loadCycles()
    } catch (e) {
      setMsg({ type: 'error', text: e?.message || 'Failed to set active cycle' })
    } finally {
      setActivatingCycle(false)
    }
  }

  const onFormChange = (key, value) => setForm((p) => ({ ...p, [key]: value }))
  const onEditChange = (key, value) => setEditing((p) => ({ ...p, [key]: value }))

  const createLocation = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const payload = {
        delivery_location: form.delivery_location,
        name: form.name,
        phone: form.phone,
        address: form.address,
        ...(String(form.rep_code).trim() ? { rep_code: String(form.rep_code).trim().toUpperCase() } : { rep_code: null }),
        is_active: !!form.is_active,
        ...(String(form.sort_order).trim() ? { sort_order: Number(form.sort_order) } : {}),
      }
      const res = await fetch('/api/admin/ram/delivery-locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await safeJson(res, '/api/admin/ram/delivery-locations (POST)')
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to create')
      setMsg({ type: 'success', text: 'Delivery location created' })
      setForm(emptyForm())
      fetchLocations()
    } catch (e) {
      setMsg({ type: 'error', text: e?.message || 'Failed to create' })
    } finally {
      setSaving(false)
    }
  }

  const saveEdit = async () => {
    if (!editing?.id) return
    setSaving(true)
    setMsg(null)
    try {
      const payload = {
        id: editing.id,
        delivery_location: editing.delivery_location,
        name: editing.name,
        phone: editing.phone,
        address: editing.address,
        rep_code: String(editing.rep_code || '').trim() ? String(editing.rep_code || '').trim().toUpperCase() : null,
        is_active: !!editing.is_active,
        sort_order: String(editing.sort_order).trim() ? Number(editing.sort_order) : null,
      }
      const res = await fetch('/api/admin/ram/delivery-locations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await safeJson(res, '/api/admin/ram/delivery-locations (PATCH)')
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to update')
      setMsg({ type: 'success', text: 'Delivery location updated' })
      setEditing(null)
      fetchLocations()
    } catch (e) {
      setMsg({ type: 'error', text: e?.message || 'Failed to update' })
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (loc) => {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/ram/delivery-locations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ id: loc.id, is_active: !loc.is_active }),
      })
      const json = await safeJson(res, '/api/admin/ram/delivery-locations (PATCH active)')
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to update')
      fetchLocations()
    } catch (e) {
      setMsg({ type: 'error', text: e?.message || 'Failed to update' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-base sm:text-lg md:text-xl font-semibold break-words">Admin — Ram Sales — Data</h1>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm" onClick={fetchLocations}>
          Refresh
        </button>
      </div>

      {!!msg && (
        <div
          className={`mb-4 rounded-lg border p-3 text-sm ${
            msg.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="bg-white border rounded-lg p-4 mb-4">
        <div className="text-sm font-semibold mb-3">Ram Cycles</div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border rounded-lg p-3">
            <div className="text-xs text-gray-600 mb-2">Set Active Cycle</div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Cycle</label>
                <select
                  className="border rounded px-3 py-2 text-xs sm:text-sm w-full"
                  value={selectedCycleId ?? ''}
                  onChange={(e) => setSelectedCycleId(e.target.value ? Number(e.target.value) : null)}
                  disabled={loadingCycles || cycles.length === 0}
                >
                  {cycles.length === 0 ? (
                    <option value="">No cycles found</option>
                  ) : (
                    cycles.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code}){c.is_active ? ' — Active' : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <button
                type="button"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                onClick={setActiveCycle}
                disabled={activatingCycle || selectedCycleId == null || selectedCycleId === activeCycleId}
              >
                {activatingCycle ? 'Updating...' : 'Set Active'}
              </button>
            </div>
          </div>

          <div className="border rounded-lg p-3">
            <div className="text-xs text-gray-600 mb-2">Create New Cycle</div>
            <form onSubmit={createCycle} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                className="border rounded px-3 py-2 text-xs sm:text-sm"
                placeholder="Code (e.g. RAM-APR-2026)"
                value={newCycleCode}
                onChange={(e) => setNewCycleCode(e.target.value)}
                required
              />
              <input
                className="border rounded px-3 py-2 text-xs sm:text-sm"
                placeholder="Name (e.g. April 2026)"
                value={newCycleName}
                onChange={(e) => setNewCycleName(e.target.value)}
                required
              />
              <input
                type="datetime-local"
                className="border rounded px-3 py-2 text-xs sm:text-sm"
                value={newCycleStartsAt}
                onChange={(e) => setNewCycleStartsAt(e.target.value)}
              />
              <input
                type="datetime-local"
                className="border rounded px-3 py-2 text-xs sm:text-sm"
                value={newCycleEndsAt}
                onChange={(e) => setNewCycleEndsAt(e.target.value)}
              />
              <label className="flex items-center gap-2 text-xs sm:text-sm text-gray-700">
                <input type="checkbox" checked={!!newCycleMakeActive} onChange={(e) => setNewCycleMakeActive(e.target.checked)} />
                Make active
              </label>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50"
                  disabled={creatingCycle}
                >
                  {creatingCycle ? 'Creating...' : 'Create Cycle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4 mb-4">
        <div className="text-sm font-medium mb-3">Add Delivery Location</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <input
            className="border rounded px-3 py-2 text-xs sm:text-sm"
            placeholder="Delivery location code/name"
            value={form.delivery_location}
            onChange={(e) => onFormChange('delivery_location', e.target.value)}
          />
          <input className="border rounded px-3 py-2 text-xs sm:text-sm" placeholder="Contact name" value={form.name} onChange={(e) => onFormChange('name', e.target.value)} />
          <input className="border rounded px-3 py-2 text-xs sm:text-sm" placeholder="Phone" value={form.phone} onChange={(e) => onFormChange('phone', e.target.value)} />
          <input
            className="border rounded px-3 py-2 text-xs sm:text-sm"
            placeholder="Rep passcode (optional)"
            value={form.rep_code}
            onChange={(e) => onFormChange('rep_code', e.target.value)}
          />
          <input
            className="border rounded px-3 py-2 text-xs sm:text-sm sm:col-span-2"
            placeholder="Address"
            value={form.address}
            onChange={(e) => onFormChange('address', e.target.value)}
          />
          <input
            className="border rounded px-3 py-2 text-xs sm:text-sm"
            placeholder="Sort order (optional)"
            value={form.sort_order}
            onChange={(e) => onFormChange('sort_order', e.target.value)}
          />
          <label className="flex items-center gap-2 text-xs sm:text-sm text-gray-700">
            <input type="checkbox" checked={!!form.is_active} onChange={(e) => onFormChange('is_active', e.target.checked)} />
            Active
          </label>
          <div className="sm:col-span-2 lg:col-span-3">
            <button
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50"
              onClick={createLocation}
              disabled={saving || !String(form.delivery_location).trim()}
            >
              {saving ? 'Saving...' : 'Add'}
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto border rounded bg-white">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 border text-left">Delivery Location</th>
              <th className="p-2 border text-left">Contact</th>
              <th className="p-2 border text-left">Phone</th>
              <th className="p-2 border text-left">Rep Passcode</th>
              <th className="p-2 border text-left">Address</th>
              <th className="p-2 border text-right">Sort</th>
              <th className="p-2 border text-center">Active</th>
              <th className="p-2 border text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="p-3 text-gray-600" colSpan={8}>
                  Loading...
                </td>
              </tr>
            )}
            {!loading && locations.length === 0 && (
              <tr>
                <td className="p-3 text-gray-600" colSpan={8}>
                  No delivery locations.
                </td>
              </tr>
            )}
            {locations.map((l) => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="p-2 border font-medium">{l.delivery_location}</td>
                <td className="p-2 border">{l.name || ''}</td>
                <td className="p-2 border">{l.phone || ''}</td>
                <td className="p-2 border">{l.rep_code || ''}</td>
                <td className="p-2 border">{l.address || ''}</td>
                <td className="p-2 border text-right">{l.sort_order ?? ''}</td>
                <td className="p-2 border text-center">
                  <button
                    className={`px-2 py-1 rounded text-xs ${l.is_active ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-gray-50 text-gray-700 border border-gray-200'} disabled:opacity-50`}
                    onClick={() => toggleActive(l)}
                    disabled={saving}
                  >
                    {l.is_active ? 'Yes' : 'No'}
                  </button>
                </td>
                <td className="p-2 border text-right">
                  <button
                    className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
                    onClick={() => setEditing({ ...l, sort_order: l.sort_order ?? '', rep_code: l.rep_code || '' })}
                    disabled={saving}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
        <div className="text-sm font-semibold text-blue-900">Ram Shopping Control</div>
        <div className="mt-1 text-xs sm:text-sm text-blue-700">Toggle whether members can start Ram shopping from the portal.</div>
        <div className="mt-3 flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none" onClick={() => setShoppingOpen(!shoppingOpen)}>
            <div className={`w-12 h-6 rounded-full px-1 flex items-center ${shoppingOpen ? 'bg-green-500 justify-end' : 'bg-gray-300 justify-start'}`}>
              <div className="w-4 h-4 bg-white rounded-full shadow" />
            </div>
            <span className={`text-sm font-medium ${shoppingOpen ? 'text-green-700' : 'text-gray-600'}`}>{shoppingOpen ? 'Open' : 'Closed'}</span>
          </label>
          <input type="checkbox" checked={shoppingOpen} onChange={(e) => setShoppingOpen(e.target.checked)} className="hidden" />
          <button
            type="button"
            onClick={saveShoppingStatus}
            disabled={shoppingLoading}
            className={`px-3 py-2 rounded text-white text-sm ${shoppingLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {shoppingLoading ? 'Saving…' : 'Save'}
          </button>
        </div>
        {shoppingMsg && (
          <div
            className={`mt-2 p-2 rounded text-sm ${
              shoppingMsg.startsWith('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
            }`}
          >
            {shoppingMsg}
          </div>
        )}
      </div>

      <DraggableModal
        open={!!editing}
        onClose={() => (saving ? null : setEditing(null))}
        title="Edit Delivery Location"
        footer={
          <div className="flex gap-2 justify-end">
            <button type="button" className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 text-sm" onClick={() => setEditing(null)} disabled={saving}>
              Close
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 text-white text-sm disabled:opacity-50"
              onClick={saveEdit}
              disabled={saving || !String(editing?.delivery_location || '').trim()}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            className="border rounded px-3 py-2 text-xs sm:text-sm"
            placeholder="Delivery location code/name"
            value={editing?.delivery_location || ''}
            onChange={(e) => onEditChange('delivery_location', e.target.value)}
          />
          <input className="border rounded px-3 py-2 text-xs sm:text-sm" placeholder="Contact name" value={editing?.name || ''} onChange={(e) => onEditChange('name', e.target.value)} />
          <input className="border rounded px-3 py-2 text-xs sm:text-sm" placeholder="Phone" value={editing?.phone || ''} onChange={(e) => onEditChange('phone', e.target.value)} />
          <input
            className="border rounded px-3 py-2 text-xs sm:text-sm"
            placeholder="Rep passcode"
            value={editing?.rep_code || ''}
            onChange={(e) => onEditChange('rep_code', e.target.value)}
          />
          <input className="border rounded px-3 py-2 text-xs sm:text-sm" placeholder="Sort order" value={editing?.sort_order ?? ''} onChange={(e) => onEditChange('sort_order', e.target.value)} />
          <input
            className="border rounded px-3 py-2 text-xs sm:text-sm sm:col-span-2"
            placeholder="Address"
            value={editing?.address || ''}
            onChange={(e) => onEditChange('address', e.target.value)}
          />
          <label className="flex items-center gap-2 text-xs sm:text-sm text-gray-700">
            <input type="checkbox" checked={!!editing?.is_active} onChange={(e) => onEditChange('is_active', e.target.checked)} />
            Active
          </label>
        </div>
      </DraggableModal>
    </div>
  )
}

export default function RamDataPage() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <RamDataContent />
    </ProtectedRoute>
  )
}
