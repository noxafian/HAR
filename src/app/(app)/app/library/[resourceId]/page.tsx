import { ResourceDetailClient } from '@/components/library/resource-detail-client'

export default async function ResourceDetailPage({ params }: { params: Promise<{ resourceId: string }> }) {
  const { resourceId } = await params
  return <ResourceDetailClient resourceId={resourceId} />
}
