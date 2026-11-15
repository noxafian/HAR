/** Test uploading a real PDF to Supabase Storage and generating a signed URL. */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { basename } from 'path'

// Parse .env.local manually
const envContent = readFileSync('.env.local', 'utf-8')
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const idx = trimmed.indexOf('=')
  if (idx === -1) continue
  const key = trimmed.slice(0, idx).trim()
  let val = trimmed.slice(idx + 1).trim()
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1)
  }
  process.env[key] = val
}

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const filePath = 'D:\\unit-IV EAI.pdf'

if (!existsSync(filePath)) {
  console.error('❌ File not found:', filePath)
  process.exit(1)
}

const fileBuffer = readFileSync(filePath)
const fileName = basename(filePath)
const storagePath = `test-${Date.now()}-${fileName.replace(/\s+/g, '-')}`

console.log('📄 File:', fileName)
console.log('📦 Size:', (fileBuffer.length / 1024).toFixed(1), 'KB')
console.log('📤 Uploading to bucket "library" as:', storagePath)
console.log('')

// Upload
const { error: uploadError } = await supabase.storage
  .from('library')
  .upload(storagePath, fileBuffer, { contentType: 'application/pdf', upsert: true })

if (uploadError) {
  console.error('❌ Upload failed:', uploadError.message)
  process.exit(1)
}
console.log('✅ Upload SUCCESS')

// Signed URL (15 min)
const { data: urlData, error: urlError } = await supabase.storage
  .from('library')
  .createSignedUrl(storagePath, 900)

if (urlError || !urlData?.signedUrl) {
  console.error('❌ Signed URL failed:', urlError?.message)
  process.exit(1)
}

console.log('✅ Signed URL (15 min):')
console.log(urlData.signedUrl)
console.log('')
console.log('Storage path (save this for deletion):', storagePath)
console.log('')
console.log('✅ Everything works! File is in Supabase Storage.')
console.log('👉 Tell me when you want it deleted.')
