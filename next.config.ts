import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  assetPrefix: process.env.ELECTRON_BUILD === "1" ? "./" : undefined,
};

export default nextConfig;
