// ─────────────────────────────────────────────────────────────
// Camada de dados (o "back-end" do app roda no Firebase):
//   • Cloud Storage guarda as mídias (fotos/vídeos)
//   • Firestore guarda os metadados (nome, recado, tag, url, likes...)
// Este módulo concentra TODA a conversa com o Firebase, para o resto
// do app não precisar conhecer os detalhes.
// ─────────────────────────────────────────────────────────────
import { db, storage } from "./firebase.js";
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
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const COL = "moments";

/**
 * Envia um momento: sobe o arquivo no Storage e grava o metadado no Firestore.
 * @param {{ blob: Blob, name: string, message: string, tag: string, isVideo: boolean }} data
 * @param {(pct:number)=>void} [onProgress] callback simples de progresso (0–100)
 */
export async function uploadMoment({ blob, name, message, tag, isVideo }, onProgress) {
  const ext = isVideo ? guessVideoExt(blob.type) : "jpg";
  const fileName = `momentos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const storageRef = ref(storage, fileName);

  onProgress?.(10);
  await uploadBytes(storageRef, blob, { contentType: blob.type || (isVideo ? "video/mp4" : "image/jpeg") });
  onProgress?.(70);

  const url = await getDownloadURL(storageRef);
  onProgress?.(85);

  await addDoc(collection(db, COL), {
    name: (name || "Convidado").trim().slice(0, 80),
    message: (message || "").trim().slice(0, 280),
    tag: tag || "",
    isVideo: !!isVideo,
    url,
    storagePath: fileName,
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

function guessVideoExt(mime = "") {
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("quicktime")) return "mov";
  if (mime.includes("webm")) return "webm";
  return "mp4";
}
