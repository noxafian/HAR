#!/usr/bin/env node
/**
 * Seed GATE 2027 syllabus topics into gate_syllabus table
 * Follow bootstrap-owner.mjs pattern: manual .env.local parsing, service role client
 */
import { createClient } from '@supabase/supabase-js'
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

// Create service role client
const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
})

// GATE 2027 Syllabus Data
const GATE_SYLLABUS = [
  { subject_id: 'cs-engineering-math', subject_name: 'Engineering Mathematics', exam: 'CS', topics: ['Discrete Mathematics', 'Linear Algebra', 'Calculus', 'Probability and Statistics', 'Graph Theory'] },
  { subject_id: 'cs-digital-logic', subject_name: 'Digital Logic', exam: 'CS', topics: ['Boolean Algebra', 'Combinational Circuits', 'Sequential Circuits', 'Number Representations', 'K-Maps', 'Logic Gates'] },
  { subject_id: 'cs-computer-org', subject_name: 'Computer Organization', exam: 'CS', topics: ['Machine Instructions', 'ALU', 'CPU Control', 'Memory Hierarchy', 'I/O Interface', 'Pipelining', 'Cache Memory'] },
  { subject_id: 'cs-programming', subject_name: 'Programming and Data Structures', exam: 'CS', topics: ['Recursion', 'Arrays and Linked Lists', 'Stacks and Queues', 'Trees', 'Graphs', 'Hashing', 'Heaps'] },
  { subject_id: 'cs-algorithms', subject_name: 'Algorithms', exam: 'CS', topics: ['Sorting', 'Searching', 'Graph Algorithms', 'Dynamic Programming', 'Greedy Algorithms', 'Divide and Conquer', 'NP-Completeness', 'Complexity Analysis', 'Backtracking'] },
  { subject_id: 'cs-toc', subject_name: 'Theory of Computation', exam: 'CS', topics: ['Regular Languages and FA', 'Context-Free Grammars', 'Pushdown Automata', 'Turing Machines', 'Decidability', 'Complexity Classes'] },
  { subject_id: 'cs-compiler', subject_name: 'Compiler Design', exam: 'CS', topics: ['Lexical Analysis', 'Parsing', 'Syntax-Directed Translation', 'Intermediate Code Generation', 'Code Optimization', 'Code Generation', 'Symbol Tables'] },
  { subject_id: 'cs-os', subject_name: 'Operating Systems', exam: 'CS', topics: ['Processes and Threads', 'CPU Scheduling', 'Deadlock Detection and Prevention', 'Memory Management', 'Virtual Memory and Paging', 'File Systems', 'Disk Scheduling', 'I/O Management'] },
  { subject_id: 'cs-databases', subject_name: 'Databases', exam: 'CS', topics: ['ER Model', 'Relational Algebra', 'SQL Queries', 'Normalization', 'Transaction Management', 'Indexing and Hashing', 'Query Processing and Optimization'] },
  { subject_id: 'cs-networks', subject_name: 'Computer Networks', exam: 'CS', topics: ['OSI and TCP/IP Model', 'Data Link Layer', 'Routing Algorithms', 'TCP and UDP', 'Congestion Control', 'Application Layer Protocols', 'Network Security'] },
  { subject_id: 'da-prob-stats', subject_name: 'Probability and Statistics', exam: 'DA', topics: ['Random Variables', 'Probability Distributions', 'Hypothesis Testing', 'Linear Regression', 'Bayesian Inference', 'Sampling Theory', 'Descriptive Statistics'] },
  { subject_id: 'da-linear-algebra', subject_name: 'Linear Algebra', exam: 'DA', topics: ['Matrices and Determinants', 'Eigenvalues and Eigenvectors', 'Singular Value Decomposition', 'Vector Spaces', 'Linear Transformations', 'Orthogonality'] },
  { subject_id: 'da-calculus', subject_name: 'Calculus and Optimization', exam: 'DA', topics: ['Differential Calculus', 'Gradient Descent', 'Convex Optimization', 'Lagrange Multipliers', 'Multivariate Calculus', 'Integration Techniques'] },
  { subject_id: 'da-ml', subject_name: 'Machine Learning', exam: 'DA', topics: ['Supervised Learning', 'Unsupervised Learning', 'Neural Networks and Deep Learning', 'Decision Trees and Random Forests', 'SVM', 'Clustering Algorithms', 'Dimensionality Reduction', 'Model Evaluation and Metrics', 'Overfitting and Regularization'] },
  { subject_id: 'da-ai', subject_name: 'Artificial Intelligence', exam: 'DA', topics: ['Search Algorithms', 'Knowledge Representation', 'Planning and Reasoning', 'Fuzzy Logic', 'Natural Language Processing Basics'] },
  { subject_id: 'da-programming', subject_name: 'Programming and Data Structures', exam: 'DA', topics: ['Python Fundamentals', 'Data Structures in Python', 'Algorithm Design', 'NumPy and Pandas', 'File I/O and Data Processing'] },
  { subject_id: 'da-databases', subject_name: 'Database Management', exam: 'DA', topics: ['SQL and Relational Databases', 'NoSQL Databases', 'Data Warehousing', 'OLAP and OLTP', 'ETL Pipelines'] },
  { subject_id: 'da-bigdata', subject_name: 'Big Data Technologies', exam: 'DA', topics: ['MapReduce Paradigm', 'Hadoop Ecosystem', 'Apache Spark', 'Stream Processing', 'Distributed Storage Systems'] },
  { subject_id: 'da-visualization', subject_name: 'Data Visualization', exam: 'DA', topics: ['Chart Types and Selection', 'Matplotlib and Seaborn', 'Interactive Dashboards', 'Storytelling with Data', 'Exploratory Data Analysis'] }
]

async function run() {
  console.log('Starting GATE 2027 syllabus seeding...')
  
  // Flatten syllabus into individual topic records
  const topicRecords = []
  for (const subject of GATE_SYLLABUS) {
    for (const topic of subject.topics) {
      topicRecords.push({
        subject_id: subject.subject_id,
        subject_name: subject.subject_name,
        exam: subject.exam,
        topic_name: topic
      })
    }
    console.log(`Prepared ${subject.subject_name} (${subject.topics.length} topics)`)
  }

  console.log(`\nInserting ${topicRecords.length} topics...`)

  // Upsert all topics (idempotent)
  const { data, error } = await admin
    .from('gate_syllabus')
    .upsert(topicRecords, { onConflict: 'subject_id,topic_name' })
    .select()

  if (error) {
    console.error('Error seeding topics:', error.message)
    process.exit(1)
  }

  console.log(`\n✓ Successfully seeded ${topicRecords.length} topics across ${GATE_SYLLABUS.length} subjects`)
  console.log(`  - CS subjects: ${GATE_SYLLABUS.filter(s => s.exam === 'CS').length}`)
  console.log(`  - DA subjects: ${GATE_SYLLABUS.filter(s => s.exam === 'DA').length}`)
}

run().catch(error => {
  console.error('Seeding failed:', error instanceof Error ? error.message : 'Unknown error')
  process.exit(1)
})
