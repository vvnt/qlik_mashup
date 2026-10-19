// Liste de valeurs d'un champ ou d'une dimension maître, avec sa zone de recherche.
// Elle sert aux filtres, aux listes ouvertes depuis les puces de la barre des sélections et au
// filtre joker : dans chacun, la recherche reste collée en haut du panneau pendant que la liste
// défile (barre .picker__bar, sticky).
//
// Les valeurs s'affichent dans le vocabulaire Samsic (js/vocab.js). Pour un champ traduit, la
// recherche porte sur les libellés Samsic, côté page (taper « propreté » doit trouver le métier) ;
// pour les autres (année, mois, géographie), c'est la recherche Qlik (searchListObjectFor), qui
// retrouve aussi les valeurs au-delà des LIMIT premières.
//
// Un objet de liste Qlik est créé à l'instanciation et détruit par destroy().

(function () {
  'use strict';

  const PATH = '/qListObjectDef';
  const LIMIT = 200;        // valeurs récupérées
  const V = window.Vocab;
  const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

  // source : nom de champ (chaîne) ou { libraryId, label, field } pour une dimension maître.
  // options.embedded : la liste s'intègre dans un panneau existant (pas de fenêtre propre).
  // options.onLayout(layout) : rappelé à chaque mise à jour de l'objet de liste.
  function create(doc, source, options) {
    const opts = options || {};
    const field = typeof source === 'string' ? source : source.field;
    const label = typeof source === 'string' ? V.fieldLabel(source) : source.label;
    const local = V.hasTable(field);   // recherche dans les libellés traduits
    const definition = typeof source === 'string'
      // Valeurs possibles d'abord (état Qlik), puis ordre naturel du champ (chronologique pour les
      // mois, alphabétique pour le texte) : une valeur utile n'est jamais noyée sous les exclues.
      ? { qDef: { qFieldDefs: [source], qSortCriterias: [{ qSortByState: 1, qSortByNumeric: 1, qSortByAscii: 1 }] } }
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
    search.setAttribute('aria-label', 'Rechercher dans ' + label);
    bar.append(search);

    const list = document.createElement('ul');
    list.className = 'filter__list';
    list.setAttribute('role', 'list');

    const note = document.createElement('p');
    note.className = 'picker__note';
    note.hidden = true;

    el.append(bar, list, note);

    let model = null;
    let cells = [];
    let total = 0;
    let destroyed = false;
    let searching = false;
    let timer = 0;

    function draw() {
      const query = local ? V.fold(search.value.trim()) : '';
      const shown = query ? cells.filter((cell) => V.fold(V.value(field, cell.qText)).includes(query)) : cells;
      window.ValueList.render(list, shown, (elem) => model.selectListObjectValues(PATH, [elem], true), field);
      if (query && !shown.length) {
        note.hidden = false;
        note.textContent = 'Aucune valeur ne correspond.';
      } else {
        note.hidden = searching || query !== '' || total <= LIMIT;
        note.textContent = `${LIMIT} premières valeurs sur ${total} : utilisez la recherche.`;
      }
    }

    const ready = window.Q.watch(doc, {
      qInfo: { qType: 'mashup-picker' },
      qListObjectDef: {
        ...definition,
        qInitialDataFetch: [{ qTop: 0, qLeft: 0, qWidth: 1, qHeight: LIMIT }],
      },
    }, (layout, current) => {
      model = current;
      const listObject = layout.qListObject;
      cells = ((listObject.qDataPages[0] || {}).qMatrix || []).map((row) => row[0]);
      // Champ traduit : ordre alphabétique des libellés Samsic.
      if (local) cells.sort((a, b) => collator.compare(V.value(field, a.qText), V.value(field, b.qText)));
      total = listObject.qDimensionInfo.qCardinal || cells.length;
      draw();
      if (opts.onLayout) opts.onLayout(layout);
    });

    // Une fois la liste créée, on peut détruire l'objet même si la fermeture a précédé la création.
    ready.then((created) => { if (destroyed) doc.destroySessionObject(created.id); });

    search.addEventListener('input', () => {
      clearTimeout(timer);
      if (local) { draw(); return; }
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
      if (local) { if (model) draw(); return; }
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
