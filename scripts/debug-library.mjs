import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf-8')
for (const line of env.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const idx = trimmed.indexOf('=')
  if (idx === -1) continue
  const key = trimmed.slice(0, idx).trim()
  let val = trimmed.slice(idx + 1).trim()
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
  process.env[key] = val
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// 1. Check all resources
const { data: all, error: e1 } = await supabase.from('resources').select('id,title,file_type,status,is_deleted,category')
console.log('All resources:', JSON.stringify(all, null, 2))
if (e1) console.log('Error:', e1.message)

// 2. Check columns exist
const { data: cols, error: e2 } = await supabase.rpc('exec_sql', { sql: "SELECT column_name FROM information_schema.columns WHERE table_name='resources' AND table_schema='public' ORDER BY ordinal_position" }).catch(() => ({ data: null, error: { message: 'rpc not available' } }))
console.log('Columns check:', cols ?? e2?.message)

// 3. Try exact same query the API uses
const { data: apiQuery, error: e3 } = await supabase
  .from('resources')
  .select('id,title,description,paper,subject_id,topic_id,file_type,file_size,status,uploaded_by,verified_by,verified_at,version,download_count,created_at,updated_at,category,subjects(name),topics(name)', { count: 'exact' })
  .eq('is_deleted', false)
  .order('created_at', { ascending: false })
  .range(0, 99)

console.log('\nAPI query result:', apiQuery?.length ?? 0, 'rows')
if (e3) console.log('API query ERROR:', e3.message)
else console.log('Items:', JSON.stringify(apiQuery?.map(r => ({ id: r.id, title: r.title, status: r.status, category: r.category })), null, 2))
