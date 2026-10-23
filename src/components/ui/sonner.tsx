"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, toast, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system", resolvedTheme } = useTheme()
  const activeTheme = (theme === "system" ? resolvedTheme : theme) as ToasterProps["theme"]

  return (
    <Sonner
      theme={activeTheme || "light"}
      className="toaster group"
      richColors
      closeButton
      position="top-right"
      offset={props.offset ?? "1.25rem"}
      mobileOffset={
        props.mobileOffset ?? {
          top: "1rem",
          bottom: "calc(env(safe-area-inset-bottom, 0px) * 0.65 + 4.5rem)",
          left: "max(1rem, env(safe-area-inset-left, 0px))",
          right: "max(1rem, env(safe-area-inset-right, 0px))",
        }
      }
      style={
        {
          "--normal-bg": "var(--toast-normal-bg, var(--popover))",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          ...props.style,
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "group toast font-sans text-sm rounded-xl shadow-xl border backdrop-blur-md transition-all duration-200",
          description: "text-xs font-normal opacity-90",
          actionButton:
            "rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 transition-colors shadow-sm",
          cancelButton:
            "rounded-lg bg-muted text-muted-foreground px-3 py-1.5 text-xs font-medium hover:bg-muted/80 transition-colors",
          closeButton:
            "border border-border/60 bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
          ...props.toastOptions?.classNames,
        },
        ...props.toastOptions,
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
export type { ToasterProps }

