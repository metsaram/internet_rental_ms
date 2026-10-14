import { mkdir, writeFile, readFile, unlink, stat } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

/**
 * Phase 11 — Storage abstraction.
 *
 * In production this would be backed by S3/Vercel Blob/Supabase Storage with
 * short-lived signed URLs. For the sandbox we use the local filesystem under
 * `download/storage/`, with opaque keys so the real path is never exposed to
 * the client. The interface (put/get/delete) stays the same so swapping to a
 * cloud provider later is a drop-in change.
 *
 * Security: keys are random hex strings; the entity owner + company are
 * verified by the API route before issuing a download. Files are never served
 * statically — only via the authenticated `/api/attachments/[id]/download`
 * route.
 */

const STORAGE_DIR = path.join(process.cwd(), "download", "storage");

async function ensureDir() {
  await mkdir(STORAGE_DIR, { recursive: true });
}

export interface StoredFile {
  key: string;
  size: number;
}

/** Store a file and return an opaque key + size. */
export async function putFile(
  data: ArrayBuffer | Buffer,
  ext?: string
): Promise<StoredFile> {
  await ensureDir();
  const key = randomBytes(16).toString("hex") + (ext ? `.${ext}` : "");
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  await writeFile(path.join(STORAGE_DIR, key), buf);
  return { key, size: buf.byteLength };
}

/** Retrieve a file by its opaque key. Returns null if missing. */
export async function getFile(key: string): Promise<Buffer | null> {
  try {
    // Guard against path traversal — key must be a bare filename.
    if (!/^[a-f0-9]+(\.[a-z0-9]+)?$/i.test(key)) return null;
    return await readFile(path.join(STORAGE_DIR, key));
  } catch {
    return null;
  }
}

/** Delete a stored file. No-op if missing. */
export async function deleteFile(key: string): Promise<void> {
  try {
    if (!/^[a-f0-9]+(\.[a-z0-9]+)?$/i.test(key)) return;
    await unlink(path.join(STORAGE_DIR, key));
  } catch {
    // ignore — file may already be gone
  }
}

/** Get the size of a stored file (for validation/display). */
export async function fileSize(key: string): Promise<number | null> {
  try {
    if (!/^[a-f0-9]+(\.[a-z0-9]+)?$/i.test(key)) return null;
    const s = await stat(path.join(STORAGE_DIR, key));
    return s.size;
  } catch {
    return null;
  }
}

/** Allowed MIME types for uploads. */
export const ALLOWED_MIME = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.ms-excel",
];

export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

export function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME.includes(mime);
}

/** Human-readable file size. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
