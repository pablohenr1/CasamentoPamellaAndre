// ─────────────────────────────────────────────────────────────
// Cliente S3-compatível do Cloudflare R2, compartilhado entre as
// functions que precisam falar com o bucket (presign, corte de vídeo).
// ─────────────────────────────────────────────────────────────
import { S3Client } from "@aws-sdk/client-s3";

export const MAX_UPLOAD_BYTES = 60 * 1024 * 1024; // 60 MB

export function r2Client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

export function r2Bucket() {
  return process.env.R2_BUCKET_NAME;
}

export function r2PublicUrl(key) {
  return `${process.env.R2_PUBLIC_BASE_URL}/${key}`;
}
