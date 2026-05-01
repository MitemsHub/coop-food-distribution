'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import collage from '../public/landing/collage.png'

export default function MemberVerification() {
  const reduceMotion = useReducedMotion()
  const MotionImage = motion.create(Image)

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <main className="flex-1 relative overflow-hidden flex items-center justify-center px-4 py-8">
        <div className="absolute inset-0">
          <MotionImage
            src={collage}
            alt=""
            fill
            priority
            fetchPriority="high"
            quality={75}
            placeholder="blur"
            sizes="(max-width: 768px) 100vw, 1200px"
            className="object-cover brightness-110 contrast-105 saturate-110"
            initial={reduceMotion ? false : { scale: 1.03, opacity: 0, x: 0, y: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { scale: 1.06, opacity: 1, x: -10, y: -6 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : {
                    opacity: { duration: 0.45, ease: 'easeOut' },
                    scale: { duration: 22, ease: 'easeOut' },
                    x: { duration: 22, ease: 'easeOut' },
                    y: { duration: 22, ease: 'easeOut' },
                  }
            }
          />

          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/40 via-slate-900/20 to-emerald-950/30" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.10),rgba(0,0,0,0.36))]" />
          <div className="absolute inset-0 backdrop-blur-[0.7px]" />
        </div>

        <motion.div
          className="relative w-full max-w-xl"
          initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.98 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.5, ease: 'easeOut' }}
        >
          <div className="rounded-3xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-xl overflow-hidden">
            <div className="px-6 md:px-10 pt-10 pb-8 text-center">
              <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-white/90">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l3 6 6 .9-4.5 4.4 1.1 6.2L12 17.9 6.4 20.5l1.1-6.2L3 9.9 9 9l3-6z" />
                  </svg>
                </span>
                <span className="text-sm font-semibold tracking-wide">CBN Coop</span>
              </div>

              <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                Welcome to CBN Coop
              </h1>
              <p className="mt-2 text-base md:text-lg text-white/80">
                Food Distribution Portal
              </p>
            </div>

            <div className="px-6 md:px-10 pb-10">
              <div className="space-y-3">
                <motion.div whileHover={reduceMotion ? undefined : { y: -1 }} whileTap={reduceMotion ? undefined : { scale: 0.99 }}>
                  <Link
                    href="/portal"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 text-white font-semibold shadow-lg hover:from-blue-600 hover:to-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Member Login
                  </Link>
                </motion.div>

                <motion.div whileHover={reduceMotion ? undefined : { y: -1 }} whileTap={reduceMotion ? undefined : { scale: 0.99 }}>
                  <a
                    href="https://cbn.coop.ng/Signup"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4 text-white font-semibold shadow-lg hover:from-emerald-600 hover:to-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Become a Member
                    <svg className="h-4 w-4 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3h7v7m0-7L10 14M5 5h5M5 10h5M5 15h5M5 20h14" />
                    </svg>
                  </a>
                </motion.div>
              </div>

              <div className="mt-7 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                <p className="text-sm text-white/75">
                  Need help with your membership?
                </p>
                <p className="mt-1 text-xs text-white/60">
                  customerservice@cbncoopng.com · 09096797982, 08180578550
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      <footer className="relative border-t border-gray-200/70 bg-gradient-to-r from-blue-50/90 via-white/80 to-green-50/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-gray-600">
            <span className="text-xs">Powered by</span>
            <span className="inline-flex items-center">
              <Link
                href="/contact"
                className="text-xs font-semibold text-blue-700 hover:text-blue-800 drop-shadow-[0_0_12px_rgba(37,99,235,0.25)]"
              >
                MitemsHub
              </Link>
              <motion.span
                className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-blue-600"
                animate={reduceMotion ? undefined : { opacity: [0.35, 1, 0.35], scale: [1, 1.6, 1] }}
                transition={reduceMotion ? undefined : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              />
            </span>
          </div>
          <div className="text-xs text-gray-500">© 2026 CBN Coop Food Distribution</div>
        </div>
      </footer>
    </div>
  )
}
