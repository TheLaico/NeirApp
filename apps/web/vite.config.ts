import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // En desarrollo la API se sirve bajo el mismo origen: sin CORS ni URLs hardcodeadas.
    proxy: { "/api": "http://localhost:8000" },
  },
  // maplibre-gl carga su parser de tiles/GeoJSON en un Web Worker interno; el pre-bundler de Vite
  // reescribe esa ruta y rompe la carga del worker. Se excluye para que sirva su propio ESM tal cual.
  optimizeDeps: { exclude: ["maplibre-gl"] },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    css: false,
  },
});
