// Liste de valeurs Qlik partagée par les filtres et par le sélecteur des puces.
// Chaque valeur est un bouton à bascule ; l'état Qlik (S, O, A, X) est exposé en data-state.

(function () {
  'use strict';

  // La couleur ne suffit pas : l'état est aussi annoncé par les lecteurs d'écran.
  const STATES = { S: 'sélectionnée', O: 'possible', A: 'alternative', X: 'exclue' };

  // cells : [{ qText, qElemNumber, qState }] ; onPick(elemNumber) fait la sélection.
  function render(list, cells, onPick) {
    // Le rendu remplace les boutons : on garde le focus clavier sur la même valeur.
    const focused = list.contains(document.activeElement) ? document.activeElement.dataset.elem : undefined;

    list.replaceChildren(...cells.map((cell) => {
      const item = document.createElement('li');
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'filter__opt';
      option.dataset.state = cell.qState;
      option.dataset.elem = cell.qElemNumber;
      option.setAttribute('aria-pressed', cell.qState === 'S' ? 'true' : 'false');
      option.append(cell.qText);
      const stateName = document.createElement('span');
      stateName.className = 'visually-hidden';
      stateName.textContent = ` (${STATES[cell.qState] || cell.qState})`;
      option.append(stateName);
      option.addEventListener('click', () => onPick(cell.qElemNumber));
      item.append(option);
      return item;
    }));

    if (focused !== undefined) {
      const again = list.querySelector(`[data-elem="${focused}"]`);
      if (again) again.focus();
    }
  }

  // Icône du sprite img/icons.svg (couleur héritée).
  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', `icon icon--${name}`);   // icon--<nom> : cible des animations au survol
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `img/icons.svg#icon-${name}`);
    svg.append(use);
    return svg;
  }

  window.ValueList = { render, icon };
})();
