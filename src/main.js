// ─────────────────────────────────────────────────────────────
// Ponto de entrada do app: monta o cabeçalho com os dados do evento,
// liga as abas e inicializa os módulos de envio e galeria.
// ─────────────────────────────────────────────────────────────
import "./styles.css";
import { EVENTO } from "./config.js";
import { initUpload } from "./upload.js";
import { initGallery } from "./gallery.js";

// Preenche nome dos noivos e subtítulo a partir do .env
document.querySelectorAll("[data-noivos]").forEach((el) => (el.textContent = EVENTO.noivos));
document.title = `${EVENTO.noivos} · Mesa de Memórias`;

// Abas Enviar / Galeria
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("panel-" + tab.dataset.tab).classList.add("active");
  });
});

initUpload();
initGallery();
