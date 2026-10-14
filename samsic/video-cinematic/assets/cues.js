// Repères temporels (secondes) : source unique pour l'image (assets/cine.js) et le son
// (tools/build.mjs écrit les <audio> des effets d'après SFX). À recaler sur les temps forts de la
// musique une fois assets/audio/music.mp3 déposé (npx hyperframes beats).
(function (root) {
  // Calés sur la musique (NotProd, « Cinematic Epic Trailer (30 sec) ») : montée 0,3–2 s, impacts
  // à 7,29 / 9,54 / 10,03 / 14,9 / 15,41 / 16,46 s, gros impact de basse à 20,05 s, dernier impact à
  // 22,45 s, puis extinction vers 26 s (analyse d'énergie par bande, voir README).
  const CUE = {
    hookOn: 0.34,        // le chiffre clé apparaît (flash glitch) sur la première attaque
    shatter: 1.18,       // il éclate en particules
    title: 2.55,         // le titre se forme
    titleOut: 4.6,       // le titre part vers la caméra
    screenIn: 5.0,       // l'écran du mashup arrive en 3D (posé vers 5,9 s)
    clickA: 6.59,        // sélection « Propreté »
    crumbs: 7.29,        // zoom sur le fil d'Ariane
    clickB: 8.1,         // sélection d'une prestation
    chip: 8.73,          // ouverture de la puce « Prestation »
    opt1: 9.17,
    opt2: 9.54,
    chipDone: 10.03,
    searchCut: 10.6,     // coupe glitch vers la recherche
    searchClick: 10.89,
    keys: [11.17, 11.45, 11.73],
    searchDone: 12.22,
    explode: 12.81,      // la caméra tourne, la pile se prépare
    split: 13.99,        // les plaques se séparent
    labelUi: 14.9,
    labelEngine: 15.41,
    pulse: 16.46,        // impulsion lumineuse dans le mouvement
    drop: 20.05,         // gros impact de basse
    recompose: 21.45,
    land: 22.45,         // dernier impact : le mashup est recomposé
    heroTitle: 23.2,
    powered: 24.5,
    logos: 26.2,         // la musique s'est tue : dernier impact de bande-annonce
    flare: 27.6,
    end: 30,
  };

  // [effet, début, volume] : fichiers de assets/sfx (bibliothèque HyperFrames, licence Pixabay).
  // Décalages mesurés jusqu'au pic : impact-bass-1 0,14 s, impact-bass-2 2,01 s, whoosh 0,16 s,
  // whoosh-cinematic 2,55 s, glitch-1 0,18 s (attaque).
  const SFX = [
    ["glitch-3", 0.3, 0.3],
    ["whoosh-short", CUE.hookOn - 0.16, 0.4],
    ["impact-bass-1", CUE.shatter - 0.14, 0.75],
    ["glitch-1", CUE.shatter - 0.18, 0.3],
    ["whoosh", CUE.title - 0.16, 0.35],
    ["sparkle", CUE.title + 0.55, 0.35],
    ["whoosh", CUE.titleOut + 0.1, 0.4],
    ["whoosh-short", CUE.screenIn + 0.1, 0.35],
    ["click", CUE.clickA, 0.55],
    ["whoosh-short", CUE.crumbs - 0.06, 0.25],
    ["click", CUE.clickB, 0.55],
    ["click", CUE.chip, 0.5],
    ["click-soft", CUE.opt1, 0.55],
    ["click-soft", CUE.opt2, 0.55],
    ["click", CUE.chipDone, 0.45],
    ["glitch-1", CUE.searchCut - 0.18, 0.25],
    ["click", CUE.searchClick, 0.5],
    ...CUE.keys.map((t) => ["key-press", t, 0.5],),
    ["ping", CUE.searchDone, 0.3],
    ["whoosh-cinematic", CUE.split - 2.55, 0.4],
    ...[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((d) => ["click-soft", CUE.labelUi + d, 0.22]),
    ["impact-bass-2", CUE.drop - 2.01, 0.8],
    ["glitch-1", CUE.drop - 0.18, 0.35],
    ["whoosh", CUE.recompose - 0.16, 0.4],
    ["impact-bass-1", CUE.land - 0.14, 0.55],
    ["sparkle", CUE.land + 0.1, 0.3],
    ["whoosh-short", CUE.heroTitle - 0.16, 0.3],
    ["impact-bass-2", CUE.logos - 2.01, 0.9],
    ["sparkle", CUE.logos, 0.45],
    ["whoosh-short", CUE.flare - 0.16, 0.25],
  ];

  if (typeof module !== "undefined" && module.exports) module.exports = { CUE, SFX };
  else { root.CUE = CUE; root.SFX = SFX; }
})(typeof window !== "undefined" ? window : globalThis);
