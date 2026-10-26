import { mkdir, writeFile, readFile, unlink, stat } from "fs/promises";
import path from "path";
import os from "os";
import { randomBytes } from "crypto";
import { supabaseStorage, storageConfig } from "./supabase-storage";

export { supabaseStorage, storageConfig } from "./supabase-storage";

/**
 * Storage abstraction with reusable Supabase Storage integration.
 *
 * In serverless environments (e.g. Vercel, AWS Lambda), the runtime filesystem
 * (/var/task) is read-only (EROFS). We use os.tmpdir() (/tmp) for ephemeral caching
 * and ensure that local disk operations are safely guarded, with Supabase Storage
 * acting as the primary persistent cloud store.
 */

function getStorageDir(): string {
  if (
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT
  ) {
    return path.join(os.tmpdir(), "net_rent_storage");
  }
  return path.join(process.cwd(), "download", "storage");
}

async function ensureDir() {
  try {
    await mkdir(getStorageDir(), { recursive: true });
  } catch {
    // Non-fatal if filesystem is restricted or read-only
  }
}

export interface StoredFile {
  key: string;
  size: number;
  publicUrl?: string | null;
}

export interface PutFileOptions {
  folder?: string;
  entityType?: string | null;
  category?: string | null;
  mimeType?: string;
  fileName?: string;
}

/** Compute the public URL for a file in Supabase Storage */
export function getSupabasePublicUrl(key: string, folder: string = "payments"): string | null {
  if (!storageConfig.isConfigured) return null;
  const targetPath = key.includes("/") ? key : `${folder}/${key}`;
  return supabaseStorage.getPublicUrl(targetPath);
}

/**
 * Store a file in local cache and automatically upload to Supabase Storage bucket.
 * Folder routing is fully automatic based on entityType/category unless overridden.
 */
export async function putFile(
  data: ArrayBuffer | Buffer,
  ext?: string,
  options?: PutFileOptions
): Promise<StoredFile> {
  const key = randomBytes(16).toString("hex") + (ext ? `.${ext}` : "");
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);

  // 1. Write to local cache (non-fatal if read-only or in serverless environment)
  try {
    await ensureDir();
    await writeFile(path.join(getStorageDir(), key), buf);
  } catch (err) {
    console.warn("Notice: Local storage write skipped or unavailable:", (err as Error).message);
  }

  let publicUrl: string | null = null;
  let supabaseUploadError: Error | null = null;

  // 2. Automatically upload to Supabase Storage if configured
  if (storageConfig.isConfigured) {
    const folder = options?.folder || storageConfig.resolveFolder(options?.entityType, options?.category);
    const mimeType = options?.mimeType ?? "application/octet-stream";
    const targetPath = `${folder}/${key}`;

    try {
      const uploadRes = await supabaseStorage.upload({
        path: targetPath,
        data: buf,
        mimeType,
        upsert: true,
      });
      publicUrl = uploadRes.publicUrl;

      // Also mirror with original human-readable fileName if distinct
      if (options?.fileName && options.fileName !== key) {
        const namedPath = `${folder}/${options.fileName}`;
        supabaseStorage.upload({
          path: namedPath,
          data: buf,
          mimeType,
          upsert: true,
        }).catch(() => {
          // non-fatal background upload
        });
      }
    } catch (err) {
      supabaseUploadError = err as Error;
      console.warn("Notice: Supabase Storage upload error:", (err as Error).message);
    }
  }

  // In serverless environments where local disk cannot persist files across invocations,
  // surface an actionable error if Supabase upload failed (e.g. missing service role key or RLS).
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (isServerless && supabaseUploadError) {
    throw new Error(
      `Cloud storage upload failed: ${supabaseUploadError.message}. ` +
      `Please ensure SUPABASE_SERVICE_ROLE_KEY is set in your Vercel Environment Variables.`
    );
  }

  return { key, size: buf.byteLength, publicUrl };
}

/** Retrieve a file by its opaque key, checking local cache first, then Supabase Storage. */
export async function getFile(key: string, folder: string = "payments"): Promise<Buffer | null> {
  try {
    // Guard against path traversal — key must be safe characters
    if (!/^[a-f0-9]+(\.[a-z0-9]+)?$/i.test(key) && !/^[a-zA-Z0-9_\-\.]+$/.test(key)) {
      return null;
    }

    // 1. Try local filesystem cache first
    try {
      const localBuf = await readFile(path.join(getStorageDir(), key));
      if (localBuf && localBuf.length > 0) return localBuf;
    } catch {
      // not in local cache, proceed to fetch from Supabase
    }

    // 2. Fetch from Supabase Storage
    if (storageConfig.isConfigured) {
      const pathsToTry = [
        `${folder}/${key}`,
        `payments/${key}`,
        `attachments/${key}`,
        `contracts/${key}`,
        `invoices/${key}`,
        key,
      ];

      for (const p of pathsToTry) {
        try {
          const buf = await supabaseStorage.download(p);
          if (buf && buf.length > 0) {
            // Cache locally for faster subsequent access
            try {
              await ensureDir();
              await writeFile(path.join(getStorageDir(), key), buf);
            } catch {
              // ignore cache write error
            }
            return buf;
          }
        } catch {
          // try next path
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/** Delete a stored file from local cache and Supabase Storage. */
export async function deleteFile(key: string, folder: string = "payments"): Promise<void> {
  try {
    if (!/^[a-f0-9]+(\.[a-z0-9]+)?$/i.test(key) && !/^[a-zA-Z0-9_\-\.]+$/.test(key)) {
      return;
    }

    // 1. Delete from local cache
    try {
      await unlink(path.join(getStorageDir(), key));
    } catch {
      // ignore
    }

    // 2. Delete from Supabase Storage
    if (storageConfig.isConfigured) {
      await supabaseStorage.delete([`${folder}/${key}`, `payments/${key}`, key]);
    }
  } catch {
    // ignore
  }
}

/** Get the size of a stored file (for validation/display). */
export async function fileSize(key: string): Promise<number | null> {
  try {
    if (!/^[a-f0-9]+(\.[a-z0-9]+)?$/i.test(key) && !/^[a-zA-Z0-9_\-\.]+$/.test(key)) {
      return null;
    }
    const s = await stat(path.join(getStorageDir(), key));
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
