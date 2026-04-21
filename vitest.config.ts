import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // next-test-api-route-handler spins up a real HTTP server on localhost.
    // In Node 22, localhost resolves to IPv6 ::1 by default. This sandbox
    // blocks TCP connections to [::1] via a network policy, causing every
    // testApiHandler request to return 403 "Blocked by network policy".
    //
    // --dns-result-order=ipv4first forces localhost → 127.0.0.1, which
    // the sandbox permits and which also bypasses the HTTP proxy (NO_PROXY
    // already includes 127.0.0.1).
    env: {
      NODE_OPTIONS: "--dns-result-order=ipv4first",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
