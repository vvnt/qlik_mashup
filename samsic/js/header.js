// En-tête : comme sur samsic.com, le grand logo (144 px) déborde sur le bandeau en haut de page
// et se réduit (72 px) dès que la page défile ; la transition est en CSS (layout.css).

(function () {
  'use strict';

  const header = document.querySelector('.site-header');
  if (!header) return;

  let queued = false;
  const update = () => {
    queued = false;
    header.classList.toggle('is-scrolled', window.scrollY > 10);
  };

  window.addEventListener('scroll', () => {
    if (!queued) { queued = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
})();
