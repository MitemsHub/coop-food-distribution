// app/page.js
import { supabase } from '../lib/supabaseClient'

export default async function Page() {
  const { data, error } = await supabase.from('test_table').select('*')

  if (error) console.error('Supabase Error:', error)

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Supabase Connection Test</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  )
}
