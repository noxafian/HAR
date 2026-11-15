#!/usr/bin/env node
/** Bootstrap the first StudyHub owner through the database's one-time secret workflow. */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const envPath = resolve(process.cwd(), '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const value = line.trim()
    if (!value || value.startsWith('#')) continue
    const index = value.indexOf('=')
    if (index < 1) continue
    const key = value.slice(0, index).trim()
    const raw = value.slice(index + 1).trim()
    if (!process.env[key]) process.env[key] = raw.replace(/^(["'])(.*)\1$/, '$2')
  }
}

const targetEmail = process.argv[2]?.trim().toLowerCase()
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const bootstrapSecret = process.env.ADMIN_BOOTSTRAP_SECRET
if (!targetEmail || !url || !serviceRoleKey || !bootstrapSecret || bootstrapSecret.length < 32) {
  console.error('Usage: ADMIN_BOOTSTRAP_SECRET=<32+ chars> node scripts/bootstrap-owner.mjs <registered-user-email>')
  console.error('Required environment: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_BOOTSTRAP_SECRET')
  process.exit(1)
}

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } })

async function run() {
  const { data: owners, error: ownerError } = await admin.from('memberships').select('user_id').eq('role', 'owner').limit(1)
  if (ownerError) throw ownerError
  if (owners?.length) throw new Error('An owner already exists; bootstrap is permanently locked.')

  let target = null
  for (let page = 1; page <= 20 && !target; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    target = data.users.find(user => user.email?.toLowerCase() === targetEmail) ?? null
    if (data.users.length < 1000) break
  }
  if (!target) throw new Error('Target user was not found. Register the account first.')

  const { error: seedError } = await admin.rpc('seed_owner_bootstrap_secret', { p_secret: bootstrapSecret })
  if (seedError && seedError.code !== '55000') throw seedError
  const { error: bootstrapError } = await admin.rpc('bootstrap_owner_pub', { p_user_id: target.id, p_secret: bootstrapSecret })
  if (bootstrapError) throw bootstrapError
  console.log(`Owner membership successfully bootstrapped for ${target.email} (${target.id}).`)
}

run().catch(error => {
  console.error('Owner bootstrap failed:', error instanceof Error ? error.message : 'Unknown error')
  process.exitCode = 1
})
