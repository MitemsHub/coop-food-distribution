'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import ImageUpload from './ImageUpload'

export default function ItemManagement() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState(null)
  const [showImageUpload, setShowImageUpload] = useState(false)
  const [message, setMessage] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('name')

      if (error) throw error
      setItems(data || [])
    } catch (error) {
      console.error('Error fetching items:', error)
      setMessage({ type: 'error', text: 'Failed to load items' })
    } finally {
      setLoading(false)
    }
  }

  const updateItemImage = async (itemId, imageUrl) => {
    try {
      const { error } = await supabase
        .from('items')
        .update({ image_url: imageUrl })
        .eq('item_id', itemId)

      if (error) throw error

      // Refresh data from database to ensure consistency
      await fetchItems()
      
      // Force component refresh
      setRefreshKey(prev => prev + 1)

      setMessage({ type: 'success', text: 'Image updated successfully' })
      setShowImageUpload(false)
      setSelectedItem(null)
    } catch (error) {
      console.error('Error updating item image:', error)
      setMessage({ type: 'error', text: 'Failed to update image' })
    }
  }

  const handleImageUploaded = (imageUrl) => {
    if (selectedItem) {
      updateItemImage(selectedItem.item_id, imageUrl)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Pagination logic
  const totalPages = Math.ceil(items.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentItems = items.slice(startIndex, endIndex)

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Item Image Management</h2>
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              fetchItems()
              setRefreshKey(prev => prev + 1)
              setMessage({ type: 'success', text: 'Data refreshed' })
            }}
            className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
          >
            Refresh
          </button>
          <div className="text-sm text-gray-600">
            {items.length} items total • Page {currentPage} of {totalPages} • Showing {currentItems.length} items
          </div>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Items Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
        {currentItems.map(item => (
          <div key={item.item_id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            {/* Item Image */}
            <div className="mb-3">
              <div className="w-full h-32 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                {item.image_url ? (
                  <img
                    src={`${item.image_url}?t=${Date.now()}&r=${refreshKey}`}
                    alt={item.name}
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      e.target.src = '/images/items/placeholder.svg'
                    }}
                  />
                ) : (
                  <img
                    src="/images/items/placeholder.svg"
                    alt="No image"
                    className="max-w-full max-h-full object-contain opacity-50"
                  />
                )}
              </div>
            </div>

            {/* Item Info */}
            <div className="space-y-2">
              <h3 className="font-medium text-gray-900 text-sm leading-tight">
                {item.name}
              </h3>
              <div className="text-xs text-gray-500">
                SKU: {item.sku}
              </div>
              <div className="text-xs text-gray-500">
                {item.unit} • {item.category}
              </div>
              
              {/* Upload Button */}
              <button
                onClick={() => {
                  setSelectedItem(item)
                  setShowImageUpload(true)
                }}
                className="w-full mt-2 px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
              >
                {item.image_url ? 'Change Image' : 'Add Image'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 text-gray-700 rounded-lg transition-colors text-sm"
          >
            Previous
          </button>
          
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => goToPage(page)}
                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                  currentPage === page
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {page}
              </button>
            ))}
          </div>
          
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 text-gray-700 rounded-lg transition-colors text-sm"
          >
            Next
          </button>
        </div>
      )}

      {items.length === 0 && (
        <div className="text-center py-8">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p className="text-gray-500">No items found</p>
        </div>
      )}

      {/* Image Upload Modal */}
      {showImageUpload && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                Upload Image for {selectedItem.name}
              </h3>
              <button
                onClick={() => {
                  setShowImageUpload(false)
                  setSelectedItem(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="mb-4">
              <div className="text-sm text-gray-600 mb-2">
                SKU: {selectedItem.sku}
              </div>
            </div>

            <ImageUpload
              onImageUploaded={handleImageUploaded}
              currentImageUrl={selectedItem.image_url}
              itemSku={selectedItem.sku}
            />
          </div>
        </div>
      )}
    </div>
  )
}