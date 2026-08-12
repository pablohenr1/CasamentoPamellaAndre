// ─────────────────────────────────────────────────────────────
// Camada de dados:
//   • Cloudflare R2 guarda as mídias (fotos/vídeos), via URL assinada
//     gerada pela function serverless em /api/presign-upload
//   • Firestore guarda os metadados (nome, recado, tag, url, likes...)
// Este módulo concentra TODA a conversa com esses serviços, para o
// resto do app não precisar conhecer os detalhes.
// ─────────────────────────────────────────────────────────────
import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  increment,
  serverTimestamp,
} from "firebase/firestore";

const COL = "moments";

/**
 * Envia um momento: pede uma URL assinada (R2), sobe o arquivo DIRETO
 * pro bucket, e grava o metadado no Firestore.
 * @param {{ blob: Blob, name: string, message: string, tag: string, isVideo: boolean }} data
 * @param {(pct:number)=>void} [onProgress] callback simples de progresso (0–100)
 */
export async function uploadMoment({ blob, name, message, tag, isVideo }, onProgress) {
  const contentType = blob.type || (isVideo ? "video/mp4" : "image/jpeg");

  onProgress?.(5);
  const presignRes = await fetch("/api/presign-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType, isVideo, size: blob.size }),
  });
  if (!presignRes.ok) {
    const { error } = await presignRes.json().catch(() => ({}));
    throw new Error(error || "Não consegui preparar o envio.");
  }
  const { uploadUrl, publicUrl, key } = await presignRes.json();
  onProgress?.(15);

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!putRes.ok) throw new Error("Falha ao subir o arquivo.");
  onProgress?.(85);

  await addDoc(collection(db, COL), {
    name: (name || "Convidado").trim().slice(0, 80),
    message: (message || "").trim().slice(0, 280),
    tag: tag || "",
    isVideo: !!isVideo,
    url: publicUrl,
    storagePath: key,
    likes: 0,
    createdAt: serverTimestamp(),
  });

  onProgress?.(100);
}

/**
 * Escuta a galeria em TEMPO REAL (ordenada do mais novo para o mais antigo).
 * Retorna a função de "unsubscribe".
 * @param {(items:Array)=>void} callback recebe a lista atualizada
 */
export function listenMoments(callback) {
  const q = query(collection(db, COL), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          // createdAt pode vir null por um instante (latência do serverTimestamp)
          ts: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
        };
      });
      callback(items);
    },
    (err) => console.error("[listenMoments]", err)
  );
}

/** Curtir (+1) ou descurtir (-1) um momento. */
export async function toggleLike(id, liked) {
  const refDoc = doc(db, COL, id);
  await updateDoc(refDoc, { likes: increment(liked ? -1 : 1) });
}

/**
 * Baixa a mídia de um momento como Uint8Array (para download individual ou zip).
 * Usa a URL pública do Storage.
 */
export async function fetchMomentBytes(item) {
  const res = await fetch(item.url);
  if (!res.ok) throw new Error(`Falha ao baixar ${item.id}: ${res.status}`);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}
