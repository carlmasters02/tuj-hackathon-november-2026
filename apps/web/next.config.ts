import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@hm/shared"],
  serverExternalPackages: ["sharp"],
  experimental: { serverActions: { bodySizeLimit: "1mb" } },
  async redirects() {
    return [
      { source: "/portfolio/writing", destination: "/portfolio/words", permanent: false },
      { source: "/gallery", destination: "/portfolio", permanent: false },
      { source: "/gallery/upload", destination: "/portfolio/upload", permanent: false },
      { source: "/gallery/:id", destination: "/portfolio/work/:id", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        // The ONLY place 'wasm-unsafe-eval' is allowed: the Pyodide worker script and runtime files.
        source: "/workers/pyodide-worker.js",
        headers: [
          { key: "Content-Security-Policy", value: "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'" },
          { key: "Cache-Control", value: "no-cache" },
        ],
      },
      {
        source: "/pyodide/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, immutable" }],
      },
    ];
  },
};

export default config;
