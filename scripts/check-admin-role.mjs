#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const envPath = resolve(process.cwd(), '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const v = line.trim()
    if (!v || v.startsWith('#')) continue
    const i = v.indexOf('=')
    if (i < 1) continue
    const key = v.slice(0, i).trim()
    const raw = v.slice(i + 1).trim()
    if (!process.env[key]) process.env[key] = raw.replace(/^(["'])(.*)\1$/, '$2')
  }
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})

const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
console.log('Checking admin email:', adminEmail)

let userId = null
const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
const user = usersData?.users?.find(u => u.email?.toLowerCase() === adminEmail)
if (user) {
  userId = user.id
  console.log('✓ Auth user found:', userId)
} else {
  console.log('✗ No auth user found for', adminEmail)
  process.exit(1)
}

const { data: membership, error } = await admin.from('memberships').select('role,status').eq('user_id', userId).maybeSingle()
if (error) {
  console.log('✗ DB error:', error.message)
} else if (!membership) {
  console.log('✗ No membership row found — need to run bootstrap or login once')
} else {
  console.log('Membership role:', membership.role, '| status:', membership.status)
  if (membership.role === 'owner' && membership.status === 'approved') {
    console.log('✓ Admin is correctly set up as owner')
  } else {
    console.log('✗ Problem: role should be owner/approved — fixing now...')
    const { error: fixErr } = await admin.from('memberships').update({ role: 'owner', status: 'approved', approved_at: new Date().toISOString() }).eq('user_id', userId)
    if (fixErr) console.log('Fix failed:', fixErr.message)
    else console.log('✓ Fixed — role set to owner, status set to approved')
  }
}
