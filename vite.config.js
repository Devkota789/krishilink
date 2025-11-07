import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  // IMPORTANT for IIS + React Router refreshes:
  // Set a fixed base so built asset URLs are absolute to the app root and do not break on deep routes.
  // If hosted at the website root, keep '/'. If hosted under a virtual directory, set to that path (e.g., '/Krishilink/').
  // You can also override via env: VITE_BASE=/Krishilink/ npm run build
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target:
          "https://w1vqqn7ucvzpndp9xsvdkd15gzcedswvilahs3agd6b3dljo7tg24pbklk4u.shamir.com.np",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
