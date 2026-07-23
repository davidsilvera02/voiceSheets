/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Produce a self-contained server bundle for the Docker runner image.
  output: "standalone",
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
