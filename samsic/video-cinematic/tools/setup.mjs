// Copie les fichiers non versionnés : captures du mashup (produites par ../video, `npm run capture`)
// et effets sonores de la bibliothèque HyperFrames (licence Pixabay, voir assets/sfx/CREDITS.md).
// La musique (assets/audio/music.mp3) se télécharge à la main : voir le storyboard.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const captures = join(root, "..", "video", "assets", "captures");
const sfx = join(root, "node_modules", "hyperframes", "dist", "skills", "media-use", "audio", "assets", "sfx");

const jobs = [
  [captures, "assets/captures", ["home-top", "sel-0", "sel-1", "sel-2", "chip-open", "chip-add-1", "chip-add-2", "chip-done", "search-0", "search-1", "search-2", "search-3", "search-done"].map((n) => n + ".jpg")],
  [sfx, "assets/sfx", ["whoosh", "whoosh-short", "whoosh-cinematic", "impact-bass-1", "impact-bass-2", "glitch-1", "glitch-3", "click", "click-soft", "key-press", "sparkle", "ping"].map((n) => n + ".mp3").concat("CREDITS.md")],
];

for (const [from, to, files] of jobs) {
  mkdirSync(join(root, to), { recursive: true });
  for (const f of files) {
    const src = join(from, f);
    if (!existsSync(src)) { console.error(`Manquant : ${src}`); process.exitCode = 1; continue; }
    copyFileSync(src, join(root, to, f));
  }
}
mkdirSync(join(root, "assets", "audio"), { recursive: true });
if (!existsSync(join(root, "assets", "audio", "music.mp3"))) console.warn("À déposer : assets/audio/music.mp3 (Pixabay, NotProd « Cinematic Epic Trailer (30 sec) »).");
