// Tuiles d'indicateurs : CA HT, marge, taux de marge, chacune avec son évolution N / N-1.
// Un seul hypercube sans dimension, uniquement des master items.

(function () {
  'use strict';

  const M = window.APP_CONFIG.measures;

  // value / delta : clés de APP_CONFIG.measures. unit : voir theme.js (valueFormatter).
  const TILES = [
    { id: 'ca', value: M.ca, valueUnit: 'eur', delta: M.caDeltaPct, deltaUnit: 'pct-delta' },
    { id: 'margin', value: M.margin, valueUnit: 'eur', delta: M.marginDeltaPct, deltaUnit: 'pct-delta' },
    { id: 'rate', value: M.rate, valueUnit: 'pct', delta: M.rateDeltaPts, deltaUnit: 'pts' },
  ];

  const measureIds = [];
  TILES.forEach((t) => [t.value, t.delta].forEach((id) => { if (!measureIds.includes(id)) measureIds.push(id); }));

  function init(doc) {
    const format = window.QCHART_THEME.valueFormatter;
    const tiles = TILES.map((t) => ({
      cfg: t,
      valueEl: document.querySelector(`[data-kpi="${t.id}"] .qkpi__value`),
      metaEl: document.querySelector(`[data-kpi="${t.id}"] .qkpi__meta`),
    }));

    return window.Q.watch(doc, {
      qInfo: { qType: 'mashup-kpis' },
      qHyperCubeDef: {
        qDimensions: [],
        qMeasures: measureIds.map((id) => ({ qLibraryId: id })),
        qInitialDataFetch: [{ qTop: 0, qLeft: 0, qWidth: measureIds.length, qHeight: 1 }],
      },
    }, (layout) => {
      const totals = layout.qHyperCube.qGrandTotalRow || [];
      const numOf = (id) => {
        const cell = totals[measureIds.indexOf(id)];
        return cell && Number.isFinite(cell.qNum) ? cell.qNum : null;
      };

      tiles.forEach(({ cfg, valueEl, metaEl }) => {
        const value = numOf(cfg.value);
        const delta = numOf(cfg.delta);

        valueEl.textContent = value == null ? '—' : format(value, { compact: true, unit: cfg.valueUnit });
        valueEl.title = value == null ? '' : format(value, { unit: cfg.valueUnit });

        metaEl.classList.remove('is-up', 'is-down');
        if (delta == null) {
          metaEl.textContent = 'vs N-1 —';
        } else {
          metaEl.textContent = 'vs N-1 ' + format(delta, { unit: cfg.deltaUnit });
          if (delta > 0) metaEl.classList.add('is-up');
          if (delta < 0) metaEl.classList.add('is-down');
        }
      });
    });
  }

  window.Kpis = { init };
})();
