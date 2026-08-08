import type { NextConfig } from "next";

const MAX_UPLOAD_BYTES = Number(process.env.MAX_MEDIA_SIZE_BYTES || 2 * 1024 * 1024 * 1024);

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      // Keep this aligned with MAX_MEDIA_SIZE_BYTES for large media uploads.
      bodySizeLimit: `${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}mb`,
    },
    // Next 16 uses proxyClientMaxBodySize
    proxyClientMaxBodySize: MAX_UPLOAD_BYTES,
  },
};

export default nextConfig;
