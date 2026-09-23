# Flight Log

An aviation-themed web experience, released as one new "log entry" each year. It's a static site with no backend. Personal content is **encrypted with a passcode**, so the site can be hosted from a public repository without exposing anything private.

| Log | Year | Entry |
|---|---|---|
| 02 | 2025 | Memory matching game ([`2025-year2-memory-game/`](2025-year2-memory-game/)) |
| 03 | 2026 | Flight Log: encrypted interactive story ([`year3/`](year3/)) |
| 04 | 2027 | *Scheduled* |

The root [`index.html`](index.html) is a logbook hub that links to each entry.

---

## Features (Log 03)

- **Timed unlock:** the page stays behind a live countdown until a set date and time. It shows dual time-zone clocks.
- **Pre-flight gate:** a short checklist, then a passcode prompt. After repeated wrong attempts it shows progressive hints (a picture, then a partial pattern, then a "contact me" message). It never shows the passcode itself.
- **Navigation display:** an animated SVG flight path between two cities, with a live distance readout and relationship stats.
- **Flight-history timeline:** chapters styled as flight phases (takeoff, climb, cruise, turbulence, recovery, flight plan), with optional photos.
- **Daily transmissions:** letters that unlock one per day at midnight in a configured time zone, plus "open when…" letters available at any time.
- **Reasons generator:** shuffled, non-repeating messages with a counter.
- **In-flight movie:** a seatback-screen slideshow with subtitles, story-style progress bars, tap-to-seek, end credits and an optional soundtrack embed.
- **Boarding pass finale:** unlocked after the movie's end credits, with a tear-off coupon.
- **Quick hide:** one tap swaps the page for plain study notes. A triple-tap or long-press restores it.

Mobile-first, dependency-free HTML, CSS and JavaScript. It respects `prefers-reduced-motion` and uses fonts from Google Fonts.

---

## Privacy model

All personal material lives in `private/`, which is **git-ignored and never committed**. A sealing script encrypts it into files that are safe to publish:

| Published file | Contents |
|---|---|
| `year3/sealed.json` | All text (letters, story, captions, credits) as AES-256-GCM ciphertext, plus the public lock-screen hint |
| `year3/data/*.bin` | Each photo encrypted separately, with random filenames |

- **Key derivation:** PBKDF2-SHA-256 with 250,000 iterations and a random 16-byte salt per seal.
- **Encryption:** AES-256-GCM with a random 96-bit IV per item. A wrong passcode fails GCM authentication, so there's no plaintext check value to test guesses against.
- **Decryption:** happens entirely in the browser through the Web Crypto API. Decrypted content is held in memory only. Browser storage keeps only progress flags (letters read, finale unlocked, wrong-attempt count).
- **Passcode handling:** passcodes are trimmed and lowercased before key derivation, so capitalisation doesn't matter.

**Limitations.** This is client-side encryption for a personal project. Its strength depends on the passcode. The hint text, the hint cards and the page code are public by design, and the sealing script refuses to run if the hints contain the full passcode. The timed unlock and daily letter locks are presentation only: once someone has the passcode, the page can decrypt all content.

---

## Project structure

```
.
├── index.html                 Logbook hub (GitHub Pages entry point)
├── assets/
│   ├── theme.css              Shared design tokens and starfield styles
│   └── sky.js                 Animated starfield
├── year3/
│   ├── index.html             Gate screens, decoy page, letter dialog
│   ├── app.js                 Countdown, passcode, decryption, section rendering
│   ├── movie.js               In-flight movie player
│   ├── style.css              Log 03 styles
│   ├── sealed.json            Generated: encrypted content
│   └── data/                  Generated: encrypted photos
├── tools/
│   ├── seal.js                Encrypts private/ into year3/ (Node, no dependencies)
│   └── shrink-photos.ps1      Resizes photos to 1400px JPEG (Windows)
├── 2025-year2-memory-game/    Log 02, kept as originally built
├── DEPLOY.md                  Step-by-step publishing checklist
└── private/                   Git-ignored: content.js and photos/
```

---

## Getting started

**Requirements:** Node.js 18 or newer. Any static file server for local preview (for example Python 3). PowerShell 5.1 or newer, only if you use the photo shrinking script.

1. **Write the content.** Create `private/content.js` (a CommonJS module). It holds the passcode hint, story chapters, daily and anytime letters, reasons, movie scenes and credits, the final letter and the boarding pass fields.
2. **Add photos.** Put them in `private/photos/` using the filenames referenced in `content.js`. Missing photos are skipped. Optionally shrink them (originals are kept in `private/photos/originals/`):
   ```bash
   powershell -ExecutionPolicy Bypass -File tools/shrink-photos.ps1
   ```
3. **Seal.** Encrypt everything into `year3/`. Re-run this after every content change:
   ```bash
   node tools/seal.js "<passcode>"
   ```
4. **Preview locally.** Serve the repository root:
   ```bash
   python -m http.server 8765
   ```
   | URL | Purpose |
   |---|---|
   | `/year3/` | The experience as the recipient sees it |
   | `/year3/?preview` | Skip the countdown (content stays encrypted) |
   | `/year3/?now=2026-10-02T00:00:05%2B04:00` | Simulate a date and time for testing timed unlocks |

   To reset saved progress, clear the `y3-` keys in the browser's local storage.

---

## Deployment

The site deploys as-is to **GitHub Pages**, with no build step:

1. Commit the generated `year3/sealed.json` and `year3/data/`. Never commit `private/`.
2. In the repository, go to **Settings → Pages → Deploy from a branch → `main` / `(root)`**.
3. Share the `/year3/` URL.

`.nojekyll` is included so Pages serves the files unchanged. The hub and Log 03 pages ask search engines not to index them (`noindex, nofollow`).

See [`DEPLOY.md`](DEPLOY.md) for the full checklist.

---

## Tech stack

HTML5 · CSS3 (custom properties, responsive layout, keyframe animation) · Vanilla JavaScript (ES modules) · Web Crypto API · Inline SVG · Node.js (tooling only)
