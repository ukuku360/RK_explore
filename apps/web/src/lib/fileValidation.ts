const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp'])

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
])

type MagicSignature = { bytes: number[]; offset?: number }

const MAGIC_SIGNATURES: Record<string, MagicSignature[]> = {
  'image/jpeg': [{ bytes: [0xff, 0xd8, 0xff] }],
  'image/png': [{ bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  'image/gif': [
    { bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] }, // GIF87a
    { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] }, // GIF89a
  ],
  'image/webp': [
    { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF
    { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 }, // WEBP
  ],
}

function matchesMagicBytes(header: Uint8Array, sig: MagicSignature): boolean {
  const offset = sig.offset ?? 0
  if (header.length < offset + sig.bytes.length) return false
  return sig.bytes.every((byte, i) => header[offset + i] === byte)
}

async function readFileHeader(file: File, length = 12): Promise<Uint8Array> {
  const slice = file.slice(0, length)
  const buffer = await slice.arrayBuffer()
  return new Uint8Array(buffer)
}

export type FileValidationResult =
  | { ok: true }
  | { ok: false; message: string }

export async function validateImageFile(file: File): Promise<FileValidationResult> {
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, message: `File is too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` }
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { ok: false, message: `File type ".${ext}" is not allowed. Use jpg, png, gif, or webp.` }
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return { ok: false, message: `MIME type "${file.type}" is not allowed.` }
  }

  const header = await readFileHeader(file)

  // WebP needs both RIFF and WEBP markers.
  if (file.type === 'image/webp') {
    const sigs = MAGIC_SIGNATURES['image/webp']!
    const allMatch = sigs.every((sig) => matchesMagicBytes(header, sig))
    if (!allMatch) {
      return { ok: false, message: 'File content does not match its declared type.' }
    }
    return { ok: true }
  }

  const sigs = MAGIC_SIGNATURES[file.type]
  if (!sigs) {
    return { ok: false, message: 'Unable to verify file type.' }
  }

  const anyMatch = sigs.some((sig) => matchesMagicBytes(header, sig))
  if (!anyMatch) {
    return { ok: false, message: 'File content does not match its declared type.' }
  }

  return { ok: true }
}
