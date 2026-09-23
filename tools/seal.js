#!/usr/bin/env node
// Encrypts private/content.js + private/photos/* into year3/sealed.json and
// year3/data/*.bin so the public repo holds nothing readable without the passcode.
//
//   node tools/seal.js "your passcode"
//
// Passcodes are trimmed and lowercased, so "Sky" and "sky " both work.

const fs = require("fs");
const path = require("path");
const { webcrypto: crypto } = require("crypto");

const ROOT = path.join(__dirname, "..");
const PRIVATE = path.join(ROOT, "private");
const PHOTOS = path.join(PRIVATE, "photos");
const OUT_DIR = path.join(ROOT, "year3");
const DATA_DIR = path.join(OUT_DIR, "data");
const ITERATIONS = 250000;
const PHOTO_WARN_BYTES = 800 * 1024;
const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

async function deriveKey(passcode, salt) {
  const base = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(passcode), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]
  );
}

async function encrypt(key, bytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes));
  return { iv, ct };
}

const b64 = (u8) => Buffer.from(u8).toString("base64");

function collectPhotoNames(content) {
  const names = new Set();
  for (const c of content.chapters || []) if (c.photo) names.add(c.photo);
  for (const s of content.movie?.scenes || []) if (s.photo) names.add(s.photo);
  return [...names];
}

async function main() {
  const raw = process.argv[2];
  if (!raw || !raw.trim()) {
    console.error('Usage: node tools/seal.js "your passcode"');
    process.exit(1);
  }
  const passcode = raw.trim().toLowerCase();

  const contentPath = path.join(PRIVATE, "content.js");
  delete require.cache[require.resolve(contentPath)];
  const content = require(contentPath);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passcode, salt);

  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const photos = {};
  const missing = [];
  let big = [];
  for (const name of collectPhotoNames(content)) {
    const file = path.join(PHOTOS, name);
    const type = MIME[path.extname(name).toLowerCase()];
    if (!type || !fs.existsSync(file)) { missing.push(name); continue; }
    const bytes = fs.readFileSync(file);
    if (bytes.length > PHOTO_WARN_BYTES) big.push(`${name} (${(bytes.length / 1048576).toFixed(1)} MB)`);
    const { iv, ct } = await encrypt(key, bytes);
    const id = b64(crypto.getRandomValues(new Uint8Array(9))).replace(/[+/=]/g, "x");
    const out = new Uint8Array(iv.length + ct.length);
    out.set(iv); out.set(ct, iv.length);
    fs.writeFileSync(path.join(DATA_DIR, `${id}.bin`), out);
    photos[name] = { src: `data/${id}.bin`, type };
  }

  const { passcodeHint, passcodeHelp, ...secret } = content;
  if (passcodeHelp && JSON.stringify(passcodeHelp).toLowerCase().includes(passcode)) {
    console.error("✖ passcodeHelp contains the full passcode. It's public, so take it out.");
    process.exit(1);
  }
  const payload = new TextEncoder().encode(JSON.stringify({ ...secret, photos }));
  const { iv, ct } = await encrypt(key, payload);

  const sealed = { v: 1, hint: passcodeHint || "", help: passcodeHelp || null, iter: ITERATIONS, salt: b64(salt), iv: b64(iv), data: b64(ct) };
  fs.writeFileSync(path.join(OUT_DIR, "sealed.json"), JSON.stringify(sealed));

  console.log(`✔ Sealed year3/sealed.json with ${Object.keys(photos).length} photo(s).`);
  if (missing.length) console.log(`  Not found (skipped, that's fine): ${missing.join(", ")}`);
  if (big.length) {
    console.log(`  ⚠ Large photos, slow on mobile data: ${big.join(", ")}`);
    console.log("    Shrink them with: powershell -ExecutionPolicy Bypass -File tools/shrink-photos.ps1  then seal again.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
