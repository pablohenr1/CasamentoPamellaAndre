// ─────────────────────────────────────────────────────────────
// Tela "Enviar": escolher foto/vídeo do celular, validar, pré-visualizar
// e enviar para o Firebase.
// ─────────────────────────────────────────────────────────────
import { EVENTO } from "./firebase.js";
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

  let pendingBlob = null;
  let pendingIsVideo = false;
  let selectedTag = "Cerimônia";

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
      try {
        const dur = await checkVideoDuration(file);
        if (dur > EVENTO.videoMaxSeconds + 0.8) {
          setStatus(
            `Vídeo de ${Math.round(dur)}s — o limite é ${EVENTO.videoMaxSeconds}s. Escolha um trecho mais curto ✿`,
            true
          );
          fileInput.value = "";
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
        },
        (pct) => setStatus(`Enviando… ${pct}%`, false)
      );

      setStatus(`Momento enviado! ${EVENTO.noivos} vão amar ✿`, false);
      // limpa o formulário
      previewBox.classList.remove("show");
      previewBox.innerHTML = "";
      fileInput.value = "";
      guestMsg.value = "";
      pendingBlob = null;
      pendingIsVideo = false;
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
