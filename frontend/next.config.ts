
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
