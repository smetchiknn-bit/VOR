import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Дублирует vite.config.js с добавлением base: "./" — относительные пути
// к ассетам позволяют открывать собранный dist/index.html из любого
// каталога/подпути (в т.ч. в отдельном окне) без «белого экрана».
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3000,
    },
  },
});
