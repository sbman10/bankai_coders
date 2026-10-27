import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["regress-outer-ambiance.ngrok-free.dev"],
  turbopack: { root: process.cwd() },
  serverExternalPackages: ["pdfjs-dist", "@google-cloud/vision", "tesseract.js", "@napi-rs/canvas"],
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
