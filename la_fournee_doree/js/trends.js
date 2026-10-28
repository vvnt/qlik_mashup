// Courbes de tendance par mois : CA et taux de marge, N contre N-1 (master items).
//
// Sélectionner un mois retire les autres de l'hypercube (comportement associatif de Qlik).
// L'axe reste donc celui des 12 mois, fourni par une liste de valeurs indépendante des
// sélections ; les points absents ne sont simplement pas tracés.
// Clic n'importe où sur la grille = bascule du mois le plus proche (second clic = retrait).

(function () {
  'use strict';

  const { measures: M, dimensions: D } = window.APP_CONFIG;
  const T = window.QCHART_THEME;
  const { esc, animation, axisText, tooltip } = window.ChartKit;
  const fmt = T.valueFormatter;
  const LIST_PATH = '/qListObjectDef';

  const months = { list: [], model: null, listeners: [] };
  const onMonths = (fn) => months.listeners.push(fn);

  // Mois dans l'ordre de la liste : { name, elem, selected }.
  function watchMonths(doc) {
    return window.Q.watch(doc, {
      qInfo: { qType: 'mashup-months' },
      qListObjectDef: {
        qLibraryId: D.month,
        qInitialDataFetch: [{ qTop: 0, qLeft: 0, qWidth: 1, qHeight: 12 }],
      },
    }, (layout, model) => {
      months.model = model;
      months.list = ((layout.qListObject.qDataPages[0] || {}).qMatrix || [])
        .map((row) => ({ name: row[0].qText, elem: row[0].qElemNumber, selected: row[0].qState === 'S' }));
      months.listeners.forEach((fn) => fn());
    });
  }

  function cubeProperties(measureIds) {
    return {
      qInfo: { qType: 'mashup-trend' },
      qHyperCubeDef: {
        qDimensions: [{ qLibraryId: D.month, qNullSuppression: true }],
        qMeasures: measureIds.map((id) => ({ qLibraryId: id })),
        qSuppressMissing: true,
        qInitialDataFetch: [{ qTop: 0, qLeft: 0, qWidth: measureIds.length + 1, qHeight: 12 }],
      },
    };
  }

  // elem du mois -> [valeur N, valeur N-1] (null si non calculable).
  function readRows(layout) {
    const page = layout.qHyperCube.qDataPages[0];
    return new Map(((page && page.qMatrix) || []).map((row) => [
      row[0].qElemNumber,
      row.slice(1).map((cell) => (Number.isFinite(cell.qNum) ? cell.qNum : null)),
    ]));
  }

  function mountTrend(doc, id, measureIds, unit) {
    const card = document.getElementById(id);
    const canvas = card.querySelector('[data-chart]');
    const empty = card.querySelector('.qcard__empty');
    const chart = echarts.init(canvas, null, { renderer: 'canvas' });
    const current = { rows: null };

    new ResizeObserver(() => chart.resize()).observe(canvas);

    chart.getZr().on('click', (event) => {
      const point = [event.offsetX, event.offsetY];
      if (!months.model || !chart.containPixel('grid', point)) return;
      const month = months.list[Math.round(chart.convertFromPixel({ xAxisIndex: 0 }, point[0]))];
      if (month) months.model.selectListObjectValues(LIST_PATH, [month.elem], true);
    });

    function render() {
      if (!current.rows || !months.list.length) return;
      const values = months.list.map((m) => current.rows.get(m.elem) || [null, null]);
      const hasData = values.some((v) => v[0] != null || v[1] != null);
      card.classList.add('is-ready');
      empty.hidden = hasData;
      canvas.hidden = !hasData;
      if (!hasData) { chart.clear(); return; }

      const names = months.list.map((m) => m.name);
      const line = (label, index, color, width, z, type) => ({
        name: label,
        type: 'line',
        z,
        connectNulls: false,
        symbol: 'circle',
        symbolSize: T.fs.xs * 0.6,
        lineStyle: { color, width, type },
        itemStyle: { color },
        emphasis: { scale: 1.6 },
        data: months.list.map((m, i) => ({
          value: values[i][index],
          // Mois sélectionné : point plus grand cerclé de blanc.
          ...(m.selected ? { symbolSize: T.fs.xs, itemStyle: { color, borderColor: T.paper, borderWidth: 2 } } : {}),
        })),
      });

      chart.setOption({
        ...animation(),
        grid: { left: 0, right: T.sp.m, top: T.fs.xs * 2.6, bottom: 0, containLabel: true },
        legend: {
          show: true, selectedMode: false, top: 0, right: 0, icon: 'roundRect',
          itemWidth: T.fs.xs, itemHeight: 3, itemGap: T.sp.m,
          textStyle: axisText(),
        },
        tooltip: {
          ...tooltip((items) => {
            const rows = Array.isArray(items) ? items : [items];
            const lines = rows.map((p) => `${esc(p.seriesName)} : ${p.value == null ? '—' : fmt(p.value, { unit })}`);
            return `${esc(rows[0].axisValueLabel)}<br>${lines.join('<br>')}`;
          }, 'axis'),
          axisPointer: { type: 'line', lineStyle: { color: T.axisInk } },
        },
        xAxis: {
          type: 'category', data: names, boundaryGap: false,
          axisLine: { lineStyle: { color: T.gridLine } },
          axisTick: { show: false },
          axisLabel: { ...axisText(), hideOverlap: true },
        },
        yAxis: {
          type: 'value', scale: unit === 'pct',
          splitLine: { lineStyle: { color: T.gridLine, type: 'dashed' } },
          axisLabel: { ...axisText(), formatter: (v) => fmt(v, { compact: true, unit }) },
        },
        series: [line('N', 0, T.accent, 2.5, 3, 'solid'), line('N-1', 1, T.mark, 1.5, 2, 'dashed')],
      }, true);

      const selected = months.list.filter((m) => m.selected).map((m) => m.name);
      canvas.setAttribute('aria-label', `${card.querySelector('.qcard__title').textContent}, N contre N-1, par mois`
        + (selected.length ? ` : mois sélectionnés ${selected.join(', ')}.` : '.'));
    }

    onMonths(render);
    return window.Q.watch(doc, cubeProperties(measureIds), (layout) => {
      current.rows = readRows(layout);
      render();
    });
  }

  function init(doc) {
    return Promise.all([
      watchMonths(doc),
      mountTrend(doc, 'chart-trend-revenue', [M.ca, M.caPrev], 'eur'),
      mountTrend(doc, 'chart-trend-rate', [M.rate, M.ratePrev], 'pct'),
    ]);
  }

  window.Trends = { init };
})();
