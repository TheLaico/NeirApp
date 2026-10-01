import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: { exclude: ["maplibre-gl"] },
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://localhost:8000", ws: true } },
    // Permite ver la app desde la red local o un túnel temporal (p. ej. trycloudflare.com) mientras se prueba en otro dispositivo.
    allowedHosts: true,
  },
});
