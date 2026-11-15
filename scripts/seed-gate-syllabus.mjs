#!/usr/bin/env node
/**
 * seed-gate-syllabus.mjs
 *
 * Seeds the gate_syllabus table with GATE CS 2027, DA 2027, and General Aptitude
 * topics. The table schema (migration-19) uses TEXT ids matching the app constants:
 *   - subject_id  TEXT NOT NULL
 *   - subject_name TEXT NOT NULL
 *   - exam         TEXT NOT NULL CHECK (exam IN ('CS', 'DA', 'GA'))
 *   - topic_name   TEXT NOT NULL
 *   - topic_id     TEXT NOT NULL
 *   - UNIQUE (exam, subject_id, topic_name)
 *
 * Re-running is safe — upsert with onConflict ignores existing rows.
 *
 * Env vars (loaded from .env.local if present):
 *   SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// 1. Load .env.local manually (dotenv is not installed)
// ---------------------------------------------------------------------------
function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local')
  let raw
  try {
    raw = readFileSync(envPath, 'utf-8')
  } catch {
    return // file absent — rely on process.env
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '')
    if (key && !(key in process.env)) {
      process.env[key] = value
    }
  }
}

loadEnvLocal()

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    '❌  Missing env vars. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env.local or the environment.',
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ---------------------------------------------------------------------------
// 2. Syllabus data — keyed by subject id from CS_SUBJECTS / DA_SUBJECTS / GA_SUBJECTS
// ---------------------------------------------------------------------------

/** @type {Array<{ exam: 'CS'|'DA'|'GA', subjectId: string, subjectName: string, topics: string[] }>} */
const SYLLABUS = [
  // ── GATE CS 2027 ──────────────────────────────────────────────────────────
  {
    exam: 'CS',
    subjectId: 'cs-eng-math',
    subjectName: 'Engineering Mathematics',
    topics: [
      'Linear Algebra',
      'Calculus',
      'Probability and Statistics',
      'Discrete Mathematics',
    ],
  },
  {
    exam: 'CS',
    subjectId: 'cs-discrete-math',
    subjectName: 'Discrete Mathematics',
    topics: [
      'Propositional and First Order Logic',
      'Sets, Relations and Functions',
      'Partial Orders and Lattices',
      'Monoids and Groups',
      'Graphs',
      'Combinatorics',
    ],
  },
  {
    exam: 'CS',
    subjectId: 'cs-digital-logic',
    subjectName: 'Digital Logic',
    topics: [
      'Boolean Algebra',
      'Combinational and Sequential Circuits',
      'Minimization',
      'Number Representations and Computer Arithmetic',
    ],
  },
  {
    exam: 'CS',
    subjectId: 'cs-coa',
    subjectName: 'Computer Organization and Architecture',
    topics: [
      'Machine Instructions and Addressing Modes',
      'ALU, Data Path and Control Unit',
      'Instruction Pipelining',
      'Memory Hierarchy',
      'I/O Interface',
    ],
  },
  {
    exam: 'CS',
    subjectId: 'cs-pds',
    subjectName: 'Programming and Data Structures',
    topics: [
      'Programming in C',
      'Recursion',
      'Arrays',
      'Stacks',
      'Queues',
      'Linked Lists',
      'Trees',
      'Binary Search Trees',
      'Binary Heaps',
      'Graphs',
    ],
  },
  {
    exam: 'CS',
    subjectId: 'cs-algorithms',
    subjectName: 'Algorithms',
    topics: [
      'Searching',
      'Sorting',
      'Hashing',
      'Asymptotic Worst Case Time and Space Complexity',
      'Algorithm Design Techniques',
      'Graph Traversals',
      'Dynamic Programming',
      'Greedy Algorithms',
    ],
  },
  {
    exam: 'CS',
    subjectId: 'cs-toc',
    subjectName: 'Theory of Computation',
    topics: [
      'Regular Expressions and Finite Automata',
      'Context-Free Grammars and Push-Down Automata',
      'Regular and Context-Free Languages',
      'Pumping Lemma',
      'Turing Machines and Undecidability',
    ],
  },
  {
    exam: 'CS',
    subjectId: 'cs-compiler',
    subjectName: 'Compiler Design',
    topics: [
      'Lexical Analysis',
      'Parsing',
      'Syntax-Directed Translation',
      'Runtime Environments',
      'Intermediate Code Generation',
      'Local Optimisation',
      'Data Flow Analyses',
    ],
  },
  {
    exam: 'CS',
    subjectId: 'cs-os',
    subjectName: 'Operating Systems',
    topics: [
      'System Calls',
      'Processes and Threads',
      'Inter-Process Communication',
      'Concurrency and Synchronization',
      'Deadlock',
      'CPU and I/O Scheduling',
      'Memory Management',
      'File Systems',
    ],
  },
  {
    exam: 'CS',
    subjectId: 'cs-dbms',
    subjectName: 'Database Management Systems',
    topics: [
      'ER-Model',
      'Relational Model',
      'Relational Algebra',
      'Tuple Calculus',
      'SQL',
      'Integrity Constraints',
      'Normal Forms',
      'File Organisation',
      'Indexing',
      'Transactions and Concurrency Control',
    ],
  },
  {
    exam: 'CS',
    subjectId: 'cs-cn',
    subjectName: 'Computer Networks',
    topics: [
      'Concept of Layering',
      'LAN Technologies',
      'Flow and Error Control',
      'Routing Algorithms',
      'Congestion Control',
      'TCP/UDP and Sockets',
      'IPv4/IPv6',
      'Application Layer Protocols',
      'Network Security',
    ],
  },

  // ── GATE DA 2027 ──────────────────────────────────────────────────────────
  {
    exam: 'DA',
    subjectId: 'da-prob-stats',
    subjectName: 'Probability and Statistics',
    topics: [
      'Counting',
      'Probability Axioms',
      'Random Variables',
      'Uniform, Binomial, Poisson and Normal Distributions',
      'Conditional Probability',
      'Bayes Theorem',
      'Hypothesis Testing',
      'Confidence Intervals',
    ],
  },
  {
    exam: 'DA',
    subjectId: 'da-linear-algebra',
    subjectName: 'Linear Algebra',
    topics: [
      'Vector Spaces',
      'Subspaces',
      'Linear Dependence',
      'Projections',
      'Orthogonal Bases',
      'Eigenvalues and Eigenvectors',
      'Matrix Decompositions (SVD, PCA)',
    ],
  },
  {
    exam: 'DA',
    subjectId: 'da-calculus',
    subjectName: 'Calculus and Optimization',
    topics: [
      'Functions, Limits, Continuity',
      'Differentiation',
      'Integration',
      'Convexity',
      'Unconstrained and Constrained Optimization',
      'Gradient Descent',
    ],
  },
  {
    exam: 'DA',
    subjectId: 'da-pds-algo',
    subjectName: 'Programming, Data Structures and Algorithms',
    topics: [
      'Python and C Programming',
      'Arrays',
      'Stacks',
      'Queues',
      'Linked Lists',
      'Trees',
      'Hash Tables',
      'Sorting and Searching',
      'Time Complexity',
    ],
  },
  {
    exam: 'DA',
    subjectId: 'da-dbms',
    subjectName: 'Database Management and Warehousing',
    topics: [
      'ER Model',
      'Relational Model',
      'SQL',
      'Normal Forms',
      'Data Warehousing',
      'OLAP',
      'ETL',
    ],
  },
  {
    exam: 'DA',
    subjectId: 'da-ml',
    subjectName: 'Machine Learning',
    topics: [
      'Supervised Learning — Regression',
      'Supervised Learning — Classification',
      'Support Vector Machines',
      'Decision Trees',
      'Random Forests',
      'Neural Networks',
      'Unsupervised Learning — Clustering',
      'Unsupervised Learning — PCA',
      'Overfitting and Regularization',
      'Cross-Validation',
      'Evaluation Metrics',
    ],
  },
  {
    exam: 'DA',
    subjectId: 'da-ai',
    subjectName: 'Artificial Intelligence',
    topics: [
      'Search Algorithms',
      'Logic',
      'Bayesian Networks',
      'Markov Decision Processes',
      'NLP Basics',
      'Computer Vision Basics',
    ],
  },

  // ── General Aptitude ──────────────────────────────────────────────────────
  {
    exam: 'GA',
    subjectId: 'ga-verbal',
    subjectName: 'Verbal Ability',
    topics: [
      'English Grammar',
      'Sentence Completion',
      'Verbal Analogies',
      'Word Groups',
      'Critical Reasoning',
      'Verbal Deduction',
      'Reading Comprehension',
    ],
  },
  {
    exam: 'GA',
    subjectId: 'ga-quant',
    subjectName: 'Quantitative Aptitude',
    topics: [
      'Data Interpretation',
      '2D and 3D Geometry',
      'Numerical Computation',
      'Numerical Reasoning',
      'Numerical Estimation',
    ],
  },
]

// ---------------------------------------------------------------------------
// 3. Build rows and upsert
// ---------------------------------------------------------------------------
function buildTopicId(subjectId, topicName) {
  return `${subjectId}::${topicName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`
}

// Determine which schema version is live by probing for the topic_id column.
// migration-16 schema: UNIQUE(subject_id, topic_name) — no topic_id column, exam CHECK is 'CS'|'DA' only
// migration-19 schema: UNIQUE(exam, subject_id, topic_name) — has topic_id, exam CHECK includes 'GA'
const { error: probeError } = await supabase
  .from('gate_syllabus')
  .select('topic_id')
  .limit(1)

const hasMigration19 = !probeError
if (hasMigration19) {
  console.log('  ℹ️   Detected migration-19 schema (topic_id column present)\n')
} else {
  console.log('  ℹ️   Detected migration-16 schema (no topic_id column); GA rows skipped (exam CHECK only allows CS/DA)\n')
}

/** @type {Array<Record<string, string>>} */
const rows = []
for (const entry of SYLLABUS) {
  // migration-16 CHECK constraint only allows 'CS' or 'DA', not 'GA'
  if (!hasMigration19 && entry.exam === 'GA') continue

  for (const topic of entry.topics) {
    /** @type {Record<string, string>} */
    const row = {
      subject_id: entry.subjectId,
      subject_name: entry.subjectName,
      exam: entry.exam,
      topic_name: topic,
    }
    if (hasMigration19) {
      row.topic_id = buildTopicId(entry.subjectId, topic)
    }
    rows.push(row)
  }
}

console.log(`\n📚  Seeding gate_syllabus — ${rows.length} topics across ${SYLLABUS.length} subjects\n`)

const BATCH = 50
let inserted = 0
let skipped = 0

for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH)
  // migration-16: UNIQUE(subject_id, topic_name)
  // migration-19: UNIQUE(exam, subject_id, topic_name)
  const conflictCols = hasMigration19 ? 'exam,subject_id,topic_name' : 'subject_id,topic_name'
  const { data, error } = await supabase
    .from('gate_syllabus')
    .upsert(batch, {
      onConflict: conflictCols,
      ignoreDuplicates: true,
    })
    .select('id')

  if (error) {
    console.error(`❌  Batch ${Math.floor(i / BATCH) + 1} failed:`, error.message)
    process.exit(1)
  }

  const batchInserted = data?.length ?? 0
  const batchSkipped = batch.length - batchInserted
  inserted += batchInserted
  skipped += batchSkipped

  const subjects = [...new Set(batch.map((r) => r.subject_name))]
  console.log(
    `  ✅  Batch ${String(Math.floor(i / BATCH) + 1).padStart(2)} — inserted ${batchInserted}, skipped ${batchSkipped}  [${subjects.join(', ')}]`,
  )
}

console.log(`\n🎉  Done — inserted ${inserted} new rows, ${skipped} already existed.\n`)
