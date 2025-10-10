// app/page.jsx
import Link from 'next/link'
import { ProfessionalDeliveryTruck, ProfessionalWarehouse, ProfessionalCommunitySymbol, ProfessionalFoodBasket, ProfessionalDistributionNetwork, ProfessionalCooperativeLogo } from './components/ProfessionalBackground'

export default function MemberVerification() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 via-white to-emerald-50 flex flex-col">
      <main className="flex-1 flex items-center justify-center relative overflow-hidden py-4 md:py-6">
        {/* Enhanced professional gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/5 via-transparent to-green-900/5"></div>
        <div className="absolute inset-0 bg-gradient-to-bl from-indigo-800/3 via-transparent to-emerald-800/3"></div>
      {/* Professional Welcoming Background Design - Responsive */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Strategic placement for visual hierarchy and professional composition */}
        
        {/* Top section - Corporate identity and logistics */}
        <div className="absolute top-0 left-0 w-full h-1/3">
          <ProfessionalCooperativeLogo 
            className="absolute top-4 left-4 md:top-8 md:left-12 opacity-8" 
            size={80}
          />
          <ProfessionalDeliveryTruck 
            className="absolute top-8 right-4 md:top-16 md:right-20 opacity-12" 
            size={80}
          />
          <ProfessionalDistributionNetwork 
            className="hidden md:block absolute top-24 left-1/4 opacity-15" 
            width={220}
            height={60}
          />
        </div>
        
        {/* Middle section - Community and cooperation focus */}
        <div className="absolute top-1/3 left-0 w-full h-1/3 flex items-center justify-between px-4 md:px-16">
          <ProfessionalCommunitySymbol 
            className="opacity-18" 
            size={70}
          />
          <ProfessionalFoodBasket 
            className="opacity-15" 
            size={60}
          />
        </div>
        
        {/* Bottom section - Infrastructure and distribution */}
        <div className="absolute bottom-0 left-0 w-full h-1/3">
          <ProfessionalWarehouse 
            className="absolute bottom-6 left-4 md:bottom-12 md:left-16 opacity-10" 
            size={100}
          />
          <ProfessionalDistributionNetwork 
            className="hidden md:block absolute bottom-20 right-1/4 transform rotate-12 opacity-12" 
            width={180}
            height={50}
          />
          <ProfessionalFoodBasket 
            className="absolute bottom-8 right-4 md:bottom-16 md:right-12 opacity-14" 
            size={55}
          />
        </div>
        
        {/* Subtle corner accents for professional framing - Hidden on mobile */}
        <div className="hidden lg:block absolute top-4 right-4 opacity-6">
          <ProfessionalCommunitySymbol size={60} />
        </div>
        <div className="hidden lg:block absolute bottom-4 left-4 opacity-6">
          <ProfessionalDeliveryTruck size={70} />
        </div>
        
        {/* Central connecting elements for visual flow - Hidden on mobile */}
        <div className="hidden md:block absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <ProfessionalDistributionNetwork 
            className="opacity-8 transform -rotate-45" 
            width={160}
            height={40}
          />
        </div>
      </div>
      
      <div className="w-full max-w-2xl mx-auto px-4 md:px-6 relative z-10">
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-green-600 px-6 md:px-8 py-8 md:py-12 text-center">
            <div className="mb-4">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 md:w-10 md:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h1 className="text-2xl md:text-4xl font-bold text-white mb-2">
                Welcome to CBN Coop
              </h1>
              <p className="text-lg md:text-xl text-white/90 font-light">
                Food Distribution Portal
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 md:px-8 py-8 md:py-12">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-xl md:text-2xl font-semibold text-gray-800 mb-4">
                Are you a member of the CBN Coop?
              </h2>
              <p className="text-gray-600 text-sm md:text-base leading-relaxed">
                Please select your membership status to continue to the appropriate portal.
              </p>
            </div>

            {/* Buttons */}
            <div className="space-y-4 md:space-y-6">
              {/* Yes, I am a member */}
              <Link 
                href="/portal" 
                className="group w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl px-6 md:px-8 py-4 md:py-5 flex items-center justify-center transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                <svg className="w-5 h-5 md:w-6 md:h-6 mr-3 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-lg md:text-xl font-semibold">
                  Yes, I am a member
                </span>
              </Link>

              {/* No, I want to join */}
              <a 
                href="https://cbn.coop.ng/Signup" 
                target="_blank"
                rel="noopener noreferrer"
                className="group w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl px-6 md:px-8 py-4 md:py-5 flex items-center justify-center transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                <svg className="w-5 h-5 md:w-6 md:h-6 mr-3 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                <span className="text-lg md:text-xl font-semibold">
                  Not yet, I want to join
                </span>
                <svg className="w-4 h-4 md:w-5 md:h-5 ml-2 group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>

            {/* Additional Info */}
            <div className="mt-8 md:mt-12 pt-6 md:pt-8 border-t border-gray-100">
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">
                  Need help with your membership?
                </p>
                <p className="text-xs text-gray-400">
                  Contact us at customerservice@cbncoopng.com or call 09096797982, 08180578550
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    {/* Footer - Outside main content, full width with same background */}
    <footer className="bg-gradient-to-br from-blue-50 via-indigo-50 via-white to-emerald-50 border-t border-gray-200/50 relative">
      {/* Same gradient overlays as main background */}
      <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/5 via-transparent to-green-900/5"></div>
      <div className="absolute inset-0 bg-gradient-to-bl from-indigo-800/3 via-transparent to-emerald-800/3"></div>
      
      <div className="relative max-w-7xl mx-auto px-4 md:px-6 py-4">
        <div className="flex flex-col md:flex-row items-center justify-between space-y-2 md:space-y-0">
          <div className="flex items-center space-x-1.5 text-gray-500">
            <span className="text-xs">Powered by</span>
            <span className="font-medium text-blue-500 text-xs">MitemsHub</span>
          </div>
          <div className="text-xs text-gray-400">
            © 2025 CBN Coop Food Distribution
          </div>
        </div>
      </div>
    </footer>
  </div>
  )
}