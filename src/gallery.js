// ─────────────────────────────────────────────────────────────
// Tela "Galeria": mural de polaroids, bandeja de recentes (stories),
// busca, filtros e o "Baixar tudo (.zip)".
// Recebe os momentos em tempo real e abre o visualizador de stories.
// ─────────────────────────────────────────────────────────────
import { EVENTO } from "./config.js";
import { listenMoments, fetchMomentBytes } from "./momentsService.js";
import { buildZip } from "./zip.js";
import { escapeHtml, normalize, safeName, extFromMime, downloadBlob } from "./utils.js";
import { openStories } from "./stories.js";

let allEntries = [];
let visibleEntries = [];
let activeType = "all"; // all | photo | video
let activeTag = null;
let searchTerm = "";

export function initGallery() {
  const board = document.getElementById("board");
  const countNum = document.getElementById("countNum");
  const emptyState = document.getElementById("emptyState");
  const searchInput = document.getElementById("searchInput");
  const searchClear = document.getElementById("searchClear");
  const trayWrap = document.getElementById("trayWrap");
  const tray = document.getElementById("tray");
  const exportBtn = document.getElementById("exportBtn");

  // Escuta a galeria (polling em /api/moments)
  listenMoments((items) => {
    allEntries = items;
    render();
  });

  function applyFilters() {
    const term = normalize(searchTerm);
    return allEntries.filter((en) => {
      if (activeType === "photo" && en.isVideo) return false;
      if (activeType === "video" && !en.isVideo) return false;
      if (activeTag && en.tag !== activeTag) return false;
      if (term) {
        const hay = normalize(en.name) + " " + normalize(en.message) + " " + normalize(en.tag);
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }

  function render() {
    visibleEntries = applyFilters();
    const filtering = activeType !== "all" || activeTag || searchTerm;
    countNum.textContent = filtering
      ? `${visibleEntries.length}/${allEntries.length}`
      : allEntries.length;
    emptyState.style.display = visibleEntries.length ? "none" : "block";

    board.innerHTML = visibleEntries
      .map((en, i) => {
        const media = en.isVideo
          ? `<video src="${en.url}#t=0.1" muted playsinline preload="metadata"></video>`
          : `<img src="${en.url}" loading="lazy" alt="${escapeHtml(en.name)}">`;
        const hint = en.isVideo
          ? `<span class="zoom-hint"><svg width="13" height="13" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg></span>`
          : `<span class="zoom-hint"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4M11 8v6M8 11h6"/></svg></span>`;
        const tagLabel = en.tag ? `<span class="moment-tag">${escapeHtml(en.tag)}</span>` : "";
        const caption = en.message
          ? `<span class="name">${escapeHtml(en.name)}</span>${escapeHtml(en.message)}`
          : `<span class="name">${escapeHtml(en.name)}</span>`;
        return `<div class="polaroid" data-idx="${i}">${media}${hint}<div class="cap">${caption}${tagLabel}</div></div>`;
      })
      .join("");

    board.querySelectorAll(".polaroid").forEach((p) => {
      p.addEventListener("click", () => openStories(visibleEntries, parseInt(p.dataset.idx, 10)));
    });

    renderTray();
  }

  function renderTray() {
    const recent = visibleEntries.slice(0, 12);
    if (recent.length === 0) {
      trayWrap.style.display = "none";
      return;
    }
    trayWrap.style.display = "block";
    tray.innerHTML = recent
      .map((en, i) => {
        const thumb = en.isVideo
          ? `<div class="tray-play"><video class="thumb" src="${en.url}#t=0.1" muted playsinline preload="metadata"></video></div>`
          : `<img class="thumb" src="${en.url}" alt="${escapeHtml(en.name)}">`;
        return `<div class="tray-item" data-idx="${i}">
            <div class="tray-ring">${thumb}</div>
            <div class="tray-name">${escapeHtml((en.name || "Convidado").split(" ")[0])}</div>
          </div>`;
      })
      .join("");
    tray.querySelectorAll(".tray-item").forEach((t) => {
      t.addEventListener("click", () => openStories(visibleEntries, parseInt(t.dataset.idx, 10)));
    });
  }

  // Busca
  searchInput.addEventListener("input", () => {
    searchTerm = searchInput.value.trim();
    searchClear.style.display = searchTerm ? "block" : "none";
    render();
  });
  searchClear.addEventListener("click", () => {
    searchInput.value = "";
    searchTerm = "";
    searchClear.style.display = "none";
    render();
  });

  // Filtros (tipo + momento)
  document.querySelectorAll("#filterRow .filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      if (chip.dataset.filter) {
        activeType = chip.dataset.filter;
        document
          .querySelectorAll("#filterRow .filter-chip[data-filter]")
          .forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
      } else if (chip.dataset.tag) {
        if (activeTag === chip.dataset.tag) {
          activeTag = null;
          chip.classList.remove("active");
        } else {
          activeTag = chip.dataset.tag;
          document
            .querySelectorAll("#filterRow .filter-chip[data-tag]")
            .forEach((c) => c.classList.remove("active"));
          chip.classList.add("active");
        }
      }
      render();
    });
  });

  // Baixar tudo (.zip) — com trava opcional por PIN dos noivos
  exportBtn.addEventListener("click", async () => {
    if (!allEntries.length) return;

    if (EVENTO.adminPin) {
      const pin = window.prompt("Área dos noivos — digite o PIN para baixar tudo:");
      if (pin === null) return;
      if (pin !== EVENTO.adminPin) {
        alert("PIN incorreto.");
        return;
      }
    }

    const original = exportBtn.innerHTML;
    exportBtn.disabled = true;
    exportBtn.textContent = "Baixando mídias…";

    try {
      const files = [];
      for (let i = 0; i < allEntries.length; i++) {
        const en = allEntries[i];
        exportBtn.textContent = `Baixando ${i + 1}/${allEntries.length}…`;
        const bytes = await fetchMomentBytes(en);
        const ext = en.isVideo ? extFromMime(en.url.includes(".mov") ? "quicktime" : "mp4") : "jpg";
        files.push({ name: safeName(en.name, i, ext), bytes });
      }
      const recados = allEntries
        .map((en, i) => `${String(i + 1).padStart(2, "0")} — [${en.tag || "—"}] ${en.name}${en.message ? ": " + en.message : ""}`)
        .join("\n");
      files.push({
        name: "recados.txt",
        bytes: new TextEncoder().encode(`Mesa de Memórias — ${EVENTO.noivos}\n\n${recados}\n`),
      });

      exportBtn.textContent = "Compactando…";
      const zip = buildZip(files);
      const slug = normalize(EVENTO.noivos).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      downloadBlob(zip, `momentos_${slug || "casamento"}.zip`);

      exportBtn.textContent = "Pronto ✓";
      setTimeout(() => {
        exportBtn.innerHTML = original;
        exportBtn.disabled = false;
      }, 1600);
    } catch (err) {
      console.error(err);
      exportBtn.textContent = "Erro — tente de novo";
      setTimeout(() => {
        exportBtn.innerHTML = original;
        exportBtn.disabled = false;
      }, 2200);
    }
  });
}
