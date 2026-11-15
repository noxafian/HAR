/**
 * src/security/validator.ts
 * File-type validation and input sanitization utilities
 */

export type AllowedFileExtension = 'pdf' | 'png' | 'jpg' | 'jpeg' | 'docx' | 'pptx' | 'txt'

export const ALLOWED_EXTENSIONS: AllowedFileExtension[] = [
  'pdf', 'png', 'jpg', 'jpeg', 'docx', 'pptx', 'txt',
]

export const EXTENSION_TO_MIME: Record<AllowedFileExtension, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
}

/**
 * File magic byte signatures for validation
 * Maps extension to expected leading bytes (hex)
 */
const MAGIC_BYTES: Partial<Record<AllowedFileExtension, number[][]>> = {
  pdf:  [[0x25, 0x50, 0x44, 0x46]], // %PDF
  png:  [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]], // PNG
  jpg:  [[0xFF, 0xD8, 0xFF]],        // JPEG
  jpeg: [[0xFF, 0xD8, 0xFF]],        // JPEG
  // DOCX/PPTX are ZIP-based — magic is PK\x03\x04
  docx: [[0x50, 0x4B, 0x03, 0x04]],
  pptx: [[0x50, 0x4B, 0x03, 0x04]],
  // TXT: no reliable magic bytes — validated by extension/MIME only
}

export interface FileValidationResult {
  valid: boolean
  extension?: AllowedFileExtension
  expectedMime?: string
  error?: string
}

/**
 * Extract and validate file extension from original filename
 * Never uses extension as a security boundary alone
 */
export function validateFileExtension(filename: string): FileValidationResult {
  const sanitized = filename.trim().toLowerCase()
  const lastDot = sanitized.lastIndexOf('.')
  if (lastDot === -1 || lastDot === sanitized.length - 1) {
    return { valid: false, error: 'No file extension found' }
  }

  const ext = sanitized.slice(lastDot + 1) as AllowedFileExtension
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: `Extension .${ext} is not allowed` }
  }

  return {
    valid: true,
    extension: ext,
    expectedMime: EXTENSION_TO_MIME[ext],
  }
}

/**
 * Validate file type using magic bytes (first bytes of file content)
 * @param bytes First 16 bytes of the file
 * @param declaredExtension Extension from filename
 */
export function validateFileMagicBytes(
  bytes: Uint8Array,
  declaredExtension: AllowedFileExtension
): boolean {
  const signatures = MAGIC_BYTES[declaredExtension]
  if (!signatures) {
    // No magic bytes defined for this type — pass through (txt)
    return true
  }

  return signatures.some(sig =>
    sig.every((byte, i) => bytes[i] === byte)
  )
}

/**
 * Validate file type from declared content-type and extension
 * Both must match the allowed set
 */
export function validateFileType(
  filename: string,
  declaredContentType: string,
): FileValidationResult {
  const extResult = validateFileExtension(filename)
  if (!extResult.valid || !extResult.extension) return extResult

  const expectedMime = EXTENSION_TO_MIME[extResult.extension]
  const normalizedDeclared = declaredContentType.split(';')[0].trim().toLowerCase()

  if (normalizedDeclared !== expectedMime) {
    return {
      valid: false,
      extension: extResult.extension,
      expectedMime,
      error: `Content-Type mismatch: expected ${expectedMime}, got ${normalizedDeclared}`,
    }
  }

  return extResult
}

/**
 * Sanitize a user-supplied string
 * Removes control characters, trims whitespace
 * Does NOT escape for HTML — that's a rendering concern
 */
export function sanitizeString(input: string, maxLength = 1000): string {
  return input
    .replace(/[\x00-\x1F\x7F]/g, '') // remove control characters
    .trim()
    .slice(0, maxLength)
}

/**
 * Sanitize filename for storage metadata
 * Strips path separators and dangerous characters
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[/\\<>:"|?*\x00-\x1F]/g, '_') // replace dangerous chars
    .replace(/\.{2,}/g, '_')                // prevent path traversal (double dots)
    .replace(/^\.+/, '_')                     // no leading dots
    .trim()
    .slice(0, 255)
}

/**
 * Validate max file size
 */
export function validateFileSize(sizeBytes: number): { valid: boolean; error?: string } {
  const maxBytes = parseInt(process.env.MAX_UPLOAD_SIZE_BYTES || '52428800', 10) // 50 MB default
  if (sizeBytes > maxBytes) {
    return {
      valid: false,
      error: `File size ${sizeBytes} bytes exceeds maximum ${maxBytes} bytes`,
    }
  }
  if (sizeBytes <= 0) {
    return { valid: false, error: 'File size must be greater than 0' }
  }
  return { valid: true }
}
