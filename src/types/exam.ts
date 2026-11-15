/** Official GATE paper codes. DA = Data Science & AI. CS = Computer Science. GA = General Aptitude. */
export type ExamPaper = 'CS' | 'DA' | 'GA'

export interface ExamSchedule {
  paper: ExamPaper
  /**
   * null = official schedule not yet configured.
   * Display "Official paper schedule not configured." when null.
   */
  configuredDate: Date | null
  sessionLabel: string | null
  timezone: string
}

export interface ExamSession {
  id: string
  paper: ExamPaper
  year: number
  durationMinutes: number
  totalMarks: number | null
  totalQuestions: number | null
}
