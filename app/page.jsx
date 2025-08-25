// app/page.jsx
import Link from 'next/link'
import MemberLauncher from './components/MemberLauncher'

export default function Landing() {
  return (
    <main className="min-h-screen p-6 flex flex-col items-center">
      <h1 className="text-3xl font-semibold mb-6">CBN Coop • Food Distribution</h1>
      <div className="mb-2">
      <a href="/" className="text-sm text-blue-600 hover:underline">← Back to Home</a>
      </div>
      <div className="grid md:grid-cols-3 gap-4 w-full max-w-5xl">
        {/* Members */}
        <div className="border rounded-xl p-5 bg-white shadow-sm">
          <h2 className="text-xl font-medium mb-2">Members</h2>
          <p className="text-sm text-gray-600 mb-3">
            Welcome! Enter your Member ID to continue to the shop.
          </p>
          <MemberLauncher />
        </div>

        {/* Branch Reps */}
        <div className="border rounded-xl p-5 bg-white shadow-sm">
          <h2 className="text-xl font-medium mb-2">Branch / Department Reps</h2>
          <p className="text-sm text-gray-600 mb-3">
            Work on Pending and Delivered for your delivery branch.
            Use your Delivery Branch Code (e.g., DUTSE) as passcode.
          </p>
          <Link href="/rep/login" className="px-4 py-2 bg-blue-600 text-white rounded inline-block">
            Open Rep Portal
          </Link>
        </div>

        {/* Admin */}
        <div className="border rounded-xl p-5 bg-white shadow-sm">
          <h2 className="text-xl font-medium mb-2">Admin</h2>
          <p className="text-sm text-gray-600 mb-3">
            Full control of imports, inventory, reports and approvals.
          </p>
          <Link href="/admin/pin" className="px-4 py-2 bg-blue-600 text-white rounded inline-block">
            Admin Passcode
          </Link>
          {/* If you still want Supabase Auth login too, you can add: */}
          {/* <Link href="/auth/login" className="ml-2 px-4 py-2 border rounded inline-block">Admin Login (Email)</Link> */}
        </div>
      </div>
    </main>
  )
}