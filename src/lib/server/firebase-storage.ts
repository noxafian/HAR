/** Supabase Storage operations for server-side file management.
 *  Drop-in replacement for the former Firebase Storage module —
 *  same exported function signatures, Supabase under the hood.
 */
import 'server-only'
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'library'

/** Service-role Supabase client — bypasses RLS for admin storage ops. */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase credentials are not configured.')
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * Upload a file to Supabase Storage.
 * @param path - Storage path (e.g., "library/file.pdf")
 * @param buffer - File content as Buffer
 * @param contentType - MIME type of the file
 */
export async function uploadFile(
  path: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  const supabase = getAdminClient()
  // Strip leading "library/" prefix — the bucket IS "library"
  const storagePath = path.startsWith(`${BUCKET}/`) ? path.slice(BUCKET.length + 1) : path

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType, upsert: true })

  if (error) throw new Error(`Storage upload failed: ${error.message}`)
}

/**
 * Get a signed URL for downloading a file.
 * @param path - Storage path (e.g., "library/timestamp-file.pdf")
 * @param expiresInMs - Expiration time in milliseconds
 * @returns Signed download URL
 */
export async function getSignedUrl(
  path: string,
  expiresInMs: number,
): Promise<string> {
  const supabase = getAdminClient()
  const storagePath = path.startsWith(`${BUCKET}/`) ? path.slice(BUCKET.length + 1) : path
  const expiresInSeconds = Math.ceil(expiresInMs / 1000)

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds)

  if (error || !data?.signedUrl) throw new Error(`Failed to create signed URL: ${error?.message ?? 'No URL returned'}`)
  return data.signedUrl
}

/**
 * Delete a file from Supabase Storage.
 * @param path - Storage path
 */
export async function deleteFile(path: string): Promise<void> {
  const supabase = getAdminClient()
  const storagePath = path.startsWith(`${BUCKET}/`) ? path.slice(BUCKET.length + 1) : path

  const { error } = await supabase.storage.from(BUCKET).remove([storagePath])
  // Ignore 404-equivalent — file already gone is fine
  if (error && !error.message.toLowerCase().includes('not found')) {
    throw new Error(`Storage delete failed: ${error.message}`)
  }
}

/**
 * Get file metadata from Supabase Storage.
 * @param path - Storage path
 */
export async function getFileMetadata(
  path: string,
): Promise<{ size: number; contentType: string | null }> {
  const supabase = getAdminClient()
  const storagePath = path.startsWith(`${BUCKET}/`) ? path.slice(BUCKET.length + 1) : path

  // list() is the only way to get metadata for a single file in Supabase
  const parts = storagePath.split('/')
  const fileName = parts.pop()!
  const folder = parts.join('/')

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(folder || undefined, { search: fileName })

  if (error) throw new Error(`Metadata lookup failed: ${error.message}`)
  const file = data?.find((f) => f.name === fileName)
  if (!file) throw new Error('File not found in storage')

  return {
    size: file.metadata?.size ?? 0,
    contentType: file.metadata?.mimetype ?? null,
  }
}

/**
 * Download file bytes from Supabase Storage.
 * @param path - Storage path
 * @param maximumBytes - Maximum allowed file size
 */
export async function downloadBytes(
  path: string,
  maximumBytes: number,
): Promise<Buffer> {
  const supabase = getAdminClient()
  const storagePath = path.startsWith(`${BUCKET}/`) ? path.slice(BUCKET.length + 1) : path

  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath)
  if (error || !data) throw new Error(`Download failed: ${error?.message ?? 'No data returned'}`)

  const arrayBuffer = await data.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  if (buffer.length > maximumBytes) throw new Error('File exceeds the configured maximum size')
  return buffer
}
