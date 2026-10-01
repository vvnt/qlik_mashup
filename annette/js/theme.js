// Thème des graphiques ECharts : toutes les couleurs et polices sont lues dans
// les propriétés CSS (css/charts-tokens.css), jamais écrites ici.
// À charger AVANT chart-engine.js.

(function () {
  'use strict';

  const css = getComputedStyle(document.documentElement);
  const raw = (name) => css.getPropertyValue(name).trim();

  // ECharts ne comprend ni color-mix() ni rgb(r g b / a). Un canvas 2D résout n'importe
  // quelle couleur CSS ; s'il la restitue en color(srgb …), on relit le pixel dessiné.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const color = (name) => {
    ctx.fillStyle = '#000';
    ctx.fillStyle = raw(name);
    const resolved = ctx.fillStyle;
    if (!resolved.startsWith('color(')) return resolved;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${+(a / 255).toFixed(2)})`;
  };

  // Taille d'un token (rem, clamp…) résolue en pixels.
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden';
  const size = (name) => {
    probe.style.fontSize = `var(${name})`;
    document.body.append(probe);
    const px = parseFloat(getComputedStyle(probe).fontSize);
    probe.remove();
    return px;
  };

  const nf = (options) => new Intl.NumberFormat('fr-FR', options);
  const eur = nf({ style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const eurCompact = nf({ style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 });
  const num = nf({ maximumFractionDigits: 1 });
  const numCompact = nf({ notation: 'compact', maximumFractionDigits: 1 });
  const pct = nf({ style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const pctSigned = nf({ style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'exceptZero' });
  const pts = nf({ minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'exceptZero' });

  // unit : 'eur' (défaut), 'count', 'pct' (ratio 0-1), 'pct-delta' (ratio signé), 'pts' (points de marge, valeur déjà x100).
  function valueFormatter(v, opts) {
    const compact = !!(opts && opts.compact);
    switch (opts && opts.unit) {
      case 'count': return compact ? numCompact.format(v) : num.format(v);
      case 'pct': return pct.format(v);
      case 'pct-delta': return pctSigned.format(v).replace('-', '−');
      case 'pts': return pts.format(v).replace('-', '−') + ' pt';
      default: return compact ? eurCompact.format(v) : eur.format(v);
    }
  }

  window.QCHART_THEME = {
    palette: ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-6'].map(color),
    axisInk: color('--chart-ink'),
    gridLine: color('--chart-grid'),
    fontFamily: raw('--font-mono'),
    // Rôles utilisés par les rendus propres à ce mashup (lots 3 et suivants).
    accent: color('--chart-accent'),
    mark: color('--chart-mark'),
    markHover: color('--chart-mark-hover'),
    muted: color('--chart-muted'),
    valueFontFamily: raw('--font-sans'),
    label: color('--chart-label'),
    strong: color('--chart-strong'),
    onAccent: color('--chart-on-accent'),
    paper: color('--chart-paper'),
    tooltipBg: color('--chart-tooltip-bg'),
    fs: { xs: size('--fs-xs'), xxs: size('--fs-2xs'), ui: size('--fs-ui') },
    sp: { s: size('--sp-2'), m: size('--sp-4'), l: size('--sp-6') },
    valueFormatter,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
})();
