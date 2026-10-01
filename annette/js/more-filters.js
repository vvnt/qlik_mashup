// Filtre « joker » : à gauche des filtres, il liste toutes les AUTRES dimensions maîtres de
// l'application (celles qui n'ont pas déjà leur propre bouton) et laisse choisir leurs valeurs.
//
// Panneau à deux niveaux : la liste des dimensions, puis, après un clic, les valeurs de la
// dimension choisie (avec recherche au-delà de 20 valeurs, voir value-picker.js) et un bouton
// « Retour ». Rien n'est ajouté à la rangée ; les sélections apparaissent dans la barre des
// sélections. La liste des dimensions est lue dans l'application : une nouvelle dimension
// maître apparaît sans modifier le code.

(function () {
  'use strict';

  const { dimensions, filters } = window.APP_CONFIG;
  const SHOWN = new Set(filters.map((f) => dimensions[f.key]));   // ids déjà affichés en filtres
  const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

  function init(doc) {
    const { icon } = window.ValueList;
    const { openPanels, closeAll } = window.Filters.panels;
    const container = document.getElementById('filters');

    // ---- Structure ---------------------------------------------------------------------
    const root = document.createElement('div');
    root.className = 'filter filter--more';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn--secondary btn--sm filter__btn';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-haspopup', 'true');
    // Bouton à icône seule : le nom accessible et l'infobulle portent le libellé.
    button.setAttribute('aria-label', 'Autres filtres');
    button.title = 'Autres filtres';
    const count = document.createElement('span');
    count.className = 'filter__count';
    button.append(icon('star'), count);

    const panel = document.createElement('div');
    panel.className = 'filter__panel more';
    panel.id = 'filter-more';
    panel.hidden = true;
    button.setAttribute('aria-controls', panel.id);

    // Niveau 1 : les dimensions.
    const listView = document.createElement('div');
    const filterBar = document.createElement('div');
    filterBar.className = 'picker__bar';
    const filterInput = document.createElement('input');
    filterInput.type = 'search';
    filterInput.className = 'picker__search';
    filterInput.placeholder = 'Filtrer les dimensions…';
    filterInput.setAttribute('aria-label', 'Filtrer la liste des dimensions');
    const dimList = document.createElement('ul');
    dimList.className = 'filter__list';
    dimList.setAttribute('role', 'list');
    const noMatch = document.createElement('p');
    noMatch.className = 'picker__note';
    noMatch.textContent = 'Aucune dimension ne correspond.';
    noMatch.hidden = true;
    filterBar.append(filterInput);
    listView.append(filterBar, dimList, noMatch);

    // Niveau 2 : les valeurs de la dimension choisie.
    const valuesView = document.createElement('div');
    valuesView.className = 'more__values';
    valuesView.hidden = true;
    const head = document.createElement('div');
    head.className = 'more__head';
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'more__back';
    back.setAttribute('aria-label', 'Retour à la liste des dimensions');
    back.append(icon('back'));
    const title = document.createElement('span');
    title.className = 'more__title';
    head.append(back, title);
    const slot = document.createElement('div');
    valuesView.append(head, slot);

    panel.append(listView, valuesView);
    root.append(button, panel);

    // ---- État ----------------------------------------------------------------------------
    const state = { dims: [], selectedFields: new Set(), current: null, picker: null };

    const hasSelection = (dim) => dim.fields.some((field) => state.selectedFields.has(field));

    function renderList() {
      const query = filterInput.value.trim();
      const visible = state.dims.filter((dim) => !query || dim.title.toLowerCase().includes(query.toLowerCase()));
      noMatch.hidden = visible.length > 0;
      dimList.replaceChildren(...visible.map((dim) => {
        const item = document.createElement('li');
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'filter__opt more__dim';
        option.dataset.dim = dim.id;
        option.dataset.state = hasSelection(dim) ? 'S' : 'O';
        option.setAttribute('aria-haspopup', 'true');
        const text = document.createElement('span');
        text.textContent = dim.title;
        option.append(text, icon('chevron-right'));
        option.addEventListener('click', () => showValues(dim));
        item.append(option);
        return item;
      }));
    }

    function updateBadge() {
      const active = state.dims.filter(hasSelection).length;
      count.textContent = active ? String(active) : '';
      button.classList.toggle('has-selection', active > 0);
    }

    function showList(focusDim) {
      if (state.picker) { state.picker.destroy(); state.picker = null; }
      state.current = null;
      valuesView.hidden = true;
      listView.hidden = false;
      renderList();
      const again = focusDim && dimList.querySelector(`[data-dim="${CSS.escape(focusDim.id)}"]`);
      (again || filterInput).focus();
    }

    function showValues(dim) {
      if (state.picker) state.picker.destroy();
      state.current = dim;
      state.picker = window.ValuePicker.create(doc, { libraryId: dim.id, label: dim.title }, { embedded: true });
      title.textContent = dim.title;
      slot.replaceChildren(state.picker.el);
      listView.hidden = true;
      valuesView.hidden = false;
      back.focus();
      state.picker.focus();   // curseur dans la recherche (écran non tactile)
    }

    back.addEventListener('click', () => showList(state.current));
    filterInput.addEventListener('input', renderList);

    // ---- Ouverture / fermeture (partagées avec les autres filtres) ------------------------
    const filter = {
      root,
      open() {
        closeAll(filter);
        panel.hidden = false;
        button.setAttribute('aria-expanded', 'true');
        openPanels.add(filter);
        if (window.matchMedia('(pointer: fine)').matches) filterInput.focus();
      },
      close() {
        panel.hidden = true;
        button.setAttribute('aria-expanded', 'false');
        openPanels.delete(filter);
        if (state.picker) { state.picker.destroy(); state.picker = null; }
        state.current = null;
        valuesView.hidden = true;
        listView.hidden = false;
        filterInput.value = '';
        renderList();
      },
    };
    button.addEventListener('click', () => (panel.hidden ? filter.open() : filter.close()));

    container.prepend(root);

    // ---- Données Qlik ----------------------------------------------------------------------
    return Promise.all([
      // Toutes les dimensions maîtres, sauf celles déjà affichées.
      window.Q.watch(doc, {
        qInfo: { qType: 'DimensionList' },
        qDimensionListDef: { qType: 'dimension', qData: { title: '/qMetaDef/title', dim: '/qDim' } },
      }, (layout) => {
        state.dims = ((layout.qDimensionList || {}).qItems || [])
          .filter((item) => !SHOWN.has(item.qInfo.qId))
          .map((item) => ({
            id: item.qInfo.qId,
            title: (item.qMeta && item.qMeta.title) || (item.qData && item.qData.title) || item.qInfo.qId,
            fields: (item.qData && item.qData.dim && item.qData.dim.qFieldDefs) || [],
          }))
          .sort((a, b) => collator.compare(a.title, b.title));
        if (state.current === null) renderList();
        updateBadge();
      }),
      // Les champs qui ont une sélection : pastille sur les dimensions concernées et compteur.
      window.Q.watch(doc, {
        qInfo: { qType: 'mashup-more-selections' },
        qSelectionObjectDef: {},
      }, (layout) => {
        state.selectedFields = new Set(((layout.qSelectionObject || {}).qSelections || []).map((s) => s.qField));
        if (state.current === null) renderList();
        updateBadge();
      }),
    ]);
  }

  window.MoreFilters = { init };
})();
