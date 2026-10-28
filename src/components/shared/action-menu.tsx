"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActionConfirmationConfig {
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

export interface ActionItem {
  /** Unique identifier for the action */
  id: string;
  /** Human-readable label (used for button text, tooltip, and menu item) */
  label: string;
  /** Icon displayed alongside the label or in the icon button */
  icon?: React.ReactNode;
  /** Callback triggered when the action is executed (or after confirmation if configured) */
  onClick?: (e?: React.MouseEvent) => void | Promise<void>;

  /**
   * Action priority rank for visible button selection.
   * Lower number = higher priority (e.g. 1 is highest priority, 2 is next).
   */
  priority?: number;
  /** Explicitly marks this action as a primary action */
  isPrimary?: boolean;
  /**
   * Preferred display placement:
   * - 'auto': Responsive auto-placement based on table action rules (default)
   * - 'visible': Strongly prefers placement as a visible button
   * - 'menu': Always placed inside the 3-dot overflow menu
   */
  display?: "auto" | "visible" | "menu";

  /** Disabled state */
  disabled?: boolean;
  /** Optional explanation of why the action is disabled (rendered in tooltip) */
  disabledReason?: string;
  /** Completely hide/omit this action */
  hidden?: boolean;

  /** Visual variant: 'default' | 'destructive' | 'outline' | 'ghost' | 'secondary' | 'subtle' | 'destructive-subtle' */
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "ghost"
    | "secondary"
    | "subtle"
    | "destructive-subtle";
  /** Custom class name for the button or menu item */
  className?: string;
  /** Custom tooltip text (defaults to label or disabledReason) */
  tooltip?: string;
  /** Optional keyboard shortcut hint (e.g. '⌘E', 'Del') */
  shortcut?: string;

  /** Logical group or category for menu organizing (e.g. 'Manage', 'Danger') */
  group?: string;

  /**
   * Confirmation dialog configuration for destructive or sensitive actions.
   * If true, uses a default confirmation prompt with the action's label.
   */
  confirmation?: ActionConfirmationConfig | boolean;
}

export interface ActionMenuProps {
  /** List of actions available for this row or item */
  actions: ActionItem[];
  /**
   * Custom max visible buttons on Desktop / Tablet.
   * Default behavior:
   * - 1-3 actions: all visible
   * - 4-6 actions: top 2 visible
   * - 7+ actions: 0 visible (all in 3-dot menu)
   */
  maxVisibleDesktop?: number;
  /**
   * Custom max visible buttons on Mobile (< 768px).
   * Default behavior:
   * - 1-2 actions: all visible
   * - > 2 actions: primary action visible (1), rest in 3-dot menu
   * - 7+ actions: 0 visible (all in 3-dot menu)
   */
  maxVisibleMobile?: number;

  /** Size variant for buttons: 'icon' (default for table rows), 'sm', or 'default' */
  size?: "default" | "sm" | "icon";
  /** Default button variant for visible action buttons (defaults to 'ghost') */
  buttonVariant?:
    | "default"
    | "destructive"
    | "outline"
    | "ghost"
    | "secondary"
    | "subtle"
    | "destructive-subtle";
  /**
   * Visual style for button backgrounds:
   * - 'subtle': Reduced color background tint (10-15% opacity) for primary and destructive buttons (default)
   * - 'ghost': Completely transparent background until hovered
   */
  buttonStyle?: "subtle" | "ghost";
  /** Dropdown menu alignment: 'start' | 'end' | 'center' (defaults to 'end') */
  align?: "start" | "end" | "center";
  /** Custom icon for the 3-dot more trigger */
  moreIcon?: React.ReactNode;
  /** Custom tooltip and aria-label for the 3-dot trigger */
  moreLabel?: string;
  /** Additional container classes */
  className?: string;
  /** Prevent clicks from propagating to parent rows/elements (defaults to true) */
  stopPropagation?: boolean;
  /** Whether visible buttons should show both icon and text label (defaults to false for table cells) */
  showLabelInButton?: boolean;
}

export function ActionMenu({
  actions,
  maxVisibleDesktop,
  maxVisibleMobile,
  size = "icon",
  buttonVariant = "ghost",
  buttonStyle = "subtle",
  align = "end",
  moreIcon,
  moreLabel = "More actions",
  className,
  stopPropagation = true,
  showLabelInButton = false,
}: ActionMenuProps) {
  const isMobile = useIsMobile();
  const [confirmingAction, setConfirmingAction] = React.useState<ActionItem | null>(null);
  const [isConfirming, setIsConfirming] = React.useState(false);

  // Filter out hidden actions
  const activeActions = React.useMemo(() => {
    return actions.filter((a) => !a.hidden);
  }, [actions]);

  // Compute number of visible buttons based on rules:
  // - 1-3 actions (Desktop/Tablet): all visible buttons
  // - 1-2 actions (Mobile): all visible buttons
  // - More than 2 actions (Mobile): primary action(s) as buttons, rest in 3-dot menu
  // - 4-6 actions (Desktop): 1-3 highest-priority actions as visible buttons, rest in 3-dot menu (default: 2)
  // - 7+ actions: 3-dot menu with actions organized into logical groups
  const visibleCount = React.useMemo(() => {
    const total = activeActions.length;
    if (total === 0) return 0;

    if (isMobile) {
      if (maxVisibleMobile !== undefined) {
        return Math.min(total, Math.max(0, maxVisibleMobile));
      }
      if (total <= 2) {
        return total;
      }
      if (total >= 7) {
        return 0;
      }
      // More than 2 actions on mobile: display primary action(s)
      const primaryCount = activeActions.filter((a) => a.isPrimary).length;
      return primaryCount > 0 ? Math.min(2, primaryCount) : 1;
    }

    // Desktop / Tablet
    if (maxVisibleDesktop !== undefined) {
      return Math.min(total, Math.max(0, maxVisibleDesktop));
    }
    if (total <= 3) {
      return total;
    }
    if (total >= 7) {
      return 0;
    }
    // 4-6 actions: display 1-3 highest priority actions (defaults to 2)
    return 2;
  }, [activeActions, isMobile, maxVisibleDesktop, maxVisibleMobile]);

  // Partition actions into visible buttons vs 3-dot menu items
  const { visibleActions, menuActions } = React.useMemo(() => {
    const total = activeActions.length;
    if (total === 0) {
      return { visibleActions: [], menuActions: [] };
    }

    if (visibleCount >= total) {
      // Check if any explicitly request menu
      const visible = activeActions.filter((a) => a.display !== "menu");
      const menu = activeActions.filter((a) => a.display === "menu");
      return { visibleActions: visible, menuActions: menu };
    }

    if (visibleCount <= 0) {
      return { visibleActions: [], menuActions: activeActions };
    }

    // Sort active actions by priority to determine which get button slots
    const scored = activeActions.map((action, index) => {
      let score = 500;
      if (action.display === "menu") {
        score = 9999;
      } else if (action.display === "visible") {
        score = 0;
      }

      if (action.isPrimary) {
        score -= 200;
      }

      if (action.priority !== undefined) {
        score += action.priority;
      } else {
        score += index * 10;
      }

      return { action, index, score };
    });

    // Sort ascending by score
    scored.sort((a, b) => a.score - b.score);

    const visibleSet = new Set(
      scored.slice(0, visibleCount).map((s) => s.action.id)
    );

    // Keep natural array order for visible buttons and menu items
    const visible: ActionItem[] = [];
    const menu: ActionItem[] = [];

    for (const item of activeActions) {
      if (visibleSet.has(item.id)) {
        visible.push(item);
      } else {
        menu.push(item);
      }
    }

    return { visibleActions: visible, menuActions: menu };
  }, [activeActions, visibleCount]);

  // Group menu actions by their logical section
  const menuGroups = React.useMemo(() => {
    if (menuActions.length === 0) return [];

    const total = activeActions.length;
    const hasExplicitGroups = menuActions.some((a) => !!a.group);

    // If 7+ actions or explicit groups provided, organize into sections
    if (hasExplicitGroups || total >= 7) {
      const map = new Map<string, ActionItem[]>();

      for (const action of menuActions) {
        let groupName = action.group;
        if (!groupName) {
          if (action.variant === "destructive") {
            groupName = "Danger Zone";
          } else if (action.isPrimary) {
            groupName = "Primary Actions";
          } else {
            groupName = "General";
          }
        }

        if (!map.has(groupName)) {
          map.set(groupName, []);
        }
        map.get(groupName)!.push(action);
      }

      // Convert to ordered groups array, ensuring 'Danger Zone' is last
      const groups: { name: string; items: ActionItem[] }[] = [];
      let dangerGroup: { name: string; items: ActionItem[] } | null = null;

      for (const [name, items] of map.entries()) {
        if (name === "Danger Zone" || name.toLowerCase().includes("danger") || name.toLowerCase().includes("destruct")) {
          dangerGroup = { name, items };
        } else {
          groups.push({ name, items });
        }
      }

      if (dangerGroup) {
        groups.push(dangerGroup);
      }

      return groups;
    }

    // Default single group without header
    return [{ name: "", items: menuActions }];
  }, [menuActions, activeActions.length]);

  const handleActionClick = (action: ActionItem, e: React.MouseEvent) => {
    if (stopPropagation) {
      e.stopPropagation();
    }

    if (action.disabled) return;

    if (action.confirmation) {
      setConfirmingAction(action);
      return;
    }

    action.onClick?.(e);
  };

  const handleConfirmAction = async () => {
    if (!confirmingAction) return;
    try {
      setIsConfirming(true);
      await confirmingAction.onClick?.();
      setConfirmingAction(null);
    } finally {
      setIsConfirming(false);
    }
  };

  if (activeActions.length === 0) {
    return null;
  }

  const confirmationConfig = confirmingAction
    ? typeof confirmingAction.confirmation === "object"
      ? confirmingAction.confirmation
      : {
          title: confirmingAction.label,
          description: `Are you sure you want to proceed with "${confirmingAction.label}"? This action cannot be undone.`,
          confirmText: confirmingAction.variant === "destructive" ? "Delete" : "Confirm",
          destructive: confirmingAction.variant === "destructive",
        }
    : null;

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <div
          className={cn("inline-flex items-center justify-end gap-1", className)}
          onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
        >
          {/* Visible Action Buttons */}
          {visibleActions.map((action) => {
            const isDestructive =
              action.variant === "destructive" || action.variant === "destructive-subtle";
            const isPrimary =
              action.isPrimary || action.variant === "default" || action.variant === "subtle";

            // Theme-adaptive, reduced-background button styling
            // Ensures full contrast, high accessibility, and seamless consistency across all theme colors (light, dark, system)
            let buttonClasses = "";
            let effectiveVariant:
              | "default"
              | "destructive"
              | "outline"
              | "ghost"
              | "secondary"
              | "subtle"
              | "destructive-subtle" = buttonVariant;

            if (buttonStyle === "ghost") {
              effectiveVariant = "ghost";
              if (isDestructive) {
                buttonClasses =
                  "text-destructive hover:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20 focus-visible:ring-destructive/30";
              } else if (isPrimary) {
                buttonClasses =
                  "text-primary hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/20";
              } else {
                buttonClasses =
                  "text-muted-foreground hover:text-foreground hover:bg-accent/60 dark:hover:bg-accent/40";
              }
            } else {
              // buttonStyle === "subtle" (default)
              // Reduced background opacity (10-15% tint) mapped to theme tokens
              if (isDestructive) {
                effectiveVariant = "destructive-subtle";
                buttonClasses =
                  "bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive dark:bg-destructive/15 dark:hover:bg-destructive/25 focus-visible:ring-destructive/30";
              } else if (isPrimary) {
                effectiveVariant = "subtle";
                buttonClasses =
                  "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary dark:bg-primary/15 dark:hover:bg-primary/25";
              } else if (
                action.variant &&
                action.variant !== "default" &&
                action.variant !== "ghost"
              ) {
                effectiveVariant = action.variant;
              } else {
                effectiveVariant = buttonVariant;
                buttonClasses =
                  "text-muted-foreground hover:text-foreground hover:bg-accent/60 dark:hover:bg-accent/40";
              }
            }

            const tooltipText =
              (action.disabled && action.disabledReason) || action.tooltip || action.label;

            const buttonEl = (
              <Button
                key={action.id}
                type="button"
                variant={effectiveVariant}
                size={size}
                disabled={action.disabled}
                onClick={(e) => handleActionClick(action, e)}
                className={cn(
                  size === "icon" ? "size-8" : "h-8 px-2.5 text-xs font-medium gap-1.5",
                  "shadow-none transition-colors",
                  buttonClasses,
                  action.className
                )}
                aria-label={action.label}
              >
                {action.icon}
                {(showLabelInButton || size !== "icon") && <span>{action.label}</span>}
              </Button>
            );

            // In icon mode, wrap with a helpful tooltip
            if (size === "icon" && !showLabelInButton) {
              return (
                <Tooltip key={action.id}>
                  <TooltipTrigger asChild>{buttonEl}</TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {tooltipText}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return buttonEl;
          })}

          {/* 3-Dot (More) Overflow Menu */}
          {menuActions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-foreground hover:bg-accent/60 dark:hover:bg-accent/40 shadow-none transition-colors"
                  aria-label={moreLabel}
                  title={moreLabel}
                >
                  {moreIcon || <MoreHorizontal className="size-4" />}
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align={align}
                className="w-48 z-50"
                onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
              >
                {menuGroups.map((group, groupIdx) => (
                  <React.Fragment key={group.name || `group-${groupIdx}`}>
                    {groupIdx > 0 && <DropdownMenuSeparator />}
                    {group.name ? (
                      <DropdownMenuLabel className="text-[10px] uppercase font-semibold text-muted-foreground px-2 py-1">
                        {group.name}
                      </DropdownMenuLabel>
                    ) : null}
                    <DropdownMenuGroup>
                      {group.items.map((action) => {
                        const isDestructive =
                          action.variant === "destructive" ||
                          action.variant === "destructive-subtle";
                        const isPrimary =
                          action.isPrimary ||
                          action.variant === "default" ||
                          action.variant === "subtle";

                        return (
                          <DropdownMenuItem
                            key={action.id}
                            disabled={action.disabled}
                            variant={isDestructive ? "destructive" : "default"}
                            onClick={(e) => handleActionClick(action, e)}
                            className={cn(
                              "text-xs gap-2 cursor-pointer transition-colors",
                              isDestructive &&
                                "text-destructive focus:text-destructive focus:bg-destructive/10 dark:focus:bg-destructive/20",
                              isPrimary &&
                                !isDestructive &&
                                "text-primary focus:text-primary focus:bg-primary/10 dark:focus:bg-primary/20",
                              action.className
                            )}
                          >
                            {action.icon && (
                              <span className="size-4 shrink-0 flex items-center justify-center">
                                {action.icon}
                              </span>
                            )}
                            <span className="flex-1 truncate">{action.label}</span>
                            {action.shortcut && (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {action.shortcut}
                              </span>
                            )}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuGroup>
                  </React.Fragment>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </TooltipProvider>

      {/* Built-in Confirmation Dialog for Destructive / Sensitive Actions */}
      {confirmingAction && confirmationConfig && (
        <ConfirmDialog
          open={!!confirmingAction}
          onOpenChange={(open) => {
            if (!open && !isConfirming) {
              setConfirmingAction(null);
            }
          }}
          title={confirmationConfig.title}
          description={confirmationConfig.description}
          confirmText={confirmationConfig.confirmText ?? "Confirm"}
          cancelText={confirmationConfig.cancelText ?? "Cancel"}
          destructive={confirmationConfig.destructive}
          loading={isConfirming}
          onConfirm={handleConfirmAction}
        />
      )}
    </>
  );
}
