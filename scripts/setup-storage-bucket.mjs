/** Creates the "library" bucket in Supabase Storage if it doesn't already exist. */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

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

if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

console.log('Checking Supabase Storage bucket "library"...')

// List existing buckets
const { data: buckets, error: listError } = await supabase.storage.listBuckets()
if (listError) {
  console.error('❌ Failed to list buckets:', listError.message)
  process.exit(1)
}

const exists = buckets?.some((b) => b.name === 'library')

if (exists) {
  console.log('✅ Bucket "library" already exists — nothing to do.')
} else {
  console.log('Creating bucket "library"...')
  const { error: createError } = await supabase.storage.createBucket('library', {
    public: false,           // private — files only accessible via signed URLs
    fileSizeLimit: 52428800, // 50 MB per file
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ],
  })

  if (createError) {
    console.error('❌ Failed to create bucket:', createError.message)
    process.exit(1)
  }
  console.log('✅ Bucket "library" created successfully.')
}

// Quick upload test
console.log('\nRunning upload test...')
const testBuffer = Buffer.from('%PDF-1.4 test')
const testPath = `test-${Date.now()}.pdf`

const { error: uploadError } = await supabase.storage
  .from('library')
  .upload(testPath, testBuffer, { contentType: 'application/pdf', upsert: true })

if (uploadError) {
  console.error('❌ Upload test failed:', uploadError.message)
  process.exit(1)
}

// Get signed URL
const { data: urlData, error: urlError } = await supabase.storage
  .from('library')
  .createSignedUrl(testPath, 60)

if (urlError || !urlData?.signedUrl) {
  console.error('❌ Signed URL test failed:', urlError?.message)
} else {
  console.log('✅ Upload test passed.')
  console.log('✅ Signed URL generated:', urlData.signedUrl.slice(0, 80) + '...')
}

// Cleanup test file
await supabase.storage.from('library').remove([testPath])
console.log('✅ Test file cleaned up.')
console.log('\n🎉 Supabase Storage is ready! Library uploads should now work.')
