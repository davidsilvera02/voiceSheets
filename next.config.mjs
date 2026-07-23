/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle for the Docker image. Vercel builds Next
  // natively, so standalone output is skipped there.
  output: process.env.VERCEL ? undefined : "standalone",
  // xlsx and other heavy libraries stay server-only where possible.
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "prisma"],
  },
  eslint: {
    // Linting is run separately in CI; do not block production builds on it.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
