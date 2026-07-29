// ─────────────────────────────────────────────────────────────
// Inicialização do Firebase (SDK modular v10)
// Lê as credenciais das variáveis VITE_FIREBASE_* definidas no .env
// ─────────────────────────────────────────────────────────────
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Aviso amigável no console se esqueceram de configurar o .env
if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("cole_")) {
  console.warn(
    "[Firebase] Variáveis de ambiente não configuradas. " +
      "Copie .env.example para .env e preencha com as chaves do seu projeto Firebase."
  );
}

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);

// Constantes do evento (também vêm do .env, com valores padrão de fallback)
export const EVENTO = {
  noivos: import.meta.env.VITE_NOIVOS || "Nossos noivos",
  data: import.meta.env.VITE_DATA_CASAMENTO || "",
  videoMaxSeconds: Number(import.meta.env.VITE_VIDEO_MAX_SECONDS || 30),
  adminPin: import.meta.env.VITE_ADMIN_PIN || "",
};
