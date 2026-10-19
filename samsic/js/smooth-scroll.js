// Défilement souple vers les sections de la page (menu, pied de page, boutons « #… »).
//
// Le navigateur saute d'un coup vers l'ancre ; on anime plutôt le défilement avec une courbe
// d'accélération puis de décélération, d'une durée proportionnelle à la distance (bornée).
// L'en-tête fixe et la bande des filtres collée (js/sticky-controls.js) sont pris en compte : la
// section s'arrête juste en dessous. L'adresse (#section) est mise à jour et le focus passe à la
// section, comme avec un saut normal (lecteurs d'écran, clavier).
// Une action de l'utilisateur (molette, toucher, clavier) interrompt l'animation.
// Mouvement réduit : comportement natif, sans animation.

(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const MIN = 450;              // ms
  const MAX = 1100;             // ms
  const PER_PX = 0.35;          // ms par pixel parcouru
  const GAP = 16;               // px entre l'en-tête (ou la bande des filtres) et la section
  const header = document.querySelector('.site-header');

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);   // easeInOutCubic
  let frame = 0;

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function scrollToTarget(target) {
    stop();
    const sticky = window.StickyControls;
    const offset = (sticky ? sticky.offsetFor(target) : (header ? header.offsetHeight : 0)) + GAP;
    const start = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const end = Math.max(0, Math.min(max, target.getBoundingClientRect().top + start - offset));
    const distance = end - start;
    const duration = Math.min(MAX, Math.max(MIN, Math.abs(distance) * PER_PX));
    const t0 = performance.now();

    const step = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      // behavior: 'instant' : ne pas cumuler avec un éventuel scroll-behavior CSS.
      window.scrollTo({ top: start + distance * ease(t), behavior: 'instant' });
      frame = t < 1 ? requestAnimationFrame(step) : 0;
    };
    frame = requestAnimationFrame(step);
  }

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href^="#"]');
    if (!link || link.classList.contains('skip-link')) return;
    const id = decodeURIComponent(link.getAttribute('href').slice(1));
    const target = id ? document.getElementById(id) : null;
    if (!target) return;

    event.preventDefault();
    history.pushState(null, '', '#' + id);
    scrollToTarget(target);
    // Focus sur la section sans saut (tabindex -1 si elle n'est pas focalisable).
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });

  ['wheel', 'touchstart', 'keydown'].forEach((type) => {
    window.addEventListener(type, () => { if (frame) stop(); }, { passive: true });
  });
})();
