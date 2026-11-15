/** Direct test: Supabase DB + Storage — no dev server needed */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'

const envContent = readFileSync('.env.local', 'utf-8')
for (const line of envContent.split('\n')) {
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

console.log('=== Direct Supabase Test (no dev server) ===\n')

// 1. Members
const { data: members, error: mErr } = await supabase.from('memberships').select('role, status')
console.log('1. Members:', mErr ? '❌ ' + mErr.message : `✅ ${members.length} total (${members.filter(m=>m.status==='approved').length} approved, ${members.filter(m=>m.role==='owner').length} owner)`)

// 2. Questions
const { count: qCount, error: qErr } = await supabase.from('questions').select('id', { count: 'exact', head: true })
console.log('2. Questions:', qErr ? '❌ ' + qErr.message : `✅ ${qCount} in bank`)

// 3. Resources (library)
const { count: rCount, error: rErr } = await supabase.from('resources').select('id', { count: 'exact', head: true }).eq('is_deleted', false)
console.log('3. Library resources:', rErr ? '❌ ' + rErr.message : `✅ ${rCount} files`)

// 4. Mock tests
const { count: mCount, error: mtErr } = await supabase.from('mock_tests').select('id', { count: 'exact', head: true })
console.log('4. Mock tests:', mtErr ? '❌ ' + mtErr.message : `✅ ${mCount} tests`)

// 5. Announcements
const { count: aCount, error: aErr } = await supabase.from('announcements').select('id', { count: 'exact', head: true })
console.log('5. Announcements:', aErr ? '❌ ' + aErr.message : `✅ ${aCount} announcements`)

// 6. Upload PDF to Storage
const pdfPath = 'D:\\Gate\\GATE_CSE_2027_Question_Bank.pdf'
process.stdout.write(`\n6. Upload PDF to Storage... `)
if (!existsSync(pdfPath)) {
  console.log(`❌ File not found at ${pdfPath}`)
} else {
  const buf = readFileSync(pdfPath)
  const storagePath = `${Date.now()}-GATE_CSE_2027_Question_Bank.pdf`
  const { error: upErr } = await supabase.storage.from('library').upload(storagePath, buf, { contentType: 'application/pdf', upsert: true })
  if (upErr) {
    console.log('❌ Storage upload failed:', upErr.message)
  } else {
    // Insert resource record
    const { data: res, error: dbErr } = await supabase.from('resources').insert({
      title: 'GATE CSE 2027 Question Bank',
      description: 'Official GATE CSE 2027 question bank for practice',
      file_type: 'pdf',
      file_size: buf.length,
      content_hash: (await import('node:crypto')).createHash('sha256').update(buf).digest('hex'),
      object_key: `library/${storagePath}`,
      paper: 'CS',
      status: 'verified',
      uploaded_by: (await supabase.from('memberships').select('user_id').eq('role','owner').single()).data?.user_id,
    }).select('id').single()

    if (dbErr) {
      console.log('❌ DB insert failed:', dbErr.message)
      // cleanup storage
      await supabase.storage.from('library').remove([storagePath])
    } else {
      const { data: urlData } = await supabase.storage.from('library').createSignedUrl(storagePath, 900)
      console.log(`✅ Uploaded! resourceId: ${res.id}`)
      console.log(`   Size: ${(buf.length/1024/1024).toFixed(1)} MB`)
      console.log(`   Signed URL (15 min): ${urlData?.signedUrl?.slice(0,80)}...`)
    }
  }
}

// 7. Storage bucket check
const { data: buckets } = await supabase.storage.listBuckets()
console.log(`\n7. Storage buckets: ✅ ${buckets?.map(b=>b.name).join(', ')}`)

console.log('\n=== Done ===')
