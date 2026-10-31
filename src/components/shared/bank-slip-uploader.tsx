"use client";

import * as React from "react";
import { toast } from "sonner";
import { Upload, ClipboardPaste, FileText, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";

export interface BankSlipUploaderProps {
  file: File | null;
  previewUrl: string | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  maxSizeBytes?: number;
  allowedMimeTypes?: string[];
  className?: string;
  id?: string;
}

const DEFAULT_ALLOWED_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
];

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export function extractFileFromDataTransfer(
  dt: DataTransfer | null,
  allowedMimes: string[] = DEFAULT_ALLOWED_MIMES
): File | null {
  if (!dt) return null;

  // 1. Check dt.files
  if (dt.files && dt.files.length > 0) {
    for (let i = 0; i < dt.files.length; i++) {
      const f = dt.files[i];
      if (
        allowedMimes.includes(f.type) ||
        (f.type.startsWith("image/") && allowedMimes.some((m) => m.startsWith("image/")))
      ) {
        return f;
      }
    }
  }

  // 2. Check dt.items
  if (dt.items && dt.items.length > 0) {
    for (let i = 0; i < dt.items.length; i++) {
      const item = dt.items[i];
      if (
        item.kind === "file" &&
        (allowedMimes.includes(item.type) ||
          (item.type.startsWith("image/") && allowedMimes.some((m) => m.startsWith("image/"))))
      ) {
        const file = item.getAsFile();
        if (file) {
          const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
          const isGeneric = !file.name || file.name === "image.png" || file.name === "blob";
          const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
          const timeStr = Date.now().toString().slice(-4);
          const name = isGeneric ? `bank-slip-${dateStr}-${timeStr}.${ext}` : file.name;
          return new File([file], name, { type: file.type });
        }
      }
    }
  }

  return null;
}

export function BankSlipUploader({
  file,
  previewUrl,
  onSelect,
  onRemove,
  onError,
  disabled = false,
  maxSizeBytes = DEFAULT_MAX_SIZE,
  allowedMimeTypes = DEFAULT_ALLOWED_MIMES,
  className,
  id = "bank-slip-file",
}: BankSlipUploaderProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = React.useState(false);

  const validateFile = React.useCallback(
    (f: File): { valid: boolean; error?: string } => {
      const isMimeAllowed =
        allowedMimeTypes.includes(f.type) ||
        (f.type.startsWith("image/") && allowedMimeTypes.some((m) => m.startsWith("image/")));

      if (!isMimeAllowed) {
        return {
          valid: false,
          error: "Please select an image (PNG, JPG, WEBP, GIF) or PDF file",
        };
      }

      if (f.size > maxSizeBytes) {
        const maxMb = (maxSizeBytes / (1024 * 1024)).toFixed(0);
        return {
          valid: false,
          error: `File exceeds maximum allowed size of ${maxMb}MB`,
        };
      }

      return { valid: true };
    },
    [allowedMimeTypes, maxSizeBytes]
  );

  const processFile = React.useCallback(
    (selectedFile: File) => {
      const validation = validateFile(selectedFile);
      if (!validation.valid) {
        if (onError && validation.error) onError(validation.error);
        toast.error(validation.error);
        return false;
      }
      onSelect(selectedFile);
      return true;
    },
    [validateFile, onError, onSelect]
  );

  const handlePasteFromClipboard = React.useCallback(async () => {
    if (disabled) return;
    try {
      if (!navigator.clipboard?.read) {
        toast.info("Direct clipboard reading is not supported in this browser. Please press Ctrl+V to paste.");
        return;
      }

      const items = await navigator.clipboard.read();
      let foundFile: File | null = null;

      for (const item of items) {
        const matchingType = item.types.find(
          (t) =>
            allowedMimeTypes.includes(t) ||
            (t.startsWith("image/") && allowedMimeTypes.some((m) => m.startsWith("image/")))
        );

        if (matchingType) {
          const blob = await item.getType(matchingType);
          const ext = matchingType.split("/")[1]?.replace("jpeg", "jpg") || "png";
          const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
          const timeStr = Date.now().toString().slice(-4);
          foundFile = new File([blob], `bank-slip-${dateStr}-${timeStr}.${ext}`, {
            type: matchingType,
          });
          break;
        }
      }

      if (!foundFile) {
        toast.error("No image found in clipboard. Please copy an image first (e.g. from Telegram).");
        return;
      }

      const success = processFile(foundFile);
      if (success) {
        toast.success("Bank slip pasted from clipboard");
      }
    } catch (err: unknown) {
      const errorObj = err as Error;
      if (
        errorObj.name === "NotAllowedError" ||
        errorObj.message?.toLowerCase().includes("denied") ||
        errorObj.message?.toLowerCase().includes("permission")
      ) {
        toast.error("Clipboard permission denied. Press Ctrl+V to paste the image directly.");
      } else {
        toast.error("Could not read clipboard. Press Ctrl+V to paste the image.");
      }
    }
  }, [disabled, allowedMimeTypes, processFile]);

  const handleContainerPaste = (e: React.ClipboardEvent) => {
    if (disabled) return;
    const extracted = extractFileFromDataTransfer(e.clipboardData, allowedMimeTypes);
    if (extracted) {
      e.preventDefault();
      const success = processFile(extracted);
      if (success) {
        toast.success("Bank slip pasted from clipboard");
      }
    }
  };

  // Window paste listener for convenience when dialog is active
  React.useEffect(() => {
    const handleWindowPaste = (e: ClipboardEvent) => {
      if (disabled || e.defaultPrevented) return;
      const extracted = extractFileFromDataTransfer(e.clipboardData, allowedMimeTypes);
      if (extracted) {
        e.preventDefault();
        const success = processFile(extracted);
        if (success) {
          toast.success("Bank slip pasted from clipboard");
        }
      }
    };

    window.addEventListener("paste", handleWindowPaste);
    return () => window.removeEventListener("paste", handleWindowPaste);
  }, [disabled, allowedMimeTypes, processFile]);

  const handleBrowseClick = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <input
        ref={fileInputRef}
        id={id}
        type="file"
        accept={allowedMimeTypes.join(",")}
        className="hidden"
        disabled={disabled}
        data-testid="bank-slip-file-input"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            processFile(e.target.files[0]);
            e.target.value = "";
          }
        }}
      />

      <ContextMenu>
        <ContextMenuTrigger asChild>
          {file ? (
            <div
              tabIndex={0}
              onPaste={handleContainerPaste}
              className="relative flex items-center gap-3 rounded-lg border bg-muted/20 p-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-ring select-none"
              title="Right-click for options (Paste, Replace, Remove)"
              data-testid="bank-slip-preview-container"
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Bank slip preview"
                  className="size-14 rounded-md border object-cover bg-background shrink-0"
                />
              ) : (
                <div className="flex size-14 items-center justify-center rounded-md border bg-background shrink-0">
                  <FileText className="size-6 text-muted-foreground" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">{file.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB · Ready to save with payment
                </p>
                <p className="text-[10px] text-primary/80">Right-click or Ctrl+V to paste / replace</p>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handlePasteFromClipboard}
                  disabled={disabled}
                  className="size-7 text-muted-foreground hover:text-foreground"
                  title="Paste new image from clipboard (Ctrl+V)"
                  data-testid="bank-slip-replace-paste-btn"
                >
                  <ClipboardPaste className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onRemove}
                  disabled={disabled}
                  className="size-7 text-muted-foreground hover:text-destructive"
                  title="Remove image"
                  data-testid="bank-slip-remove-btn"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={handleBrowseClick}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleBrowseClick();
                }
              }}
              onPaste={handleContainerPaste}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!disabled) setIsDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragOver(false);
                if (disabled) return;
                const dropped = extractFileFromDataTransfer(e.dataTransfer, allowedMimeTypes);
                if (dropped) processFile(dropped);
              }}
              className={cn(
                "group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-3.5 text-center transition-all select-none focus:outline-none focus:ring-2 focus:ring-ring",
                isDragOver
                  ? "border-primary bg-primary/10 scale-[1.01]"
                  : "border-input bg-muted/10 hover:bg-muted/25 hover:border-primary/50",
                disabled && "opacity-50 pointer-events-none"
              )}
              data-testid="bank-slip-dropzone"
            >
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Upload className="size-4" />
                </div>
                <div className="flex size-8 items-center justify-center rounded-full bg-secondary/80 text-foreground">
                  <ClipboardPaste className="size-4" />
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-foreground">
                  Upload or paste bank transaction slip / receipt
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Drag & drop, browse, or paste with{" "}
                  <kbd className="px-1 py-0.5 rounded bg-muted border text-[9px] font-mono">
                    Ctrl+V
                  </kbd>{" "}
                  · Right-click for options
                </p>
              </div>

              <div
                className="flex items-center gap-2 pt-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={handleBrowseClick}
                  className="h-7 text-xs px-2.5"
                  data-testid="bank-slip-browse-btn"
                >
                  <Upload className="size-3 mr-1" />
                  Browse file
                </Button>
                <Button
                  type="button"
                  variant="subtle"
                  size="sm"
                  disabled={disabled}
                  onClick={handlePasteFromClipboard}
                  className="h-7 text-xs px-2.5"
                  data-testid="bank-slip-paste-btn"
                >
                  <ClipboardPaste className="size-3 mr-1" />
                  Paste image
                </Button>
              </div>
            </div>
          )}
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56" data-testid="bank-slip-context-menu">
          <ContextMenuItem
            onClick={handlePasteFromClipboard}
            disabled={disabled}
            data-testid="context-menu-paste-action"
          >
            <ClipboardPaste className="mr-2 size-4 text-primary" />
            <span>{file ? "Paste image to replace" : "Paste from clipboard"}</span>
            <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={handleBrowseClick}
            disabled={disabled}
            data-testid="context-menu-browse-action"
          >
            <Upload className="mr-2 size-4" />
            <span>{file ? "Browse file to replace..." : "Browse file..."}</span>
          </ContextMenuItem>

          {file && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                variant="destructive"
                onClick={onRemove}
                disabled={disabled}
                data-testid="context-menu-remove-action"
              >
                <Trash2 className="mr-2 size-4" />
                <span>Remove image</span>
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}

