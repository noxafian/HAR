import type { ExamPaper } from '@/types/exam'
import type { Subject } from '@/types/syllabus'

export const MAX_UPLOAD_SIZE_BYTES = 52428800 // 50 MB

export const EXAM_PAPERS: ExamPaper[] = ['CS', 'DA', 'GA']

export const ROUTE_PATHS = {
  home: '/',
  login: '/login',
  register: '/register',
  requestAccess: '/request-access',
  accessPending: '/access-pending',
  accessDenied: '/access-denied',
  app: '/app',
  library: '/app/library',
  libraryResource: (id: string) => `/app/library/${id}`,
  examCS: '/app/exams/cs-2027',
  examDA: '/app/exams/da-2027',
  examGA: '/app/exams/general-aptitude',
  pyq: '/app/pyq',
  practice: '/app/practice/algorithms',
  mockTests: '/app/mock-tests',
  mockTest: (id: string) => `/app/mock-tests/${id}`,
  sprint: '/app/sprint',
  revision: '/app/revision',
  flashcards: '/app/flashcards',
  mistakes: '/app/mistakes',
  planner: '/app/planner',
  focus: '/app/focus',
  analytics: '/app/analytics',
  ai: '/app/ai',
  aiConnect: '/app/ai/connect',
  community: '/app/community',
  discussion: (id: string) => `/app/community/discussions/${id}`,
  settingsProfile: '/app/settings/profile',
  settingsPrivacy: '/app/settings/privacy',
  admin: '/admin',
  adminMembers: '/admin/members',
  adminJoinRequests: '/admin/join-requests',
  adminResources: '/admin/resources',
  adminVideos: '/admin/videos',
  adminStorage: '/admin/storage',
  adminAudit: '/admin/audit',
  adminQuestions: '/admin/questions',
  adminMockStudio: '/admin/mock-studio',
  adminAnnouncements: '/admin/announcements',
  adminCommunity: '/admin/community',
  adminPlatformAnalytics: '/admin/platform-analytics',
} as const

/** CS subjects — reference only. Subtopic hierarchy imported from verified GATE 2027 syllabus in Phase B. */
export const CS_SUBJECTS: Omit<Subject, 'paper'>[] = [
  { id: 'cs-eng-math', name: 'Engineering Mathematics', order: 1 },
  { id: 'cs-discrete-math', name: 'Discrete Mathematics', order: 2 },
  { id: 'cs-digital-logic', name: 'Digital Logic', order: 3 },
  { id: 'cs-coa', name: 'Computer Organization and Architecture', order: 4 },
  { id: 'cs-pds', name: 'Programming and Data Structures', order: 5 },
  { id: 'cs-algorithms', name: 'Algorithms', order: 6 },
  { id: 'cs-toc', name: 'Theory of Computation', order: 7 },
  { id: 'cs-compiler', name: 'Compiler Design', order: 8 },
  { id: 'cs-os', name: 'Operating Systems', order: 9 },
  { id: 'cs-dbms', name: 'Database Management Systems', order: 10 },
  { id: 'cs-cn', name: 'Computer Networks', order: 11 },
]

/** DA subjects — reference only. Subtopic hierarchy imported from verified GATE 2027 syllabus in Phase B. */
export const DA_SUBJECTS: Omit<Subject, 'paper'>[] = [
  { id: 'da-prob-stats', name: 'Probability and Statistics', order: 1 },
  { id: 'da-linear-algebra', name: 'Linear Algebra', order: 2 },
  { id: 'da-calculus', name: 'Calculus and Optimization', order: 3 },
  { id: 'da-pds-algo', name: 'Programming, Data Structures and Algorithms', order: 4 },
  { id: 'da-dbms', name: 'Database Management and Warehousing', order: 5 },
  { id: 'da-ml', name: 'Machine Learning', order: 6 },
  { id: 'da-ai', name: 'Artificial Intelligence', order: 7 },
]

/** General Aptitude — shared across all GATE papers */
export const GA_SUBJECTS: Omit<Subject, 'paper'>[] = [
  { id: 'ga-verbal', name: 'Verbal Ability', order: 1 },
  { id: 'ga-quant', name: 'Quantitative Aptitude', order: 2 },
]
