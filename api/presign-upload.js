// ─────────────────────────────────────────────────────────────
// Function serverless (Vercel) — gera uma URL assinada (presigned)
// para o convidado subir o arquivo DIRETO pro bucket R2, sem que a
// chave secreta do R2 nunca chegue ao navegador.
// ─────────────────────────────────────────────────────────────
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, r2Bucket, r2PublicUrl, MAX_UPLOAD_BYTES } from "./_r2.js";
import { signUploadKey } from "./_uploadTicket.js";

// Lista fechada de tipos aceitos — nada de "image/*" genérico: isso deixaria
// passar coisa como image/svg+xml, que pode conter <script> e seria servida
// de volta pelo R2 com esse content-type (um jeito clássico de hospedar
// script malicioso via upload "só de imagem").
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { contentType, isVideo, size } = req.body || {};

    if (!contentType || !ALLOWED_TYPES.has(contentType)) {
      return res.status(400).json({ error: "Tipo de arquivo não permitido" });
    }
    if (typeof size === "number" && size > MAX_UPLOAD_BYTES) {
      return res.status(400).json({ error: "Arquivo maior que o limite de 60 MB" });
    }

    const ext = guessExt(contentType, isVideo);
    const key = `momentos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(r2Client(), command, { expiresIn: 300 });
    const publicUrl = r2PublicUrl(key);
    // prova, pro /api/moments, que essa storagePath saiu daqui — sem isso,
    // qualquer um poderia reaproveitar a storagePath de outro convidado
    // (ela aparece na listagem pública) pra mexer no arquivo dele.
    const ticket = signUploadKey(key);

    return res.status(200).json({ uploadUrl, publicUrl, key, ticket });
  } catch (err) {
    console.error("[presign-upload]", err);
    return res.status(500).json({ error: "Falha ao gerar URL de upload" });
  }
}

function guessExt(mime = "", isVideo) {
  if (mime.includes("jpeg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("quicktime")) return "mov";
  if (mime.includes("webm")) return "webm";
  return isVideo ? "mp4" : "jpg";
}
