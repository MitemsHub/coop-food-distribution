import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function RepAccessPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto relative">
        <div className="absolute -top-10 -left-10 w-56 h-56 bg-emerald-200/40 blur-3xl rounded-full pointer-events-none" aria-hidden="true" />
        <div className="absolute -bottom-10 -right-10 w-72 h-72 bg-blue-200/40 blur-3xl rounded-full pointer-events-none" aria-hidden="true" />

        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Reps Portal</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Select the portal you want to access.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <Link
            href="/rep/login?module=food"
            className="group relative overflow-hidden bg-white/90 backdrop-blur border border-emerald-100 rounded-2xl p-5 sm:p-6 shadow-sm hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-700" aria-hidden="true" />
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" aria-hidden="true" />
            <div className="relative">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-base sm:text-lg font-semibold text-gray-900">Food Distribution</div>
                  <div className="text-xs sm:text-sm text-gray-600 mt-1">Manage food orders and delivery workflow.</div>
                </div>
              </div>
              <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 group-hover:text-emerald-800">
                Continue
                <span className="transform transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true">
                  →
                </span>
              </div>
            </div>
          </Link>

          <Link
            href="/rep/login?module=ram"
            className="group relative overflow-hidden bg-white/90 backdrop-blur border border-blue-100 rounded-2xl p-5 sm:p-6 shadow-sm hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-700" aria-hidden="true" />
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" aria-hidden="true" />
            <div className="relative">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-2.761 0-5 2.239-5 5v5h10v-5c0-2.761-2.239-5-5-5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 8a3 3 0 116 0" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-base sm:text-lg font-semibold text-gray-900">Ram Sales</div>
                  <div className="text-xs sm:text-sm text-gray-600 mt-1">Manage ram orders and delivery workflow.</div>
                </div>
              </div>
              <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 group-hover:text-blue-800">
                Continue
                <span className="transform transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true">
                  →
                </span>
              </div>
            </div>
          </Link>
        </div>

        <div className="mt-6">
          <Link
            href="/portal"
            className="group inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/80 backdrop-blur px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:shadow-md hover:bg-white hover:text-gray-900 active:translate-y-px transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/40 focus-visible:ring-offset-2"
          >
            <span className="transform transition-transform duration-200 group-hover:-translate-x-0.5" aria-hidden="true">
              ←
            </span>
            Back to Portal
          </Link>
        </div>
      </div>
    </main>
  )
}
