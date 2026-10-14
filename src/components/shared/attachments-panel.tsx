"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Paperclip,
  Upload,
  Download,
  Trash2,
  Loader2,
  FileText,
  Image as ImageIcon,
  File,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatRelative } from "@/lib/format";
import { formatBytes } from "@/lib/storage";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Attachment = {
  id: string;
  entityType: string;
  entityId: string;
  category: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sizeLabel: string;
  uploadedBy: { name: string | null; email: string } | null;
  createdAt: string;
};

const CATEGORY_OPTS = [
  { value: "CONTRACT", label: "Contract" },
  { value: "QUOTATION", label: "Quotation" },
  { value: "INVOICE", label: "Invoice" },
  { value: "RECEIPT", label: "Receipt" },
  { value: "PROVIDER_DOC", label: "Provider doc" },
  { value: "OTHER", label: "Other" },
] as const;

function iconForMime(mime: string) {
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime === "application/pdf") return FileText;
  return File;
}

export function AttachmentsPanel({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: string;
}) {
  const qc = useQueryClient();
  const [uploading, setUploading] = React.useState(false);
  const [category, setCategory] = React.useState<string>(
    entityType === "contract" ? "CONTRACT" : entityType === "invoice" ? "INVOICE" : "OTHER"
  );
  const [deleting, setDeleting] = React.useState<Attachment | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { data: attachments = [], isLoading } = useQuery<Attachment[]>({
    queryKey: ["attachments", entityType, entityId],
    queryFn: () => {
      const qs = new URLSearchParams({ entityType, entityId });
      return api<Attachment[]>(`/api/attachments?${qs.toString()}`);
    },
  });

  const onFileSelected = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("entityType", entityType);
      fd.append("entityId", entityId);
      fd.append("category", category);
      const res = await fetch("/api/attachments", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Upload failed");
      toast.success(`Uploaded ${file.name}`);
      qc.invalidateQueries({ queryKey: ["attachments", entityType, entityId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) onFileSelected(f);
  };

  const delMut = async (id: string) => {
    await api(`/api/attachments/${id}`, { method: "DELETE" });
    toast.success("Attachment deleted");
    setDeleting(null);
    qc.invalidateQueries({ queryKey: ["attachments", entityType, entityId] });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Paperclip className="size-4 text-muted-foreground" />
          Attachments
          {attachments.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">{attachments.length}</Badge>
          )}
        </p>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTS.map((c) => (
              <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 px-3 py-4 text-xs text-muted-foreground transition hover:border-primary/40 hover:bg-primary/5"
      >
        {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
        <span>{uploading ? "Uploading..." : "Drop a file or click to upload (max 5 MB)"}</span>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFileSelected(f);
            e.target.value = "";
          }}
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : attachments.length === 0 ? (
        <p className="py-2 text-center text-xs text-muted-foreground">No attachments yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {attachments.map((a) => {
            const Icon = iconForMime(a.mimeType);
            return (
              <li
                key={a.id}
                className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-2 text-xs transition hover:bg-muted/30"
              >
                <div className="flex size-7 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                  <Icon className="size-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <a
                    href={`/api/attachments/${a.id}/download`}
                    className="block truncate font-medium hover:text-primary hover:underline"
                    title={a.fileName}
                  >
                    {a.fileName}
                  </a>
                  <p className="text-[10px] text-muted-foreground">
                    {a.sizeLabel} · {a.uploadedBy?.name ?? a.uploadedBy?.email ?? "—"} · {formatRelative(a.createdAt)}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 text-[9px]">
                  {CATEGORY_OPTS.find((c) => c.value === a.category)?.label ?? a.category}
                </Badge>
                <a
                  href={`/api/attachments/${a.id}/download`}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Download"
                >
                  <Download className="size-3.5" />
                </a>
                <button
                  onClick={() => setDeleting(a)}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"
                  aria-label="Delete"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title="Delete attachment"
        description={deleting ? `Delete "${deleting.fileName}"? The file will be permanently removed from storage.` : ""}
        confirmText="Delete"
        destructive
        onConfirm={() => deleting && delMut(deleting.id)}
      />
    </div>
  );
}
