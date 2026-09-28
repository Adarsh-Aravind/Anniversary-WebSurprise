import { initMovie } from "./movie.js";

// ---------------------------------------------------------------------
//  Time. `?now=2026-09-29T00:00:05+04:00` fakes the clock for testing,
//  `?preview` skips the midnight countdown (content stays encrypted).
// ---------------------------------------------------------------------
// Midnight India time: the anniversary starts while she's still home; she flies out that night.
const UNLOCK = Date.parse("2026-09-29T00:00:00+05:30");
const params = new URLSearchParams(location.search);
const fakeNow = params.has("now") ? Date.parse(params.get("now")) : NaN;
const clockOffset = Number.isNaN(fakeNow) ? 0 : fakeNow - Date.now();
const now = () => Date.now() + clockOffset;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const dubaiMidnight = (isoDate) => Date.parse(`${isoDate}T00:00:00+04:00`);


// ---------------------------------------------------------------------
//  Small helpers
// ---------------------------------------------------------------------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// "Line one\nline two\n\nNew paragraph" -> <p> elements with <br>s
function paragraphs(text = "") {
  return text.split(/\n\s*\n/).map((para) => {
    const p = h("p");
    para.split("\n").forEach((line, i) => { if (i) p.append(h("br")); p.append(line); });
    return p;
  });
}

const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } },
};

const fmtNum = (n) => n.toLocaleString("en-IN");
const pad = (n) => String(n).padStart(2, "0");
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const fmtDate = (iso) => `${iso.slice(8, 10)} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

function fmtLeft(ms) {
  const m = Math.max(0, Math.ceil(ms / 60000));
  const d = Math.floor(m / 1440), hr = Math.floor((m % 1440) / 60), min = m % 60;
  if (d) return `${d}d ${hr}h`;
  if (hr) return `${hr}h ${min}m`;
  return `${min}m`;
}

function showScreen(id) {
  for (const s of $$("#app > .screen, #log")) s.hidden = s.id !== id;
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------------
//  Crypto: PBKDF2 -> AES-GCM, matching tools/seal.js
// ---------------------------------------------------------------------
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const sealedPromise = fetch("sealed.json", { cache: "no-cache" }).then((r) => {
  if (!r.ok) throw new Error("sealed.json missing — run tools/seal.js");
  return r.json();
});
sealedPromise.catch(() => {}); // surfaced on the checklist screen instead
let aesKey = null;
let content = null;

async function unseal(passcode) {
  const sealed = await sealedPromise;
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(passcode.trim().toLowerCase()), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: fromB64(sealed.salt), iterations: sealed.iter, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]
  );
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(sealed.iv) }, key, fromB64(sealed.data));
  aesKey = key;
  return JSON.parse(new TextDecoder().decode(plain));
}

const photoCache = new Map();
function photoURL(name) {
  const entry = name && content?.photos?.[name];
  if (!entry) return null;
  if (!photoCache.has(name)) {
    photoCache.set(name, fetch(entry.src)
      .then((r) => r.arrayBuffer())
      .then((buf) => crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(buf, 0, 12) }, aesKey, new Uint8Array(buf, 12)))
      .then((plain) => URL.createObjectURL(new Blob([plain], { type: entry.type }))));
  }
  return photoCache.get(name);
}

function photo(name, alt, cls) {
  const url = photoURL(name);
  if (!url) return null;
  const img = h("img", { class: cls, alt, decoding: "async" });
  const frame = h("figure", { class: `${cls}-frame loading` }, img);
  url.then((src) => { img.src = src; img.onload = () => frame.classList.remove("loading"); }).catch(() => frame.remove());
  return frame;
}

// ---------------------------------------------------------------------
//  Screen 1: countdown to midnight (India time)
// ---------------------------------------------------------------------
function startCountdown() {
  showScreen("screen-countdown");
  const els = ["d", "h", "m", "s"].map((k) => $(`#cd-${k}`));
  const timer = setInterval(update, 1000);
  update();
  function update() {
    const left = UNLOCK - now();
    if (left <= 0) { clearInterval(timer); startChecklist(); return; }
    const s = Math.floor(left / 1000);
    [Math.floor(s / 86400), Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60]
      .forEach((v, i) => { els[i].textContent = pad(v); });
  }
}

// ---------------------------------------------------------------------
//  Screen 2: pre-flight checklist + passcode
// ---------------------------------------------------------------------
function startChecklist() {
  showScreen("screen-checklist");
  const items = $$(".checklist [role=checkbox]");
  const input = $("#pass");
  const submit = $("#pass-form button[type=submit]");
  const error = $("#pass-error");

  // Wrong tries are remembered, so hints already earned survive a reload.
  let tries = store.get("y3-tries", 0);
  sealedPromise.then((s) => {
    if (s.hint) $("#pass-hint").textContent = `Hint: ${s.hint}`;
    renderHelp(s.help, tries);
  }).catch((e) => { error.textContent = e.message; });

  for (const item of items) {
    item.addEventListener("click", () => {
      item.setAttribute("aria-checked", item.getAttribute("aria-checked") === "true" ? "false" : "true");
      const ready = items.every((i) => i.getAttribute("aria-checked") === "true");
      input.disabled = submit.disabled = !ready;
      $("#pass-form").classList.toggle("ready", ready);
      if (ready) input.focus();
    });
  }

  $("#pass-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!input.value.trim()) return;
    submit.disabled = true;
    submit.textContent = "Contacting tower…";
    error.textContent = "";
    try {
      content = await unseal(input.value);
      input.value = "";
      store.set("y3-tries", 0);
      takeoff();
    } catch {
      error.textContent = "Clearance denied. Check the code and try again.";
      tries++;
      store.set("y3-tries", tries);
      sealedPromise.then((s) => renderHelp(s.help, tries));
      $("#pass-form").classList.remove("shake");
      void $("#pass-form").offsetWidth;
      $("#pass-form").classList.add("shake");
      submit.disabled = false;
      submit.textContent = "Request clearance";
      input.select();
    }
  });
}

// Hints unlock after 2, 4 and 6 wrong tries. The full passcode is never shown.
function renderHelp(help, tries) {
  if (!help) return;
  const box = $("#pass-help");
  const cards = [];
  if (tries >= 2 && help.picture) {
    cards.push(h("div", { class: "help-card" },
      h("span", { class: "help-pic", "aria-hidden": "true" }, help.picture),
      h("div", {}, h("span", { class: "label" }, "Hint 1 · picture"), h("p", {}, help.pictureCaption || ""))));
  }
  if (tries >= 4 && help.partial) {
    cards.push(h("div", { class: "help-card" },
      h("span", { class: "help-partial mono" }, help.partial),
      h("div", {}, h("span", { class: "label" }, "Hint 2"), h("p", {}, help.partialCaption || ""))));
  }
  if (tries >= 6 && help.stuck) cards.push(h("p", { class: "help-stuck" }, help.stuck));
  if (cards.length === box.children.length) return;
  box.replaceChildren(...cards);
  box.lastElementChild?.classList.add("new");
}

// ---------------------------------------------------------------------
//  Screen 3: takeoff, then the log
// ---------------------------------------------------------------------
function takeoff() {
  showScreen("screen-takeoff");
  setTimeout(() => {
    renderLog();
    showScreen("log");
  }, reduceMotion ? 500 : 2600);
}

// ---------------------------------------------------------------------
//  The log
// ---------------------------------------------------------------------
function section(id, num, label, title, ...body) {
  return h("section", { class: "sec reveal", id },
    h("div", { class: "sec-head" },
      h("span", { class: "label" }, `${num} · ${label}`),
      h("h2", { class: "sec-title" }, title)),
    ...body);
}

function renderLog() {
  const log = $("#log");
  log.replaceChildren(
    renderHero(),
    renderStats(),
    renderStory(),
    renderLetters(),
    renderReasons(),
    renderRadio(),
    renderMovie(),
    renderFinal(),
    h("footer", { class: "log-foot" },
      h("a", { href: "../", class: "back-link" }, "← Back to the logbook"),
      h("span", { class: "mono" }, "LOG 02 · END OF ENTRY"))
  );
  observeReveals();
  if (store.get("y3-won", false)) unlockFinal(false);
}

function renderHero() {
  const hero = content.hero || {};
  return h("header", { class: "hero" },
    h("span", { class: "label" }, hero.kicker || "Flight Log · Entry 02"),
    h("h1", { class: "display hero-title" }, hero.title || `Two years airborne, ${content.name}.`),
    h("p", { class: "hero-sub" }, hero.subtitle || ""),
    h("span", { class: "scroll-cue", "aria-hidden": "true" }, "Scroll", h("i")));
}

// #2 — Logbook stats
function renderStats() {
  const start = Date.parse(`${content.relationshipStart || "2024-09-29"}T00:00:00+05:30`);
  const days = Math.max(0, Math.floor((now() - start) / 86400000));
  const stat = (value, label) => h("div", { class: "stat" }, h("span", { class: "stat-value" }, value), h("span", { class: "stat-label" }, label));

  return section("stats", "01", "Logbook", "By the numbers",
    h("div", { class: "stats" },
      stat(fmtNum(days), "days together"),
      stat(fmtNum(days * 24), "hours logged"),
      stat("1", "turbulence survived"),
      stat(String(Math.floor(days / 365)), "anniversaries")));
}

// #3 — Story timeline
function renderStory() {
  const items = (content.chapters || []).map((c, i) =>
    h("li", { class: `leg reveal${c.turbulence ? " turbulence" : ""}`, style: `--i:${i}` },
      h("div", { class: "leg-marker" }, h("span", { class: "leg-alt mono" }, c.altitude || "")),
      h("article", { class: "leg-card" },
        h("div", { class: "leg-meta" },
          h("span", { class: "leg-phase" }, c.turbulence ? `⚠ ${c.phase}` : c.phase),
          h("span", { class: "leg-when" }, c.when || "")),
        h("h3", { class: "leg-title" }, c.title),
        photo(c.photo, c.title, "leg-photo"),
        h("div", { class: "leg-body" }, paragraphs(c.body)))));
  return section("story", "02", "Flight history", "Our story, logged",
    h("ol", { class: "legs" }, items));
}

// #4 — Open when… letters
function renderLetters() {
  const opened = new Set(store.get("y3-opened", []));
  const markOpened = (id) => { opened.add(id); store.set("y3-opened", [...opened]); };

  const daily = (content.dailyLetters || []).map((l, i) => {
    const id = `d${i}`, unlockAt = l.unlockAt ? Date.parse(l.unlockAt) : dubaiMidnight(l.date);
    const status = h("span", { class: "env-status mono" });
    const btn = h("button", { class: "envelope daily", type: "button" },
      h("span", { class: "env-date mono" }, fmtDate(l.date)),
      h("span", { class: "env-label" }, l.label),
      status);
    function refresh() {
      const left = unlockAt - now();
      btn.disabled = left > 0;
      btn.classList.toggle("locked", left > 0);
      btn.classList.toggle("fresh", left <= 0 && !opened.has(id));
      status.textContent = left > 0 ? `🔒 in ${fmtLeft(left)}` : opened.has(id) ? "Read ✓" : "New transmission";
    }
    btn.addEventListener("click", () => {
      openLetter(`Transmission · ${fmtDate(l.date)}`, l.title, l.body);
      markOpened(id); refresh();
    });
    refresh();
    setInterval(refresh, 30000);
    return btn;
  });

  const anytime = (content.anytimeLetters || []).map((l, i) => {
    const id = `a${i}`;
    const btn = h("button", { class: `envelope anytime${opened.has(id) ? " read" : ""}`, type: "button" },
      h("span", { class: "env-icon", "aria-hidden": "true" }, "✉"),
      h("span", { class: "env-label" }, l.label));
    btn.addEventListener("click", () => {
      openLetter("Open when · any time", l.title, l.body);
      markOpened(id); btn.classList.add("read");
    });
    return btn;
  });

  return section("letters", "03", "Radio", "Open when…",
    h("p", { class: "sec-lede" }, "A new one unlocks every midnight for six days. The rest are for whenever you need them."),
    h("h3", { class: "sub-label label" }, "Daily transmissions · 29 SEP → 04 OCT"),
    h("div", { class: "env-grid" }, daily),
    h("h3", { class: "sub-label label" }, "Open any time"),
    h("div", { class: "env-list" }, anytime));
}

const dialog = $("#letter");
function openLetter(meta, title, body) {
  $("#letter-meta").textContent = meta;
  $("#letter-title").textContent = title;
  $("#letter-body").replaceChildren(...paragraphs(body));
  dialog.showModal();
  $(".letter-paper", dialog).scrollTop = 0;
}
$(".letter-close", dialog).addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });

// #5 — 730 reasons
function renderReasons() {
  const reasons = (content.reasons || []).filter((r) => !/^\[.*\]$/.test(r.trim()));
  let order = [];
  const reshuffle = () => {
    order = reasons.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  };
  reshuffle();

  const num = h("span", { class: "reason-num mono" }, "Reason #— of 730");
  const text = h("p", { class: "reason-text" }, "Tap the button. I'll start.");
  const card = h("div", { class: "reason-card" }, h("span", { class: "reason-quote", "aria-hidden": "true" }, "“"), text, num);
  const btn = h("button", { class: "btn-primary", type: "button" }, "Tell me why ♥");

  btn.addEventListener("click", () => {
    card.classList.remove("swap"); void card.offsetWidth; card.classList.add("swap");
    if (!order.length) {
      text.textContent = `That's every one I've written down so far. The other ${fmtNum(1095 - reasons.length)}, I'll tell you in person.`;
      num.textContent = "To be continued…";
      reshuffle();
      btn.textContent = "Start again ♥";
      return;
    }
    const i = order.pop();
    text.textContent = reasons[i];
    num.textContent = `Reason #${String(i + 1).padStart(3, "0")} of 730`;
    btn.textContent = "Another one ♥";
  });

  return section("reasons", "04", "Reasons", "730 reasons I choose you",
    h("p", { class: "sec-lede" }, "Two years is about 730 days. One reason for every single one of them."),
    card, h("div", { class: "reason-actions" }, btn));
}

// #5 — Radio decoder: a message spelled in the pilot alphabet, decoded letter by letter
const PHONETIC = {
  A: "Alfa", B: "Bravo", C: "Charlie", D: "Delta", E: "Echo", F: "Foxtrot", G: "Golf", H: "Hotel", I: "India",
  J: "Juliett", K: "Kilo", L: "Lima", M: "Mike", N: "November", O: "Oscar", P: "Papa", Q: "Quebec", R: "Romeo",
  S: "Sierra", T: "Tango", U: "Uniform", V: "Victor", W: "Whiskey", X: "X-ray", Y: "Yankee", Z: "Zulu",
  0: "Zero", 1: "One", 2: "Two", 3: "Tree", 4: "Fower", 5: "Fife", 6: "Six", 7: "Seven", 8: "Eight", 9: "Niner",
};

function renderRadio() {
  const radio = content.radio || {};
  const message = (radio.message || "").toUpperCase().replace(/[^A-Z0-9 ]/g, "").trim();
  if (!message) return new DocumentFragment();

  const tiles = [];
  const words = message.split(/\s+/).map((word) => h("div", { class: "radio-word" },
    [...word].map((ch) => {
      const input = h("input", {
        class: "radio-input", type: "text", inputmode: "text", maxlength: "1",
        autocomplete: "off", autocapitalize: "characters", spellcheck: "false", "aria-label": PHONETIC[ch],
      });
      const tile = h("label", { class: "radio-tile" }, h("span", { class: "radio-code mono" }, PHONETIC[ch]), input);
      tiles.push({ ch, input, tile });
      return tile;
    })));

  const status = h("span", { class: "radio-status" }, "● Incoming");
  const done = h("div", { class: "radio-done", hidden: true },
    h("p", { class: "radio-message" }, message),
    h("p", { class: "radio-reply" }, radio.reply || ""));
  const panel = h("div", { class: "radio-panel" },
    h("div", { class: "radio-head mono" },
      h("span", {}, `FREQ ${radio.frequency || "121.50"}`),
      h("span", {}, `FROM ${radio.from || "TOWER"}`),
      status),
    h("div", { class: "radio-words" }, words),
    done);
  const sayAgain = h("button", { class: "btn-ghost", type: "button" }, "Say again");
  const actions = h("div", { class: "reason-actions" }, sayAgain);

  const isOk = (t) => t.tile.classList.contains("ok");
  const nextOpen = (from = -1) => tiles.find((t, i) => i > from && !isOk(t)) || tiles.find((t) => !isOk(t));
  function lock(t) { t.input.value = t.ch; t.input.readOnly = true; t.tile.classList.add("ok"); }
  function advance(i) { const n = nextOpen(i); if (n) n.input.focus(); else finish(true); }

  function finish(celebrate) {
    if (panel.classList.contains("solved")) return;
    tiles.forEach(lock);
    panel.classList.add("solved");
    status.textContent = "Copy that ♥";
    done.hidden = false;
    actions.remove();
    document.activeElement?.blur();
    store.set("y3-radio", true);
    if (celebrate) hearts();
  }

  tiles.forEach((t, i) => {
    t.input.addEventListener("input", () => {
      const v = t.input.value.slice(-1).toUpperCase();
      if (!v) return;
      if (v === t.ch) { lock(t); advance(i); return; }
      t.input.value = "";
      t.tile.classList.remove("shake"); void t.tile.offsetWidth; t.tile.classList.add("shake");
    });
    t.input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !t.input.value && i > 0) { e.preventDefault(); tiles[i - 1].input.focus(); }
    });
  });
  sayAgain.addEventListener("click", () => {
    const n = nextOpen();
    if (!n) return;
    lock(n);
    advance(tiles.indexOf(n));
  });

  if (store.get("y3-radio", false)) finish(false);

  return section("radio", "05", "Comms", "Message from the ground",
    h("p", { class: "sec-lede" }, "You know the pilot alphabet better than me. Fill in the letters."),
    panel, actions);
}

// #6 — In-flight movie
function renderMovie() {
  const root = h("div");
  const movie = content.movie || {};
  const scenes = (movie.scenes || []).map((s) => ({ caption: s.caption, url: photoURL(s.photo) }));
  queueMicrotask(() => initMovie(root, { ...movie, scenes }, { onEnd: () => unlockFinal(true) }));
  const song = movie.song;
  const soundtrack = song?.spotifyTrack && h("div", { class: "soundtrack" },
    h("div", { class: "soundtrack-head" },
      h("span", { class: "label" }, "♫ Our soundtrack"),
      h("p", {}, `${song.title} · ${song.artist}. Headphones on, press play here, then start the movie.`)),
    h("iframe", {
      class: "soundtrack-player",
      src: `https://open.spotify.com/embed/track/${encodeURIComponent(song.spotifyTrack)}?theme=0`,
      title: `${song.title} by ${song.artist} on Spotify`,
      loading: "lazy",
      scrolling: "no",
      allow: "clipboard-write; encrypted-media; fullscreen; picture-in-picture",
    }));
  return section("cinema", "06", "In-flight entertainment", "Now showing",
    h("p", { class: "sec-lede" }, "Last year was a game. This year you get a movie. Press play, and stay for the end credits."),
    soundtrack, root);
}

// #7 — Final letter + boarding pass
function renderFinal() {
  return section("final", "07", "Final approach", "Final transmission",
    h("div", { class: "final-locked", id: "final-locked" },
      h("span", { class: "lock-icon", "aria-hidden": "true" }, "🔒"),
      h("p", {}, "Locked. Watch the movie (credits included) to receive the final transmission.")),
    h("div", { class: "final-content", id: "final-content", hidden: true }));
}

function unlockFinal(celebrate) {
  const box = $("#final-content");
  if (!box || !box.hidden) return;
  store.set("y3-won", true);
  const f = content.finalLetter || {};
  const bp = content.boardingPass || {};
  const field = (label, value, cls = "") => h("div", { class: `bp-field ${cls}` }, h("span", { class: "bp-label" }, label), h("span", { class: "bp-value" }, value));

  const barcode = h("div", { class: "bp-barcode", "aria-hidden": "true" });
  let seed = 29;
  for (let i = 0; i < 48; i++) {
    seed = (seed * 9301 + 49297) % 233280;
    barcode.append(h("i", { style: `flex-grow:${1 + Math.floor((seed / 233280) * 4)}` }));
  }

  const stub = h("button", { class: "bp-stub", type: "button", "aria-label": "Tear off the coupon" },
    h("span", { class: "bp-label" }, "Coupon"),
    h("span", { class: "bp-coupon" }, bp.coupon || ""),
    h("span", { class: "bp-tear mono" }, "Tap to tear ✂"));
  stub.addEventListener("click", () => {
    stub.classList.add("torn");
    stub.querySelector(".bp-tear").textContent = "Redeem at arrivals ♥";
  });

  box.replaceChildren(
    h("article", { class: "final-letter" },
      h("span", { class: "letter-meta" }, "Final transmission · priority ♥"),
      h("h3", {}, f.title || "Final transmission"),
      h("div", { class: "letter-body" }, paragraphs(f.body))),
    h("div", { class: "boarding-pass" },
      h("div", { class: "bp-main" },
        h("div", { class: "bp-top" },
          h("span", { class: "bp-airline" }, "✈ Co-Pilot Airways"),
          h("span", { class: "bp-kind mono" }, "Boarding pass")),
        h("div", { class: "bp-route" },
          h("div", {}, h("span", { class: "bp-code" }, bp.fromCode || "Y02"), h("span", { class: "bp-city" }, bp.fromCity || "Year two")),
          h("span", { class: "bp-arrow", "aria-hidden": "true" }, "✈"),
          h("div", { class: "bp-dest" }, h("span", { class: "bp-code" }, bp.toCode || "♡"), h("span", { class: "bp-city" }, bp.toCity || "My Arms"))),
        h("div", { class: "bp-grid" },
          field("Passenger", bp.passenger || content.name.toUpperCase(), "wide"),
          field("Flight", bp.flight || "IR 0929"),
          field("Date", bp.date || "29 SEP 2026"),
          field("Gate", bp.gate || "ARRIVALS"),
          field("Seat", bp.seat || "1A"),
          field("Class", bp.class || "FOREVER"),
          field("Boarding", bp.boarding || "Whenever you're ready", "wide")),
        barcode),
      stub),
    h("p", { class: "captain-line" }, bp.captainLine || ""));

  $("#final-locked").hidden = true;
  box.hidden = false;
  if (celebrate) {
    hearts();
    setTimeout(() => $("#final").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }), 900);
  }
}

function hearts() {
  if (reduceMotion) return;
  const layer = h("div", { class: "hearts", "aria-hidden": "true" });
  for (let i = 0; i < 36; i++) {
    layer.append(h("span", { style: `left:${Math.random() * 100}%;--dur:${2.5 + Math.random() * 2.5}s;--delay:${Math.random() * 0.8}s;--size:${14 + Math.random() * 22}px;--drift:${-40 + Math.random() * 80}px` }, Math.random() < 0.25 ? "✈" : "♥"));
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 6000);
}

function observeReveals() {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
  $$(".reveal").forEach((el) => io.observe(el));
}

// ---------------------------------------------------------------------
//  Quick hide: tap the eye button -> boring study notes.
//  Bring it back: long-press OR triple-tap the notes title.
// ---------------------------------------------------------------------
(function quickHide() {
  const btn = $("#hide-btn"), decoy = $("#decoy"), app = $("#app"), title = $("#decoy-title");
  let scrollY = 0;
  btn.addEventListener("click", () => {
    scrollY = window.scrollY;
    if (dialog.open) dialog.close();
    app.hidden = true; btn.hidden = true; decoy.hidden = false;
    $(".hearts")?.remove();
    window.scrollTo(0, 0);
  });
  function restore() {
    decoy.hidden = true; app.hidden = false; btn.hidden = false;
    window.scrollTo(0, scrollY);
  }
  let pressTimer, taps = 0, tapTimer;
  title.addEventListener("pointerdown", () => { pressTimer = setTimeout(restore, 700); });
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) title.addEventListener(ev, () => clearTimeout(pressTimer));
  title.addEventListener("click", () => {
    taps++; clearTimeout(tapTimer);
    if (taps >= 3) { taps = 0; restore(); return; }
    tapTimer = setTimeout(() => { taps = 0; }, 900);
  });
  title.addEventListener("contextmenu", (e) => e.preventDefault());
})();

// ---------------------------------------------------------------------
//  Go
// ---------------------------------------------------------------------
if (now() < UNLOCK && !params.has("preview")) startCountdown();
else startChecklist();
