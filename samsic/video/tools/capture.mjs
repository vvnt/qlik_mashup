// Captures du mashup Samsic pour la vidéo, avec le moteur de démonstration (données fictives).
// Usage (depuis samsic/video) : node tools/capture.mjs
//
// La page samsic/index.html est servie telle quelle, sauf le chargeur Qlik, remplacé par
// tools/demo-engine.js. Fenêtre 1440 × 900, densité 2 (zooms nets), mouvement réduit (pas de
// balayage ni de défilement animé : la vidéo les recrée). Chaque étape est une vraie interaction
// (clics, saisie) ; les positions utiles (barres, puces, menus…) sont relevées dans meta.json.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.resolve(here, '../..');                 // samsic/
const outDir = path.resolve(here, '../assets/captures');
fs.mkdirSync(outDir, { recursive: true });

const PORT = 8097;
const W = 1440;
const H = 900;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2',
};

// ---- Serveur local : index.html avec le moteur de démonstration -------------------------------
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (url === '/capture.html') {
    const html = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8')
      .replace('<script src="js/qlik-loader.js"></script>', '')
      .replace('<script src="js/qlik.js"></script>', '<script src="js/qlik.js"></script>\n  <script src="video/tools/demo-engine.js"></script>');
    res.writeHead(200, { 'content-type': TYPES['.html'] });
    res.end(html);
    return;
  }
  const file = path.join(siteDir, url);
  if (!file.startsWith(siteDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));

const chrome = execSync('npx hyperframes browser path', { cwd: path.resolve(here, '..') }).toString().trim().split(/\r?\n/).pop();
const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
page.on('pageerror', (e) => console.error('page:', e.stack || e.message));
await page.goto(`http://localhost:${PORT}/capture.html`, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
await pause(1200);

const meta = { viewport: { w: W, h: H }, shots: {} };

// ---- Outils ------------------------------------------------------------------------------------
const rect = (sel) => page.evaluate((s) => {
  const e = document.querySelector(s);
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
}, sel);

// Barre d'un graphique ECharts : centre de la barre (moitié de sa longueur) pour une catégorie.
const bar = (cardId, name) => page.evaluate((id, n) => {
  const el = document.querySelector(`#${id} [data-chart]`);
  const chart = echarts.getInstanceByDom(el);
  const opt = chart.getOption();
  const i = opt.yAxis[0].data.indexOf(n);
  if (i < 0) return null;
  const v = opt.series[0].data[i].value;
  const [x, y] = chart.convertToPixel({ seriesIndex: 0 }, [v / 2, i]);
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left + x), y: Math.round(r.top + y) };
}, cardId, name);

// Option d'une liste ouverte (filtre, puce, joker) par son texte.
const option = (panelSel, text) => page.evaluate((p, t) => {
  const e = [...document.querySelectorAll(`${p} .filter__opt`)].find((o) => o.textContent.trim().startsWith(t));
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
}, panelSel, text);

const center = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const click = async (pt) => { await page.mouse.click(pt.x, pt.y); await pause(500); };

async function shot(name, extra = {}) {
  await pause(350);
  await page.screenshot({ path: path.join(outDir, `${name}.jpg`), type: 'jpeg', quality: 92 });
  const common = {
    band: await rect('#controls-band'),
    crumbs: await rect('#crumbs'),
    chips: await rect('#sel-chips'),
  };
  meta.shots[name] = { ...common, ...extra };
  console.log('✓', name);
}

async function scrollTo(y) {
  await page.evaluate((v) => window.scrollTo({ top: v, behavior: 'instant' }), y);
  await pause(400);
}

// ---- 1. Haut de page : grand logo, chiffres clés --------------------------------------------
await scrollTo(0);
meta.kpis = await page.evaluate(() => [...document.querySelectorAll('.qkpi__value')].map((e) => {
  const r = e.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), text: e.textContent.trim() };
}));
meta.logoBig = await rect('.site-header__logo img');
await shot('home-top');

// ---- 2. Page entière sans en-tête (fond de la séquence de défilement) ----------------------
meta.page = await page.evaluate(() => {
  const top = (s) => Math.round(document.querySelector(s).getBoundingClientRect().top + scrollY);
  return {
    height: document.documentElement.scrollHeight,
    sentinel: top('#controls-sentinel'),
    metiers: top('#metiers'),
    crumbs: top('#crumbs'),
    tendances: top('#tendances'),
  };
});
await page.evaluate(() => { document.querySelector('.site-header').style.visibility = 'hidden'; });
await page.screenshot({ path: path.join(outDir, 'page-full.jpg'), type: 'jpeg', quality: 90, fullPage: true });
await page.evaluate(() => { document.querySelector('.site-header').style.visibility = ''; });
await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
await pause(600);
console.log('✓ page-full');

// ---- 3. Bande collée et en-tête réduit (calques de la séquence de défilement) ---------------
const yCharts = meta.page.crumbs - 80 - 82 - 16;               // fil d'Ariane juste sous la bande collée
await scrollTo(yCharts);
meta.scroll = { charts: yCharts };
const bandStuck = await rect('#controls-band');
meta.bandStuck = bandStuck;
meta.page.tendancesScroll = meta.page.tendances - 80 - bandStuck.h - 16;
// clip se mesure depuis le haut du DOCUMENT : on ajoute le défilement courant.
await page.screenshot({ path: path.join(outDir, 'band-stuck.png'), clip: { x: 0, y: yCharts + bandStuck.y, width: W, height: bandStuck.h + 1 } });
await page.evaluate(() => { document.querySelector('.site-header__logo img').style.visibility = 'hidden'; });
await page.screenshot({ path: path.join(outDir, 'header-bar.png'), clip: { x: 0, y: yCharts, width: W, height: 80 } });
await page.evaluate(() => { document.querySelector('.site-header__logo img').style.visibility = ''; });
meta.logoSmall = await rect('.site-header__logo img');
meta.nav = {
  tendances: await rect('.site-nav a[href="#tendances"]'),
  metiers: await rect('.site-nav a[href="#metiers"]'),
};
console.log('✓ calques');

// ---- 4. Sélection dans les graphiques : Métier → Prestation --------------------------------
await shot('sel-0', { target: await bar('chart-revenue', 'Propreté') });
await click(meta.shots['sel-0'].target);
await shot('sel-1', { target: await bar('chart-revenue', 'Nettoyage de bureaux') });
await click(meta.shots['sel-1'].target);
await shot('sel-2');

// ---- 5. Modifier en place : liste de la puce « Prestation » ------------------------------------
const chipPrest = await page.evaluate(() => {
  const chip = [...document.querySelectorAll('.chip')].find((c) => c.dataset.field === 'Sous-catégorie');
  const r = chip.querySelector('.chip__main').getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
});
meta.shots['sel-2'].chip = chipPrest;
await click(center(chipPrest));
const optA = await option('.chip', 'Bionettoyage hospitalier');
await shot('chip-open', { opt: optA });
await click(center(optA));
const optB = await option('.chip', 'Propreté industrielle');
await shot('chip-add-1', { opt: optB });
await click(center(optB));
await shot('chip-add-2');
await page.mouse.click(1380, 700); await pause(400);           // ferme la liste
const allCrumb = await page.evaluate(() => {
  const r = document.querySelector('.crumbs__link').getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
});
await shot('chip-done', { crumbAll: allCrumb });
await click(center(allCrumb));
await shot('reset');

// ---- 6. Filtres : Région (direct), puis Ville par le bouton joker ---------------------------
const btnRegion = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.filter__btn')].find((e) => e.textContent.trim().startsWith('Région'));
  const r = b.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
});
meta.shots.reset.btnRegion = btnRegion;
await click(center(btnRegion));
const optBzh = await option('#filters', 'Bretagne');
await shot('region-open', { opt: optBzh });
await click(center(optBzh));
await shot('region-done');
const btnMore = await rect('.filter--more .filter__btn');
meta.shots['region-done'].btnMore = btnMore;
await page.mouse.click(1380, 700); await pause(400);           // ferme la liste Région
await click(center(btnMore));
const optVille = await page.evaluate(() => {
  const e = [...document.querySelectorAll('.more__dim')].find((o) => o.textContent.trim().startsWith('Ville'));
  const r = e.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
});
await shot('more-open', { opt: optVille, btnMore });
await click(center(optVille));
const optRennes = await option('.filter--more', 'Rennes');
await shot('more-values', { opt: optRennes });
await click(center(optRennes));
await shot('more-done');
await page.mouse.click(1380, 700); await pause(400);

// ---- 7. Recherche intelligente : « nett » -----------------------------------------------------
const input = await rect('#search-input');
await shot('search-0', { input });
await page.click('#search-input');
for (const [i, part] of ['ne', 'net', 'nett'].entries()) {
  await page.evaluate((v) => {
    const el = document.getElementById('search-input');
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, part);
  await pause(450);
  await shot(`search-${i + 1}`, { input, panel: await rect('#search-panel') });
}
await page.keyboard.press('ArrowDown');
await pause(200);
await page.keyboard.press('Enter');
await pause(600);
await shot('search-done');

// ---- 8. Fin : haut de la page de détail avec toutes les sélections ---------------------------
fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2));
console.log('meta.json écrit');
await browser.close();
server.close();
