// Filtres : une liste de valeurs par dimension maître, dessinée sur mesure.
// Clic sur une valeur = sélection Qlik en mode bascule (un second clic la retire).
// États Qlik : S sélectionnée, O possible, A alternative, X exclue.

(function () {
  'use strict';

  const openPanels = new Set();

  function closeAll(except) {
    openPanels.forEach((filter) => { if (filter !== except) filter.close(); });
  }

  function createFilter(doc, cfg, dimensionId) {
    const root = document.createElement('div');
    root.className = 'filter';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn--secondary btn--sm filter__btn';
    button.setAttribute('aria-expanded', 'false');
    const label = document.createElement('span');
    label.textContent = cfg.label;
    const count = document.createElement('span');
    count.className = 'filter__count';
    button.append(label, count);

    const panel = document.createElement('div');
    panel.className = 'filter__panel';
    panel.hidden = true;
    panel.id = 'filter-' + cfg.key;
    button.setAttribute('aria-controls', panel.id);
    root.append(button, panel);

    // Liste de valeurs + zone de recherche (collée en haut quand la liste défile), voir value-picker.js.
    const picker = window.ValuePicker.create(doc, { libraryId: dimensionId, label: cfg.label }, {
      embedded: true,
      onLayout(layout) {
        const selected = (layout.qListObject.qDimensionInfo.qStateCounts || {}).qSelected || 0;
        count.textContent = selected ? String(selected) : '';
        button.classList.toggle('has-selection', selected > 0);
      },
    });
    panel.append(picker.el);

    const filter = {
      root,
      open() {
        closeAll(filter);
        panel.hidden = false;
        button.setAttribute('aria-expanded', 'true');
        openPanels.add(filter);
        picker.focus();
      },
      close() {
        panel.hidden = true;
        button.setAttribute('aria-expanded', 'false');
        openPanels.delete(filter);
        picker.reset();
      },
    };

    button.addEventListener('click', () => (panel.hidden ? filter.open() : filter.close()));

    return filter;
  }

  function init(doc) {
    const { filters, dimensions } = window.APP_CONFIG;
    const container = document.getElementById('filters');
    const toggle = document.getElementById('filters-toggle');
    const toggleCount = document.getElementById('filters-count');
    filters.forEach((cfg) => container.append(createFilter(doc, cfg, dimensions[cfg.key]).root));
    container.hidden = false;

    // Mobile : les filtres sont repliés derrière un bouton (voir cards.css) ; le badge compte
    // les filtres actifs. Sur grand écran le bouton reste masqué.
    toggle.hidden = false;
    toggle.addEventListener('click', () => {
      const open = container.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      if (!open) closeAll();
    });
    new MutationObserver(() => {
      const active = container.querySelectorAll('.filter__btn.has-selection').length;
      toggleCount.textContent = active ? String(active) : '';
    }).observe(container, { subtree: true, attributes: true, attributeFilter: ['class'] });

    document.addEventListener('click', (event) => {
      if (!event.target.closest('.filter')) closeAll();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeAll();
    });
  }

  // Le filtre joker (more-filters.js) partage ces panneaux : un seul est ouvert à la fois.
  window.Filters = { init, panels: { openPanels, closeAll } };
})();
