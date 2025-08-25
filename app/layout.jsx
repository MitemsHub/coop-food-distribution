// app/layout.jsx
import './globals.css'
import Navbar from './components/Navbar'

export const metadata = {
  title: 'CBN Coop • Food Distribution',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        <Navbar />
        <main className="max-w-7xl mx-auto p-4 pt-4">{children}</main>
      </body>
    </html>
  )
}