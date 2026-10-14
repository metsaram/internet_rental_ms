"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Wraps view content with a subtle fade + slight upward slide on every view
 * switch. Keeps the app feeling responsive without being distracting.
 */
export function ViewTransition({ viewKey, children }: { viewKey: string; children: React.ReactNode }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={viewKey}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
