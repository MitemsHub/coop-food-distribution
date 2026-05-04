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
          <main className="w-full">
            <PageTransition>{children}</PageTransition>
          </main>
        </AuthProvider>
      </body>
    </html>
  )
}
