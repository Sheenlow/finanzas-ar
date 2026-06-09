import type { NextConfig } from "next";
import { resolve } from "path";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.3'],
  turbopack: {
    root: resolve('.'),
  },
};

export default nextConfig;
