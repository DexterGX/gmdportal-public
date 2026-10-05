/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Allow Google profile images used by next-auth / Google OAuth
    domains: ["lh3.googleusercontent.com"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
  // Round 13: pdfjs-dist + @napi-rs/canvas (vendor catalog PDF rendering,
  // see src/lib/cabinetCatalogVisuals.ts) ship their own native/worker
  // files that webpack shouldn't try to bundle/transform - same reasoning
  // as @prisma/client below. serverExternalPackages tells Next's server
  // build + Vercel's output file tracing to ship them as plain node_modules
  // instead, which is what their prebuilt binaries need to actually load.
  serverExternalPackages: ["pdfjs-dist", "@napi-rs/canvas"],
  webpack: (config, { isServer }) => {
    // Fix for Prisma Client with Next.js - handle node: protocol imports
    if (isServer) {
      config.externals.push("@prisma/client", "pdfjs-dist", "@napi-rs/canvas");
    }

    // Handle node:async_hooks and other node: imports
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "node:async_hooks": false,
      async_hooks: false,
    };

    return config;
  },
};

module.exports = nextConfig;
