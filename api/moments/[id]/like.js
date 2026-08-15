// ─────────────────────────────────────────────────────────────
// POST /api/moments/:id/like → curtir (+1) ou descurtir (-1),
// via transação (evita corrida entre curtidas simultâneas e
// impede o contador de ficar negativo).
// ─────────────────────────────────────────────────────────────
import { db } from "../../_firebaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { id } = req.query;
  const { liked } = req.body || {};

  try {
    const ref = db().collection("moments").doc(id);
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("not-found");
      const current = snap.data().likes || 0;
      const next = Math.max(0, current + (liked ? -1 : 1));
      tx.update(ref, { likes: next });
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    if (err.message === "not-found") return res.status(404).json({ error: "Momento não existe" });
    console.error("[POST /api/moments/:id/like]", err);
    return res.status(500).json({ error: "Falha ao curtir" });
  }
}
