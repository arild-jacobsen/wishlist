import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Explicitly set the workspace root to this project's directory.
  // Without this, Next.js detects the wrong root when multiple package-lock.json
  // files exist in parent directories (e.g. a NanoClaw sandbox), which causes
  // it to look for .env.local in the wrong place.
  outputFileTracingRoot: path.resolve(__dirname),
};

export default nextConfig;
