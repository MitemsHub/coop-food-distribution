'use client'

import Link from 'next/link'
import { useState } from 'react'

function Icon({ name, className }) {
  if (name === 'mail') {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8m-18 8h18a2 2 0 002-2V8a2 2 0 00-2-2H3a2 2 0 00-2 2v6a2 2 0 002 2z"
        />
      </svg>
    )
  }
  if (name === 'phone') {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.128a11.042 11.042 0 005.516 5.516l1.128-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
        />
      </svg>
    )
  }
  if (name === 'whatsapp') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" />
      </svg>
    )
  }
  if (name === 'linkedin') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.6 0 4.266 2.37 4.266 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 114.126 0 2.062 2.062 0 01-2.063 2.065zM6.814 20.452H3.86V9h2.954v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    )
  }
  if (name === 'globe') {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.6 9h16.8M3.6 15h16.8M12 3a15.3 15.3 0 010 18M12 3a15.3 15.3 0 000 18" />
      </svg>
    )
  }
  return null
}

function SocialButton({ href, label, icon, sub }) {
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-gray-300 hover:shadow-sm transition-all"
    >
      <div className="h-10 w-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-700 group-hover:text-gray-900 group-hover:bg-gray-100 transition-colors">
        <Icon name={icon} className={icon === 'whatsapp' || icon === 'linkedin' ? 'h-5 w-5' : 'h-5 w-5'} />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-gray-900 truncate">{label}</div>
        {!!sub && <div className="text-xs text-gray-600 truncate">{sub}</div>}
      </div>
      <div className="ml-auto text-gray-400 group-hover:text-gray-600 transition-colors" aria-hidden="true">
        →
      </div>
    </a>
  )
}

export default function ContactPage() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [requests, setRequests] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState(null)

  const onSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setMsg(null)
    try {
      if (!String(name).trim()) throw new Error('Please enter your name')
      if (!String(phone).trim() && !String(email).trim()) throw new Error('Please enter a phone number or email')
      if (!String(requests).trim()) throw new Error('Please tell me what you need')

      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(name || '').trim(),
          phone: String(phone || '').trim(),
          email: String(email || '').trim(),
          requests: String(requests || '').trim(),
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to send message')

      setMsg({ type: 'success', text: 'Message sent successfully. I will get back to you shortly.' })
      setName('')
      setPhone('')
      setEmail('')
      setRequests('')
    } catch (err) {
      setMsg({ type: 'error', text: err?.message || 'Please check the form and try again' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50 flex flex-col">
      <main className="flex-1">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Contact Me</h1>
            <div className="mt-1 text-sm text-gray-600">
              Need a customized portal, website, or management system for your organization? Send a message and I’ll respond promptly.
            </div>
          </div>
          <Link
            href="/portal"
            className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <span aria-hidden="true">←</span>
            Back
          </Link>
        </div>

        {!!msg && (
          <div
            className={`mb-5 rounded-xl border p-3 text-sm ${
              msg.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'
            }`}
          >
            {msg.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <section className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 shadow-sm p-5 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">Quick Message</div>
                <div className="text-xs text-gray-600 mt-1">Share what you need, and I’ll reach out.</div>
              </div>
            </div>

            <form onSubmit={onSubmit} className="mt-5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Your Name</label>
                  <input
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. John Doe"
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Phone Number</label>
                  <input
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 0812..."
                    autoComplete="tel"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Email</label>
                <input
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. you@company.com"
                  autoComplete="email"
                  inputMode="email"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Your Request</label>
                <textarea
                  className="w-full min-h-32 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  value={requests}
                  onChange={(e) => setRequests(e.target.value)}
                  placeholder="Tell me what you want to build or improve (features, timeline, budget range, etc.)"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 px-4 py-3 text-white text-sm font-semibold hover:from-blue-700 hover:to-emerald-700 disabled:opacity-60"
              >
                <Icon name="mail" className="h-4 w-4" />
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </form>
          </section>

          <aside className="lg:col-span-2 space-y-3">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 md:p-6">
              <div className="text-sm font-semibold text-gray-900">Reach Me Directly</div>
              <div className="mt-4 space-y-2">
                <SocialButton href="tel:08122763992" label="Call" sub="08122763992" icon="phone" />
                <SocialButton href="tel:08149100561" label="Call" sub="08149100561" icon="phone" />
                <SocialButton href="https://wa.me/2348122763992" label="WhatsApp" icon="whatsapp" />
                <SocialButton href="mailto:chuksmitti@gmail.com" label="Email" icon="mail" />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 md:p-6">
              <div className="text-sm font-semibold text-gray-900">Social</div>
              <div className="mt-4 space-y-2">
                <SocialButton href="http://linkedin.com/in/mitems" label="LinkedIn" icon="linkedin" />
                <SocialButton href="https://mitemshub.github.io/mitems-portfolio/" label="Portfolio" icon="globe" />
              </div>
            </div>
          </aside>
        </div>
      </div>
      </main>

      <footer className="bg-gray-50 border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-4">
          <div className="flex flex-col md:flex-row items-center justify-between space-y-2 md:space-y-0">
            <div className="flex items-center space-x-1.5 text-gray-500">
              <span className="text-xs">Powered by</span>
              <span className="font-medium text-blue-500 text-xs">MitemsHub</span>
            </div>
            <div className="text-xs text-gray-400">© 2026 CBN Coop Food Distribution</div>
          </div>
        </div>
      </footer>
    </div>
  )
}
