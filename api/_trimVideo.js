// ─────────────────────────────────────────────────────────────
// Corta um vídeo já salvo no R2: baixa o arquivo original pra /tmp,
// corta com ffmpeg e sobe o resultado com uma key nova, apaga o
// original e devolve a key/url do arquivo cortado. Roda no servidor,
// então funciona igual em qualquer celular do convidado (o corte
// pesado não é no navegador).
//
// Recodifica (não usa "-c copy"): um corte por stream copy só pode
// começar num keyframe, e vídeos de celular nem sempre têm um perto
// do ponto escolhido — testamos e o corte podia sair impreciso (até
// desalinhar áudio e vídeo). Recodificar é mais lento, mas garante
// que o resultado bate exatamente com o trecho que o convidado
// escolheu. Clipes de evento são curtos, então o custo é pequeno.
// ─────────────────────────────────────────────────────────────
import { spawn } from "node:child_process";
import { mkdtemp, rm, stat as fsStat } from "node:fs/promises";
import { createWriteStream, createReadStream } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import ffmpeg from "@ffmpeg-installer/ffmpeg";
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, r2Bucket, r2PublicUrl } from "./_r2.js";

/**
 * @param {{ key: string, trimStart: number, trimEnd: number }} args
 * @returns {Promise<{ key: string, url: string }>} key/url do vídeo já cortado
 */
export async function trimVideoInR2({ key, trimStart, trimEnd }) {
  const s3 = r2Client();
  const bucket = r2Bucket();
  const dir = await mkdtemp(path.join(tmpdir(), "trim-"));
  const ext = (key.match(/\.[a-z0-9]+$/i) || [".mp4"])[0];
  const inputPath = path.join(dir, `in${ext}`);
  const outputPath = path.join(dir, `out${ext}`);

  try {
    const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    await pipeline(obj.Body, createWriteStream(inputPath));

    await new Promise((resolve, reject) => {
      const args = [
        "-y",
        "-i", inputPath,
        "-ss", String(trimStart),
        "-t", String(Math.max(0.1, trimEnd - trimStart)),
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "23",
        "-c:a", "aac",
        "-movflags", "+faststart",
        outputPath,
      ];
      const proc = spawn(ffmpeg.path, args);
      let stderr = "";
      proc.stderr.on("data", (d) => (stderr += d));
      proc.on("error", reject);
      proc.on("close", (code) =>
        code === 0 ? resolve() : reject(new Error(`ffmpeg saiu com código ${code}: ${stderr.slice(-800)}`))
      );
    });

    const { size } = await fsStat(outputPath);
    const newKey = key.replace(/(\.[a-z0-9]+)$/i, "-cut$1");

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: newKey,
        Body: createReadStream(outputPath),
        ContentType: "video/mp4",
        ContentLength: size,
      })
    );

    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => {});

    return { key: newKey, url: r2PublicUrl(newKey) };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
