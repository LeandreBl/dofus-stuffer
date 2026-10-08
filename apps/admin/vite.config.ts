import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served under /admin/ by the web container; in dev, the API runs on :3000.
export default defineConfig({
  base: "/admin/",
  plugins: [react()],
  server: {
    port: 5174,
    proxy: { "/api": { target: "http://127.0.0.1:3000", changeOrigin: true } },
  },
});
