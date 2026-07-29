// ─────────────────────────────────────────────────────────────
// Utilidades compartilhadas
// ─────────────────────────────────────────────────────────────

/** Escapa texto para inserir com segurança no HTML. */
export function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str ?? "";
  return d.innerHTML;
}

/** Remove acentos e baixa para minúsculas (para busca). */
export function normalize(s) {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** "agora" / "há 12 min" / "há 3 h" a partir de um timestamp (ms). */
export function relativeTime(ms) {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  return `há ${h} h`;
}

/** Comprime uma imagem no navegador; devolve um Blob JPEG. */
export function compressImage(file, maxWidth = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("toBlob falhou"))),
          "image/jpeg",
          quality
        );
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Lê a duração (segundos) de um arquivo de vídeo sem fazer upload. */
export function checkVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(v.src);
      resolve(v.duration || 0);
    };
    v.onerror = reject;
    v.src = URL.createObjectURL(file);
  });
}

/** Nome de arquivo seguro para downloads: "03_maria_clara.jpg". */
export function safeName(name, i, ext) {
  const clean = (name || "convidado")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
  return `${String(i + 1).padStart(2, "0")}_${clean || "convidado"}.${ext}`;
}

/** Extrai a extensão a partir do content-type. */
export function extFromMime(mime = "") {
  if (mime.includes("jpeg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("quicktime")) return "mov";
  if (mime.includes("webm")) return "webm";
  return "bin";
}

/** Dispara o download de um Blob com um nome de arquivo. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
