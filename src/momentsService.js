// ─────────────────────────────────────────────────────────────
// Camada de dados: o navegador NUNCA fala direto com Firestore ou
// R2 — tudo passa pelas functions serverless em /api, que guardam
// as credenciais (Firebase Admin SDK, chaves do R2). Assim nenhuma
// chave de back-end aparece no código que roda no navegador.
//   • /api/presign-upload → URL assinada pra subir mídia no R2
//   • /api/moments         → listar (GET) e criar (POST) momentos
//   • /api/moments/:id/like → curtir/descurtir (POST)
// ─────────────────────────────────────────────────────────────

const POLL_MS = 4000;

/**
 * Envia um momento: pede uma URL assinada (R2), sobe o arquivo DIRETO
 * pro bucket, e grava o metadado via /api/moments. Se vier `trim`, o
 * servidor corta o vídeo (ffmpeg) antes de salvar — só o trecho
 * escolhido fica guardado.
 * @param {{ blob: Blob, name: string, message: string, tag: string, isVideo: boolean, trim?: {start:number,end:number}|null }} data
 * @param {(pct:number)=>void} [onProgress] callback simples de progresso (0–100)
 */
export async function uploadMoment({ blob, name, message, tag, isVideo, trim }, onProgress) {
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
  const { uploadUrl, key, ticket } = await presignRes.json();
  onProgress?.(15);

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!putRes.ok) throw new Error("Falha ao subir o arquivo.");
  onProgress?.(trim ? 82 : 90);

  const momentRes = await fetch("/api/moments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: (name || "Convidado").trim().slice(0, 80),
      message: (message || "").trim().slice(0, 280),
      tag: tag || "",
      isVideo: !!isVideo,
      storagePath: key,
      ticket,
      ...(trim ? { trimStart: trim.start, trimEnd: trim.end } : {}),
    }),
  });
  if (!momentRes.ok) throw new Error("Momento enviado, mas não consegui salvar os dados.");

  onProgress?.(100);
}

/**
 * "Escuta" a galeria via polling em /api/moments (a cada poucos segundos).
 * Retorna a função de "unsubscribe" (para o timer).
 * @param {(items:Array)=>void} callback recebe a lista atualizada
 */
export function listenMoments(callback) {
  let stopped = false;

  async function tick() {
    if (stopped) return;
    try {
      const res = await fetch("/api/moments");
      if (res.ok) {
        const items = await res.json();
        if (!stopped) callback(items);
      }
    } catch (err) {
      console.error("[listenMoments]", err);
    }
  }

  tick();
  const interval = setInterval(tick, POLL_MS);
  return () => {
    stopped = true;
    clearInterval(interval);
  };
}

/** Curtir (+1) ou descurtir (-1) um momento. */
export async function toggleLike(id, liked) {
  const res = await fetch(`/api/moments/${id}/like`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ liked }),
  });
  if (!res.ok) throw new Error("Falha ao curtir.");
}

/**
 * Baixa a mídia de um momento como Uint8Array (para download individual ou zip).
 * Usa a URL pública do R2.
 */
export async function fetchMomentBytes(item) {
  const res = await fetch(item.url);
  if (!res.ok) throw new Error(`Falha ao baixar ${item.id}: ${res.status}`);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}
