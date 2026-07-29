import { defineConfig } from "vite";

// Configuração enxuta: app de página única, saída em /dist (padrão que o Vercel entende).
export default defineConfig({
  build: {
    outDir: "dist",
    // Firebase é grande; deixamos o Vite separar em chunks sem alarmar no build.
    chunkSizeWarningLimit: 1200,
  },
});
