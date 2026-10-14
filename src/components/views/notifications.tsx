"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BellOff,
  CheckCheck,
  Trash2,
  RefreshCw,
  Clock,
  AlertTriangle,
  FileWarning,
  Upload,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
};

type NotificationsResponse = {
  notifications: Notification[];
  unreadCount: number;
};

const TYPE_META: Record<string, { icon: React.ComponentType<{ className?: string }>; tone: string; bg: string }> = {
  RENEWAL_UPCOMING: { icon: Clock, tone: "text-amber-600", bg: "bg-amber-500/10" },
  RENEWAL_OVERDUE: { icon: AlertTriangle, tone: "text-rose-600", bg: "bg-rose-500/10" },
  INVOICE_OVERDUE: { icon: FileWarning, tone: "text-rose-600", bg: "bg-rose-500/10" },
  INVOICE_DUE_SOON: { icon: Clock, tone: "text-amber-600", bg: "bg-amber-500/10" },
  IMPORT_COMPLETED: { icon: Upload, tone: "text-emerald-600", bg: "bg-emerald-500/10" },
  IMPORT_FAILED: { icon: FileWarning, tone: "text-rose-600", bg: "bg-rose-500/10" },
};

export function NotificationsView() {
  const qc = useQueryClient();
  const [tab, setTab] = React.useState<"all" | "unread">("unread");

  const { data, isLoading } = useQuery<NotificationsResponse>({
    queryKey: ["notifications", tab],
    queryFn: () =>
      api<NotificationsResponse>(
        `/api/notifications${tab === "unread" ? "?unreadOnly=true" : ""}`
      ),
  });

  const markReadMut = async (id: string) => {
    await api(`/api/notifications/${id}/read`, { method: "POST" });
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
  };

  const markAllReadMut = async () => {
    await api("/api/notifications", { method: "POST" });
    toast.success("All marked as read");
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
  };

  const deleteMut = async (id: string) => {
    await api(`/api/notifications/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
  };

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        description="Renewal warnings, overdue invoices, and import completions — refreshed on every visit."
        actions={
          <Button variant="outline" size="sm" onClick={markAllReadMut} disabled={unreadCount === 0}>
            <CheckCheck className="size-4" />
            Mark all read
          </Button>
        }
      />

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-3">
        <NotifTile label="Unread" value={unreadCount} tone="text-primary" icon={Bell} />
        <NotifTile
          label="Overdue"
          value={notifications.filter((n) => n.type.includes("OVERDUE")).length}
          tone="text-rose-600"
          icon={AlertTriangle}
        />
        <NotifTile
          label="Due soon"
          value={notifications.filter((n) => n.type.includes("SOON") || n.type.includes("UPCOMING")).length}
          tone="text-amber-600"
          icon={Clock}
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "unread")}>
        <TabsList>
          <TabsTrigger value="unread" className="gap-1.5">
            <BellOff className="size-3.5" />
            Unread
            {unreadCount > 0 && <Badge variant="secondary" className="text-[10px]">{unreadCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-1.5">
            <Bell className="size-3.5" />
            All
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          title={tab === "unread" ? "You're all caught up" : "No notifications"}
          description={tab === "unread" ? "No unread notifications. New renewal warnings and overdue invoices will appear here." : "Notifications are generated automatically as contracts approach expiry or invoices become overdue."}
          icon={<Bell className="size-5" />}
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const meta = TYPE_META[n.type] ?? { icon: Bell, tone: "text-muted-foreground", bg: "bg-muted" };
            const Icon = meta.icon;
            const isUnread = !n.readAt;
            return (
              <div
                key={n.id}
                className={cn(
                  "flex items-start gap-3 rounded-lg border bg-card p-3 transition hover:bg-muted/30",
                  isUnread && "border-primary/30 bg-primary/5"
                )}
              >
                <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", meta.bg)}>
                  <Icon className={cn("size-4", meta.tone)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={cn("text-sm", isUnread ? "font-semibold" : "font-medium text-muted-foreground")}>
                      {n.title}
                    </p>
                    {isUnread && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{formatRelative(n.createdAt)}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {isUnread && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => markReadMut(n.id)}
                      aria-label="Mark as read"
                      title="Mark as read"
                    >
                      <CheckCheck className="size-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-rose-600"
                    onClick={() => deleteMut(n.id)}
                    aria-label="Dismiss"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NotifTile({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
      <div className={cn("flex size-9 items-center justify-center rounded-lg bg-muted/40", tone)}>
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-2xl font-semibold leading-tight tabular-nums">{value}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
