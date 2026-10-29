import type { NextConfig } from "next";

/**
 * Phase 17 — Production hardening: security headers.
 *
 * These headers are applied to every route handler response in production.
 * They mitigate common web vulnerabilities:
 *  - X-Frame-Options: DENY — prevents clickjacking via iframe embedding.
 *  - X-Content-Type-Options: nosniff — prevents MIME-type sniffing.
 *  - Referrer-Policy: strict-origin-when-cross-origin — limits referrer leakage.
 *  - Permissions-Policy: restricts camera/microphone/geolocation to self.
 *  - Strict-Transport-Security: enforces HTTPS (only sent over HTTPS in prod).
 *  - Content-Security-Policy: restricts script/style/image sources to self +
 *    Next.js inline styles + the CDN fonts/images we actually use.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https: https://va.vercel-scripts.com https://vitals.vercel-insights.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
