import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // `vercel dev` serves the /api functions; plain `vite dev` can proxy to it.
    proxy: process.env.API_PROXY ? { "/api": process.env.API_PROXY } : undefined,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
  },
});
