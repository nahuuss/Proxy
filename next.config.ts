
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  output: 'standalone',
  serverExternalPackages: ['httpntlm'],
  turbopack: {},
  webpack: (config) => {
    config.watchOptions = {
      ignored: [
        '**/data/**',
        '**/System Volume Information/**',
      ],
    };
    return config;
  },
};

export default nextConfig;
