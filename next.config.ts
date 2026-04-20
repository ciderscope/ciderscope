import type { NextConfig } from "next";

const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
} satisfies NextConfig & { eslint?: { ignoreDuringBuilds?: boolean } };

export default nextConfig;
