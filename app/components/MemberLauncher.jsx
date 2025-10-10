// app/components/MemberLauncher.jsx
'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useRouter } from 'next/navigation'
import PinSetup from './PinSetup'

export default function MemberLauncher() {
  const { login } = useAuth()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [memberId, setMemberId] = useState('')
  const [pin, setPin] = useState('')
  const [validation, setValidation] = useState({ isValid: false, message: '', suggestion: '' })
  const [isCheckingDatabase, setIsCheckingDatabase] = useState(false)
  const [memberExists, setMemberExists] = useState(null) // null = not checked, true = exists, false = doesn't exist
  const [pinStatus, setPinStatus] = useState(null) // null = not checked, true = has PIN, false = no PIN
  const [currentStep, setCurrentStep] = useState('member_id') // 'member_id', 'pin_setup'
  const [pinError, setPinError] = useState('')
  
  // Database validation function with PIN status check
  const checkMemberAndPinStatus = async (memberId) => {
    if (!memberId || memberId.trim().length < 6) return
    
    setIsCheckingDatabase(true)
    try {
      const response = await fetch('/api/members/check-pin-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ memberId: memberId.trim().toUpperCase() })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setMemberExists(data.exists)
        setPinStatus(data.hasPin)
      } else {
        setMemberExists(false)
        setPinStatus(null)
      }
    } catch (error) {
      console.error('Error checking member:', error)
      setMemberExists(false)
      setPinStatus(null)
    } finally {
      setIsCheckingDatabase(false)
    }
  }

  // Enhanced validation function
  const validateMemberId = (id) => {
    if (!id || id.length === 0) {
      return { isValid: false, message: '', suggestion: '' }
    }

    const trimmedId = id.trim().toUpperCase()
    
    // Check for valid category letters
    const validCategories = ['A', 'R', 'P', 'E']
    const firstChar = trimmedId.charAt(0)
    
    if (!validCategories.includes(firstChar)) {
      if (/^\d/.test(trimmedId)) {
        // Starts with number, suggest adding A
        return {
          isValid: false,
          message: 'Missing category letter',
          suggestion: `A${trimmedId}`
        }
      } else if (/^[B-Z]/.test(firstChar) && firstChar !== 'A' && firstChar !== 'R' && firstChar !== 'P' && firstChar !== 'E') {
        // Invalid letter, suggest A instead
        return {
          isValid: false,
          message: 'Invalid category letter',
          suggestion: `A${trimmedId.slice(1)}`
        }
      } else {
        return {
          isValid: false,
          message: 'Invalid format. Use: A12345, R12345, P12345, or E12345',
          suggestion: ''
        }
      }
    }

    // Check minimum length - require at least 6 characters total (1 letter + 5 digits)
    if (trimmedId.length < 6) {
      return {
        isValid: false,
        message: 'ID too short. Need exactly 5 digits after category letter (e.g., A12345)',
        suggestion: ''
      }
    }

    // Check for valid characters (alphanumeric only)
    if (!/^[A-Z0-9]+$/.test(trimmedId)) {
      return {
        isValid: false,
        message: 'Invalid characters. Use letters and numbers only',
        suggestion: ''
      }
    }

    // Check that after the category letter, we have numbers
    const numberPart = trimmedId.slice(1)
    if (!/^\d+$/.test(numberPart)) {
      return {
        isValid: false,
        message: 'Numbers must follow the category letter',
        suggestion: ''
      }
    }

    // Check exact number of digits (exactly 5)
    if (numberPart.length !== 5) {
      return {
        isValid: false,
        message: 'Need exactly 5 digits after category letter (e.g., A12345)',
        suggestion: ''
      }
    }

    return {
      isValid: true,
      message: 'Valid member ID format',
      suggestion: ''
    }
  }
  
  // Handle input changes with validation and database check
  const handleInputChange = (e) => {
    const value = e.target.value.toUpperCase()
    setMemberId(value)
    
    // Reset states when input changes
    setMemberExists(null)
    setPinStatus(null)
    setCurrentStep('member_id')
    setPin('')
    setPinError('')
    
    const validationResult = validateMemberId(value)
    setValidation(validationResult)
    
    // If format is valid, check database after a short delay
    if (validationResult.isValid) {
      setTimeout(() => {
        checkMemberAndPinStatus(value)
      }, 500) // 500ms delay to avoid too many API calls
    }
  }
  
  // Auto-apply suggestion when user clicks on it
  const applySuggestion = () => {
    if (validation.suggestion && validation.suggestion.includes('A')) {
      const suggested = validation.suggestion.match(/A\d+/)?.[0]
      if (suggested) {
        setMemberId(suggested)
        setValidation(validateMemberId(suggested))
      }
    }
  }
  
  const submit = async (e) => {
    e.preventDefault()
    const mid = memberId.trim().toUpperCase()
    if (!mid || !validation.isValid || memberExists !== true) return
    
    // If member doesn't have PIN, offer PIN setup
    if (pinStatus === false && currentStep === 'member_id') {
      setCurrentStep('pin_setup')
      return
    }
    
    // If member has PIN, verify it before proceeding
    if (pinStatus === true && currentStep === 'member_id') {
      if (!pin.trim()) {
        setPinError('PIN is required')
        return
      }
      
      // Verify PIN
      setIsLoading(true)
      setPinError('')
      
      try {
        const response = await fetch('/api/members/verify-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId: mid, pin: pin.trim() })
        })

        const data = await response.json()

        if (response.ok && data.success) {
          // PIN verified, proceed to shop
          proceedToShop(mid)
        } else {
          setPinError(data.error || 'Incorrect PIN')
          setIsLoading(false)
        }
      } catch (error) {
        console.error('Error verifying PIN:', error)
        setPinError('Network error. Please try again.')
        setIsLoading(false)
      }
      return
    }
    
    // If we're here, either no PIN required or PIN was verified, proceed to shop
    proceedToShop(mid)
  }

  const proceedToShop = async (mid) => {
    setIsLoading(true)
    
    try {
      // Set user as authenticated member
      login({
        type: 'member',
        id: mid,
        authenticated: true
      })
      
      // Add a small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 500))
      
      router.push(`/shop?mid=${encodeURIComponent(mid)}`)
    } catch (error) {
      console.error('Navigation error:', error)
      setIsLoading(false)
    }
  }

  const handlePinSet = () => {
    setPinStatus(true)
    setCurrentStep('member_id')
  }

  const handleSkipPin = () => {
    proceedToShop(memberId.trim().toUpperCase())
  }

  const handleBackToMemberId = () => {
    setCurrentStep('member_id')
  }

  return (
    <div className="space-y-3 md:space-y-4">
      {currentStep === 'member_id' && (
        <form className="space-y-3 md:space-y-4" onSubmit={submit}>
          <div className="relative">
            <input
              value={memberId}
              onChange={handleInputChange}
              disabled={isLoading}
              className={`w-full px-3 py-2 md:px-4 md:py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-200 transition-all duration-200 outline-none text-sm md:text-base text-gray-700 placeholder-gray-400 disabled:bg-gray-50 disabled:cursor-not-allowed ${
                !memberId ? 'border-gray-200 focus:border-blue-500' :
                validation.isValid ? 'border-green-500 focus:border-green-500' :
                'border-red-500 focus:border-red-500'
              }`}
              placeholder="Enter your Member ID (e.g., A12345)"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 md:pr-3">
              {!memberId ? (
                <svg className="w-4 h-4 md:w-5 md:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              ) : validation.isValid ? (
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
          
          {/* PIN Input - Show when member has PIN */}
          {pinStatus === true && (
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={pin}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, '')
                  setPin(value)
                  setPinError('')
                }}
                disabled={isLoading}
                maxLength={5}
                className={`w-full px-3 py-2 md:px-4 md:py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-200 transition-all duration-200 outline-none text-sm md:text-base text-gray-700 placeholder-gray-400 disabled:bg-gray-50 disabled:cursor-not-allowed ${
                  !pin ? 'border-gray-200 focus:border-blue-500' :
                  pinError ? 'border-red-500 focus:border-red-500' :
                  'border-blue-500 focus:border-blue-500'
                }`}
                placeholder="Enter your PIN"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 md:pr-3">
                {!pin ? (
                  <svg className="w-4 h-4 md:w-5 md:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                ) : pinError ? (
                  <svg className="w-4 h-4 md:w-5 md:h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 md:w-5 md:h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                )}
              </div>
            </div>
          )}
          
          {/* PIN Error Message */}
          {pinError && (
            <div className="flex items-center text-red-600 text-xs md:text-sm">
              <svg className="w-3 h-3 md:w-4 md:h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {pinError}
            </div>
          )}
          
          {/* Validation feedback */}
          {memberId && (
            <div className="text-xs md:text-sm">
              {isCheckingDatabase ? (
                <div className="flex items-center text-blue-600">
                  <div className="animate-spin rounded-full h-3 w-3 md:h-4 md:w-4 border-b-2 border-blue-600 mr-1"></div>
                  Checking member ID...
                </div>
              ) : memberExists === false ? (
                <div className="flex items-center text-red-600">
                  <svg className="w-3 h-3 md:w-4 md:h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Member ID not found in database
                </div>
              ) : memberExists === true ? (
                <div className="flex items-center text-green-600">
                  <svg className="w-3 h-3 md:w-4 md:h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {pinStatus === true ? 'Member found - PIN required' : 
                   pinStatus === false ? 'Member found - Set up PIN for faster access' : 
                   'Member found - Ready to shop!'}
                </div>
              ) : !validation.isValid ? (
                <div className="space-y-1">
                  <div className="flex items-center text-red-600">
                    <svg className="w-3 h-3 md:w-4 md:h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {validation.message}
                  </div>
                  {validation.suggestion && validation.suggestion.includes('A') && (
                    <button
                      type="button"
                      onClick={applySuggestion}
                      className="text-blue-600 hover:text-blue-700 underline text-xs"
                    >
                      {validation.suggestion}
                    </button>
                  )}
                  {validation.suggestion && !validation.suggestion.includes('A') && (
                    <div className="text-gray-500 text-xs">
                      {validation.suggestion}
                    </div>
                  )}
                </div>
              ) : validation.isValid && memberExists === null ? (
                <div className="flex items-center text-blue-600">
                  <svg className="w-3 h-3 md:w-4 md:h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Valid format - Checking database...
                </div>
              ) : null}
            </div>
          )}
          
          <button 
            type="submit"
            disabled={isLoading || !validation.isValid || memberExists !== true || isCheckingDatabase || (pinStatus === true && !pin.trim())}
            className={`w-full inline-flex items-center justify-center px-4 py-2 md:px-6 md:py-3 text-white text-sm md:text-base font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl ${
              validation.isValid && !isLoading && memberExists === true && !isCheckingDatabase && (pinStatus !== true || pin.trim())
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 md:h-5 md:w-5 border-2 border-white border-t-transparent mr-2"></div>
                {pinStatus === true ? 'Verifying...' : 'Loading...'}
              </>
            ) : (
              <>
                <svg className="w-4 h-4 md:w-5 md:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m0 0h8.5" />
                </svg>
                {pinStatus === true ? 'Start Shopping' : 
                 pinStatus === false ? 'Set Up PIN' : 
                 'Start Shopping'}
              </>
            )}
          </button>
        </form>
      )}

      {currentStep === 'pin_setup' && (
        <PinSetup 
          memberId={memberId}
          onPinSet={handlePinSet}
          onCancel={handleSkipPin}
        />
      )}
    </div>
  )
}