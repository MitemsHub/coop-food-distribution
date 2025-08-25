// app/layout.jsx
import './globals.css'
import Navbar from './components/Navbar'
import { AuthProvider } from './contexts/AuthContext'

export const metadata = {
  title: 'CBN Coop • Food Distribution',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        <AuthProvider>
          <Navbar />
          <main className="max-w-7xl mx-auto p-4 pt-4">{children}</main>
        </AuthProvider>
      </body>
    </html>
  )
}