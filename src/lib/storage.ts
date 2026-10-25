import { mkdir, writeFile, readFile, unlink, stat } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { supabaseStorage, storageConfig } from "./supabase-storage";

export { supabaseStorage, storageConfig } from "./supabase-storage";

/**
 * Storage abstraction with reusable Supabase Storage integration.
 *
 * Files are automatically saved to Supabase Object Storage using central bucket
 * configuration, with automatic entity-to-folder routing (payments/, contracts/,
 * invoices/, etc.). Local disk cache is kept under `download/storage/` for high
 * performance and offline resilience.
 */

const STORAGE_DIR = path.join(process.cwd(), "download", "storage");

async function ensureDir() {
  await mkdir(STORAGE_DIR, { recursive: true });
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
  await ensureDir();
  const key = randomBytes(16).toString("hex") + (ext ? `.${ext}` : "");
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);

  // 1. Write to local cache
  await writeFile(path.join(STORAGE_DIR, key), buf);

  let publicUrl: string | null = null;

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
      console.warn("Notice: Supabase Storage upload error, using local storage fallback:", (err as Error).message);
    }
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
      const localBuf = await readFile(path.join(STORAGE_DIR, key));
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
              await writeFile(path.join(STORAGE_DIR, key), buf);
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
      await unlink(path.join(STORAGE_DIR, key));
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
