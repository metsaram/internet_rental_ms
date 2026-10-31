"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Clock, Receipt, FileWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface InvoiceAlertNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  createdAt?: string;
  readAt?: string | null;
}

export interface InvoiceAlertModalProps {
  open: boolean;
  notifications: InvoiceAlertNotification[];
  onReviewInvoices: () => void;
  onDismiss: () => void;
}

/**
 * Invoice Payment Alert Modal shown upon user login.
 * Alerts user of invoices due within 1 week or overdue up to 1 week,
 * prompting immediate payment attention.
 */
export function InvoiceAlertModal({
  open,
  notifications,
  onReviewInvoices,
  onDismiss,
}: InvoiceAlertModalProps) {
  if (!notifications || notifications.length === 0) {
    return null;
  }

  const overdueCount = notifications.filter((n) => n.type === "INVOICE_OVERDUE").length;
  const dueSoonCount = notifications.filter((n) => n.type === "INVOICE_DUE_SOON").length;
  const hasOverdue = overdueCount > 0;

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full",
                hasOverdue
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
              )}
            >
              {hasOverdue ? (
                <AlertTriangle className="size-5" />
              ) : (
                <Clock className="size-5" />
              )}
            </div>
            <div>
              <AlertDialogTitle className="text-lg">
                {hasOverdue
                  ? "Overdue Invoice Payment Alert"
                  : "Upcoming Invoice Payments Due Soon"}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground">
                {notifications.length} invoice payment
                {notifications.length > 1 ? "s require" : " requires"} your
                attention.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        {/* Overview pill badges */}
        <div className="flex items-center gap-2 pt-1">
          {overdueCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {overdueCount} Overdue
            </Badge>
          )}
          {dueSoonCount > 0 && (
            <Badge
              variant="outline"
              className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400 text-xs"
            >
              {dueSoonCount} Due Soon
            </Badge>
          )}
        </div>

        {/* Scrollable list of invoices needing attention */}
        <div
          tabIndex={0}
          aria-label="Pending invoice payment alerts"
          className="max-h-60 overflow-y-auto space-y-2.5 pr-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
        >
          {notifications.map((n) => {
            const isOverdue = n.type === "INVOICE_OVERDUE";
            return (
              <div
                key={n.id}
                className={cn(
                  "p-3 rounded-lg border text-sm transition-colors",
                  isOverdue
                    ? "border-rose-200 bg-rose-50/50 dark:border-rose-900/60 dark:bg-rose-950/20"
                    : "border-amber-200 bg-amber-50/50 dark:border-amber-900/60 dark:bg-amber-950/20"
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-semibold text-foreground text-xs sm:text-sm truncate">
                    {n.title}
                  </span>
                  <Badge
                    variant={isOverdue ? "destructive" : "outline"}
                    className={cn(
                      "text-[10px] font-bold tracking-wider shrink-0 uppercase",
                      !isOverdue &&
                      "border-amber-300 text-amber-700 dark:text-amber-400 dark:border-amber-800"
                    )}
                  >
                    {isOverdue ? "Overdue" : "Due Soon"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {n.message}
                </p>
              </div>
            );
          })}
        </div>

        <AlertDialogFooter className="sm:justify-between gap-2 pt-2 border-t mt-2">
          <AlertDialogCancel
            onClick={onDismiss}
            className="text-muted-foreground hover:text-foreground"
          >
            Remind me later
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onReviewInvoices}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Review Invoices
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
