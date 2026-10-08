import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { seoPages } from "./seo-pages.ts";

export default defineConfig({
  plugins: [react(), seoPages()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://127.0.0.1:3000", changeOrigin: true },
      "/socket.io": { target: "http://127.0.0.1:3000", ws: true },
    },
  },
});
