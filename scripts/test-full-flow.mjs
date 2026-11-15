/** Full flow test: login → upload PDF → list library → check mock test models */
import { readFileSync, existsSync } from 'fs'

// Parse .env.local
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

const BASE = 'http://localhost:3000'
const EMAIL = process.env.ADMIN_EMAIL
const PASSWORD = process.env.ADMIN_PASSWORD

async function req(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = { raw: text } }
  return { status: res.status, ok: res.ok, json, headers: res.headers }
}

console.log('=== StudyHub Full Flow Test ===\n')

// ── 1. Login ──────────────────────────────────────────────────────────────
process.stdout.write('1. Login as admin... ')
const loginRes = await req('/api/v1/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
})
if (!loginRes.ok) {
  console.log(`❌ FAILED (${loginRes.status}):`, loginRes.json)
  process.exit(1)
}
console.log('✅', loginRes.json?.data?.user?.role ?? 'logged in')

// Extract session cookie
const setCookie = loginRes.headers.get('set-cookie') ?? ''
const cookie = setCookie.split(';')[0]

// ── 2. Upload PDF ─────────────────────────────────────────────────────────
const pdfPath = 'D:\\Gate\\GATE_CSE_2027_Question_Bank.pdf'
process.stdout.write(`\n2. Upload PDF (${existsSync(pdfPath) ? 'found' : '❌ NOT FOUND'})... `)

if (!existsSync(pdfPath)) {
  console.log('❌ File not found at', pdfPath)
} else {
  const fileBuffer = readFileSync(pdfPath)
  const { FormData, Blob } = await import('node:buffer').catch(() => ({}))
  
  const formData = new globalThis.FormData()
  formData.append('file', new Blob([fileBuffer], { type: 'application/pdf' }), 'GATE_CSE_2027_Question_Bank.pdf')
  formData.append('title', 'GATE CSE 2027 Question Bank')
  formData.append('description', 'Official GATE CSE 2027 question bank for practice')
  formData.append('paper', 'CS')

  const uploadRes = await fetch(BASE + '/api/v1/library/upload', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: formData,
  })
  const uploadJson = await uploadRes.json()
  if (uploadRes.ok) {
    console.log(`✅ resourceId: ${uploadJson?.data?.resourceId}, status: ${uploadJson?.data?.status}`)
  } else {
    console.log(`❌ FAILED (${uploadRes.status}):`, JSON.stringify(uploadJson).slice(0, 200))
  }
}

// ── 3. List library ───────────────────────────────────────────────────────
process.stdout.write('\n3. List library... ')
const libRes = await req('/api/v1/library?limit=10', { headers: { Cookie: cookie } })
if (libRes.ok) {
  console.log(`✅ ${libRes.json?.data?.total ?? 0} total resources`)
} else {
  console.log(`❌ FAILED (${libRes.status}):`, libRes.json)
}

// ── 4. Questions list ─────────────────────────────────────────────────────
process.stdout.write('\n4. Questions bank... ')
const qRes = await req('/api/v1/questions?limit=5', { headers: { Cookie: cookie } })
if (qRes.ok) {
  console.log(`✅ ${qRes.json?.data?.total ?? 0} total questions`)
} else {
  console.log(`❌ FAILED (${qRes.status}):`, qRes.json?.message ?? qRes.json)
}

// ── 5. Mock tests list ────────────────────────────────────────────────────
process.stdout.write('\n5. Mock tests... ')
const mockRes = await req('/api/v1/mock-tests?limit=5', { headers: { Cookie: cookie } })
if (mockRes.ok) {
  console.log(`✅ ${mockRes.json?.data?.total ?? mockRes.json?.data?.items?.length ?? 0} mock tests`)
} else {
  console.log(`❌ FAILED (${mockRes.status}):`, mockRes.json?.message ?? mockRes.json)
}

// ── 6. Admin summary ──────────────────────────────────────────────────────
process.stdout.write('\n6. Admin summary... ')
const adminRes = await req('/api/v1/admin/summary', { headers: { Cookie: cookie } })
if (adminRes.ok) {
  const d = adminRes.json?.data
  console.log(`✅ members: ${d?.members?.total ?? '?'}, questions: ${d?.questions?.total ?? '?'}, resources: ${d?.resources?.total ?? '?'}`)
} else {
  console.log(`❌ FAILED (${adminRes.status}):`, adminRes.json?.message ?? adminRes.json)
}

// ── 7. Announcements ──────────────────────────────────────────────────────
process.stdout.write('\n7. Announcements... ')
const annRes = await req('/api/v1/announcements?limit=5', { headers: { Cookie: cookie } })
if (annRes.ok) {
  console.log(`✅ ${annRes.json?.data?.total ?? annRes.json?.data?.items?.length ?? 0} announcements`)
} else {
  console.log(`❌ FAILED (${annRes.status}):`, annRes.json?.message ?? annRes.json)
}

// ── 8. AI providers ───────────────────────────────────────────────────────
process.stdout.write('\n8. AI providers... ')
const aiRes = await req('/api/v1/ai/connections', { headers: { Cookie: cookie } })
if (aiRes.ok) {
  console.log(`✅ ${aiRes.json?.data?.length ?? 0} connections configured`)
} else {
  console.log(`❌ FAILED (${aiRes.status}):`, aiRes.json?.message ?? aiRes.json)
}

console.log('\n=== Done ===')
