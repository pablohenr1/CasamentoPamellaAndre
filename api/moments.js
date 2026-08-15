// ─────────────────────────────────────────────────────────────
// GET  /api/moments  → lista os momentos (mais novo primeiro)
// POST /api/moments  → cria um momento novo
// Único jeito do navegador tocar no Firestore: sempre por aqui,
// nunca com o SDK cliente. Valida os campos como as regras faziam.
// ─────────────────────────────────────────────────────────────
import { HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "./_firebaseAdmin.js";
import { r2Client, r2Bucket, r2PublicUrl, MAX_UPLOAD_BYTES } from "./_r2.js";
import { verifyUploadTicket } from "./_uploadTicket.js";
import { trimVideoInR2 } from "./_trimVideo.js";

const COL = "moments";

export default async function handler(req, res) {
  if (req.method === "GET") return handleList(req, res);
  if (req.method === "POST") return handleCreate(req, res);
  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Método não permitido" });
}

async function handleList(req, res) {
  try {
    const snap = await db().collection(COL).orderBy("createdAt", "desc").get();
    // Só os campos que a galeria realmente usa — em especial, NUNCA a
    // storagePath: ela é a "chave" do arquivo no R2, e se aparecesse aqui
    // qualquer convidado poderia reaproveitá-la pra mexer no momento de
    // outra pessoa (era exatamente essa a brecha antes desse fix).
    const items = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name,
        message: data.message,
        tag: data.tag,
        isVideo: !!data.isVideo,
        url: data.url,
        likes: data.likes || 0,
        ts: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
      };
    });
    return res.status(200).json(items);
  } catch (err) {
    console.error("[GET /api/moments]", err);
    return res.status(500).json({ error: "Falha ao carregar a galeria" });
  }
}

async function handleCreate(req, res) {
  try {
    const { name, message, tag, isVideo, trimStart, trimEnd, ticket } = req.body || {};
    let { storagePath } = req.body || {};

    if (typeof storagePath !== "string" || !storagePath)
      return res.status(400).json({ error: "storagePath inválido" });

    // Prova que essa storagePath saiu de um /api/presign-upload chamado
    // agora há pouco — sem isso, qualquer um poderia mandar a storagePath
    // de outro convidado (não aparece mais na listagem, mas ainda assim
    // não custa nada checar) e mexer no arquivo de outra pessoa.
    if (!verifyUploadTicket(storagePath, ticket)) {
      return res.status(403).json({ error: "Envio inválido — peça uma nova URL de upload e tente de novo." });
    }

    // Confere que o arquivo realmente existe no R2 (o convidado pode ter
    // ganhado a URL assinada e nunca subido nada) e que o tamanho real bate
    // com o limite — o client avisa um "size" no presign, mas nada impede
    // de mentir ou simplesmente mandar mais bytes no PUT; aqui é a checagem
    // que vale de verdade, contra o arquivo que está de fato no bucket.
    const head = await r2Client()
      .send(new HeadObjectCommand({ Bucket: r2Bucket(), Key: storagePath }))
      .catch(() => null);
    if (!head) {
      return res.status(400).json({ error: "Não encontrei o arquivo enviado — tente de novo." });
    }
    if (head.ContentLength > MAX_UPLOAD_BYTES) {
      await r2Client().send(new DeleteObjectCommand({ Bucket: r2Bucket(), Key: storagePath })).catch(() => {});
      return res.status(400).json({ error: "Arquivo maior que o limite de 60 MB" });
    }

    // a url é sempre derivada da storagePath aqui no servidor — nunca aceitamos
    // uma url vinda do cliente, pra não deixar alguém apontar a galeria pra
    // qualquer link de fora.
    let url = r2PublicUrl(storagePath);

    // Se o vídeo passou do limite, o convidado escolheu um trecho no app —
    // corta de verdade aqui no servidor e troca pro arquivo já cortado.
    if (isVideo && Number.isFinite(trimStart) && Number.isFinite(trimEnd) && trimEnd > trimStart) {
      const maxAllowed = Number(process.env.VITE_VIDEO_MAX_SECONDS || 30) + 1; // pequena folga
      const start = Math.max(0, trimStart);
      const end = Math.min(trimEnd, start + maxAllowed);
      try {
        const cut = await trimVideoInR2({ key: storagePath, trimStart: start, trimEnd: end });
        storagePath = cut.key;
        url = cut.url;
      } catch (err) {
        console.error("[trim]", err);
        // segue com o vídeo original — melhor salvar o momento inteiro do
        // que fazer o convidado perder o envio por causa do corte.
      }
    }

    const doc = {
      name: String(name || "Convidado").trim().slice(0, 80),
      message: String(message || "").trim().slice(0, 280),
      tag: String(tag || "").slice(0, 40),
      isVideo: !!isVideo,
      url,
      storagePath,
      likes: 0,
      createdAt: Timestamp.now(),
    };

    const ref = await db().collection(COL).add(doc);
    return res.status(200).json({ id: ref.id });
  } catch (err) {
    console.error("[POST /api/moments]", err);
    return res.status(500).json({ error: "Falha ao salvar o momento" });
  }
}
