'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '../../components/ProtectedRoute'
import ItemManagement from '../../components/ItemManagement'
import DatabaseMigration from '../../components/DatabaseMigration'

function DataManagementPageContent() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [confirmClearAll, setConfirmClearAll] = useState('')
  const [confirmClearDelivered, setConfirmClearDelivered] = useState('')
  const [confirmResetInventory, setConfirmResetInventory] = useState('')
  const [processingAction, setProcessingAction] = useState(null)
  const router = useRouter()

  const clearAllOrders = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Prevent simultaneous operations
    if (loading || processingAction) {
      return
    }
    
    if (confirmClearAll !== 'CLEAR ALL DATA') {
      setMessage('Please type "CLEAR ALL DATA" to confirm')
      return
    }

    setLoading(true)
    setProcessingAction('clearAll')
    setMessage('Clearing all orders...')

    try {
      const response = await fetch('/api/admin/data-management/clear-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      const result = await response.json()
      
      if (result.ok) {
        setMessage(`Successfully cleared ${result.deletedCount} orders`)
        setConfirmClearAll('')
      } else {
        setMessage(`Error: ${result.error}`)
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`)
    }

    setLoading(false)
    setProcessingAction(null)
  }

  const clearDeliveredOrders = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Prevent simultaneous operations
    if (loading || processingAction) {
      return
    }
    
    if (confirmClearDelivered !== 'CLEAR DELIVERED') {
      setMessage('Please type "CLEAR DELIVERED" to confirm')
      return
    }

    setLoading(true)
    setProcessingAction('clearDelivered')
    setMessage('Clearing delivered orders...')

    try {
      const response = await fetch('/api/admin/data-management/clear-delivered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      const result = await response.json()
      
      if (result.ok) {
        setMessage(`Successfully cleared ${result.deletedCount} delivered orders`)
        setConfirmClearDelivered('')
      } else {
        setMessage(`Error: ${result.error}`)
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`)
    }

    setLoading(false)
    setProcessingAction(null)
  }

  const resetInventory = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Prevent simultaneous operations
    if (loading || processingAction) {
      return
    }
    
    if (confirmResetInventory !== 'RESET INVENTORY') {
      setMessage('Please type "RESET INVENTORY" to confirm')
      return
    }

    setLoading(true)
    setProcessingAction('resetInventory')
    setMessage('Resetting inventory quantities...')

    try {
      const response = await fetch('/api/admin/data-management/reset-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      const result = await response.json()
      
      if (result.ok) {
        setMessage(`Successfully reset ${result.updatedCount} inventory items`)
        setConfirmResetInventory('')
      } else {
        setMessage(`Error: ${result.error}`)
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`)
    }

    setLoading(false)
    setProcessingAction(null)
  }

  const exportBackup = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Prevent simultaneous operations
    if (loading || processingAction) {
      return
    }
    
    setLoading(true)
    setProcessingAction('exportBackup')
    setMessage('Creating backup...')

    try {
      const response = await fetch('/api/admin/data-management/export-backup')
      
      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `coop-backup-${new Date().toISOString().split('T')[0]}.xlsx`
        a.click()
        URL.revokeObjectURL(url)
        setMessage('Backup exported successfully as Excel file with multiple sheets')
      } else {
        const result = await response.json()
        setMessage(`Error: ${result.error}`)
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`)
    }

    setLoading(false)
    setProcessingAction(null)
  }

  // Shopping toggle state
  const [shoppingOpen, setShoppingOpen] = useState(true)
  const [shoppingLoading, setShoppingLoading] = useState(false)
  const [shoppingMsg, setShoppingMsg] = useState('')

  // Load current shopping status
  const loadShoppingStatus = async () => {
    try {
      setShoppingLoading(true)
      setShoppingMsg('')
      const res = await fetch('/api/admin/system/shopping', { cache: 'no-store', credentials: 'same-origin' })
      if (res.status === 401) {
        setShoppingMsg('Error: Unauthorized. Please log in via Admin PIN.')
        return
      }
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Failed to load status')
      setShoppingOpen(!!json.open)
    } catch (e) {
      setShoppingMsg(`Error: ${e.message}`)
    } finally {
      setShoppingLoading(false)
    }
  }

  // Save shopping status
  const saveShoppingStatus = async () => {
    try {
      setShoppingLoading(true)
      setShoppingMsg('')
      const res = await fetch('/api/admin/system/shopping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ open: shoppingOpen })
      })
      if (res.status === 401) {
        setShoppingMsg('Error: Unauthorized. Please log in via Admin PIN.')
        return
      }
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Failed to save')
      setShoppingMsg('Shopping status saved successfully')
    } catch (e) {
      setShoppingMsg(`Error: ${e.message}`)
    } finally {
      setShoppingLoading(false)
    }
  }

  // Initial load (moved to useEffect)
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        setShoppingLoading(true)
        setShoppingMsg('')
        const res = await fetch('/api/admin/system/shopping', { cache: 'no-store', credentials: 'same-origin' })
        const json = await res.json()
        if (!res.ok || !json.ok) throw new Error(json.error || 'Failed to load status')
        if (!cancelled) setShoppingOpen(!!json.open)
      } catch (e) {
        if (!cancelled) setShoppingMsg(`Error: ${e.message}`)
      } finally {
        if (!cancelled) setShoppingLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-2 sm:flex sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-2">
        <h1 className="text-lg sm:text-2xl font-semibold col-span-1">Admin — Data Management</h1>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 rounded-lg border border-gray-300 transition-colors duration-200 justify-self-end col-span-1 text-sm sm:text-base"
        >
          ← Back
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded mb-6 ${
          message.includes('Error') 
            ? 'bg-red-50 text-red-700 border border-red-200' 
            : 'bg-green-50 text-green-700 border border-green-200'
        }`}>
          {message}
        </div>
      )}

      <div className="grid gap-2 lg:gap-3 xl:gap-4">
        {/* Database Migration */}
        <DatabaseMigration />

        {/* Shopping Control */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 lg:p-3 xl:p-4">
          <h2 className="text-base sm:text-lg font-medium text-blue-900 mb-2 sm:mb-3">🛍️ Shopping Control</h2>
          <p className="text-sm sm:text-base text-blue-700 mb-2 sm:mb-3">
            Toggle whether members can start shopping from the portal.
          </p>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none" onClick={() => setShoppingOpen(!shoppingOpen)}>
              <div className={`w-12 h-6 rounded-full px-1 flex items-center ${shoppingOpen ? 'bg-green-500 justify-end' : 'bg-gray-300 justify-start'}`}>
                <div className="w-4 h-4 bg-white rounded-full shadow" />
              </div>
              <span className={`text-sm font-medium ${shoppingOpen ? 'text-green-700' : 'text-gray-600'}`}>
                {shoppingOpen ? 'Open' : 'Closed'}
              </span>
            </label>
            <input
              type="checkbox"
              checked={shoppingOpen}
              onChange={(e) => setShoppingOpen(e.target.checked)}
              className="hidden"
            />
            <button
              onClick={saveShoppingStatus}
              disabled={shoppingLoading}
              className={`px-3 py-2 rounded text-white text-sm ${shoppingLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {shoppingLoading ? 'Saving…' : 'Save'}
            </button>
          </div>
          {shoppingMsg && (
            <div className={`mt-2 p-2 rounded text-sm ${shoppingMsg.startsWith('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>{shoppingMsg}</div>
          )}
        </div>

        {/* Item Image Management */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-2 lg:p-3 xl:p-4">
          <h2 className="text-base sm:text-lg font-medium text-green-900 mb-2 sm:mb-3">🖼️ Item Image Management</h2>
          <p className="text-sm sm:text-base text-green-700 mb-3 sm:mb-4">
            Upload and manage images for inventory items to improve the shopping experience.
          </p>
          <ItemManagement />
        </div>

        {/* Backup Data */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 lg:p-3 xl:p-4">
          <h2 className="text-base sm:text-lg font-medium text-blue-900 mb-2 sm:mb-3">💾 Backup Data</h2>
          <p className="text-sm sm:text-base text-blue-700 mb-3 sm:mb-4">
            Export all current data (orders, members, inventory) as an Excel file with separate sheets for each data type.
          </p>
          <button
              type="button"
              onClick={exportBackup}
              disabled={processingAction !== null}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white text-sm sm:text-base rounded hover:bg-blue-700 disabled:opacity-50"
            >
            {processingAction === 'exportBackup' ? 'Exporting...' : 'Export Backup'}
          </button>
        </div>

        {/* Clear Delivered Orders */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 lg:p-3 xl:p-4">
          <h2 className="text-base sm:text-lg font-medium text-yellow-900 mb-2 sm:mb-3">🗑️ Clear Delivered Orders</h2>
          <p className="text-sm sm:text-base text-yellow-700 mb-3 sm:mb-4">
            Remove all delivered orders to clean up the system. This is useful at the end of each year.
          </p>
          <div className="space-y-3">
            <input
              type="text"
              placeholder='Type "CLEAR DELIVERED" to confirm'
              value={confirmClearDelivered}
              onChange={(e) => setConfirmClearDelivered(e.target.value)}
              className="w-full px-3 py-2 text-sm sm:text-base border rounded"
            />
            <button
              type="button"
              onClick={clearDeliveredOrders}
              disabled={processingAction !== null || confirmClearDelivered !== 'CLEAR DELIVERED'}
              className="w-full sm:w-auto px-4 py-2 bg-yellow-600 text-white text-sm sm:text-base rounded hover:bg-yellow-700 disabled:opacity-50"
            >
              {processingAction === 'clearDelivered' ? 'Clearing...' : 'Clear Delivered Orders'}
            </button>
          </div>
        </div>

        {/* Reset Inventory */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 lg:p-3 xl:p-4">
          <h2 className="text-base sm:text-lg font-medium text-orange-900 mb-2 sm:mb-3">🔄 Reset Inventory</h2>
          <p className="text-sm sm:text-base text-orange-700 mb-3 sm:mb-4">
            Reset all inventory quantities to zero. Use this to start fresh for a new year.
          </p>
          <div className="space-y-3">
            <input
              type="text"
              placeholder='Type "RESET INVENTORY" to confirm'
              value={confirmResetInventory}
              onChange={(e) => setConfirmResetInventory(e.target.value)}
              className="w-full px-3 py-2 text-sm sm:text-base border rounded"
            />
            <button
              type="button"
              onClick={resetInventory}
              disabled={processingAction !== null || confirmResetInventory !== 'RESET INVENTORY'}
              className="w-full sm:w-auto px-4 py-2 bg-orange-600 text-white text-sm sm:text-base rounded hover:bg-orange-700 disabled:opacity-50"
            >
              {processingAction === 'resetInventory' ? 'Resetting...' : 'Reset Inventory'}
            </button>
          </div>
        </div>

        {/* Clear All Orders */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-2 lg:p-3 xl:p-4">
          <h2 className="text-base sm:text-lg font-medium text-red-900 mb-2 sm:mb-3">⚠️ Clear All Orders</h2>
          <p className="text-sm sm:text-base text-red-700 mb-3 sm:mb-4">
            <strong>DANGER:</strong> This will permanently delete ALL orders (pending, posted, and delivered). 
            Use this to completely reset the system for a new year.
          </p>
          <div className="space-y-3">
            <input
              type="text"
              placeholder='Type "CLEAR ALL DATA" to confirm'
              value={confirmClearAll}
              onChange={(e) => setConfirmClearAll(e.target.value)}
              className="w-full px-3 py-2 text-sm sm:text-base border rounded"
            />
            <button
              type="button"
              onClick={clearAllOrders}
              disabled={processingAction !== null || confirmClearAll !== 'CLEAR ALL DATA'}
              className="w-full sm:w-auto px-4 py-2 bg-red-600 text-white text-sm sm:text-base rounded hover:bg-red-700 disabled:opacity-50"
            >
              {processingAction === 'clearAll' ? 'Clearing...' : 'Clear All Orders'}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 sm:mt-8 p-3 sm:p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm sm:text-base font-medium text-gray-900 mb-2">💡 Recommended Workflow for New Year:</h3>
        <ol className="list-decimal list-inside space-y-1 text-xs sm:text-sm text-gray-700">
          <li>Export a backup of all current data</li>
          <li>Clear delivered orders to remove test/old data</li>
          <li>Reset inventory quantities to start fresh</li>
          <li>Import new member data and pricing if needed</li>
          <li>Update any system settings for the new year</li>
        </ol>
      </div>
    </div>
  )
}

export default function DataManagementPage() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <DataManagementPageContent />
    </ProtectedRoute>
  )
}