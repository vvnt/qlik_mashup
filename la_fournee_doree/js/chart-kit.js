// Helpers ECharts partagés par charts.js (catégories) et trends.js (tendances).
// Tout vient de window.QCHART_THEME, lui-même lu depuis les tokens CSS.

(function () {
  'use strict';

  const T = window.QCHART_THEME;

  const esc = (text) => echarts.format.encodeHTML(String(text));

  const animation = () => ({ animation: !T.reducedMotion, animationDuration: 300 });

  const axisText = () => ({ color: T.axisInk, fontFamily: T.fontFamily, fontSize: T.fs.xs });

  function tooltip(formatter, trigger) {
    return {
      trigger: trigger || 'item',
      confine: true,
      backgroundColor: T.tooltipBg,
      borderColor: T.strong,
      borderWidth: 1,
      padding: [T.sp.s, T.sp.m],
      textStyle: { color: T.strong, fontFamily: T.fontFamily, fontSize: T.fs.xs },
      extraCssText: 'border-radius:0;box-shadow:none;',
      formatter,
    };
  }

  window.ChartKit = { esc, animation, axisText, tooltip };
})();
