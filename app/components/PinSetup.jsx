// app/components/PinSetup.jsx
'use client'

import { useState } from 'react'

export default function PinSetup({ memberId, onPinSet, onCancel }) {
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const validatePin = (pinValue) => {
    if (!pinValue) return { isValid: false, message: '' }
    if (pinValue.length < 4) return { isValid: false, message: 'PIN must be at least 4 characters' }
    if (pinValue.length > 5) return { isValid: false, message: 'PIN must be 5 characters or less' }
    if (!/^[0-9]+$/.test(pinValue)) return { isValid: false, message: 'PIN must contain only numbers' }
    return { isValid: true, message: 'Valid PIN format' }
  }

  const pinValidation = validatePin(pin)
  const pinsMatch = pin && confirmPin && pin === confirmPin

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!pinValidation.isValid || !pinsMatch) return

    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/members/set-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: memberId, pin })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        onPinSet()
      } else {
        setError(data.error || 'Failed to set PIN')
      }
    } catch (error) {
      console.error('Error setting PIN:', error)
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg md:text-xl font-semibold text-gray-800 mb-2">Set Up Your PIN</h3>
        <p className="text-sm md:text-base text-gray-600">
          Create a 4-5 digit PIN for quick access next time
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
        {/* PIN Input */}
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pin}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9]/g, '')
              setPin(value)
            }}
            disabled={isLoading}
            maxLength={5}
            className={`w-full px-3 py-2 md:px-4 md:py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-200 transition-all duration-200 outline-none text-sm md:text-base text-gray-700 placeholder-gray-400 disabled:bg-gray-50 disabled:cursor-not-allowed ${
              !pin ? 'border-gray-200 focus:border-blue-500' :
              pinValidation.isValid ? 'border-green-500 focus:border-green-500' :
              'border-red-500 focus:border-red-500'
            }`}
            placeholder="Enter PIN (4-5 digits)"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 md:pr-3">
            {!pin ? (
              <svg className="w-4 h-4 md:w-5 md:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            ) : pinValidation.isValid ? (
              <svg className="w-4 h-4 md:w-5 md:h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 md:w-5 md:h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
        </div>

        {/* PIN Validation Feedback */}
        {pin && !pinValidation.isValid && (
          <div className="flex items-center text-red-600 text-xs md:text-sm">
            <svg className="w-3 h-3 md:w-4 md:h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {pinValidation.message}
          </div>
        )}

        {/* Confirm PIN Input */}
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={confirmPin}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9]/g, '')
              setConfirmPin(value)
            }}
            disabled={isLoading || !pinValidation.isValid}
            maxLength={5}
            className={`w-full px-3 py-2 md:px-4 md:py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-200 transition-all duration-200 outline-none text-sm md:text-base text-gray-700 placeholder-gray-400 disabled:bg-gray-50 disabled:cursor-not-allowed ${
              !confirmPin ? 'border-gray-200 focus:border-blue-500' :
              pinsMatch ? 'border-green-500 focus:border-green-500' :
              'border-red-500 focus:border-red-500'
            }`}
            placeholder="Confirm PIN"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 md:pr-3">
            {!confirmPin ? (
              <svg className="w-4 h-4 md:w-5 md:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            ) : pinsMatch ? (
              <svg className="w-4 h-4 md:w-5 md:h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 md:w-5 md:h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
        </div>

        {/* Confirm PIN Validation Feedback */}
        {confirmPin && !pinsMatch && (
          <div className="flex items-center text-red-600 text-xs md:text-sm">
            <svg className="w-3 h-3 md:w-4 md:h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            PINs do not match
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="flex items-center text-red-600 text-xs md:text-sm">
            <svg className="w-3 h-3 md:w-4 md:h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* Action Button */}
        <button
          type="submit"
          disabled={isLoading || !pinValidation.isValid || !pinsMatch}
          className={`w-full inline-flex items-center justify-center px-4 py-2 md:px-6 md:py-3 text-white text-sm md:text-base font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl ${
            pinValidation.isValid && pinsMatch && !isLoading
              ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 md:h-5 md:w-5 border-2 border-white border-t-transparent mr-2"></div>
              Setting PIN...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 md:w-5 md:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Set PIN
            </>
          )}
        </button>
      </form>
    </div>
  )
}