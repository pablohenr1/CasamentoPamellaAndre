// ─────────────────────────────────────────────────────────────
// Configuração do evento — vem do .env (variáveis VITE_*), com
// valores padrão de fallback. Nenhuma credencial de back-end mora
// aqui: Firestore e R2 só são acessados pelas functions em /api.
// ─────────────────────────────────────────────────────────────
export const EVENTO = {
  noivos: import.meta.env.VITE_NOIVOS || "Nossos noivos",
  data: import.meta.env.VITE_DATA_CASAMENTO || "",
  videoMaxSeconds: Number(import.meta.env.VITE_VIDEO_MAX_SECONDS || 30),
  adminPin: import.meta.env.VITE_ADMIN_PIN || "",
};
