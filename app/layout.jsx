// app/layout.jsx
import './globals.css'
import Navbar from './components/Navbar'
import { AuthProvider } from './contexts/AuthContext'
import { Inter } from 'next/font/google'
import PageTransition from './components/PageTransition'

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-sans' })

export const metadata = {
  title: 'CBN Coop • Food Distribution',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <AuthProvider>
          <Navbar />
          <main className="max-w-7xl mx-auto p-2 lg:p-3 xl:p-4 pt-2 lg:pt-3 xl:pt-4">
            <PageTransition>{children}</PageTransition>
          </main>
        </AuthProvider>
      </body>
    </html>
  )
}
