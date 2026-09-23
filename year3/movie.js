// In-flight movie: a seatback-screen slideshow of scenes with subtitles,
// followed by end credits. Calls onEnd() once the credits finish (or are skipped).

const SCENE_MS = 5000;

const TEMPLATE = `
  <div class="ife-screen" data-mode="poster">
    <div class="ife-layer ife-poster">
      <img class="ife-poster-bg" alt="">
      <div class="ife-poster-body">
        <span class="ife-kicker">In-flight entertainment · Now showing</span>
        <h3 class="ife-title"></h3>
        <span class="ife-year mono"></span>
        <p class="ife-tagline"></p>
        <div class="ife-meta mono"><span>Rated ♥♥♥♥♥</span><span class="ife-runtime"></span></div>
        <p class="ife-starring"></p>
        <button class="ife-play" type="button" aria-label="Play the movie"><span aria-hidden="true">▶</span></button>
      </div>
    </div>
    <div class="ife-layer ife-player">
      <img class="ife-bg" alt="" aria-hidden="true">
      <img class="ife-fg" alt="">
      <div class="ife-bars" aria-hidden="true"></div>
      <span class="ife-scene-no mono"></span>
      <p class="ife-sub" aria-live="polite"></p>
      <button class="ife-tap prev" type="button" aria-label="Previous scene"></button>
      <button class="ife-tap toggle" type="button" aria-label="Pause or play"></button>
      <button class="ife-tap next" type="button" aria-label="Next scene"></button>
      <span class="ife-paused mono">❚❚ Paused</span>
    </div>
    <div class="ife-layer ife-credits">
      <div class="ife-roll"></div>
      <button class="ife-skip mono" type="button">Skip credits ▸▸</button>
    </div>
    <div class="ife-layer ife-end">
      <p class="ife-the-end">The End</p>
      <p class="ife-tbc">…to be continued.</p>
      <button class="btn-ghost ife-replay" type="button">↺ Watch again</button>
    </div>
  </div>
  <div class="ife-controls">
    <button type="button" class="ife-btn" data-act="prev" aria-label="Previous scene">⏮</button>
    <button type="button" class="ife-btn" data-act="toggle" aria-label="Play or pause">▶</button>
    <button type="button" class="ife-btn" data-act="next" aria-label="Next scene">⏭</button>
    <span class="ife-time mono">00:00 / 00:00</span>
    <span class="ife-seat mono">SEAT 1A</span>
  </div>`;

const mmss = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export function initMovie(root, movie, { onEnd }) {
  root.classList.add("ife");
  root.innerHTML = TEMPLATE;
  const $ = (sel) => root.querySelector(sel);
  const screen = $(".ife-screen");
  const fg = $(".ife-fg"), bg = $(".ife-bg"), sub = $(".ife-sub");
  const bars = $(".ife-bars"), sceneNo = $(".ife-scene-no"), time = $(".ife-time");
  const toggleBtn = root.querySelector('[data-act="toggle"]');

  $(".ife-title").textContent = movie.title || "US";
  $(".ife-year").textContent = `(${movie.year || "2023 – ∞"})`;
  $(".ife-tagline").textContent = movie.tagline || "";
  $(".ife-runtime").textContent = `Runtime: ${movie.runtime || "3 years & counting"}`;
  $(".ife-starring").textContent = [
    movie.starring && `Starring ${movie.starring}`,
    movie.song && `♫ ${movie.song.title} · ${movie.song.artist}`,
  ].filter(Boolean).join("  ·  ");

  const roll = $(".ife-roll");
  roll.append(Object.assign(document.createElement("p"), { className: "ife-roll-title", textContent: `${movie.title || "US"} (${movie.year || "2023 – ∞"})` }));
  for (const [role, name] of movie.credits || []) {
    const row = document.createElement("p");
    row.className = "ife-credit";
    const r = document.createElement("span"); r.textContent = role;
    const n = document.createElement("span"); n.textContent = name;
    row.append(r, n);
    roll.append(row);
  }
  if (movie.disclaimer) roll.append(Object.assign(document.createElement("p"), { className: "ife-disclaimer", textContent: movie.disclaimer }));

  // Scenes whose photo is missing are skipped.
  let scenes = [];
  const ready = Promise.all((movie.scenes || []).map((s) => (s.url ? s.url.then((src) => ({ src, caption: s.caption }), () => null) : null)))
    .then((list) => { scenes = list.filter(Boolean); return scenes; });
  ready.then((list) => {
    if (list[0]) $(".ife-poster-bg").src = list[list.length - 1].src;
    bars.replaceChildren(...list.map(() => document.createElement("i")));
    time.textContent = `00:00 / ${mmss(list.length * SCENE_MS)}`;
  });

  // A plain timer (not requestAnimationFrame) so in-app browsers that throttle frames still advance.
  let mode = "poster", idx = 0, elapsed = 0, last = 0, timer = 0, ended = false;

  function setMode(m) {
    mode = m;
    screen.dataset.mode = m;
    toggleBtn.textContent = m === "playing" ? "❚❚" : "▶";
  }

  function showScene(i) {
    idx = i; elapsed = 0;
    const s = scenes[i];
    fg.src = bg.src = s.src;
    fg.alt = s.caption || `Scene ${i + 1}`;
    fg.classList.remove("kb"); void fg.offsetWidth; fg.classList.add("kb");
    sub.textContent = s.caption || "";
    sub.classList.remove("show"); void sub.offsetWidth; sub.classList.add("show");
    sceneNo.textContent = `SCENE ${String(i + 1).padStart(2, "0")} / ${String(scenes.length).padStart(2, "0")}`;
    paintBars();
  }

  function paintBars() {
    [...bars.children].forEach((b, i) => {
      b.style.setProperty("--p", i < idx ? 1 : i > idx ? 0 : Math.min(1, elapsed / SCENE_MS));
    });
    time.textContent = `${mmss(idx * SCENE_MS + elapsed)} / ${mmss(scenes.length * SCENE_MS)}`;
  }

  function tick() {
    if (mode !== "playing") return;
    const t = performance.now();
    elapsed += t - last; last = t;
    if (elapsed >= SCENE_MS) { go(idx + 1); if (mode !== "playing") return; }
    paintBars();
  }

  function go(i) {
    if (i >= scenes.length) { credits(); return; }
    showScene(Math.max(0, i));
  }

  async function play() {
    if (mode === "poster" || mode === "end") {
      await ready;
      if (!scenes.length) { credits(); return; }
      showScene(0);
    }
    if (mode === "credits") return;
    setMode("playing");
    fg.style.animationPlayState = "running";
    last = performance.now();
    clearInterval(timer);
    timer = setInterval(tick, 100);
  }

  function pause() {
    if (mode !== "playing") return;
    setMode("paused");
    fg.style.animationPlayState = "paused";
    clearInterval(timer);
  }

  const toggle = () => (mode === "playing" ? pause() : play());
  const step = (d) => {
    if (mode !== "playing" && mode !== "paused") return;
    go(idx + d);
    if (mode === "paused") paintBars();
  };

  function credits() {
    clearInterval(timer);
    setMode("credits");
    roll.style.setProperty("--dist", `${screen.clientHeight + roll.offsetHeight}px`);
    roll.classList.remove("rolling"); void roll.offsetWidth; roll.classList.add("rolling");
  }

  function finish() {
    if (mode !== "credits") return;
    setMode("end");
    if (!ended) { ended = true; onEnd?.(); }
  }

  $(".ife-play").addEventListener("click", play);
  $(".ife-tap.toggle").addEventListener("click", toggle);
  $(".ife-tap.prev").addEventListener("click", () => step(-1));
  $(".ife-tap.next").addEventListener("click", () => step(1));
  roll.addEventListener("animationend", finish);
  $(".ife-skip").addEventListener("click", finish);
  $(".ife-replay").addEventListener("click", () => { setMode("poster"); play(); });
  root.querySelector(".ife-controls").addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "toggle" && mode !== "credits") toggle();
    if (act === "prev") step(-1);
    if (act === "next") { if (mode === "credits") finish(); else step(1); }
  });

  // Pause when scrolled away or hidden (quick-hide button).
  new IntersectionObserver(([e]) => { if (!e.isIntersecting) pause(); }, { threshold: 0.2 }).observe(screen);
}
