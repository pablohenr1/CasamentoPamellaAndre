// ─────────────────────────────────────────────────────────────
// "Ticket" assinado (HMAC) que prova que uma storagePath foi
// realmente emitida pelo /api/presign-upload — sem isso, o
// /api/moments não teria como saber se quem está criando o momento
// (ou pedindo pra cortar um vídeo) foi quem de fato subiu aquele
// arquivo, já que a storagePath aparece na listagem pública.
// ─────────────────────────────────────────────────────────────
import crypto from "node:crypto";

function secret() {
  const s = process.env.UPLOAD_TICKET_SECRET;
  if (!s) throw new Error("UPLOAD_TICKET_SECRET não configurado no .env");
  return s;
}

export function signUploadKey(key) {
  return crypto.createHmac("sha256", secret()).update(key).digest("hex");
}

export function verifyUploadTicket(key, ticket) {
  if (typeof ticket !== "string" || !ticket) return false;
  const expected = Buffer.from(signUploadKey(key), "hex");
  const given = Buffer.from(ticket, "hex");
  if (expected.length !== given.length) return false;
  return crypto.timingSafeEqual(expected, given);
}
