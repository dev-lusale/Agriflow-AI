/**
 * Builds the AgriFlow AI brand asset set from the official logo artwork.
 *   node scripts/generate-icons.mjs
 * Source:  assets/brand/agriflow-logo-source.png  (full lockup, transparent PNG)
 * Outputs:
 *   public/brand/agriflow-logo.png        trimmed full lockup (emblem + wordmark)
 *   public/brand/agriflow-mark.png        emblem only ("A" with leaf and fields), transparent, 512 px tall
 *   public/icons/icon-{48..512}.png       emblem on a white rounded tile (PWA "any")
 *   public/icons/icon-maskable-{192,512}.png  full-bleed white with safe-zone padding (PWA "maskable")
 *   public/apple-touch-icon.png (180), public/favicon.ico (16/32/48), public/icon.svg (wraps the PNG)
 *   src/app/opengraph-image.png + public/brand/og-image.png (1200×630)
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = (p) => path.join(root, p);
const srcB64 = fs.readFileSync(out("assets/brand/agriflow-logo-source.png")).toString("base64");
fs.mkdirSync(out("public/icons"), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent("<html><body style='margin:0'></body></html>");

/** Runs canvas work in the browser and returns PNG data URLs. */
const results = await page.evaluate(async (b64) => {
  const img = new Image();
  img.src = `data:image/png;base64,${b64}`;
  await img.decode();
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, W, H).data;
  const A = (x, y) => data[(y * W + x) * 4 + 3];

  // Opaque-pixel counts per row and column (alpha threshold ignores soft halo / stray specks)
  const T = 90;
  const rows = new Array(H).fill(0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (A(x, y) > T) rows[y]++;
  const firstRow = rows.findIndex((n) => n > 3);
  let lastRow = H - 1;
  while (lastRow > 0 && rows[lastRow] <= 3) lastRow--;

  // The emblem sits above the wordmark: the wordmark row band is much wider than the emblem's base.
  // Find the first row (from 45% down) whose opaque width jumps sharply → wordmark top.
  const widthAt = (y) => {
    let min = -1, max = -1;
    for (let x = 0; x < W; x++) if (A(x, y) > T) { if (min < 0) min = x; max = x; }
    return min < 0 ? 0 : max - min;
  };
  let split = Math.floor(H * 0.6);
  const emblemWidthNear = widthAt(Math.floor(H * 0.55));
  for (let y = Math.floor(H * 0.5); y < H * 0.8; y++) {
    if (widthAt(y) > emblemWidthNear * 1.35) { split = y; break; }
  }
  // back off a few rows above the wordmark to avoid its top edge
  const emblemBottom = split - 6;

  const bbox = (y0, y1) => {
    let x0 = W, x1 = 0, ya = y1, yb = y0;
    for (let y = y0; y <= y1; y++) {
      for (let x = 0; x < W; x++) {
        if (A(x, y) > T) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < ya) ya = y; if (y > yb) yb = y; }
      }
    }
    return { x0, x1, y0: ya, y1: yb };
  };
  const full = bbox(firstRow, lastRow);
  const emblem = bbox(firstRow, emblemBottom);

  const crop = (b, pad, clearBelow) => {
    const w = b.x1 - b.x0 + 1 + pad * 2;
    const h = b.y1 - b.y0 + 1 + pad * 2;
    const cc = document.createElement("canvas");
    cc.width = w;
    cc.height = h;
    const x = cc.getContext("2d");
    x.drawImage(c, b.x0 - pad, b.y0 - pad, w, h, 0, 0, w, h);
    if (clearBelow !== undefined) x.clearRect(0, clearBelow - b.y0 + pad, w, h);
    return cc;
  };
  const lockup = crop(full, 12);
  const mark = crop(emblem, 8, emblemBottom + 1);

  const scaled = (srcCanvas, size, { tile, fill, inset }) => {
    const cc = document.createElement("canvas");
    cc.width = size;
    cc.height = size;
    const x = cc.getContext("2d");
    x.imageSmoothingQuality = "high";
    if (fill) {
      x.fillStyle = fill;
      if (tile) {
        const r = size * 0.22;
        x.beginPath();
        x.roundRect(0, 0, size, size, r);
        x.fill();
      } else x.fillRect(0, 0, size, size);
    }
    const box = size * inset;
    const ratio = Math.min(box / srcCanvas.width, box / srcCanvas.height);
    const w = srcCanvas.width * ratio;
    const h = srcCanvas.height * ratio;
    x.drawImage(srcCanvas, (size - w) / 2, (size - h) / 2 + size * 0.01, w, h);
    return cc.toDataURL("image/png");
  };
  const markTall = (() => {
    const h = 512;
    const w = Math.round((mark.width / mark.height) * h);
    const cc = document.createElement("canvas");
    cc.width = w;
    cc.height = h;
    const x = cc.getContext("2d");
    x.imageSmoothingQuality = "high";
    x.drawImage(mark, 0, 0, w, h);
    return cc.toDataURL("image/png");
  })();

  const icons = {};
  for (const s of [16, 32, 48, 72, 96, 128, 144, 180, 192, 256, 384, 512]) icons[`any-${s}`] = scaled(mark, s, { tile: true, fill: "#ffffff", inset: s <= 32 ? 0.9 : 0.78 });
  for (const s of [180, 192, 512]) icons[`maskable-${s}`] = scaled(mark, s, { tile: false, fill: "#ffffff", inset: 0.62 });
  return { lockup: lockup.toDataURL("image/png"), mark: markTall, icons, info: { W, H, split, full, emblem } };
}, srcB64);

const save = (p, dataUrl) => fs.writeFileSync(out(p), Buffer.from(dataUrl.split(",")[1], "base64"));
save("public/brand/agriflow-logo.png", results.lockup);
save("public/brand/agriflow-mark.png", results.mark);
for (const s of [48, 72, 96, 128, 144, 192, 256, 384, 512]) save(`public/icons/icon-${s}.png`, results.icons[`any-${s}`]);
save("public/icons/icon-maskable-192.png", results.icons["maskable-192"]);
save("public/icons/icon-maskable-512.png", results.icons["maskable-512"]);
save("public/apple-touch-icon.png", results.icons["maskable-180"]);

// favicon.ico with PNG-encoded 16/32/48 entries
const icoImgs = [16, 32, 48].map((s) => ({ s, d: Buffer.from(results.icons[`any-${s}`].split(",")[1], "base64") }));
const head = Buffer.alloc(6);
head.writeUInt16LE(0, 0);
head.writeUInt16LE(1, 2);
head.writeUInt16LE(icoImgs.length, 4);
let off = 6 + 16 * icoImgs.length;
const dir = icoImgs.map(({ s, d }) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(s, 0);
  e.writeUInt8(s, 1);
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(d.length, 8);
  e.writeUInt32LE(off, 12);
  off += d.length;
  return e;
});
fs.writeFileSync(out("public/favicon.ico"), Buffer.concat([head, ...dir, ...icoImgs.map((i) => i.d)]));

// SVG favicon for modern browsers: wraps the 192px tile so it stays crisp-ish and on-brand
fs.writeFileSync(
  out("public/icon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 192 192" width="192" height="192"><image width="192" height="192" href="${results.icons["any-192"]}"/></svg>\n`,
);

// Social share image
const iridescent = `background-color:#dfe9ee;background-image:radial-gradient(38rem 26rem at 88% 78%,rgba(255,149,120,.45),transparent 60%),radial-gradient(30rem 20rem at 70% 25%,rgba(255,205,120,.35),transparent 60%),radial-gradient(44rem 30rem at 5% 0%,rgba(255,255,255,.95),transparent 60%),linear-gradient(135deg,#e9f1f4,#dbe8ee 45%,#e6efe9);`;
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(
  `<html><head><link href="https://fonts.googleapis.com/css2?family=Urbanist:wght@500;600&display=swap" rel="stylesheet"></head>
  <body style="margin:0;font-family:Urbanist,system-ui,sans-serif"><div style="width:1200px;height:630px;box-sizing:border-box;padding:64px 80px;display:flex;align-items:center;gap:64px;${iridescent}">
  <img src="${results.lockup}" style="width:470px;filter:drop-shadow(0 18px 30px rgba(13,17,22,.18))">
  <div><div style="font-size:60px;line-height:1.04;font-weight:600;color:#0d1116;letter-spacing:-.03em">Grow smarter.<br><span style="color:#16834b">Trade better.</span><br>Harvest more.</div>
  <div style="margin-top:22px;font-size:23px;color:#4c5864;font-weight:500;line-height:1.4">Farm records · Grok AI advice · Marketplace<br>Logistics · Finances · Zambia</div></div></div></body></html>`,
  { waitUntil: "networkidle" },
);
await page.evaluate(() => document.fonts.ready);
const og = await page.screenshot({ type: "png" });
fs.writeFileSync(out("src/app/opengraph-image.png"), og);
fs.writeFileSync(out("public/brand/og-image.png"), og);

await browser.close();
console.log("Brand assets generated.", JSON.stringify(results.info));
