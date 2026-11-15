#!/usr/bin/env node
import { getMigrationSQL } from './migration-16-revision-system.mjs'
import { writeFileSync } from 'fs'

const sql = getMigrationSQL()
writeFileSync(new URL('./migration-16.sql', import.meta.url), sql)
console.log('Written to scripts/migration-16.sql')
console.log('\n--- SQL ---\n')
console.log(sql)
