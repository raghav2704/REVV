
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        // Compatible with Next.js hydration and the local Three.js renderer.
        // A strict script CSP still needs per-response nonces.
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" },
        ...(process.env.REVV_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
      ],
    }];
  },
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
  ],

  turbopack: {
    root: process.cwd(),
  },

  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination:
          "http://127.0.0.1:8000/api/v1/:path*",
      },
      {
        source: "/uploads/:path*",
        destination:
          "http://127.0.0.1:8000/uploads/:path*",
      },
    ];
  },
};

export default nextConfig;
