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
};

module.exports = nextConfig;
