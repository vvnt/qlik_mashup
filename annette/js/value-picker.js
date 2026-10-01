// Liste de valeurs d'un champ ou d'une dimension maître, avec sa zone de recherche.
// Elle sert aux filtres, aux listes ouvertes depuis les puces de la barre des sélections et au
// filtre joker : dans chacun, la recherche reste collée en haut du panneau pendant que la liste
// défile (barre .picker__bar, sticky).
//
// Un objet de liste Qlik est créé à l'instanciation et détruit par destroy(). Pour un champ à
// nombreuses valeurs (ex. Produit), seules les LIMIT premières sont listées ; la recherche Qlik
// (searchListObjectFor) permet de retrouver les autres.

(function () {
  'use strict';

  const PATH = '/qListObjectDef';
  const LIMIT = 200;        // valeurs récupérées

  // source : nom de champ (chaîne) ou { libraryId, label } pour une dimension maître.
  // options.embedded : la liste s'intègre dans un panneau existant (pas de fenêtre propre).
  // options.onLayout(layout) : rappelé à chaque mise à jour de l'objet de liste.
  function create(doc, source, options) {
    const opts = options || {};
    const field = typeof source === 'string' ? source : source.label;
    const definition = typeof source === 'string'
      // Ordre naturel du champ (chronologique pour les mois, alphabétique pour le texte).
      ? { qDef: { qFieldDefs: [source], qSortCriterias: [{ qSortByNumeric: 1, qSortByAscii: 1 }] } }
      : { qLibraryId: source.libraryId };
    const el = document.createElement('div');
    el.className = 'filter__panel picker' + (opts.embedded ? ' picker--embedded' : '');

    // Barre de recherche : reste visible quand la liste défile.
    const bar = document.createElement('div');
    bar.className = 'picker__bar';
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'picker__search';
    search.placeholder = 'Rechercher…';
    search.autocomplete = 'off';
    search.setAttribute('aria-label', 'Rechercher dans ' + field);
    bar.append(search);

    const list = document.createElement('ul');
    list.className = 'filter__list';
    list.setAttribute('role', 'list');

    const note = document.createElement('p');
    note.className = 'picker__note';
    note.hidden = true;

    el.append(bar, list, note);

    let model = null;
    let destroyed = false;
    let searching = false;
    let timer = 0;

    const ready = window.Q.watch(doc, {
      qInfo: { qType: 'mashup-picker' },
      qListObjectDef: {
        ...definition,
        qInitialDataFetch: [{ qTop: 0, qLeft: 0, qWidth: 1, qHeight: LIMIT }],
      },
    }, (layout, current) => {
      model = current;
      const listObject = layout.qListObject;
      const cells = ((listObject.qDataPages[0] || {}).qMatrix || []).map((row) => row[0]);
      const total = listObject.qDimensionInfo.qCardinal || cells.length;

      window.ValueList.render(list, cells, (elem) => current.selectListObjectValues(PATH, [elem], true));

      note.hidden = searching || total <= LIMIT;
      note.textContent = `${LIMIT} premières valeurs sur ${total} : utilisez la recherche.`;
      if (opts.onLayout) opts.onLayout(layout);
    });

    // Une fois la liste créée, on peut détruire l'objet même si la fermeture a précédé la création.
    ready.then((created) => { if (destroyed) doc.destroySessionObject(created.id); });

    search.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        if (!model) return;
        const text = search.value.trim();
        if (text) {
          searching = true;
          await model.searchListObjectFor(PATH, text);
        } else if (searching) {
          searching = false;
          await model.abortListObjectSearch(PATH);
        }
      }, 250);
    });

    // Vide la recherche et rend la liste complète (à la fermeture du panneau).
    function reset() {
      clearTimeout(timer);
      search.value = '';
      if (searching && model) {
        searching = false;
        model.abortListObjectSearch(PATH);
      }
    }

    // Met le curseur dans la recherche, sauf sur écran tactile (le clavier virtuel gênerait).
    function focus() {
      if (window.matchMedia('(pointer: fine)').matches) search.focus();
    }

    function destroy() {
      destroyed = true;
      clearTimeout(timer);
      if (model) {
        if (searching) model.abortListObjectSearch(PATH);
        doc.destroySessionObject(model.id);
      }
      el.remove();
    }

    return { el, search, reset, focus, destroy };
  }

  window.ValuePicker = { create };
})();
