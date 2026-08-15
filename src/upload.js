// ─────────────────────────────────────────────────────────────
// Tela "Enviar": escolher foto/vídeo do celular, validar, pré-visualizar
// e enviar (via /api).
// ─────────────────────────────────────────────────────────────
import { EVENTO } from "./config.js";
import { uploadMoment } from "./momentsService.js";
import { compressImage, checkVideoDuration } from "./utils.js";

export function initUpload() {
  const captureZone = document.getElementById("captureZone");
  const fileInput = document.getElementById("fileInput");
  const previewBox = document.getElementById("previewBox");
  const sendBtn = document.getElementById("sendBtn");
  const statusMsg = document.getElementById("statusMsg");
  const guestName = document.getElementById("guestName");
  const guestMsg = document.getElementById("guestMsg");

  const trimBox = document.getElementById("trimBox");
  const trimVideo = document.getElementById("trimVideo");
  const trimRange = document.getElementById("trimRange");
  const trimLabel = document.getElementById("trimLabel");
  const trimPlayBtn = document.getElementById("trimPlayBtn");
  const trimConfirmBtn = document.getElementById("trimConfirmBtn");
  const trimHintTotal = document.getElementById("trimHintTotal");
  const trimHintMax = document.getElementById("trimHintMax");

  let pendingBlob = null;
  let pendingIsVideo = false;
  let pendingTrim = null; // { start, end } em segundos, ou null (sem corte)
  let selectedTag = "Cerimônia";
  let trimTotalDuration = 0;
  let trimWindowLen = 0;

  function fmtTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  }

  function updateTrimLabel() {
    const start = parseFloat(trimRange.value);
    const end = Math.min(start + trimWindowLen, trimTotalDuration);
    trimLabel.textContent = `${fmtTime(start)} – ${fmtTime(end)}`;
  }

  function openTrimEditor(file, totalDuration) {
    trimTotalDuration = totalDuration;
    trimWindowLen = Math.min(EVENTO.videoMaxSeconds, totalDuration);
    const maxStart = Math.max(0, totalDuration - trimWindowLen);

    if (trimVideo.src) URL.revokeObjectURL(trimVideo.src);
    trimVideo.src = URL.createObjectURL(file);
    trimRange.min = "0";
    trimRange.max = maxStart.toFixed(2);
    trimRange.step = "0.05";
    trimRange.value = "0";
    trimHintTotal.textContent = Math.round(totalDuration);
    trimHintMax.textContent = Math.round(trimWindowLen);
    updateTrimLabel();

    previewBox.classList.remove("show");
    previewBox.innerHTML = "";
    trimBox.classList.add("show");
    sendBtn.disabled = true;
    setStatus(
      `Esse vídeo tem ${Math.round(totalDuration)}s — escolha os ${Math.round(trimWindowLen)}s que quer usar ✂`,
      false
    );
  }

  trimRange.addEventListener("input", () => {
    const start = parseFloat(trimRange.value);
    trimVideo.currentTime = start;
    updateTrimLabel();
  });

  trimPlayBtn.addEventListener("click", () => {
    if (trimVideo.paused) {
      trimVideo.currentTime = parseFloat(trimRange.value);
      trimVideo.play();
      trimPlayBtn.textContent = "❚❚ Pausar";
    } else {
      trimVideo.pause();
    }
  });
  trimVideo.addEventListener("pause", () => {
    trimPlayBtn.textContent = "▶ Prévia";
  });
  trimVideo.addEventListener("timeupdate", () => {
    const start = parseFloat(trimRange.value);
    const end = Math.min(start + trimWindowLen, trimTotalDuration);
    if (trimVideo.currentTime >= end) {
      trimVideo.currentTime = start;
      if (trimVideo.paused === false) trimVideo.play();
    }
  });

  trimConfirmBtn.addEventListener("click", () => {
    const start = parseFloat(trimRange.value);
    const end = Math.min(start + trimWindowLen, trimTotalDuration);
    pendingTrim = { start: Number(start.toFixed(2)), end: Number(end.toFixed(2)) };
    trimVideo.pause();
    trimBox.classList.remove("show");
    showPreview(trimVideo.src, true);
    const previewVideo = previewBox.querySelector("video");
    if (previewVideo) {
      previewVideo.currentTime = pendingTrim.start;
      previewVideo.addEventListener("timeupdate", () => {
        if (previewVideo.currentTime >= pendingTrim.end) previewVideo.pause();
      });
    }
    setStatus(`Trecho de ${Math.round(end - start)}s selecionado — pronto pra enviar ✓`, false);
  });

  // Tags de momento
  document.querySelectorAll("#tagPicker .tag-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("#tagPicker .tag-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      selectedTag = chip.dataset.tag;
    });
  });

  captureZone.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    pendingIsVideo = file.type.startsWith("video");
    setStatus("", false);

    if (pendingIsVideo) {
      pendingTrim = null;
      trimBox.classList.remove("show");
      try {
        const dur = await checkVideoDuration(file);
        if (dur > EVENTO.videoMaxSeconds + 0.8) {
          if (dur > EVENTO.videoMaxSeconds * 6) {
            setStatus(
              `Vídeo de ${Math.round(dur)}s é longo demais pra cortar aqui — grave ou corte um trecho mais curto no seu celular antes ✿`,
              true
            );
            fileInput.value = "";
            return;
          }
          pendingBlob = file;
          openTrimEditor(file, dur);
          return;
        }
        pendingBlob = file; // vídeo sobe como está (já comprimido pelo celular)
        showPreview(URL.createObjectURL(file), true);
      } catch {
        setStatus("Não consegui ler esse vídeo — tente outro.", true);
        fileInput.value = "";
      }
    } else {
      try {
        pendingBlob = await compressImage(file, 1600, 0.82);
        showPreview(URL.createObjectURL(pendingBlob), false);
      } catch {
        setStatus("Não consegui processar essa imagem — tente outra.", true);
      }
    }
  });

  sendBtn.addEventListener("click", async () => {
    if (!pendingBlob) return;
    sendBtn.disabled = true;
    setStatus("Enviando…", false);

    try {
      await uploadMoment(
        {
          blob: pendingBlob,
          name: guestName.value.trim() || "Convidado",
          message: guestMsg.value.trim(),
          tag: selectedTag,
          isVideo: pendingIsVideo,
          trim: pendingTrim,
        },
        (pct) =>
          setStatus(
            pendingTrim && pct >= 80 ? `Cortando o vídeo… ${pct}%` : `Enviando… ${pct}%`,
            false
          )
      );

      setStatus(`Momento enviado! ${EVENTO.noivos} vão amar ✿`, false);
      // limpa o formulário
      previewBox.classList.remove("show");
      previewBox.innerHTML = "";
      fileInput.value = "";
      guestMsg.value = "";
      pendingBlob = null;
      pendingIsVideo = false;
      pendingTrim = null;
      sendBtn.disabled = true;
    } catch (err) {
      console.error(err);
      setStatus("Não consegui enviar. Verifique a conexão e tente de novo.", true);
      sendBtn.disabled = false;
    }
  });

  function showPreview(src, isVideo) {
    previewBox.innerHTML = isVideo
      ? `<video src="${src}" controls playsinline></video>`
      : `<img src="${src}" alt="Prévia">`;
    previewBox.classList.add("show");
    sendBtn.disabled = false;
  }

  function setStatus(text, isError) {
    statusMsg.textContent = text;
    statusMsg.className = "status-msg" + (isError ? " error" : "");
  }
}
