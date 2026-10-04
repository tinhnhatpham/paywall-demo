import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Fixed port so it matches FRONTEND_URL in the backend .env (CORS + Stripe redirect URLs)
  server: { port: 5173, strictPort: true },
});
