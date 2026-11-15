/**
 * One-time seed script for the hosted Supabase project.
 * Inserts exam_papers, marking_configurations, subjects, syllabus_versions,
 * and syllabus_subjects that db push does not apply (seed.sql is local-only).
 *
 * Run once:  node scripts/seed-remote.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ---------------------------------------------------------------------------
// Load .env.local manually (no dotenv dependency required)
// ---------------------------------------------------------------------------
const __dir = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dir, '../.env.local')
let envContent
try { envContent = readFileSync(envPath, 'utf8') } catch { envContent = '' }
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eq = trimmed.indexOf('=')
  if (eq < 0) continue
  const key = trimmed.slice(0, eq).trim()
  const val = trimmed.slice(eq + 1).trim()
  if (!process.env[key]) process.env[key] = val
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function run() {
  console.log('Seeding remote Supabase project:', SUPABASE_URL)

  // 1. exam_papers
  console.log('\n[1/5] exam_papers...')
  const { error: e1 } = await db.from('exam_papers').upsert([
    { code: 'CS', label: 'Computer Science and Information Technology', description: 'GATE CS paper' },
    { code: 'DA', label: 'Data Science and Artificial Intelligence',     description: 'GATE DA paper' },
  ], { onConflict: 'code' })
  if (e1) { console.error('  FAILED:', e1.message); process.exit(1) }
  console.log('  OK')

  // 2. marking_configurations
  console.log('[2/5] marking_configurations...')
  const { error: e2 } = await db.from('marking_configurations').upsert([
    { name: 'GATE standard', description: 'Standard GATE marking: one-third negative marking for incorrect MCQs; no negative marking for MSQ/NAT.' },
  ], { onConflict: 'name' })
  if (e2) { console.error('  FAILED:', e2.message); process.exit(1) }
  console.log('  OK')

  // 3. subjects
  console.log('[3/5] subjects...')
  const subjects = [
    { name: 'General Aptitude',                             is_general_aptitude: true,  display_order: 0   },
    { name: 'Engineering Mathematics',                      is_general_aptitude: false, display_order: 10  },
    { name: 'Discrete Mathematics',                         is_general_aptitude: false, display_order: 20  },
    { name: 'Digital Logic',                                is_general_aptitude: false, display_order: 30  },
    { name: 'Computer Organization and Architecture',       is_general_aptitude: false, display_order: 40  },
    { name: 'Programming and Data Structures',              is_general_aptitude: false, display_order: 50  },
    { name: 'Algorithms',                                   is_general_aptitude: false, display_order: 60  },
    { name: 'Theory of Computation',                        is_general_aptitude: false, display_order: 70  },
    { name: 'Compiler Design',                              is_general_aptitude: false, display_order: 80  },
    { name: 'Operating Systems',                            is_general_aptitude: false, display_order: 90  },
    { name: 'Database Management Systems',                  is_general_aptitude: false, display_order: 100 },
    { name: 'Computer Networks',                            is_general_aptitude: false, display_order: 110 },
    { name: 'Probability and Statistics',                   is_general_aptitude: false, display_order: 120 },
    { name: 'Linear Algebra',                               is_general_aptitude: false, display_order: 130 },
    { name: 'Calculus and Optimization',                    is_general_aptitude: false, display_order: 140 },
    { name: 'Programming, Data Structures and Algorithms',  is_general_aptitude: false, display_order: 150 },
    { name: 'Database Management and Warehousing',          is_general_aptitude: false, display_order: 160 },
    { name: 'Machine Learning',                             is_general_aptitude: false, display_order: 170 },
    { name: 'Artificial Intelligence',                      is_general_aptitude: false, display_order: 180 },
  ]
  const { error: e3 } = await db.from('subjects').upsert(subjects, { onConflict: 'name' })
  if (e3) { console.error('  FAILED:', e3.message); process.exit(1) }
  console.log('  OK')

  // 4. syllabus_versions
  console.log('[4/5] syllabus_versions...')
  const { data: papers, error: ep } = await db.from('exam_papers').select('id,code').in('code', ['CS','DA'])
  if (ep || !papers?.length) { console.error('  Could not load exam_papers:', ep?.message); process.exit(1) }

  const { data: allSubjects, error: es } = await db.from('subjects').select('id,name')
  if (es || !allSubjects?.length) { console.error('  Could not load subjects:', es?.message); process.exit(1) }

  const subjectByName = Object.fromEntries(allSubjects.map(s => [s.name, s.id]))

  const csSubjects = [
    'Engineering Mathematics','Discrete Mathematics','Digital Logic',
    'Computer Organization and Architecture','Programming and Data Structures','Algorithms',
    'Theory of Computation','Compiler Design','Operating Systems',
    'Database Management Systems','Computer Networks','General Aptitude',
  ]
  const daSubjects = [
    'Probability and Statistics','Linear Algebra','Calculus and Optimization',
    'Programming, Data Structures and Algorithms','Database Management and Warehousing',
    'Machine Learning','Artificial Intelligence','General Aptitude',
  ]

  for (const paper of papers) {
    // Mark existing versions as not current
    await db.from('syllabus_versions').update({ is_current: false }).eq('paper_id', paper.id).eq('is_current', true)

    // Upsert 2027 version
    const { data: version, error: ev } = await db.from('syllabus_versions').upsert({
      paper_id: paper.id,
      year: 2027,
      is_current: true,
      source_ref: 'GATE 2027 official syllabus — pending source URL verification',
    }, { onConflict: 'paper_id,year' }).select('id').single()
    if (ev || !version) { console.error(`  FAILED syllabus_version for ${paper.code}:`, ev?.message); process.exit(1) }

    // 5. syllabus_subjects
    const subjectNames = paper.code === 'CS' ? csSubjects : daSubjects
    const links = subjectNames
      .filter(name => subjectByName[name])
      .map((name, i) => ({ syllabus_version_id: version.id, subject_id: subjectByName[name], display_order: i * 10 }))

    const { error: esl } = await db.from('syllabus_subjects').upsert(links, { onConflict: 'syllabus_version_id,subject_id' })
    if (esl) { console.error(`  FAILED syllabus_subjects for ${paper.code}:`, esl.message); process.exit(1) }
    console.log(`  ${paper.code}: syllabus version + ${links.length} subject links OK`)
  }

  console.log('\n✓ Seed complete. Retest GET /api/v1/exams/syllabi?paper=CS')
}

run().catch(err => { console.error('Unexpected error:', err); process.exit(1) })
