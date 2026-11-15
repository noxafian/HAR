import type { ExamPaper } from './exam'

export type ResourceType = 'pdf' | 'png' | 'jpg' | 'jpeg' | 'docx' | 'pptx' | 'txt'

export type ResourceStatus = 'pending' | 'verified' | 'rejected' | 'unverified'

export interface Resource {
  id: string
  title: string
  description: string | null
  type: ResourceType
  status: ResourceStatus
  uploadedBy: string
  uploadedAt: Date
  sizeBytes: number
  examPaper: ExamPaper | null
  subjectId: string | null
  topicId: string | null
  version: number
  isBookmarked: boolean
}

export interface UploadConfig {
  maxSizeBytes: number
  allowedTypes: ResourceType[]
  /** Cloud storage not connected in Phase A. Upload available in Phase B. */
  cloudStorageAvailable: false
}

export const DEFAULT_UPLOAD_CONFIG: UploadConfig = {
  maxSizeBytes: 52428800, // 50 MB
  allowedTypes: ['pdf', 'png', 'jpg', 'jpeg', 'docx', 'pptx', 'txt'],
  cloudStorageAvailable: false,
}
