// ─────────────────────────────────────────────────────────────
// Function serverless (Vercel) — gera uma URL assinada (presigned)
// para o convidado subir o arquivo DIRETO pro bucket R2, sem que a
// chave secreta do R2 nunca chegue ao navegador.
// ─────────────────────────────────────────────────────────────
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const ALLOWED_TYPES = /^(image|video)\//;
const MAX_SIZE = 60 * 1024 * 1024; // 60 MB, mesmo teto usado nas regras do Storage

function client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { contentType, isVideo, size } = req.body || {};

    if (!contentType || !ALLOWED_TYPES.test(contentType)) {
      return res.status(400).json({ error: "Tipo de arquivo não permitido" });
    }
    if (typeof size === "number" && size > MAX_SIZE) {
      return res.status(400).json({ error: "Arquivo maior que o limite de 60 MB" });
    }

    const ext = guessExt(contentType, isVideo);
    const key = `momentos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(client(), command, { expiresIn: 300 });
    const publicUrl = `${process.env.R2_PUBLIC_BASE_URL}/${key}`;

    return res.status(200).json({ uploadUrl, publicUrl, key });
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
