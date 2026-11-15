import type { Resource } from '@/types/resource'
import type { ExamPaper } from '@/types/exam'

export interface ResourceFilters {
  search?: string
  examPaper?: ExamPaper
  subjectId?: string
  topicId?: string
  resourceType?: Resource['type']
  status?: Resource['status']
}

/**
 * Study library service interface.
 * Cloud storage (Cloudflare R2) integration: Phase B.
 */
export interface LibraryService {
  getResources(filters?: ResourceFilters): Promise<Resource[]>
  getResource(id: string): Promise<Resource>
  /** Returns a signed upload URL. Phase B only — not available in Phase A. */
  getUploadUrl(fileName: string, contentType: string): Promise<string>
  toggleBookmark(resourceId: string): Promise<void>
  reportResource(resourceId: string, reason: string): Promise<void>
  verifyResource(resourceId: string): Promise<void>
}
