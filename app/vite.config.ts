import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// 개발 서버 포트는 3003 으로 고정 — tauri.conf.json 의 devUrl 과 반드시 일치시켜야 함.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 3003,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
});
