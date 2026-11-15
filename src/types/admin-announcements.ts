export interface AdminAnnouncement {
  id: string
  author_id: string
  author_name: string
  title: string
  body: string
  is_pinned: boolean
  published: boolean
  expires_at: string | null
  created_at: string
  updated_at: string | null
}

export interface CreateAnnouncementBody {
  title: string
  body: string
  is_pinned?: boolean
  published?: boolean
  expires_at?: string
}

export interface PatchAnnouncementBody {
  title?: string
  body?: string
  is_pinned?: boolean
  published?: boolean
  expires_at?: string | null
}
