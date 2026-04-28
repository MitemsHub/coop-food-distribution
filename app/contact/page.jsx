'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

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
      <svg className={className} viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
        <path d="M19.11 17.49c-.29-.15-1.71-.84-1.98-.94-.27-.1-.47-.15-.67.15-.2.29-.77.94-.95 1.13-.17.19-.34.22-.63.07-.29-.15-1.23-.45-2.34-1.44-.86-.76-1.44-1.71-1.61-2-.17-.29-.02-.45.13-.59.13-.13.29-.34.43-.51.15-.17.2-.29.3-.48.1-.2.05-.37-.03-.52-.08-.15-.67-1.6-.91-2.19-.24-.57-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.29-1.03 1.01-1.03 2.46 0 1.45 1.06 2.86 1.2 3.06.15.2 2.08 3.16 5.04 4.43.7.3 1.25.48 1.68.61.7.22 1.34.19 1.85.12.56-.08 1.71-.71 1.95-1.4.24-.69.24-1.28.17-1.4-.07-.12-.27-.2-.56-.35z" />
        <path d="M26.67 5.34A13.25 13.25 0 0016 1.02C8.85 1.02 3.04 6.83 3.04 13.98c0 2.29.6 4.52 1.74 6.49L3 30.98l10.73-2.81a12.9 12.9 0 006.2 1.58h.01c7.15 0 12.96-5.81 12.96-12.96 0-3.46-1.35-6.71-3.79-9.15zm-6.73 22.2h-.01a10.7 10.7 0 01-5.46-1.49l-.39-.23-6.36 1.67 1.7-6.2-.25-.4a10.67 10.67 0 01-1.64-5.78C7.53 8.02 11.32 4.23 16 4.23c2.86 0 5.55 1.11 7.57 3.14a10.62 10.62 0 013.12 7.57c0 5.68-4.62 10.6-10.75 12.6z" />
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

  const toMailto = useMemo(() => {
    const subject = `MitemsHub enquiry — ${name || 'New message'}`
    const body = [
      `Name: ${name || '-'}`,
      `Phone: ${phone || '-'}`,
      `Email: ${email || '-'}`,
      '',
      'Request:',
      requests || '-',
      '',
      'Sent from: CBN Coop Food Distribution app',
    ].join('\n')
    return `mailto:chuksmitti@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }, [email, name, phone, requests])

  const onSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setMsg(null)
    try {
      if (!String(name).trim()) throw new Error('Please enter your name')
      if (!String(phone).trim() && !String(email).trim()) throw new Error('Please enter a phone number or email')
      if (!String(requests).trim()) throw new Error('Please tell me what you need')
      window.location.href = toMailto
      setMsg({ type: 'success', text: 'Opening your email app…' })
    } catch (err) {
      setMsg({ type: 'error', text: err?.message || 'Please check the form and try again' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <div className="text-xs font-semibold text-blue-700">Powered by MitemsHub</div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Contact Me</h1>
            <div className="mt-1 text-sm text-gray-600">
              Want a portal like this for your cooperative, business, or community? Send a message and I’ll respond quickly.
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
                <div className="text-xs text-gray-600 mt-1">Fill this form and click submit. It opens an email to chuksmitti@gmail.com.</div>
              </div>
              <a
                href={toMailto}
                className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Icon name="mail" className="h-4 w-4" />
                Email
              </a>
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

              <div className="text-xs text-gray-500 text-center">
                If your device has no email app, use the options on the right to reach me directly.
              </div>
            </form>
          </section>

          <aside className="lg:col-span-2 space-y-3">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 md:p-6">
              <div className="text-sm font-semibold text-gray-900">Reach Me Directly</div>
              <div className="mt-4 space-y-2">
                <SocialButton href="tel:08122763992" label="Call" sub="08122763992" icon="phone" />
                <SocialButton href="tel:08149100561" label="Call" sub="08149100561" icon="phone" />
                <SocialButton href="https://wa.me/2348122763992" label="WhatsApp" sub="Chat on WhatsApp" icon="whatsapp" />
                <SocialButton href="mailto:chuksmitti@gmail.com" label="Email" sub="chuksmitti@gmail.com" icon="mail" />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 md:p-6">
              <div className="text-sm font-semibold text-gray-900">Social</div>
              <div className="mt-4 space-y-2">
                <SocialButton href="http://linkedin.com/in/mitems" label="LinkedIn" sub="/in/mitems" icon="linkedin" />
                <SocialButton href="https://mitemshub.github.io/mitems-portfolio/" label="Portfolio" sub="mitemshub.github.io" icon="globe" />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}

