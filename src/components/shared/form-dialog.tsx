"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Generic form dialog used by every CRUD module.
 * Provides a title, description, scrollable body, and a save/cancel footer
 * with a loading state. Controlled by `open` / `onOpenChange`.
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  submitText = "Save",
  submitDisabled,
  children,
  size = "md",
  destructive = false,
  preventOutsideClose = true,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: React.ReactNode;
  onSubmit: () => void | Promise<void>;
  submitText?: string;
  submitDisabled?: boolean;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  destructive?: boolean;
  preventOutsideClose?: boolean;
}) {
  const [loading, setLoading] = React.useState(false);

  const sizeCls = {
    sm: "sm:max-w-sm",
    md: "sm:max-w-lg",
    lg: "sm:max-w-2xl",
    xl: "sm:max-w-4xl",
  }[size];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || submitDisabled) return;
    setLoading(true);
    try {
      await onSubmit();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(sizeCls, "max-h-[92vh] overflow-hidden flex flex-col gap-0 p-0")}
        onPointerDownOutside={(e) => {
          if (preventOutsideClose) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (preventOutsideClose) e.preventDefault();
        }}
      >
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-3 border-b">
            <DialogTitle>{title}</DialogTitle>
            {description ? (
              <DialogDescription>{description}</DialogDescription>
            ) : null}
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
          <DialogFooter className="px-6 py-4 border-t bg-muted/20">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={loading || submitDisabled}>
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                submitText
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  htmlFor,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  const childId = htmlFor ?? (React.isValidElement(children) ? (children.props as any)?.id : undefined);

  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={childId}
        className="text-xs font-medium text-foreground flex items-center gap-1"
      >
        {label}
        {required ? <span className="text-rose-500">*</span> : null}
      </label>
      {children}
      {hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
      {error ? (
        <p className="text-[11px] text-rose-600 dark:text-rose-400">{error}</p>
      ) : null}
    </div>
  );
}
