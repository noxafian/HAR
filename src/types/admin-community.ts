export interface AdminDiscussion {
  id: string
  author_id: string
  author_name: string
  title: string
  category: string
  reply_count: number
  is_pinned: boolean
  is_deleted: boolean
  created_at: string
}

export interface AdminReply {
  id: string
  discussion_id: string
  author_id: string
  author_name: string
  body: string
  is_deleted: boolean
  created_at: string
}

export interface AdminDiscussionListResponse {
  items: AdminDiscussion[]
  total: number
}
