import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const proxy = { "/api": { target: "http://127.0.0.1:8000", changeOrigin: true } };

// GitHub Pages serves the site from /<repo-name>/, set via VITE_BASE in CI.
export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  server: { port: 5173, proxy },
  preview: { port: 5173, proxy },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom", "@tanstack/react-query"],
          charts: ["recharts"],
          graph: ["cytoscape"],
          motion: ["framer-motion"],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
