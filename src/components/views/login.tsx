"use client";

import * as React from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  ShieldCheck,
  AlertCircle,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  Server,
  Sun,
  Moon,
  HelpCircle,
  Copy,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { resetIdleTimeoutStorage } from "@/lib/idle-timeout-config";

export function LoginScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const { update } = useSession();
  const { theme, setTheme, resolvedTheme } = useTheme();

  const [mounted, setMounted] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [rememberMe, setRememberMe] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [helpOpen, setHelpOpen] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const callbackUrl = params.get("callbackUrl") ?? "/";

  // =========================================================================
  // Form Submission
  // =========================================================================
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
        callbackUrl,
      });
      if (!res || res.error) {
        setError("Invalid email or password. Please verify your credentials.");
        return;
      }
      resetIdleTimeoutStorage();
      toast.success("Authentication successful! Welcome to NetRent.");
      await update();
      router.refresh();
    } catch {
      setError("An unexpected network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAutoFillDemo = () => {
    setEmail("admin@netrent.local");
    setPassword("admin12345");
    setError(null);
    toast.info("Demo credentials loaded (admin@netrent.local).");
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-50 via-background to-emerald-100/50 text-foreground dark:from-slate-950 dark:via-background dark:to-emerald-950/40 p-4 sm:p-6 md:p-8 lg:p-12 transition-colors duration-500">
      {/* =====================================================================
          DYNAMIC BACKGROUND LAYER 1: Ambient Moving Fluid Colors & Blobs
         ===================================================================== */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Soft centered ambient radial glow */}
        <div className="absolute inset-0 bg-[radial-gradient(850px_circle_at_50%_45%,rgba(16,185,129,0.12),transparent_70%)] dark:bg-[radial-gradient(850px_circle_at_50%_45%,rgba(16,185,129,0.18),rgba(6,182,212,0.08),transparent_70%)]" />

        {/* Morphing color wave orbs with continuous floating motion */}
        <motion.div
          animate={{
            x: [0, 80, -40, 0],
            y: [0, -60, 40, 0],
            scale: [1, 1.15, 0.95, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -left-20 -top-20 size-[32rem] rounded-full bg-emerald-400/20 dark:bg-emerald-500/15 blur-[100px]"
        />

        <motion.div
          animate={{
            x: [0, -90, 50, 0],
            y: [0, 70, -40, 0],
            scale: [1, 1.2, 0.9, 1],
          }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute -bottom-32 -right-20 size-[36rem] rounded-full bg-teal-300/25 dark:bg-teal-500/15 blur-[110px]"
        />

        <motion.div
          animate={{
            x: [0, 60, -70, 0],
            y: [0, 50, -50, 0],
            scale: [1, 0.88, 1.12, 1],
          }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute left-1/3 top-1/4 size-[26rem] rounded-full bg-emerald-200/30 dark:bg-cyan-600/15 blur-[95px]"
        />

        <motion.div
          animate={{
            scale: [1, 1.25, 1],
            opacity: [0.12, 0.22, 0.12],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute right-1/4 bottom-1/4 size-[28rem] rounded-full bg-teal-200/25 dark:bg-emerald-400/15 blur-[95px]"
        />

        {/* Tech Cyber Mesh Matrix Pattern with Radial Mask */}
        <div
          className="absolute inset-0 opacity-[0.08] dark:opacity-[0.16] transition-opacity"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: "32px 32px",
            maskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 80%)",
          }}
        />
      </div>

      {/* =====================================================================
          MAIN CARD CONTAINER
         ===================================================================== */}
      <div className="relative z-10 w-full max-w-md md:max-w-5xl">
        <div className="relative grid w-full grid-cols-1 overflow-hidden rounded-3xl border border-border/80 bg-card/95 text-card-foreground shadow-2xl backdrop-blur-2xl ring-1 ring-black/5 dark:border-emerald-500/25 dark:bg-slate-900/85 dark:ring-white/10 dark:shadow-[0_30px_90px_-20px_rgba(0,0,0,0.85)] md:grid-cols-2">
          {/* =================================================================
              LEFT PANEL: Brand Identity & Animated Network Showcase (Desktop Only, 50% Split)
             ================================================================= */}
          <div className="hidden md:flex relative flex-col justify-between overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-8 sm:p-10 md:p-10 text-white dark:from-emerald-950 dark:via-slate-950 dark:to-emerald-900/90 border-r border-emerald-500/30 dark:border-emerald-500/20">
            {/* Subtle glow orb inside brand card */}
            <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-emerald-500/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 size-64 rounded-full bg-teal-500/15 blur-3xl" />

            {/* Header: Logo, Title & Status */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative flex size-12 items-center justify-center rounded-2xl bg-white/15 dark:bg-gradient-to-br dark:from-emerald-400 dark:to-teal-600 p-2 shadow-lg shadow-emerald-950/20 ring-1 ring-white/30 backdrop-blur-sm">
                    <Image
                      src="/logo-icon.png"
                      alt="NetRent Logo"
                      width={36}
                      height={36}
                      className="size-8 object-contain drop-shadow"
                      priority
                    />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                      NetRent
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-200 dark:text-emerald-400 bg-white/15 dark:bg-emerald-500/20 px-1.5 py-0.5 rounded border border-white/20 dark:border-emerald-500/30">
                        v2.4
                      </span>
                    </h2>
                    <p className="text-xs text-emerald-100/80 dark:text-emerald-200/70 font-medium">
                      Internet Rental Management
                    </p>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-white/20 dark:border-emerald-400/30 bg-white/10 dark:bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-100 dark:text-emerald-300">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-300 dark:bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-emerald-300 dark:bg-emerald-400" />
                  </span>
                  Online
                </div>
              </div>

              {/* Tagline */}
              <div className="pt-2">
                <h1 className="text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
                  Unified Network, Seamless Contracts.
                </h1>
                <p className="mt-2 text-xs leading-relaxed text-emerald-100/80 dark:text-emerald-100/70 sm:text-sm">
                  Full lifecycle tracking for branches, shops, ISP plans, and recurring costs with automated reconciliation.
                </p>
              </div>
            </div>

            {/* Animated Live Network Topology Widget */}
            <div className="relative my-6 rounded-2xl border border-white/20 bg-black/20 p-4 shadow-inner backdrop-blur-md dark:border-emerald-500/30 dark:bg-slate-950/60">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-emerald-100 dark:text-emerald-300">
                  <Server className="size-3.5 text-emerald-200 dark:text-emerald-400" /> Live Mesh Telemetry
                </span>
                <span className="rounded-full border border-white/30 dark:border-emerald-500/40 bg-white/10 dark:bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-white dark:text-emerald-300">
                  ACTIVE
                </span>
              </div>

              {/* Animated SVG Topology */}
              <svg
                viewBox="0 0 320 110"
                className="h-24 w-full overflow-visible"
                fill="none"
              >
                {/* Connection lines */}
                <path
                  d="M 50 55 L 160 25"
                  stroke="rgba(16, 185, 129, 0.4)"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  className="animate-pulse"
                />
                <path
                  d="M 160 25 L 270 55"
                  stroke="rgba(16, 185, 129, 0.4)"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  className="animate-pulse"
                />
                <path
                  d="M 50 55 L 160 85"
                  stroke="rgba(20, 184, 166, 0.4)"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
                <path
                  d="M 160 85 L 270 55"
                  stroke="rgba(20, 184, 166, 0.4)"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
                <path
                  d="M 160 25 L 160 85"
                  stroke="rgba(16, 185, 129, 0.25)"
                  strokeWidth="1.5"
                />

                {/* Animated data pulses moving along network paths */}
                <circle r="3" fill="#34d399">
                  <animateMotion
                    path="M 50 55 L 160 25 L 270 55"
                    dur="3s"
                    repeatCount="indefinite"
                  />
                </circle>
                <circle r="3" fill="#22d3ee">
                  <animateMotion
                    path="M 270 55 L 160 85 L 50 55"
                    dur="3.4s"
                    repeatCount="indefinite"
                  />
                </circle>

                {/* Left Node: Branches */}
                <g transform="translate(50, 55)">
                  <circle
                    r="15"
                    fill="rgba(6, 78, 59, 0.9)"
                    stroke="#10b981"
                    strokeWidth="2"
                  />
                  <circle r="5" fill="#34d399" />
                  <text
                    y="24"
                    textAnchor="middle"
                    fill="#a7f3d0"
                    fontSize="9"
                    fontWeight="500"
                    fontFamily="sans-serif"
                  >
                    Branches
                  </text>
                </g>

                {/* Top Node: Core Hub */}
                <g transform="translate(160, 25)">
                  <circle
                    r="18"
                    fill="rgba(4, 120, 87, 0.95)"
                    stroke="#34d399"
                    strokeWidth="2"
                    className="animate-pulse"
                  />
                  <circle r="7" fill="#ffffff" />
                  <text
                    y="-22"
                    textAnchor="middle"
                    fill="#6ee7b7"
                    fontSize="10"
                    fontWeight="bold"
                    fontFamily="sans-serif"
                  >
                    NetRent Core
                  </text>
                </g>

                {/* Bottom Node: ISP Gateway */}
                <g transform="translate(160, 85)">
                  <circle
                    r="15"
                    fill="rgba(15, 118, 110, 0.9)"
                    stroke="#14b8a6"
                    strokeWidth="2"
                  />
                  <circle r="5" fill="#2dd4bf" />
                  <text
                    y="24"
                    textAnchor="middle"
                    fill="#99f6e4"
                    fontSize="9"
                    fontWeight="500"
                    fontFamily="sans-serif"
                  >
                    ISP Gateways
                  </text>
                </g>

                {/* Right Node: Shop Points */}
                <g transform="translate(270, 55)">
                  <circle
                    r="15"
                    fill="rgba(6, 78, 59, 0.9)"
                    stroke="#10b981"
                    strokeWidth="2"
                  />
                  <circle r="5" fill="#34d399" />
                  <text
                    y="24"
                    textAnchor="middle"
                    fill="#a7f3d0"
                    fontSize="9"
                    fontWeight="500"
                    fontFamily="sans-serif"
                  >
                    Shop Points
                  </text>
                </g>
              </svg>

              {/* Telemetry Micro Stats */}
              <div className="mt-2 grid grid-cols-3 gap-2 border-t border-emerald-500/20 pt-2.5 text-center">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-emerald-300/70">
                    Branches
                  </p>
                  <p className="text-xs font-bold text-white">14 Active</p>
                </div>
                <div className="border-x border-emerald-500/20">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-300/70">
                    Contracts
                  </p>
                  <p className="text-xs font-bold text-emerald-300">240+ Live</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-emerald-300/70">
                    Precision
                  </p>
                  <p className="text-xs font-bold text-teal-300">Decimal Safe</p>
                </div>
              </div>
            </div>

            {/* Feature Checkpoints */}
            <div className="space-y-2 pt-1 text-xs text-emerald-100/80">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                <span>Role-based access & company-scoped isolation</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                <span>Advance renewal & expiration warning triggers</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                <span>Audit-ready reconciliation and ledger tracking</span>
              </div>
            </div>

            {/* Bottom Version / Copyright */}
            <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-[11px] text-emerald-200/50">
              <span>© {new Date().getFullYear()} NetRent Systems</span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="size-3 text-emerald-400" /> SOC2 Compliant
              </span>
            </div>
          </div>

          {/* =================================================================
              RIGHT PANEL: Redesigned Interactive Login Form (50% Split)
             ================================================================= */}
          <div className="flex flex-col justify-center bg-card/95 p-6 sm:p-8 md:p-10 backdrop-blur-xl">
            {/* Top Toolbar: Workspace badge & Theme toggle */}
            <div>
              <div className="mb-6 flex items-center justify-between">
                {/* Mobile Brand Header */}
                <div className="flex items-center gap-2.5 md:hidden">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 p-1.5 shadow-md">
                    <Image
                      src="/logo-icon.png"
                      alt="NetRent"
                      width={24}
                      height={24}
                      className="size-6 object-contain"
                    />
                  </div>
                  <div>
                    <span className="text-sm font-bold tracking-tight text-foreground">
                      NetRent
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      Enterprise Login
                    </span>
                  </div>
                </div>

                <div className="hidden md:flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  Enterprise Portal
                </div>

                {/* Color Mode Switcher */}
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setTheme(resolvedTheme === "dark" ? "light" : "dark")
                    }
                    className="size-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                    title="Toggle Theme"
                    aria-label="Toggle dark/light theme"
                  >
                    {mounted ? (
                      resolvedTheme === "dark" ? (
                        <Sun className="size-4 text-amber-400 transition-transform duration-300 rotate-0" />
                      ) : (
                        <Moon className="size-4 text-slate-700 transition-transform duration-300 rotate-0" />
                      )
                    ) : (
                      <div className="size-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Title & Subtitle */}
              <div className="mb-6 space-y-1.5">
                <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Sign in to workspace
                </h2>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Enter your credentials to access your organization dashboard.
                </p>
              </div>

              {/* Demo Account Quick-Fill Assistant Pill */}
              <div className="mb-5 flex items-center justify-between rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-muted-foreground dark:border-emerald-500/30 dark:bg-emerald-950/40">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 shrink-0 text-emerald-500" />
                  <span className="text-foreground/90">
                    Demo:{" "}
                    <code className="rounded bg-background/80 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      admin@netrent.local
                    </code>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAutoFillDemo}
                  className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 active:scale-95"
                >
                  Auto-fill
                </button>
              </div>

              {/* Error Alert with Shake Animation */}
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      x: [-6, 6, -4, 4, -2, 2, 0],
                    }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.35 }}
                    className="mb-5 flex items-center gap-2.5 rounded-xl border border-rose-300/80 bg-rose-50/90 p-3 text-xs font-medium text-rose-700 shadow-xs dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300"
                    role="alert"
                  >
                    <AlertCircle className="size-4 shrink-0 text-rose-500" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Login Form */}
              <form onSubmit={submit} className="space-y-4">
                {/* Email Field */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="email"
                    className="text-xs font-medium text-foreground"
                  >
                    Email Address
                  </Label>
                  <div className="group relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-emerald-500" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="admin@netrent.local"
                      className="h-11 rounded-xl border-input/80 bg-background/50 pl-10 text-sm shadow-xs transition-all duration-200 hover:border-emerald-500/40 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/25"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="password"
                      className="text-xs font-medium text-foreground"
                    >
                      Password
                    </Label>
                    <button
                      type="button"
                      onClick={() => setHelpOpen(true)}
                      className="text-[11px] font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="group relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-emerald-500" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••••••"
                      className="h-11 rounded-xl border-input/80 bg-background/50 pl-10 pr-10 text-sm shadow-xs transition-all duration-200 hover:border-emerald-500/40 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/25"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Auxiliary row: Remember me & Help */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="remember"
                      checked={rememberMe}
                      onCheckedChange={(checked) =>
                        setRememberMe(Boolean(checked))
                      }
                      className="rounded-md border-emerald-500/50 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                    />
                    <Label
                      htmlFor="remember"
                      className="cursor-pointer text-xs font-normal text-muted-foreground select-none"
                    >
                      Remember this session
                    </Label>
                  </div>

                  <button
                    type="button"
                    onClick={() => setHelpOpen(true)}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <HelpCircle className="size-3.5" />
                    <span>Need help?</span>
                  </button>
                </div>

                {/* 3D Radiant Submit Button */}
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="pt-2"
                >
                  <Button
                    type="submit"
                    disabled={loading || !email.trim() || !password}
                    className="relative group h-11 w-full overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all hover:shadow-emerald-500/40 hover:brightness-105 active:scale-[0.99]"
                    size="lg"
                  >
                    {/* Hover light sheen sweep */}
                    <span className="pointer-events-none absolute -inset-full top-0 block -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition-all duration-700 group-hover:inset-full group-hover:opacity-100" />

                    {loading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        Verifying credentials...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        Sign in to Workspace
                        <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
                      </span>
                    )}
                  </Button>
                </motion.div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          ENTERPRISE HELP & FORGOT PASSWORD MODAL
         ===================================================================== */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <HelpCircle className="size-5" />
            </div>
            <DialogTitle>Account Access & Password Recovery</DialogTitle>
            <DialogDescription>
              NetRent is a corporate enterprise platform with centralized user management.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs leading-relaxed text-muted-foreground">
            <p>
              For security compliance, user credentials and access tokens are managed by your company administrator.
            </p>
            <div className="rounded-xl border bg-muted/40 p-3 space-y-1.5 text-foreground/90">
              <p className="font-semibold text-xs text-foreground">Standard Recovery Procedure:</p>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-muted-foreground">
                <li>Contact your IT Helpdesk or organization administrator.</li>
                <li>Request a secure temporary password reset for your email address.</li>
                <li>Default demo administrator: <code className="font-mono bg-background px-1.5 py-0.5 rounded text-emerald-600 dark:text-emerald-400 font-semibold">admin@netrent.local</code></li>
                <li>Default demo password: <code className="font-mono bg-background px-1.5 py-0.5 rounded font-semibold">admin12345</code></li>
              </ul>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div>
                <p className="font-semibold text-foreground text-xs">Helpdesk Contact</p>
                <p className="text-[11px] text-muted-foreground">ops@acme.example</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText("ops@acme.example");
                  toast.success("Administrator email copied to clipboard!");
                }}
                className="gap-1.5 text-xs rounded-lg"
              >
                <Copy className="size-3" /> Copy
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => setHelpOpen(false)}
              className="w-full sm:w-auto rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              Back to Sign In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

