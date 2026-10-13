// Balayage vers la droite des graphiques (css/motion.css).
//
// Une carte de graphique est balayée la première fois qu'elle est à l'écran ET que ses données sont
// arrivées (classe is-ready, posée par charts.js / trends.js). Wipe.replay(cards) rejoue le balayage,
// par exemple quand le niveau Métier ↔ Prestation change (drill.js).
// Classes : is-wiping pendant l'animation, is-wiped une fois le masque retiré.

(function () {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cards = Array.from(document.querySelectorAll('.qcard')).filter((card) => card.querySelector('[data-chart]'));
  if (reduced || !cards.length) {
    window.Wipe = { replay() {} };
    return;
  }

  document.documentElement.classList.add('js-wipe');

  const inView = new WeakSet();

  function play(card) {
    card.classList.remove('is-wiping', 'is-wiped');
    void card.offsetWidth;                  // relance l'animation CSS
    card.classList.add('is-wiping');
  }

  function maybePlay(card) {
    if (inView.has(card) && card.classList.contains('is-ready') && !card.classList.contains('is-wiping')) play(card);
  }

  cards.forEach((card) => {
    card.querySelector('[data-chart]').addEventListener('animationend', (event) => {
      if (event.animationName === 'wipe-right') card.classList.add('is-wiped');
    });
    // Les données arrivent après l'entrée à l'écran : on attend is-ready.
    new MutationObserver(() => maybePlay(card)).observe(card, { attributes: true, attributeFilter: ['class'] });
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        inView.add(entry.target);
        observer.unobserve(entry.target);
        maybePlay(entry.target);
      });
    }, { threshold: 0.25 });
    cards.forEach((card) => observer.observe(card));
  } else {
    cards.forEach((card) => { inView.add(card); maybePlay(card); });
  }

  // Rejoue le balayage des cartes déjà balayées (les autres le seront à leur arrivée à l'écran).
  function replay(targets) {
    targets.forEach((card) => { if (card.classList.contains('is-wiping')) play(card); });
  }

  window.Wipe = { replay };
})();
