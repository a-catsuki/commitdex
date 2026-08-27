import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Next 16 blocks /_next/* from 127.0.0.1 by default (localhost is allowed).
  // Without this, Client Components never hydrate when opening via 127.0.0.1.
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: ["@tensorflow/tfjs", "nsfwjs"],
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
