// app/components/MemberLauncher.jsx
'use client'

export default function MemberLauncher() {
  const submit = (e) => {
    e.preventDefault()
    const mid = new FormData(e.currentTarget).get('mid')?.toString().trim()
    if (!mid) return
    window.location.href = `/shop?mid=${encodeURIComponent(mid)}`
  }

  return (
    <form className="flex gap-2" onSubmit={submit}>
      <input
        name="mid"
        className="border rounded px-3 py-2 flex-1"
        placeholder="Enter your Member ID (e.g., A12345)"
      />
      <button className="px-4 py-2 bg-blue-600 text-white rounded">Continue</button>
    </form>
  )
}