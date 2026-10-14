"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SHORTCUTS = [
  { keys: ["⌘", "K"], label: "Open command palette", group: "Global" },
  { keys: ["?"], label: "Show this help", group: "Global" },
  { keys: ["Esc"], label: "Close dialog / clear search", group: "Global" },
  { keys: ["j"], label: "Move selection down in a table", group: "Tables" },
  { keys: ["k"], label: "Move selection up in a table", group: "Tables" },
  { keys: ["Enter"], label: "Open the selected row's detail", group: "Tables" },
  { keys: ["/"], label: "Focus the search box", group: "Tables" },
];

export function ShortcutsHelp({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const groups = React.useMemo(() => {
    const map = new Map<string, typeof SHORTCUTS>();
    for (const s of SHORTCUTS) {
      const arr = map.get(s.group) ?? [];
      arr.push(s);
      map.set(s.group, arr);
    }
    return Array.from(map.entries());
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Navigate NetRent faster with these shortcuts.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {groups.map(([group, items]) => (
            <div key={group}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group}
              </p>
              <div className="space-y-1.5">
                {items.map((s) => (
                  <div key={s.label} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-foreground">{s.label}</span>
                    <div className="flex gap-1">
                      {s.keys.map((k) => (
                        <kbd
                          key={k}
                          className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Hook that wires the global "?" shortcut to open the help dialog. */
export function useShortcutsHelp() {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return [open, setOpen] as const;
}
