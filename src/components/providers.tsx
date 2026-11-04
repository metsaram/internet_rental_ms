"use client";

import * as React from "react";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Keep data fresh for 60 s before auto-refetching; prevents redundant
            // round-trips when navigating between pages (e.g. Dashboard → Contracts).
            staleTime: 60_000,
            // Retain cached data in memory for 5 min after the last subscriber
            // unmounts so back-navigation renders instantly from cache.
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            // Re-fetch after a network reconnection so users always see fresh data.
            refetchOnReconnect: true,
            retry: 1,
          },
        },
      })
  );

  return (
    <SessionProvider>
      <NextThemesProvider
        attribute="class"
        defaultTheme="system"
        enableSystem={true}
        disableTransitionOnChange
      >
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </NextThemesProvider>
    </SessionProvider>
  );
}

