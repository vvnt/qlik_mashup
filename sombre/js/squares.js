// Champ de tuiles respirantes : remplit chaque élément [data-squares] de cellules .squares__cell.
//
// Même logique que le partial Hugo components/squares.html : placement pseudo-aléatoire mais
// DÉTERMINISTE (même graine = même champ), plus dense près du coin d'ancrage (à droite, en haut ou
// en bas), avec une durée, un retard et une opacité maximale propres à chaque cellule.
//
//   <div class="squares squares--top" data-squares data-seed="hero" data-cols="7" data-rows="6"
//        data-density="65" aria-hidden="true"></div>
//
// Purement décoratif (aria-hidden) : sans JavaScript la page reste complète, sans le décor.

(function () {
  'use strict';

  // FNV-1a 32 bits, comme hash.FNV32a de Hugo.
  function fnv32a(text) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
  }

  function fill(field) {
    const seed = field.dataset.seed || 'squares';
    const bottom = field.dataset.anchor === 'bottom' || field.classList.contains('squares--bottom');
    const cols = Number(field.dataset.cols) || 6;
    const rows = Number(field.dataset.rows) || 9;
    const density = Number(field.dataset.density) || 55;
    const cells = document.createDocumentFragment();

    field.style.setProperty('--cols', cols);
    for (let r = 1; r <= rows; r += 1) {
      for (let c = 1; c <= cols; c += 1) {
        // Distance au coin d'ancrage (bord droit, première ou dernière ligne), de 0 à 1.
        const rowFromAnchor = bottom ? rows - r : r - 1;
        const distance = ((cols - c) + rowFromAnchor) / (cols + rows);
        const chance = density * (1 - distance);
        const hash = fnv32a(`${seed}-${r}-${c}`);
        if ((hash % 100) >= chance) continue;

        const cell = document.createElement('span');
        cell.className = 'squares__cell';
        cell.style.setProperty('--c', c);
        cell.style.setProperty('--r', r);
        cell.style.setProperty('--dur', (5.5 + (Math.floor(hash / 7) % 50) / 10) + 's');
        cell.style.setProperty('--delay', ((Math.floor(hash / 11) % 23) / 10) + 's');
        cell.style.setProperty('--peak', 0.05 + (Math.floor(hash / 13) % 6) / 100);
        cells.append(cell);
      }
    }
    field.replaceChildren(cells);
  }

  document.querySelectorAll('[data-squares]').forEach(fill);
})();
