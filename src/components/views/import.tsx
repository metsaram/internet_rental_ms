"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  History,
  Loader2,
  RefreshCw,
  Building2,
  Store,
  Wifi,
  Database,
  Layers,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import {
  CONTRACT_FIELDS,
  SERVICE_FIELDS,
  getFields,
  type ImportEntityType,
} from "@/lib/import-fields";

type PreviewResponse = {
  fileName: string;
  fileSize: number;
  worksheets: string[];
  worksheet: string;
  totalRows: number;
  headers: Array<{ index: number; label: string }>;
  autoMap: Record<string, { header: string; target: string | null }>;
  sampleRows: Array<Array<{ header: string; value: unknown }>>;
  rows?: unknown[][];
};

type ValidationIssue = {
  row: number;
  field: string;
  fieldLabel: string;
  value: unknown;
  message: string;
  suggestion?: string;
  severity: "error" | "warning";
};

type FieldValidationStat = {
  key: string;
  label: string;
  required: boolean;
  mapped: boolean;
  mappedHeader: string | null;
  status: "valid" | "invalid" | "unmapped" | "warning";
  matchedCount: number;
  totalTested: number;
  unmatchedValues: string[];
  message: string;
  availableOptions?: string[];
};

type ValidationResponse = {
  valid: boolean;
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  missingRequiredFields: Array<{ key: string; label: string }>;
  fieldStats: Record<string, FieldValidationStat>;
  issues: ValidationIssue[];
  realMasterData: {
    branches: Array<{ code: string; name: string }>;
    shops: Array<{ code: string; name: string; branchCode?: string }>;
    providers: Array<{ code: string; name: string }>;
    services: Array<{ serviceCode: string }>;
  };
};

type ImportJob = {
  id: string;
  fileName: string;
  worksheet: string | null;
  entityType: string;
  status: string;
  totalRows: number;
  importedRows: number;
  errorRows: number;
  summary: string | null;
  createdBy: { name: string | null; email: string } | null;
  createdAt: string;
};

type Step = "upload" | "mapping" | "review" | "done";

type CommitResult = {
  jobId: string;
  totalRows: number;
  importedRows: number;
  errorRows: number;
  summary: string;
  rowResults: Array<{
    rowIndex: number;
    status: "OK" | "ERROR" | "IMPORTED";
    message?: string;
    data: Record<string, unknown>;
  }>;
};

export function ImportView() {
  const qc = useQueryClient();
  const [step, setStep] = React.useState<Step>("upload");
  const [entityType, setEntityType] = React.useState<ImportEntityType>("contract");
  const [preview, setPreview] = React.useState<PreviewResponse | null>(null);
  const [columnMap, setColumnMap] = React.useState<Record<string, string>>({});
  const [defaultFreeMonths, setDefaultFreeMonths] = React.useState(0);
  const [committing, setCommitting] = React.useState(false);
  const [result, setResult] = React.useState<CommitResult | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [validation, setValidation] = React.useState<ValidationResponse | null>(null);
  const [validating, setValidating] = React.useState(false);
  const [sideTab, setSideTab] = React.useState<"validation" | "masterData" | "sample">("validation");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { data: jobs = [], isLoading: jobsLoading } = useQuery<ImportJob[]>({
    queryKey: ["import-jobs"],
    queryFn: () => api<ImportJob[]>("/api/import/jobs"),
  });

  // Debounced live validation whenever columnMap, defaultFreeMonths, or entityType changes
  React.useEffect(() => {
    if (step !== "mapping" || !preview) {
      setValidation(null);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setValidating(true);
      try {
        const rowsToValidate =
          preview.rows && preview.rows.length > 0
            ? preview.rows
            : preview.sampleRows.map((sr) => sr.map((c) => c.value));

        const res = await fetch("/api/import/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityType,
            headers: preview.headers.map((h) => h.label),
            rows: rowsToValidate,
            columnMap,
            defaultFreeMonths,
          }),
        });
        const data = await res.json();
        if (active) {
          if (res.ok) {
            setValidation(data);
          } else {
            console.error("Validation error:", data?.error);
          }
        }
      } catch (err) {
        console.error("Failed to run validation:", err);
      } finally {
        if (active) setValidating(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [step, preview, columnMap, defaultFreeMonths, entityType]);

  const onFileSelected = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("entityType", entityType);
      const res = await fetch("/api/import/preview", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Preview failed");
      setPreview(body as PreviewResponse);
      // Apply auto-map: invert to { targetField: headerLabel }
      const initialMap: Record<string, string> = {};
      for (const v of Object.values(body.autoMap)) {
        if (v.target) initialMap[v.target] = v.header;
      }
      setColumnMap(initialMap);
      setStep("mapping");
      toast.success(`Parsed ${body.totalRows} rows from "${body.worksheet}"`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) onFileSelected(file);
  };

  const commit = async () => {
    if (!preview) return;
    setCommitting(true);
    try {
      const fullRows =
        preview.rows && preview.rows.length > 0
          ? preview.rows
          : preview.sampleRows.map((sr) => sr.map((c) => c.value));
      const res = await api<CommitResult>("/api/import/commit", {
        method: "POST",
        body: JSON.stringify({
          entityType,
          fileName: preview.fileName,
          worksheet: preview.worksheet,
          headers: preview.headers.map((h) => h.label),
          rows: fullRows,
          columnMap,
          defaultFreeMonths,
        }),
      });
      setResult(res);
      setStep("done");
      toast.success(res.summary);
      qc.invalidateQueries({ queryKey: ["import-jobs"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["services"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCommitting(false);
    }
  };

  const reset = () => {
    setStep("upload");
    setPreview(null);
    setResult(null);
    setValidation(null);
    setColumnMap({});
  };

  const fields = getFields(entityType);
  const errorResults = result?.rowResults.filter((r) => r.status === "ERROR") ?? [];
  const okResults = result?.rowResults.filter((r) => r.status !== "ERROR") ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Excel import"
        description="Bulk-import contracts or services from a spreadsheet. Preview, map columns, review row errors, then confirm — writes are atomic."
      />

      {/* Stepper */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(["upload", "mapping", "review", "done"] as Step[]).map((s, i) => {
          const active = step === s;
          const done = ["upload", "mapping", "review", "done"].indexOf(step) > i;
          return (
            <React.Fragment key={s}>
              <div
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  active && "border-primary bg-primary/5 text-primary",
                  done && "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
                  !active && !done && "border-border text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
                    active && "bg-primary text-primary-foreground",
                    done && "bg-emerald-500 text-white",
                    !active && !done && "bg-muted text-muted-foreground"
                  )}
                >
                  {done ? <CheckCircle2 className="size-3" /> : i + 1}
                </span>
                <span className="capitalize">{s}</span>
              </div>
              {i < 3 && <ArrowRight className="size-3 text-muted-foreground/50" />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step content */}
      {step === "upload" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Upload className="size-4 text-primary" />
                Upload workbook
              </CardTitle>
              <CardDescription className="text-xs">
                .xlsx or .xls, max 2 MB. Nothing is written until you confirm.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="What are you importing?">
                <Select value={entityType} onValueChange={(v) => setEntityType(v as ImportEntityType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contract">Contracts</SelectItem>
                    <SelectItem value="service">Internet services</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/20 px-6 py-12 text-center transition hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {uploading ? <Loader2 className="size-6 animate-spin" /> : <FileSpreadsheet className="size-6" />}
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {uploading ? "Parsing workbook..." : "Drop your spreadsheet here, or click to browse"}
                  </p>
                  <p className="text-xs text-muted-foreground">.xlsx / .xls · max 2 MB</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onFileSelected(f);
                    e.target.value = "";
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Expected fields</CardTitle>
              <CardDescription className="text-xs">
                {entityType === "contract" ? "Contract import" : "Service import"} — headers auto-matched.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="space-y-1.5">
                {fields.map((f) => (
                  <div key={f.key} className="flex items-center justify-between gap-2 text-xs">
                    <span className={cn(f.required ? "font-medium" : "text-muted-foreground")}>
                      {f.label}
                    </span>
                    {f.required && <Badge variant="outline" className="text-[9px]">required</Badge>}
                  </div>
                ))}
              </div>
              <div className="border-t pt-2">
                <a
                  href={`/api/template/${entityType}`}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <Download className="size-3.5" />
                  Download {entityType} template (.xlsx)
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === "mapping" && preview && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileSpreadsheet className="size-4 text-primary" />
                  {preview.fileName}
                </CardTitle>
                <CardDescription className="text-xs">
                  {preview.totalRows} rows · worksheet "{preview.worksheet}" · {preview.headers.length} columns
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={reset}>
                <ArrowLeft className="size-4" /> Back
              </Button>
            </CardHeader>
          </Card>

          {/* Real Database Validation Status Banner */}
          {validating && (
            <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-primary">
              <Loader2 className="size-4 animate-spin shrink-0" />
              <span>Validating mapped fields against live database records (branches, shops, providers)...</span>
            </div>
          )}

          {!validating && validation && (
            validation.valid ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-300">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <p className="font-semibold text-xs tracking-tight">Database validation passed</p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400/90">
                      All {validation.validRowsCount} rows verified against live database records. Branch codes, shop codes, and providers exist.
                    </p>
                  </div>
                </div>
                <Badge className="bg-emerald-600 text-white text-[11px] hover:bg-emerald-600">
                  {validation.validRowsCount} / {validation.totalRows} valid rows
                </Badge>
              </div>
            ) : (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-900 dark:text-rose-200 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="size-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                    <div>
                      <p className="font-semibold text-xs">
                        Validation found {validation.issues.length} issue{validation.issues.length > 1 ? "s" : ""} across {validation.invalidRowsCount} row{validation.invalidRowsCount > 1 ? "s" : ""}
                      </p>
                      <p className="text-xs text-rose-800 dark:text-rose-300/90">
                        Some spreadsheet values do not match existing records in your company database (e.g. invalid branch or shop codes).
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {validation.missingRequiredFields.length > 0 && (
                      <Badge variant="destructive" className="text-[10px]">
                        {validation.missingRequiredFields.length} missing required field{validation.missingRequiredFields.length > 1 ? "s" : ""}
                      </Badge>
                    )}
                    <Badge variant="outline" className="border-rose-300 text-rose-700 dark:text-rose-300 text-[10px]">
                      {validation.invalidRowsCount} invalid rows
                    </Badge>
                  </div>
                </div>

                {validation.missingRequiredFields.length > 0 && (
                  <div className="text-xs text-rose-700 dark:text-rose-300 bg-rose-500/10 rounded px-2.5 py-1.5">
                    <span className="font-medium">Missing required mappings: </span>
                    {validation.missingRequiredFields.map((f) => f.label).join(", ")}
                  </div>
                )}
              </div>
            )
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* Column mapping */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm">Map columns</CardTitle>
                <CardDescription className="text-xs">
                  Match each spreadsheet header to a target field. Live validation checks whether values match real database records.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {preview.headers.map((h) => {
                  const matched = Object.entries(columnMap).find(([, label]) => label === h.label)?.[0];
                  const stat = matched ? validation?.fieldStats?.[matched] : undefined;

                  return (
                    <div
                      key={h.index}
                      className={cn(
                        "rounded-lg border px-3 py-2.5 transition space-y-1.5",
                        stat?.status === "invalid"
                          ? "border-rose-500/40 bg-rose-500/5"
                          : stat?.status === "valid" && matched
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : "border-border bg-muted/20"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{h.label}</p>
                          <p className="text-[10px] text-muted-foreground">column {h.index + 1}</p>
                        </div>
                        <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/50" />
                        <Select
                          value={matched ?? "none"}
                          onValueChange={(target) => {
                            setColumnMap((prev) => {
                              const next = { ...prev };
                              for (const [k, v] of Object.entries(next)) {
                                if (v === h.label) delete next[k];
                              }
                              if (target !== "none") next[target] = h.label;
                              return next;
                            });
                          }}
                        >
                          <SelectTrigger className="h-8 w-52 text-xs">
                            <SelectValue placeholder="Ignore" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— ignore —</SelectItem>
                            {fields.map((f) => (
                              <SelectItem key={f.key} value={f.key}>
                                {f.label}{f.required ? " *" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Real DB validation feedback for this field */}
                      {matched && stat && (
                        <div className="pt-1 border-t border-border/40 flex flex-col gap-0.5 text-[11px]">
                          {stat.status === "valid" ? (
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-medium">
                              <CheckCircle2 className="size-3.5 shrink-0" />
                              {stat.message}
                            </span>
                          ) : stat.status === "invalid" ? (
                            <div className="space-y-0.5 text-rose-600 dark:text-rose-400">
                              <span className="flex items-center gap-1.5 font-medium">
                                <XCircle className="size-3.5 shrink-0" />
                                {stat.message}
                              </span>
                              {stat.availableOptions && stat.availableOptions.length > 0 && (
                                <p className="text-[10px] text-muted-foreground">
                                  Valid in DB: {stat.availableOptions.slice(0, 4).join(", ")}
                                  {stat.availableOptions.length > 4 ? ` (+${stat.availableOptions.length - 4} more)` : ""}
                                </p>
                              )}
                            </div>
                          ) : stat.status === "warning" ? (
                            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5 font-medium">
                              <AlertTriangle className="size-3.5 shrink-0" />
                              {stat.message}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Right sidebar: Validation issues / Real Master Data / Sample preview */}
            <Card className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Inspection</CardTitle>
                  <div className="flex items-center gap-1 rounded-md bg-muted p-0.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSideTab("validation")}
                      className={cn(
                        "rounded px-2 py-1 font-medium transition",
                        sideTab === "validation"
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Issues ({validation?.issues.length ?? 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSideTab("masterData")}
                      className={cn(
                        "rounded px-2 py-1 font-medium transition",
                        sideTab === "masterData"
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Real Data
                    </button>
                    <button
                      type="button"
                      onClick={() => setSideTab("sample")}
                      className={cn(
                        "rounded px-2 py-1 font-medium transition",
                        sideTab === "sample"
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Sample
                    </button>
                  </div>
                </div>
                <CardDescription className="text-xs">
                  {sideTab === "validation"
                    ? "Live database validation issues"
                    : sideTab === "masterData"
                    ? "Available master data records in your company DB"
                    : `First ${preview.sampleRows.length} rows`}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3 flex-1 flex flex-col">
                {entityType === "contract" && (
                  <Field label="Default free months" hint="Used when the column is blank">
                    <Input
                      type="number"
                      min={0}
                      max={120}
                      value={defaultFreeMonths}
                      onChange={(e) => setDefaultFreeMonths(Number(e.target.value))}
                      className="h-8"
                    />
                  </Field>
                )}

                {/* Tab: Validation Issues */}
                {sideTab === "validation" && (
                  <div className="flex-1 max-h-[420px] overflow-y-auto space-y-2 pr-1">
                    {(!validation?.issues || validation.issues.length === 0) ? (
                      <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground space-y-2">
                        <CheckCircle2 className="size-8 text-emerald-500" />
                        <p className="text-xs font-medium text-foreground">No validation issues</p>
                        <p className="text-[11px]">All checked fields match real database records.</p>
                      </div>
                    ) : (
                      validation.issues.map((issue, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            "rounded-lg border p-2.5 text-xs space-y-1",
                            issue.severity === "error"
                              ? "border-rose-500/30 bg-rose-500/5 text-rose-950 dark:text-rose-200"
                              : "border-amber-500/30 bg-amber-500/5 text-amber-950 dark:text-amber-200"
                          )}
                        >
                          <div className="flex items-center justify-between font-semibold">
                            <span className="flex items-center gap-1.5">
                              {issue.severity === "error" ? (
                                <XCircle className="size-3.5 text-rose-500" />
                              ) : (
                                <AlertTriangle className="size-3.5 text-amber-500" />
                              )}
                              Row {issue.row} · {issue.fieldLabel}
                            </span>
                            <Badge variant="outline" className="text-[9px] uppercase px-1 py-0">
                              {issue.severity}
                            </Badge>
                          </div>
                          <p className="text-[11px] font-medium">{issue.message}</p>
                          {issue.suggestion && (
                            <p className="text-[10px] text-muted-foreground italic">
                              Hint: {issue.suggestion}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Tab: Real Master Data */}
                {sideTab === "masterData" && (
                  <div className="flex-1 max-h-[420px] overflow-y-auto space-y-3 pr-1 text-xs">
                    {/* Branches */}
                    <div className="rounded-lg border bg-card p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between text-muted-foreground font-semibold text-[11px]">
                        <span className="flex items-center gap-1.5">
                          <Building2 className="size-3.5 text-primary" /> Branches
                        </span>
                        <span>{validation?.realMasterData.branches.length ?? 0}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {validation?.realMasterData.branches.map((b) => (
                          <span
                            key={b.code}
                            className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]"
                            title={b.name}
                          >
                            <span className="font-bold">{b.code}</span>
                            <span className="text-muted-foreground">({b.name})</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Shops */}
                    <div className="rounded-lg border bg-card p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between text-muted-foreground font-semibold text-[11px]">
                        <span className="flex items-center gap-1.5">
                          <Store className="size-3.5 text-primary" /> Shops
                        </span>
                        <span>{validation?.realMasterData.shops.length ?? 0}</span>
                      </div>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {validation?.realMasterData.shops.map((s) => (
                          <div key={s.code} className="flex items-center justify-between text-[10px] rounded bg-muted/60 px-1.5 py-0.5">
                            <span className="font-mono font-bold">{s.code}</span>
                            <span className="text-muted-foreground truncate max-w-[120px]">{s.name}</span>
                            {s.branchCode && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono">
                                {s.branchCode}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Providers */}
                    <div className="rounded-lg border bg-card p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between text-muted-foreground font-semibold text-[11px]">
                        <span className="flex items-center gap-1.5">
                          <Wifi className="size-3.5 text-primary" /> Providers
                        </span>
                        <span>{validation?.realMasterData.providers.length ?? 0}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {validation?.realMasterData.providers.map((p) => (
                          <span
                            key={p.code}
                            className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]"
                            title={p.name}
                          >
                            <span className="font-bold">{p.code}</span>
                            <span className="text-muted-foreground">({p.name})</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Services (if contracts) */}
                    {entityType === "contract" && (
                      <div className="rounded-lg border bg-card p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between text-muted-foreground font-semibold text-[11px]">
                          <span className="flex items-center gap-1.5">
                            <Database className="size-3.5 text-primary" /> Existing Services
                          </span>
                          <span>{validation?.realMasterData.services.length ?? 0}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {validation?.realMasterData.services.slice(0, 15).map((s) => (
                            <span
                              key={s.serviceCode}
                              className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold"
                            >
                              {s.serviceCode}
                            </span>
                          ))}
                          {(validation?.realMasterData.services.length ?? 0) > 15 && (
                            <span className="text-[10px] text-muted-foreground self-center">
                              +{(validation?.realMasterData.services.length ?? 0) - 15} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Sample rows */}
                {sideTab === "sample" && (
                  <div className="flex-1 max-h-[420px] overflow-y-auto space-y-1.5 pr-1">
                    {preview.sampleRows.map((row, i) => (
                      <div key={i} className="rounded border bg-card p-2 text-[11px]">
                        <p className="mb-1 font-semibold text-muted-foreground">Row {i + 2}</p>
                        <div className="grid grid-cols-1 gap-0.5">
                          {row.slice(0, 4).map((c, j) => (
                            <div key={j} className="flex justify-between gap-2">
                              <span className="truncate text-muted-foreground">{c.header}:</span>
                              <span className="truncate font-medium">{c.value === null ? "—" : String(c.value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              {validation && !validation.valid && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1.5">
                  <AlertTriangle className="size-4 shrink-0" />
                  {validation.invalidRowsCount} of {validation.totalRows} row(s) contain database validation issues.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={reset}>
                <ArrowLeft className="size-4" /> Cancel
              </Button>
              <Button
                onClick={() => setStep("review")}
                disabled={
                  Object.keys(columnMap).length === 0 ||
                  validating ||
                  (validation?.missingRequiredFields && validation.missingRequiredFields.length > 0)
                }
              >
                Review <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === "review" && preview && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="size-4 text-emerald-500" />
                Ready to import
              </CardTitle>
              <CardDescription className="text-xs">
                {preview.totalRows} {entityType} rows will be imported. Writes are atomic — any error rolls back the batch.
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setStep("mapping")}>
              <ArrowLeft className="size-4" /> Edit mapping
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Entity" value={entityType === "contract" ? "Contracts" : "Services"} />
              <Stat label="Rows" value={String(preview.totalRows)} />
              <Stat label="Mapped fields" value={String(Object.keys(columnMap).length)} />
              <Stat
                label="Valid Rows"
                value={validation ? `${validation.validRowsCount} / ${validation.totalRows}` : String(preview.totalRows)}
                tone={validation && !validation.valid ? "text-amber-600" : "text-emerald-600"}
              />
            </div>

            {validation && !validation.valid && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="size-4 text-amber-600" />
                  <span>Warning: {validation.issues.length} database validation issue(s) detected</span>
                </div>
                <p className="text-[11px] text-amber-800 dark:text-amber-300">
                  Import will fail or skip rows that do not have valid foreign keys in the database.
                </p>
              </div>
            )}

            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Field mapping
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
                {Object.entries(columnMap).map(([target, header]) => (
                  <div key={target} className="flex items-center gap-1.5">
                    <span className="font-medium">{target}</span>
                    <ArrowRight className="size-3 text-muted-foreground/50" />
                    <span className="text-muted-foreground">{header}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep("mapping")}>Back</Button>
              <Button onClick={commit} disabled={committing}>
                {committing ? <><Loader2 className="size-4 animate-spin" /> Importing...</> : <>
                  <Upload className="size-4" /> Confirm import
                </>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "done" && result && (
        <div className="space-y-4">
          <Card className={cn("border-l-4", errorResults.length > 0 ? "border-l-amber-500" : "border-l-emerald-500")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {errorResults.length > 0 ? <AlertTriangle className="size-5 text-amber-500" /> : <CheckCircle2 className="size-5 text-emerald-500" />}
                Import complete
              </CardTitle>
              <CardDescription className="text-xs">{result.summary}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Total rows" value={String(result.totalRows)} tone="text-foreground" />
                <Stat label="Imported" value={String(result.importedRows)} tone="text-emerald-600" />
                <Stat label="Errors" value={String(result.errorRows)} tone={result.errorRows > 0 ? "text-rose-600" : "text-muted-foreground"} />
              </div>
            </CardContent>
          </Card>

          {errorResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <XCircle className="size-4 text-rose-500" />
                  Row errors ({errorResults.length})
                </CardTitle>
                <CardDescription className="text-xs">These rows were skipped. Fix the source data and re-import.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 font-semibold">Row</th>
                        <th className="px-4 py-2 font-semibold">Errors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {errorResults.map((r) => (
                        <tr key={r.rowIndex} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-2 font-medium tabular-nums">{r.rowIndex}</td>
                          <td className="px-4 py-2 text-rose-600">{r.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {okResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  Imported rows ({okResults.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 font-semibold">Row</th>
                        <th className="px-4 py-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {okResults.map((r) => (
                        <tr key={r.rowIndex} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-2 font-medium tabular-nums">{r.rowIndex}</td>
                          <td className="px-4 py-2"><StatusBadge status="IMPORTED" tone="green" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={reset}>
              <RefreshCw className="size-4" /> Import another file
            </Button>
            <Button onClick={() => { window.location.hash = entityType === "contract" ? "contracts" : "services"; }}>
              View imported {entityType === "contract" ? "contracts" : "services"}
            </Button>
          </div>
        </div>
      )}

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4 text-primary" />
            Import history
          </CardTitle>
          <CardDescription className="text-xs">Last 50 import jobs</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {jobsLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : jobs.length === 0 ? (
            <EmptyState title="No imports yet" description="Your import jobs will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-semibold">File</th>
                    <th className="px-4 py-2 font-semibold">Type</th>
                    <th className="px-4 py-2 font-semibold">Rows</th>
                    <th className="px-4 py-2 font-semibold">Imported</th>
                    <th className="px-4 py-2 font-semibold">Errors</th>
                    <th className="px-4 py-2 font-semibold">By</th>
                    <th className="px-4 py-2 font-semibold">When</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr key={j.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{j.fileName}</div>
                        <div className="text-[11px] text-muted-foreground">{j.worksheet ?? "—"}</div>
                      </td>
                      <td className="px-4 py-2.5 capitalize">{j.entityType}</td>
                      <td className="px-4 py-2.5 tabular-nums">{j.totalRows}</td>
                      <td className="px-4 py-2.5 tabular-nums text-emerald-600 font-medium">{j.importedRows}</td>
                      <td className="px-4 py-2.5 tabular-nums text-rose-600 font-medium">{j.errorRows}</td>
                      <td className="px-4 py-2.5 text-xs">{j.createdBy?.name ?? j.createdBy?.email ?? "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{new Date(j.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-lg font-semibold tabular-nums", tone ?? "text-foreground")}>{value}</p>
    </div>
  );
}
