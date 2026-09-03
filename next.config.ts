import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export required by the Tauri shell — no Node.js server at runtime.
  // The build output goes to ./out, which tauri.conf.json serves as frontendDist.
  output: "export",
};

export default nextConfig;