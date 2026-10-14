// Écrit la composition racine index.html au format demandé (`node tools/build.mjs 16x9` ou `9x16`) :
// une seule racine par projet (règle HyperFrames), même scène (assets/cine.js) pour les deux formats,
// pistes audio d'après les repères de assets/cues.js.
import { existsSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { CUE, SFX } = createRequire(import.meta.url)(join(root, "assets", "cues.js"));

// Durées des effets (manifest.json de la bibliothèque HyperFrames).
const DUR = {
  "whoosh": 0.57, "whoosh-short": 0.57, "whoosh-cinematic": 5.54, "impact-bass-1": 2.12, "impact-bass-2": 2.59,
  "glitch-1": 2.64, "glitch-3": 3.1, "riser": 10.03, "click": 0.37, "click-soft": 0.37, "key-press": 0.4,
  "sparkle": 1.8, "ping": 1.32,
};
const r2 = (n) => Math.round(n * 1000) / 1000;

const lanes = [];
const music = existsSync(join(root, "assets", "audio", "music.mp3"));
const audio = [
  music
    ? `<audio id="music" class="clip" src="assets/audio/music.mp3" data-start="0" data-duration="${CUE.end}" data-track-index="2" data-volume="0.85" data-fade-out="0.5"></audio>`
    : `<!-- Musique : déposer assets/audio/music.mp3 puis relancer npm run build. -->`,
  ...SFX.map(([name, t, vol], i) => {
    const d = Math.min(DUR[name], CUE.end - t);
    // Première piste libre (les effets se superposent : une piste par chevauchement).
    let k = lanes.findIndex((end) => end <= t);
    if (k < 0) { k = lanes.length; lanes.push(0); }
    lanes[k] = t + d;
    return `<audio id="sfx-${i}" class="clip" src="assets/sfx/${name}.mp3" data-start="${r2(t)}" data-duration="${r2(d)}" data-track-index="${3 + k}" data-volume="${vol}"></audio>`;
  }),
].join("\n      ");

const page = ({ w, h, v }) => `<!doctype html>
<!-- Fichier généré par tools/build.mjs : modifier assets/cine.js, assets/cine.css ou assets/cues.js. -->
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${w}, height=${h}" />
    <title>Samsic × Qlik Cloud · version cinéma (${v ? "9:16" : "16:9"})</title>
    <script src="./assets/vendor/gsap.min.js"></script>
    <link rel="stylesheet" href="./assets/cine.css" />
    <script>window.FMT = { w: ${w}, h: ${h}, v: ${v} };</script>
    <script src="./assets/cues.js"></script>
  </head>
  <body class="${v ? "fmt-v" : "fmt-h"}">
    <div id="root" data-composition-id="main" data-start="0" data-duration="${CUE.end}" data-width="${w}" data-height="${h}">
      <div id="world" class="clip" data-start="0" data-duration="${CUE.end}" data-track-index="0" data-layout-allow-overflow></div>
      ${audio}
    </div>
    <script src="./assets/cine.js"></script>
    <script>
      window.__timelines = window.__timelines || {};
      window.__timelines["main"] = window.CINE_TIMELINE;
    </script>
  </body>
</html>
`;

const v = process.argv[2] === "9x16";
writeFileSync(join(root, "index.html"), page(v ? { w: 1080, h: 1920, v: true } : { w: 1920, h: 1080, v: false }));
console.log(`index.html écrit en ${v ? "9:16" : "16:9"} (${SFX.length} effets, ${lanes.length} pistes, musique : ${music ? "oui" : "non"}).`);
