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
  webpack: (config, { isServer }) => {
    // Fix for Prisma Client with Next.js - handle node: protocol imports
    if (isServer) {
      config.externals.push("@prisma/client");
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
