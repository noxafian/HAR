#!/usr/bin/env node
/**
 * Run migration 19 SQL via Supabase service role client
 * Note: Supabase JS client doesn't support raw SQL execution directly.
 * This script provides the SQL and attempts to execute it via REST API.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Manual .env.local parsing (no dotenv dependency)
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  console.error('Error: Required environment variables not found')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const sqlPath = resolve(process.cwd(), 'scripts', 'migration-19-gate-syllabus-progress.sql')
const migrationSQL = readFileSync(sqlPath, 'utf8')

console.log('========================================')
console.log('Migration 19: Gate Syllabus View + User Topic Progress')
console.log('========================================\n')
console.log('RECOMMENDED: Run this migration via Supabase Dashboard SQL Editor or CLI:\n')
console.log('  1. Copy the SQL below')
console.log('  2. Go to Supabase Dashboard > SQL Editor')
console.log('  3. Paste and execute\n')
console.log('OR run: npm run db:reset (applies all migrations)\n')
console.log('========================================')
console.log('SQL TO EXECUTE:')
console.log('========================================\n')
console.log(migrationSQL)
console.log('\n========================================\n')

// Attempt to execute via fetch to REST API (may not work if no exec_sql RPC exists)
async function attemptExecution() {
  console.log('Attempting automatic execution via REST API...\n')
  
  try {
    const response = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ sql: migrationSQL })
    })

    if (response.ok) {
      console.log('✓ Migration executed successfully via REST API')
      return true
    } else {
      const text = await response.text()
      console.log(`✗ REST API execution failed (${response.status}): ${text}`)
      return false
    }
  } catch (error) {
    console.log(`✗ REST API execution error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return false
  }
}

attemptExecution().then(success => {
  if (!success) {
    console.log('\nℹ  Automatic execution failed. Please run the SQL manually as described above.')
  }
}).catch(() => {
  console.log('\nℹ  Automatic execution failed. Please run the SQL manually as described above.')
})
