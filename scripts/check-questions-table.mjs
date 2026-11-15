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

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})

// Try fetching one question to see the actual error
const { data, error } = await db.from('questions').select('*').limit(1)
if (error) {
  console.log('questions table error:', error.message, '| code:', error.code)
} else {
  console.log('questions table OK, columns:', data.length > 0 ? Object.keys(data[0]).join(', ') : 'table exists but empty')
}

// Check if is_deleted column exists
const { error: e2 } = await db.from('questions').select('id,is_deleted').limit(1)
if (e2) console.log('is_deleted column MISSING:', e2.message)
else console.log('is_deleted column: EXISTS')

// Check question_answer_keys
const { error: e3 } = await db.from('question_answer_keys').select('question_id').limit(1)
if (e3) console.log('question_answer_keys table error:', e3.message)
else console.log('question_answer_keys table: EXISTS')
