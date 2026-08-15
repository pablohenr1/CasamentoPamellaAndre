// ─────────────────────────────────────────────────────────────
// Inicializa o Firebase Admin SDK (só roda no servidor). A chave de
// serviço vem de variáveis SEM prefixo VITE_, então nunca chega ao
// navegador — nem no bundle, nem em nenhuma resposta.
// ─────────────────────────────────────────────────────────────
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function app() {
  if (getApps().length) return getApps()[0];
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }),
  });
}

export function db() {
  return getFirestore(app());
}
