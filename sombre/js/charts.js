// Graphiques par catégorie (ECharts). Qlik ne fournit que les données et les sélections.
//
// Les quatre graphiques lisent le même groupe hiérarchique (Catégorie → Sous-catégorie →
// Produit), triés par CA décroissant et limités aux `topN` premières valeurs.
// Clic sur une marque = sélection Qlik en mode bascule (un second clic la retire) ;
// sélectionner une valeur fait descendre au niveau suivant (voir drill.js).
//
// Couleurs : marques grises, accent pour la valeur sélectionnée (à défaut la plus forte).
// Tout vient de window.QCHART_THEME (lu depuis les tokens CSS).

(function () {
  'use strict';

  const { measures: M, dimensions: D, topN } = window.APP_CONFIG;
  const T = window.QCHART_THEME;
  const HC = '/qHyperCubeDef';
  const fmt = T.valueFormatter;
  const { esc, animation, axisText, tooltip } = window.ChartKit;

  // ---- Données --------------------------------------------------------------------------

  // Dimension hiérarchique + mesures ; la première mesure (CA) trie, les autres suivent.
  function cubeProperties(measureIds) {
    return {
      qInfo: { qType: 'mashup-chart' },
      qHyperCubeDef: {
        qDimensions: [{ qLibraryId: D.hierarchy, qNullSuppression: true }],
        qMeasures: measureIds.map((id, i) => (i === 0
          ? { qLibraryId: id, qSortBy: { qSortByNumeric: -1 } }
          : { qLibraryId: id })),
        qInterColumnSortOrder: [1, 0],
        qSuppressZero: true,
        qSuppressMissing: true,
        qInitialDataFetch: [{ qTop: 0, qLeft: 0, qWidth: measureIds.length + 1, qHeight: topN }],
      },
    };
  }

  // Une ligne = { name, elem, selected, values: [mesure 0, mesure 1, …] }, null si non calculable.
  function readRows(layout) {
    const page = layout.qHyperCube.qDataPages[0];
    return ((page && page.qMatrix) || []).map((row) => ({
      name: row[0].qText,
      elem: row[0].qElemNumber,
      selected: row[0].qState === 'S',
      values: row.slice(1).map((cell) => (Number.isFinite(cell.qNum) ? cell.qNum : null)),
    }));
  }

  // Valeurs mises en avant : les sélectionnées, à défaut la plus forte (première ligne).
  function highlights(rows) {
    const anySelected = rows.some((r) => r.selected);
    return rows.map((r, i) => (anySelected ? r.selected : i === 0));
  }

  // ---- Options communes -----------------------------------------------------------------

  function categoryAxis(names, chartWidth) {
    return {
      type: 'category',
      inverse: true,
      data: names,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        ...axisText(),
        color: T.label,
        width: Math.round(chartWidth * (chartWidth < 480 ? 0.4 : 0.3)),
        overflow: 'truncate',
      },
    };
  }

  // ---- Cartes ---------------------------------------------------------------------------

  function mountCard(doc, id, measureIds, draw) {
    const card = document.getElementById(id);
    const canvas = card.querySelector('[data-chart]');
    const empty = card.querySelector('.qcard__empty');
    const chart = echarts.init(canvas, null, { renderer: 'canvas' });
    const current = { model: null };

    chart.on('click', (event) => {
      const elem = event.data && event.data.elem;
      if (current.model && Number.isInteger(elem)) {
        current.model.selectHyperCubeValues(HC, 0, [elem], true);
      }
    });

    new ResizeObserver(() => chart.resize()).observe(canvas);

    return window.Q.watch(doc, cubeProperties(measureIds), (layout, model) => {
      current.model = model;
      const rows = readRows(layout);
      card.classList.add('is-ready');
      empty.hidden = rows.length > 0;
      canvas.hidden = rows.length === 0;
      if (!rows.length) { chart.clear(); return; }

      // Hauteur proportionnelle au nombre de barres (--bar-row), sans jamais passer sous le minimum CSS.
      if (draw.rowsHeight) {
        canvas.style.height = `calc(var(--bar-row) * ${rows.length} + var(--sp-10))`;
        chart.resize();
      }

      chart.setOption(draw(rows, chart.getWidth()), true);
      canvas.setAttribute('aria-label', `${card.querySelector('.qcard__title').textContent} : ${rows.length} valeurs, `
        + `la plus forte est ${rows[0].name}.`);
    });
  }

  // 1. CA HT par niveau de hiérarchie.
  function drawRevenue(rows, width) {
    const on = highlights(rows);
    const max = Math.max(...rows.map((r) => r.values[0] || 0)) || 1;
    return {
      ...animation(),
      grid: { left: 0, right: T.fs.xs * 7, top: 0, bottom: 0, containLabel: true },
      tooltip: tooltip((p) => `${esc(p.name)}<br>${fmt(p.value, {})}`),
      xAxis: { type: 'value', show: false, min: 0, max },
      yAxis: categoryAxis(rows.map((r) => r.name), width),
      series: [{
        type: 'bar',
        barCategoryGap: '38%',
        label: { show: true, position: 'right', color: T.label, fontFamily: T.fontFamily, fontSize: T.fs.xs,
          formatter: (p) => fmt(p.value, { compact: true }) },
        emphasis: { itemStyle: { color: T.markHover } },
        data: rows.map((r, i) => ({
          value: r.values[0] || 0, elem: r.elem,
          itemStyle: { color: on[i] ? T.accent : T.mark },
        })),
      }],
    };
  }

  // 2. Évolution du CA N / N-1 en % : barres divergentes autour de zéro, négatif en accent.
  function drawGrowth(rows, width) {
    const values = rows.map((r) => r.values[1]);
    const lo = Math.min(0, ...values.filter((v) => v != null));
    const hi = Math.max(0, ...values.filter((v) => v != null));
    const span = (hi - lo) || 1;
    return {
      ...animation(),
      grid: { left: 0, right: T.fs.xs * 6, top: 0, bottom: 0, containLabel: true },
      tooltip: tooltip((p) => `${esc(p.name)}<br>${fmt(p.value, { unit: 'pct-delta' })}`),
      xAxis: { type: 'value', show: false, min: lo < 0 ? lo - span * 0.3 : 0, max: hi },
      yAxis: categoryAxis(rows.map((r) => r.name), width),
      series: [{
        type: 'bar',
        barCategoryGap: '38%',
        label: {
          show: true, color: T.label, fontFamily: T.fontFamily, fontSize: T.fs.xs,
          formatter: (p) => fmt(p.value, { unit: 'pct-delta' }),
        },
        markLine: {
          silent: true, symbol: 'none', label: { show: false },
          lineStyle: { color: T.axisInk, type: 'solid', width: 1 },
          data: [{ xAxis: 0 }],
        },
        data: rows.map((r, i) => {
          const v = values[i];
          return {
            value: v, elem: r.elem,
            label: { position: v < 0 ? 'left' : 'right' },
            itemStyle: { color: r.selected ? T.strong : (v < 0 ? T.accent : T.mark) },
          };
        }),
      }],
    };
  }

  // 3. Taux de marge N (barre) contre N-1 (repère vertical).
  function drawRate(rows, width) {
    const on = highlights(rows);
    const max = Math.max(...rows.flatMap((r) => [r.values[1], r.values[2]]).filter((v) => v != null), 0) || 1;
    return {
      ...animation(),
      grid: { left: 0, right: T.sp.l, top: 0, bottom: 0, containLabel: true },
      tooltip: tooltip((p) => {
        const row = rows[p.dataIndex];
        return `${esc(row.name)}<br>N : ${fmt(row.values[1], { unit: 'pct' })}<br>`
          + `N-1 : ${row.values[2] == null ? '—' : fmt(row.values[2], { unit: 'pct' })}`;
      }),
      xAxis: { type: 'value', show: false, min: 0, max: max * 1.08 },
      yAxis: categoryAxis(rows.map((r) => r.name), width),
      series: [
        {
          type: 'bar',
          barCategoryGap: '38%',
          label: {
            show: true, position: 'insideLeft', fontFamily: T.fontFamily, fontSize: T.fs.xs,
            formatter: (p) => fmt(p.value, { unit: 'pct' }),
          },
          emphasis: { itemStyle: { color: T.markHover } },
          data: rows.map((r, i) => ({
            value: r.values[1], elem: r.elem,
            label: { color: on[i] ? T.onAccent : T.strong },
            itemStyle: { color: on[i] ? T.accent : T.mark },
          })),
        },
        {
          type: 'scatter',
          silent: false,
          symbol: 'rect',
          symbolSize: [Math.max(2, T.fs.xs / 5), T.fs.xs * 1.9],
          z: 5,
          itemStyle: { color: T.strong },
          tooltip: { show: false },
          data: rows.map((r) => ({ value: [r.values[2], r.name], elem: r.elem })),
        },
      ],
    };
  }

  // 4. CA × taux de marge : un point par valeur, surface proportionnelle à la marge.
  function drawScatter(rows) {
    const on = highlights(rows);
    const maxMargin = Math.max(...rows.map((r) => r.values[2] || 0)) || 1;
    const points = rows.length <= 12;
    return {
      ...animation(),
      grid: { left: 0, right: T.sp.l * 2, top: T.sp.m, bottom: 0, containLabel: true },
      tooltip: tooltip((p) => `${esc(p.name)}<br>CA : ${fmt(p.value[0], {})}<br>`
        + `Taux de marge : ${fmt(p.value[1], { unit: 'pct' })}<br>Marge : ${fmt(p.value[2], {})}`),
      xAxis: {
        type: 'value', scale: true,
        axisLabel: { ...axisText(), formatter: (v) => fmt(v, { compact: true }) },
        axisLine: { lineStyle: { color: T.gridLine } },
        splitLine: { lineStyle: { color: T.gridLine, type: 'dashed' } },
      },
      yAxis: {
        type: 'value', scale: true,
        axisLabel: { ...axisText(), formatter: (v) => fmt(v, { unit: 'pct' }) },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: T.gridLine, type: 'dashed' } },
      },
      series: [{
        type: 'scatter',
        symbolSize: (value) => T.fs.xs * 0.8 + Math.sqrt((value[2] || 0) / maxMargin) * T.fs.xs * 2.4,
        label: {
          show: points, position: 'right', color: T.label, fontFamily: T.fontFamily, fontSize: T.fs.xs,
          formatter: (p) => p.name,
        },
        labelLayout: { hideOverlap: true },
        emphasis: { itemStyle: { color: T.markHover }, label: { show: true } },
        data: rows.map((r, i) => ({
          name: r.name, elem: r.elem,
          value: [r.values[0], r.values[1], r.values[2]],
          itemStyle: { color: on[i] ? T.accent : T.mark, opacity: 0.92 },
        })),
      }],
    };
  }

  drawRevenue.rowsHeight = true;
  drawGrowth.rowsHeight = true;
  drawRate.rowsHeight = true;

  function init(doc) {
    return Promise.all([
      mountCard(doc, 'chart-revenue', [M.ca], drawRevenue),
      mountCard(doc, 'chart-growth', [M.ca, M.caDeltaPct], drawGrowth),
      mountCard(doc, 'chart-rate', [M.ca, M.rate, M.ratePrev], drawRate),
      mountCard(doc, 'chart-scatter', [M.ca, M.rate, M.margin], drawScatter),
    ]);
  }

  window.Charts = { init };
})();
