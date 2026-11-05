import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client"],
  experimental: {
    agentUpgrade: "security",
  },
};

export default nextConfig;
