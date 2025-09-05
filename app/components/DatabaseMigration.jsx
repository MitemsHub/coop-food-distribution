'use client'

import { useState } from 'react'

export default function DatabaseMigration() {
  const [migrationStatus, setMigrationStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  const runMigration = async () => {
    setLoading(true)
    setMigrationStatus(null)

    try {
      const response = await fetch('/api/admin/migrate-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const result = await response.json()

      if (result.success) {
        setMigrationStatus({
          type: 'success',
          message: result.message
        })
      } else if (result.requiresManualMigration) {
        setMigrationStatus({
          type: 'manual',
          message: result.message,
          instructions: result.instructions
        })
      } else {
        setMigrationStatus({
          type: 'error',
          message: result.error || 'Migration failed'
        })
      }
    } catch (error) {
      setMigrationStatus({
        type: 'error',
        message: 'Network error: ' + error.message
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
      <h3 className="text-lg font-medium text-purple-900 mb-2">🔧 Database Migration</h3>
      <p className="text-sm text-purple-700 mb-4">
        Run this once to add image support to your database. This adds an image_url column to the items table.
      </p>

      {migrationStatus && (
        <div className={`p-3 rounded-lg mb-4 text-sm ${
          migrationStatus.type === 'success' 
            ? 'bg-green-50 text-green-700 border border-green-200'
            : migrationStatus.type === 'manual'
            ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          <div className="font-medium mb-2">{migrationStatus.message}</div>
          {migrationStatus.instructions && (
            <div className="space-y-2">
              {migrationStatus.instructions.map((instruction, index) => (
                <div key={index} className={index === 0 ? 'font-medium' : 'font-mono text-xs bg-gray-100 p-2 rounded'}>
                  {instruction}
                </div>
              ))}
              <div className="mt-3 p-2 bg-blue-50 rounded text-blue-700">
                <strong>How to run manual migration:</strong>
                <ol className="list-decimal list-inside mt-1 space-y-1 text-xs">
                  <li>Go to your Supabase dashboard</li>
                  <li>Navigate to SQL Editor</li>
                  <li>Copy and paste the SQL commands above</li>
                  <li>Click "Run" to execute</li>
                  <li>Refresh this page and try the migration again</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      )}

      <button
        onClick={runMigration}
        disabled={loading}
        className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 text-sm"
      >
        {loading ? (
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Running Migration...
          </div>
        ) : (
          'Run Database Migration'
        )}
      </button>

      <div className="mt-3 text-xs text-purple-600">
        <strong>Note:</strong> This is safe to run multiple times. If the column already exists, it will be skipped.
      </div>
    </div>
  )
}