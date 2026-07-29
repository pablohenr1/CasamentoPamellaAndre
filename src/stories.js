// ─────────────────────────────────────────────────────────────
// Visualizador estilo stories (Instagram): barras de progresso,
// cabeçalho com avatar, auto-avanço (foto 5s / vídeo até o fim),
// navegação por toque, pausa ao segurar e curtir com coração.
// ─────────────────────────────────────────────────────────────
import { toggleLike, fetchMomentBytes } from "./momentsService.js";
import { escapeHtml, relativeTime, safeName, extFromMime, downloadBlob } from "./utils.js";

const PHOTO_MS = 5000;

let entries = [];
let idx = 0;
let raf = null;
let start = 0;
let elapsed = 0;
let dur = PHOTO_MS;
let paused = false;
let currentVideo = null;
let els = null;

/** Abre o visualizador de stories em uma lista de momentos, no índice dado. */
export function openStories(list, startIdx) {
  entries = list;
  idx = startIdx;
  if (!els) cacheEls();
  buildSegments();
  els.stories.classList.add("open");
  els.stories.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  renderStory();
}

function cacheEls() {
  els = {
    stories: document.getElementById("stories"),
    progress: document.getElementById("stProgress"),
    stage: document.getElementById("stStage"),
    caption: document.getElementById("stCaption"),
    name: document.getElementById("stName"),
    sub: document.getElementById("stSub"),
    avatar: document.getElementById("stAvatar"),
    close: document.getElementById("stClose"),
    download: document.getElementById("stDownload"),
    prev: document.getElementById("stPrev"),
    next: document.getElementById("stNext"),
    heart: document.getElementById("stHeart"),
  };

  els.prev.addEventListener("click", prev);
  els.next.addEventListener("click", next);
  els.close.addEventListener("click", close);
  els.heart.addEventListener("click", (e) => {
    e.stopPropagation();
    like();
  });
  els.download.addEventListener("click", async (e) => {
    e.stopPropagation();
    const en = entries[idx];
    if (!en) return;
    try {
      const bytes = await fetchMomentBytes(en);
      const ext = en.isVideo ? extFromMime(en.url.includes(".mov") ? "quicktime" : "mp4") : "jpg";
      downloadBlob(new Blob([bytes]), safeName(en.name, idx, ext));
    } catch (err) {
      console.error(err);
    }
  });

  // segurar para pausar
  els.stage.addEventListener("pointerdown", pause);
  els.stage.addEventListener("pointerup", resume);
  els.stage.addEventListener("pointerleave", resume);

  document.addEventListener("keydown", (e) => {
    if (!els.stories.classList.contains("open")) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") prev();
    else if (e.key === "ArrowRight") next();
  });
}

function buildSegments() {
  els.progress.innerHTML = entries
    .map(() => `<span class="st-seg"><span class="fill"></span></span>`)
    .join("");
}

function renderStory() {
  const en = entries[idx];
  if (!en) return close();
  cancelAnimationFrame(raf);

  const segs = els.progress.querySelectorAll(".st-seg");
  segs.forEach((s, i) => {
    const fill = s.querySelector(".fill");
    s.classList.toggle("done", i < idx);
    fill.style.width = i < idx ? "100%" : "0";
  });

  els.name.textContent = en.name || "Convidado";
  els.sub.textContent = (en.tag ? en.tag + " · " : "") + relativeTime(en.ts);
  els.avatar.querySelector("span").textContent = (en.name || "C").trim().charAt(0).toUpperCase();

  els.caption.innerHTML = en.message
    ? `<div class="st-msg">${escapeHtml(en.message)}</div>${en.tag ? `<span class="st-moment">${escapeHtml(en.tag)}</span>` : ""}`
    : en.tag
    ? `<span class="st-moment">${escapeHtml(en.tag)}</span>`
    : "";
  els.caption.style.display = en.message || en.tag ? "block" : "none";

  els.heart.classList.toggle("liked", !!en._liked);

  paused = false;
  elapsed = 0;
  if (en.isVideo) {
    els.stage.innerHTML = `<video id="stVideo" src="${en.url}" autoplay playsinline></video>`;
    const v = document.getElementById("stVideo");
    currentVideo = v;
    dur = PHOTO_MS;
    v.onloadedmetadata = () => {
      dur = v.duration && isFinite(v.duration) ? v.duration * 1000 : PHOTO_MS;
    };
    v.ontimeupdate = () => {
      if (v.duration && isFinite(v.duration)) {
        segs[idx].querySelector(".fill").style.width = (v.currentTime / v.duration) * 100 + "%";
      }
    };
    v.onended = next;
  } else {
    els.stage.innerHTML = `<img src="${en.url}" alt="${escapeHtml(en.name)}">`;
    currentVideo = null;
    dur = PHOTO_MS;
    startPhotoTimer();
  }
}

function startPhotoTimer() {
  start = Date.now();
  const fill = els.progress.querySelectorAll(".st-seg")[idx].querySelector(".fill");
  const tick = () => {
    if (paused) {
      raf = requestAnimationFrame(tick);
      return;
    }
    const el = elapsed + (Date.now() - start);
    const p = Math.min(1, el / dur);
    fill.style.width = p * 100 + "%";
    if (p >= 1) return next();
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

function next() {
  if (idx < entries.length - 1) {
    idx++;
    renderStory();
  } else {
    close();
  }
}
function prev() {
  if (idx > 0) {
    idx--;
    renderStory();
  } else {
    renderStory();
  }
}
function pause() {
  paused = true;
  if (currentVideo) currentVideo.pause();
  else elapsed += Date.now() - start;
}
function resume() {
  if (!paused) return;
  paused = false;
  if (currentVideo) currentVideo.play();
  else start = Date.now();
}
function close() {
  els.stories.classList.remove("open");
  els.stories.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  cancelAnimationFrame(raf);
  els.stage.innerHTML = "";
  currentVideo = null;
}

async function like() {
  const en = entries[idx];
  if (!en) return;
  const wasLiked = !!en._liked;
  en._liked = !wasLiked; // estado local imediato (otimista)
  els.heart.classList.toggle("liked", en._liked);
  els.heart.classList.add("pop");
  setTimeout(() => els.heart.classList.remove("pop"), 400);
  if (en._liked) spawnFloatingHeart();

  try {
    await toggleLike(en.id, wasLiked);
  } catch (err) {
    console.error("Falha ao curtir:", err);
    en._liked = wasLiked; // desfaz em caso de erro
    els.heart.classList.toggle("liked", en._liked);
  }
}

function spawnFloatingHeart() {
  const h = document.createElement("div");
  h.className = "float-heart";
  h.innerHTML =
    '<svg width="34" height="34" viewBox="0 0 24 24" fill="#ff3b6b" stroke="#ff3b6b"><path d="M12 21s-7-4.5-9.5-9C1 9 2.5 5.5 6 5.5c2 0 3.2 1.2 4 2.4.8-1.2 2-2.4 4-2.4 3.5 0 5 3.5 3.5 6.5C19 16.5 12 21 12 21z"/></svg>';
  const rect = els.stage.getBoundingClientRect();
  h.style.left = rect.left + rect.width - 58 + "px";
  h.style.top = rect.top + rect.height - 70 + "px";
  document.body.appendChild(h);
  setTimeout(() => h.remove(), 1000);
}
