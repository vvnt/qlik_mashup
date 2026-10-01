// Tableau de détail : un vrai <table> HTML accessible (en-têtes, tri par colonne, clavier).
//
// Il suit le niveau de la hiérarchie produit (Catégorie → Sous-catégorie → Produit) et porte
// les six indicateurs du plan. Clic sur une ligne (ou Entrée sur son nom) = sélection Qlik
// en bascule ; sélectionner une valeur fait descendre au niveau suivant (voir drill.js).
// Les lignes viennent de Qlik triées par CA décroissant, limitées à LIMIT valeurs ; le tri par
// colonne s'applique à ces lignes. La ligne de total est le total Qlik (égal aux tuiles).

(function () {
  'use strict';

  const { measures: M, dimensions: D } = window.APP_CONFIG;
  const fmt = window.QCHART_THEME.valueFormatter;
  const HC = '/qHyperCubeDef';
  const LIMIT = 50;

  const COLUMNS = [
    { key: 'ca', label: 'CA HT', id: M.ca, unit: 'eur' },
    { key: 'caDelta', label: 'CA N / N-1', id: M.caDeltaPct, unit: 'pct-delta', signed: true },
    { key: 'margin', label: 'Marge', id: M.margin, unit: 'eur' },
    { key: 'marginDelta', label: 'Marge N / N-1', id: M.marginDeltaPct, unit: 'pct-delta', signed: true },
    { key: 'rate', label: 'Taux de marge', id: M.rate, unit: 'pct' },
    { key: 'rateDelta', label: 'Taux N / N-1', id: M.rateDeltaPts, unit: 'pts', signed: true },
  ];

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  function init(doc) {
    const card = document.getElementById('table-detail');
    const wrap = card.querySelector('.table-wrap');
    const empty = card.querySelector('.qcard__empty');
    const state = { rows: [], totals: [], levelLabel: 'Catégorie', sort: { key: 'ca', dir: -1 }, model: null };

    function sortedRows() {
      const { key, dir } = state.sort;
      const index = COLUMNS.findIndex((c) => c.key === key);
      return state.rows.slice().sort((a, b) => {
        if (key === 'name') return dir * a.name.localeCompare(b.name, 'fr');
        const x = a.values[index];
        const y = b.values[index];
        if (x == null && y == null) return 0;
        if (x == null) return 1;   // valeurs manquantes toujours en dernier
        if (y == null) return -1;
        return dir * (x - y);
      });
    }

    function valueCell(column, value) {
      const cell = el('td', 'data-table__num', value == null ? '—' : fmt(value, { unit: column.unit }));
      if (column.signed && value != null) {
        if (value < 0) cell.classList.add('is-down');
        else if (value > 0) cell.classList.add('is-up');
      }
      return cell;
    }

    function headerCell(key, label, alignRight) {
      const active = state.sort.key === key;
      const th = el('th', alignRight ? 'data-table__num' : '');
      th.scope = 'col';
      th.setAttribute('aria-sort', active ? (state.sort.dir === 1 ? 'ascending' : 'descending') : 'none');
      const button = el('button', 'data-table__sort', label);
      button.type = 'button';
      button.addEventListener('click', () => {
        // Première fois : décroissant pour les nombres, croissant pour les noms ; puis on inverse.
        state.sort = { key, dir: active ? -state.sort.dir : (key === 'name' ? 1 : -1) };
        render();
        // Le rendu remplace l'en-tête : on rend le focus au bouton de la même colonne.
        wrap.querySelector(`[data-sort-key="${key}"]`).focus();
      });
      button.dataset.sortKey = key;
      th.append(button);
      return th;
    }

    function render() {
      const rows = sortedRows();
      // Le rendu remplace les lignes : on garde le focus clavier sur la même valeur.
      const focused = wrap.contains(document.activeElement) ? document.activeElement.dataset.elem : undefined;
      card.classList.add('is-ready');
      empty.hidden = rows.length > 0;
      wrap.hidden = rows.length === 0;
      if (!rows.length) { wrap.replaceChildren(); return; }

      const head = el('tr');
      head.append(headerCell('name', state.levelLabel, false),
        ...COLUMNS.map((c) => headerCell(c.key, c.label, true)));

      const body = rows.map((row) => {
        const tr = el('tr', row.selected ? 'is-selected' : '');
        const name = el('th', 'data-table__name');
        name.scope = 'row';
        const button = el('button', 'data-table__select', row.name);
        button.type = 'button';
        button.dataset.elem = row.elem;
        button.setAttribute('aria-pressed', row.selected ? 'true' : 'false');
        name.append(button);
        tr.append(name, ...COLUMNS.map((c, i) => valueCell(c, row.values[i])));
        // Toute la ligne est cliquable ; le bouton du nom donne l'accès clavier.
        tr.addEventListener('click', () => {
          if (state.model) state.model.selectHyperCubeValues(HC, 0, [row.elem], true);
        });
        return tr;
      });

      const foot = el('tr');
      const totalLabel = el('th', 'data-table__name', 'Total');
      totalLabel.scope = 'row';
      foot.append(totalLabel, ...COLUMNS.map((c, i) => valueCell(c, state.totals[i])));

      const table = el('table', 'data-table');
      table.setAttribute('aria-label', card.querySelector('.qcard__title').textContent);
      table.append(el('thead'), el('tbody'), el('tfoot'));
      table.tHead.append(head);
      table.tBodies[0].append(...body);
      table.tFoot.append(foot);
      wrap.replaceChildren(table);
      if (focused !== undefined) {
        const again = wrap.querySelector(`[data-elem="${focused}"]`);
        if (again) again.focus();
      }
    }

    return window.Q.watch(doc, {
      qInfo: { qType: 'mashup-table' },
      qHyperCubeDef: {
        qDimensions: [{ qLibraryId: D.hierarchy, qNullSuppression: true }],
        qMeasures: COLUMNS.map((c, i) => (i === 0
          ? { qLibraryId: c.id, qSortBy: { qSortByNumeric: -1 } }
          : { qLibraryId: c.id })),
        qInterColumnSortOrder: [1, 0],
        qSuppressZero: true,
        qSuppressMissing: true,
        qInitialDataFetch: [{ qTop: 0, qLeft: 0, qWidth: COLUMNS.length + 1, qHeight: LIMIT }],
      },
    }, (layout, model) => {
      state.model = model;
      const cube = layout.qHyperCube;
      const info = (cube.qDimensionInfo || [])[0] || {};
      state.levelLabel = (info.qGroupFieldDefs || [])[info.qGroupPos || 0] || info.qFallbackTitle || 'Valeur';
      const num = (cell) => (cell && Number.isFinite(cell.qNum) ? cell.qNum : null);
      state.rows = ((cube.qDataPages[0] || {}).qMatrix || []).map((row) => ({
        name: row[0].qText,
        elem: row[0].qElemNumber,
        selected: row[0].qState === 'S',
        values: row.slice(1).map(num),
      }));
      state.totals = (cube.qGrandTotalRow || []).map(num);
      render();
    });
  }

  window.DetailTable = { init };
})();
