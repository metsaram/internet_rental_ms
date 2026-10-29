"use client";

import * as React from "react";
import { FormDialog, Field } from "@/components/shared/form-dialog";
import { Textarea } from "@/components/ui/textarea";

export interface VoidInvoiceDialogProps {
  invoice: { id: string; invoiceNumber: string } | null;
  onClose: () => void;
  onVoid: (id: string, reason: string) => Promise<void>;
}

export function VoidInvoiceDialog({
  invoice,
  onClose,
  onVoid,
}: VoidInvoiceDialogProps) {
  const open = !!invoice;
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const isValid = Boolean(reason.trim());

  const handleSubmit = async () => {
    if (!invoice) return;
    const cleanReason = reason.trim();
    if (!cleanReason) {
      setError("Please provide a reason for voiding this invoice");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onVoid(invoice.id, cleanReason);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title={`Void invoice ${invoice?.invoiceNumber ?? ""}`}
      description="Voiding an invoice marks it as void and preserves it for audit history. A reason is required."
      submitText={submitting ? "Voiding..." : "Void invoice"}
      submitDisabled={!isValid || submitting}
      destructive
      onSubmit={handleSubmit}
      size="sm"
    >
      <div className="space-y-4">
        {error && (
          <div
            role="alert"
            className="rounded-md bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400"
          >
            {error}
          </div>
        )}
        <Field
          label="Reason for voiding"
          htmlFor="void-reason"
          required
          hint="Provide a clear explanation for audit history"
        >
          <Textarea
            id="void-reason"
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. Billing error, service cancelled, duplicate invoice..."
            autoFocus
          />
        </Field>
      </div>
    </FormDialog>
  );
}
