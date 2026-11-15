export interface TopActiveUser {
  user_id: string
  display_name: string
  attempt_count: number
}

export interface SubjectQuestionCount {
  subject_id: string
  subject_name: string
  count: number
}

export interface DailySignup {
  date: string
  count: number
}

export interface PlatformAnalytics {
  total_users: number
  active_last_7_days: number
  active_last_30_days: number
  total_questions: number
  published_questions: number
  total_mock_tests: number
  published_mock_tests: number
  total_pyq_attempts: number
  total_mock_attempts: number
  top_5_active_users: TopActiveUser[]
  questions_by_subject: SubjectQuestionCount[]
  daily_signups_last_30_days: DailySignup[]
}
