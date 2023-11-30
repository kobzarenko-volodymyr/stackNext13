/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
    // MDX (Markdown with JSX):
    mdxRs: true,
    serverComponentsExternalPackages: ["mongoose"],
  },
  // to get images from Clark
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*",
      },
      {
        protocol: "http",
        hostname: "*",
      },
    ],
  },
};

module.exports = nextConfig;
