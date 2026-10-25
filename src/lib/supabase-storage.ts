/**
 * Reusable Supabase Storage client and configuration.
 *
 * Centralizes bucket configuration, authentication headers, endpoint generation,
 * folder resolution, and CRUD operations against Supabase Object Storage.
 */

export interface StorageConfig {
  url: string;
  key: string;
  bucket: string;
}

/** Global Supabase Storage configuration loaded from environment */
export const storageConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || "https://qqiegcibcbytabdqwwyn.supabase.co",
  key:
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "",
  bucket: process.env.SUPABASE_STORAGE_BUCKET || "net_rent",

  /** Check if Supabase Storage is configured and ready */
  get isConfigured(): boolean {
    return Boolean(this.url && this.bucket);
  },

  /** Map entity type / category to canonical storage folder in the bucket */
  resolveFolder(entityType?: string | null, category?: string | null): string {
    if (entityType === "payment" || category === "RECEIPT") return "payments";
    if (entityType === "contract" || category === "CONTRACT") return "contracts";
    if (entityType === "invoice" || category === "INVOICE") return "invoices";
    if (entityType === "template") return "template";
    return "attachments";
  },
};

export interface StorageUploadOptions {
  path: string;
  data: Buffer | Uint8Array | ArrayBuffer;
  mimeType?: string;
  upsert?: boolean;
  bucket?: string;
}

export interface StorageUploadResult {
  path: string;
  key: string;
  publicUrl: string;
  size: number;
}

export interface StorageListOptions {
  prefix?: string;
  limit?: number;
  bucket?: string;
}

export interface StorageListItem {
  name: string;
  id?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  metadata?: {
    size?: number;
    mimetype?: string;
    [key: string]: unknown;
  } | null;
}

/**
 * Reusable Supabase Storage operations
 */
export const supabaseStorage = {
  /** Get standard authentication and request headers */
  getHeaders(contentType?: string): Record<string, string> {
    const headers: Record<string, string> = {};
    if (storageConfig.key) {
      headers["apikey"] = storageConfig.key;
      headers["Authorization"] = `Bearer ${storageConfig.key}`;
    }
    if (contentType) {
      headers["Content-Type"] = contentType;
    }
    return headers;
  },

  /** Compute canonical public URL for an object */
  getPublicUrl(targetPath: string, bucket: string = storageConfig.bucket): string {
    const normalized = targetPath.replace(/^\/+/, "");
    return `${storageConfig.url}/storage/v1/object/public/${bucket}/${normalized}`;
  },

  /** Compute authenticated endpoint URL for an object */
  getObjectUrl(targetPath: string, bucket: string = storageConfig.bucket): string {
    const normalized = targetPath.replace(/^\/+/, "");
    return `${storageConfig.url}/storage/v1/object/${bucket}/${normalized}`;
  },

  /**
   * Upload a file buffer to the Supabase Storage bucket.
   * Reusable for any entity, template, or payment slip.
   */
  async upload(options: StorageUploadOptions): Promise<StorageUploadResult> {
    if (!storageConfig.isConfigured) {
      throw new Error("Supabase Storage is not configured. Missing NEXT_PUBLIC_SUPABASE_URL or bucket.");
    }

    const bucket = options.bucket || storageConfig.bucket;
    const targetPath = options.path.replace(/^\/+/, "");
    const mimeType = options.mimeType || "application/octet-stream";
    const endpoint = this.getObjectUrl(targetPath, bucket);

    const buf = Buffer.isBuffer(options.data)
      ? options.data
      : Buffer.from(options.data as ArrayBuffer);

    const headers = this.getHeaders(mimeType);
    if (options.upsert !== false) {
      headers["x-upsert"] = "true";
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: new Uint8Array(buf),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Supabase Storage upload to [${bucket}/${targetPath}] failed (HTTP ${res.status}): ${errText}`);
    }

    const publicUrl = this.getPublicUrl(targetPath, bucket);
    return {
      path: targetPath,
      key: targetPath.split("/").pop() || targetPath,
      publicUrl,
      size: buf.byteLength,
    };
  },

  /**
   * Download a file from the Supabase Storage bucket.
   * Tries public endpoint first, then authenticated endpoint.
   */
  async download(targetPath: string, bucket: string = storageConfig.bucket): Promise<Buffer | null> {
    if (!storageConfig.isConfigured) return null;

    const normalized = targetPath.replace(/^\/+/, "");
    const publicUrl = this.getPublicUrl(normalized, bucket);
    const authUrl = this.getObjectUrl(normalized, bucket);

    // 1. Try public endpoint
    try {
      const res = await fetch(publicUrl);
      if (res.ok) {
        return Buffer.from(await res.arrayBuffer());
      }
    } catch {
      // ignore and try auth endpoint
    }

    // 2. Try authenticated endpoint
    try {
      const res = await fetch(authUrl, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        return Buffer.from(await res.arrayBuffer());
      }
    } catch {
      // ignore
    }

    return null;
  },

  /**
   * Delete one or more files from the bucket by path prefixes.
   */
  async delete(paths: string | string[], bucket: string = storageConfig.bucket): Promise<void> {
    if (!storageConfig.isConfigured) return;

    const prefixes = Array.isArray(paths) ? paths : [paths];
    const normalizedPrefixes = prefixes.map((p) => p.replace(/^\/+/, ""));

    try {
      const endpoint = `${storageConfig.url}/storage/v1/object/${bucket}`;
      await fetch(endpoint, {
        method: "DELETE",
        headers: this.getHeaders("application/json"),
        body: JSON.stringify({ prefixes: normalizedPrefixes }),
      });
    } catch {
      // silent failure on delete
    }
  },

  /**
   * List files under a prefix in the bucket.
   */
  async list(options?: StorageListOptions): Promise<StorageListItem[]> {
    if (!storageConfig.isConfigured) return [];

    const bucket = options?.bucket || storageConfig.bucket;
    const prefix = options?.prefix?.replace(/^\/+/, "") || "";
    const endpoint = `${storageConfig.url}/storage/v1/object/list/${bucket}`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: this.getHeaders("application/json"),
        body: JSON.stringify({ prefix, limit: options?.limit || 100 }),
      });

      if (!res.ok) return [];
      return (await res.json()) as StorageListItem[];
    } catch {
      return [];
    }
  },
};
