import Link from 'next/link'
import {
  GraduationCap, Library, ClipboardList, Sparkles, BarChart2, Users,
  Lock, BookOpen, Timer, RotateCcw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const features = [
  {
    Icon: GraduationCap,
    title: 'Examination Workspaces',
    description: 'Dedicated spaces for GATE CS 2027 and GATE DA 2027 with independent syllabi, progress tracking, and analytics.',
    badge: 'CS & DA',
  },
  {
    Icon: Library,
    title: 'Shared Study Library',
    description: 'Centrally verified study materials — PDFs, notes, and resources — organised by subject and topic.',
    badge: null,
  },
  {
    Icon: ClipboardList,
    title: 'Mock Examinations',
    description: 'Full-length timed mock tests with MCQ, MSQ, and NAT question types in a professional exam interface.',
    badge: null,
  },
  {
    Icon: Sparkles,
    title: 'AI Study Assistant',
    description: 'Connect your preferred AI provider to get subject-specific explanations, generate flashcards, and practice questions.',
    badge: 'Phase B',
  },
  {
    Icon: BarChart2,
    title: 'Performance Analytics',
    description: 'Track syllabus coverage, PYQ accuracy, mock test history, and identify weak topics across your preparation.',
    badge: null,
  },
  {
    Icon: Users,
    title: 'Group Collaboration',
    description: 'Participate in group discussions, share doubts, respond to weekly challenges, and contribute to the community.',
    badge: null,
  },
  {
    Icon: BookOpen,
    title: 'PYQ Bank',
    description: 'Curated previous-year questions with official answers, organised by year, paper, subject, and topic.',
    badge: null,
  },
  {
    Icon: RotateCcw,
    title: 'Revision System',
    description: 'Scheduled topic-wise revision, mistake notebook, and flashcards to systematically consolidate your learning.',
    badge: null,
  },
  {
    Icon: Timer,
    title: 'Focus Timer',
    description: 'Pomodoro-based focus timer with configurable durations, session tracking, and study log.',
    badge: null,
  },
]

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Nav bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/90">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <span className="font-bold text-indigo-600 dark:text-indigo-400">Keryvion StudyHub</span>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link href="/request-access">
              <Button size="sm">Request Access</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50 to-white pb-20 pt-24 dark:from-indigo-950/30 dark:to-slate-950">
          <div className="mx-auto max-w-3xl px-4 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
              <Lock className="h-3 w-3" />
              Invitation-only platform · GATE 2027
            </div>
            <h1 className="mb-4 text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl">
              Your GATE 2027{' '}
              <span className="text-indigo-600 dark:text-indigo-400">Preparation Hub</span>
            </h1>
            <p className="mb-8 text-lg text-slate-600 dark:text-slate-400">
              A private, collaborative learning platform for GATE CS and DA preparation.
              Structured workspaces, verified resources, mock tests, and AI-powered study assistance — all in one place.
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link href="/login">
                <Button size="lg" className="w-full sm:w-auto">Sign In</Button>
              </Link>
              <Link href="/request-access">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">Request Access</Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="mb-2 text-center text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Everything you need to crack GATE 2027
          </h2>
          <p className="mb-10 text-center text-slate-500 dark:text-slate-400">
            Built specifically for serious GATE preparation — not a generic study app.
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ Icon, title, description, badge }) => (
              <div
                key={title}
                className="group flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950">
                    <Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                  </div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
                    {badge && <Badge variant="secondary" className="text-xs">{badge}</Badge>}
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Callout */}
        <section className="bg-indigo-600 dark:bg-indigo-700">
          <div className="mx-auto max-w-3xl px-4 py-14 text-center">
            <h2 className="mb-3 text-2xl font-bold text-white">Ready to start preparing?</h2>
            <p className="mb-6 text-indigo-100">
              Keryvion StudyHub is available by invitation. Request access and the owner will review your application.
            </p>
            <Link href="/request-access">
              <Button variant="secondary" size="lg">Request Access</Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-center text-sm text-slate-500">© {new Date().getFullYear()} Keryvion Labs</p>
      </footer>
    </div>
  )
}
