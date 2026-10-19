// Bande des filtres collée sous l'en-tête pendant le défilement (css/sticky.css).
//
//  - Elle est « collée » quand le repère vide placé juste au-dessus d'elle (#controls-sentinel)
//    passe sous l'en-tête : classe is-stuck, qui la compacte et la passe en position fixe.
//  - La mise en page ne doit JAMAIS bouger : une bande collante (sticky) qui se compacte change de
//    hauteur dans le flux, et le navigateur recale alors le défilement (scroll anchoring), ce qui
//    fait trembler la bande. Ici, une cale (#controls-placeholder) prend la hauteur exacte de la bande
//    dans le même instant où celle-ci sort du flux : le contenu ne bouge pas d'un pixel.
//  - En bas de page, la bande remonte quand la fin du contenu principal l'atteint (comme sticky).
//  - --header-offset (hauteur de l'en-tête, qui passe sur deux lignes sur mobile) et la hauteur de la
//    bande collée servent au défilement vers les sections (js/smooth-scroll.js, scroll-padding-top).
// Événement « controls-stuck » sur document à chaque changement d'état.

(function () {
  'use strict';

  const root = document.documentElement;
  const header = document.querySelector('.site-header');
  const band = document.getElementById('controls-band');
  const sentinel = document.getElementById('controls-sentinel');
  const placeholder = document.getElementById('controls-placeholder');
  const main = document.querySelector('.site-main');
  if (!header || !band || !sentinel || !placeholder || !main) return;

  const GAP = 16;               // px entre la bande et le titre d'une section atteinte par le menu
  const state = { stuck: false, headerH: 0, stuckH: 0 };

  // Passe la bande en mode collé (ou non) sans changer la mise en page : la cale reçoit la hauteur
  // de la bande AVANT que celle-ci ne sorte du flux, et disparaît en même temps qu'elle y revient.
  function setClass(stuck) {
    if (stuck) {
      placeholder.style.height = band.offsetHeight + 'px';
      placeholder.hidden = false;
      band.classList.add('is-stuck');
    } else {
      band.classList.remove('is-stuck');
      band.style.transform = '';
      placeholder.hidden = true;
    }
  }

  // Hauteur de la bande compactée, mesurée sans peindre ni déplacer le contenu.
  function measureStuck() {
    if (state.stuck) { state.stuckH = band.offsetHeight; return; }
    setClass(true);
    state.stuckH = band.offsetHeight;
    setClass(false);
  }

  function applyOffsets() {
    state.headerH = header.offsetHeight;
    root.style.setProperty('--header-offset', state.headerH + 'px');
    root.style.scrollPaddingTop = (state.headerH + state.stuckH + GAP) + 'px';
  }

  // Fin du contenu principal : la bande collée remonte avec elle (décrochage d'un élément sticky).
  function release() {
    const limit = main.getBoundingClientRect().bottom - parseFloat(getComputedStyle(main).paddingBottom);
    const overflow = state.headerH + state.stuckH - limit;
    band.style.transform = overflow > 0 ? `translateY(${-Math.round(overflow)}px)` : '';
  }

  function setStuck(stuck) {
    if (stuck === state.stuck) return;
    setClass(stuck);
    state.stuck = stuck;
    if (stuck) state.stuckH = band.offsetHeight;
    applyOffsets();
    document.dispatchEvent(new CustomEvent('controls-stuck', { detail: { stuck } }));
  }

  let queued = false;
  function update() {
    queued = false;
    setStuck(sentinel.getBoundingClientRect().top < state.headerH);
    if (state.stuck) release();
  }

  window.addEventListener('scroll', () => {
    if (!queued) { queued = true; requestAnimationFrame(update); }
  }, { passive: true });

  // L'en-tête et la bande changent de taille (écran, puces de sélection, polices) : on remesure.
  new ResizeObserver(() => {
    measureStuck();
    applyOffsets();
    update();
  }).observe(header);
  new ResizeObserver(() => {
    measureStuck();
    applyOffsets();
  }).observe(band);

  measureStuck();
  applyOffsets();
  update();

  window.StickyControls = {
    // Hauteur à laisser libre sous l'en-tête pour une cible donnée (la bande ne colle qu'en dessous d'elle).
    offsetFor(target) {
      const below = !!(sentinel.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING);
      return state.headerH + (below ? state.stuckH : 0);
    },
    isStuck: () => state.stuck,
  };
})();
