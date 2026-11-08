// Genera los íconos PNG de la PWA desde un SVG propio. Uso: node scripts/make-icons.cjs
const { chromium } = require("playwright");
const { mkdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#2c6a56"/><g transform="translate(${pad} ${pad}) scale(${(512 - pad * 2) / 512})"><circle cx="256" cy="256" r="170" fill="#f8f6f0"/><circle cx="256" cy="256" r="130" fill="#d9e9e0"/><path d="M256 360c-70-30-96-98-72-168 62 4 114 40 108 110-2 24-14 44-36 58z" fill="#2c6a56"/><path d="M256 360c8-60 30-110 64-146" stroke="#f8f6f0" stroke-width="12" fill="none" stroke-linecap="round"/></g></svg>`;

const out = path.join(__dirname, "../public/icons/");
mkdirSync(out, { recursive: true });
(async () => {
const browser = await chromium.launch();
const page = await browser.newPage();
const jobs = [["icon-192.png", 192, 0], ["icon-512.png", 512, 0], ["maskable-512.png", 512, 70], ["apple-touch-icon.png", 180, 0]];
for (const [name, size, pad] of jobs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0">${svg(pad).replace("<svg ", `<svg width="${size}" height="${size}" `)}</body>`);
  writeFileSync(out + name, await page.screenshot({ type: "png" }));
}
await browser.close();
console.log("íconos listos");
})();
