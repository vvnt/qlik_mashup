// Recherche intelligente, limitée au vocabulaire Samsic (js/vocab.js).
//
// La recherche de Qlik (doc.searchResults) porte sur les valeurs d'origine : elle ne trouverait pas
// « propreté » et montrerait des valeurs qui trahissent les données de démonstration. On cherche donc
// côté page, dans les libellés Samsic des seuls champs du vocabulaire :
//  - une liste Qlik par champ garde ses valeurs et leur état à jour (sélections comprises) ;
//  - seules les valeurs possibles avec les sélections courantes sont proposées (comme le contexte
//    « CurrentSelections » de Qlik Sense) ;
//  - un résultat = un champ et ses valeurs trouvées ; le choisir sélectionne ces valeurs dans Qlik.
// Plusieurs mots : une valeur doit les contenir tous (sans casse ni accents).
//
// Accessibilité : motif « combobox » (le focus reste dans le champ ; flèches haut/bas pour
// parcourir, Entrée pour choisir, Échap pour fermer, aria-activedescendant).

(function () {
  'use strict';

  const V = window.Vocab;
  const PATH = '/qListObjectDef';
  const MIN_CHARS = 2;
  const DELAY = 150;          // ms d'attente après la dernière frappe
  const GROUPS = 12;          // résultats affichés
  const VALUES_SHOWN = 3;     // valeurs affichées par champ dans un résultat
  const FETCH = 2000;         // valeurs lues par champ

  function init(doc) {
    const root = document.getElementById('site-search');
    const input = document.getElementById('search-input');
    const panel = document.getElementById('search-panel');
    const status = document.getElementById('search-status');
    const list = document.getElementById('search-results');

    // Champ Qlik -> { model, values: [{ label, folded, elem, state }] }.
    const sources = new Map();
    const state = { terms: [], results: [], active: -1, timer: 0 };

    // Libellé avec les passages trouvés entourés de <mark> (repli caractère par caractère :
    // les positions restent celles du libellé d'origine).
    function highlight(label, terms) {
      const chars = Array.from(label);
      const folded = chars.map((c) => V.fold(c));
      const flat = folded.join('');
      const marked = new Array(chars.length).fill(false);
      if (folded.every((f) => f.length === 1)) {
        terms.forEach((term) => {
          let from = flat.indexOf(term);
          while (from !== -1) {
            for (let i = from; i < from + term.length; i++) marked[i] = true;
            from = flat.indexOf(term, from + term.length);
          }
        });
      }
      const fragment = document.createDocumentFragment();
      let run = '';
      let inMark = false;
      const flush = () => {
        if (!run) return;
        if (inMark) {
          const mark = document.createElement('mark');
          mark.textContent = run;
          fragment.append(mark);
        } else {
          fragment.append(run);
        }
        run = '';
      };
      chars.forEach((c, i) => {
        if (marked[i] !== inMark) { flush(); inMark = marked[i]; }
        run += c;
      });
      flush();
      return fragment;
    }

    function open() {
      panel.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }

    function close() {
      panel.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      state.active = -1;
    }

    function setActive(index) {
      const entries = list.querySelectorAll('[role="option"]');
      entries.forEach((entry, i) => entry.setAttribute('aria-selected', String(i === index)));
      state.active = index;
      if (index >= 0 && entries[index]) {
        input.setAttribute('aria-activedescendant', entries[index].id);
        entries[index].scrollIntoView({ block: 'nearest' });
      } else {
        input.removeAttribute('aria-activedescendant');
      }
    }

    async function choose(index) {
      const result = state.results[index];
      close();
      input.value = '';
      list.replaceChildren();
      if (!result) return;
      const source = sources.get(result.field);
      await source.model.selectListObjectValues(PATH, result.matches.map((m) => m.elem), false);
    }

    // Correspondances : par champ, valeurs possibles contenant tous les mots. Les champs dont une
    // valeur commence par la recherche passent en tête, puis ceux qui ont le moins de valeurs trouvées.
    function find(terms) {
      const results = [];
      sources.forEach((source, field) => {
        const matches = source.values.filter((v) => (v.state === 'O' || v.state === 'S')
          && terms.every((term) => v.folded.includes(term)));
        if (!matches.length) return;
        const prefix = matches.some((m) => m.folded.startsWith(terms[0]));
        results.push({ field, matches, prefix });
      });
      return results
        .sort((a, b) => (b.prefix - a.prefix) || (a.matches.length - b.matches.length))
        .slice(0, GROUPS);
    }

    function render() {
      const { results, terms } = state;
      list.replaceChildren(...results.map((result, index) => {
        const item = document.createElement('li');
        item.id = 'search-option-' + index;
        item.className = 'search__option';
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', 'false');

        const line = document.createElement('div');
        line.className = 'search__line';
        const field = document.createElement('span');
        field.className = 'search__field';
        field.textContent = V.fieldLabel(result.field);
        const values = document.createElement('span');
        values.className = 'search__values';
        result.matches.slice(0, VALUES_SHOWN).forEach((match, i) => {
          if (i) values.append(', ');
          values.append(highlight(match.label, terms));
        });
        const more = result.matches.length - Math.min(result.matches.length, VALUES_SHOWN);
        if (more > 0) {
          const extra = document.createElement('span');
          extra.className = 'search__more';
          extra.textContent = ` +${more}`;
          values.append(extra);
        }
        line.append(field, values);
        item.append(line);

        // mousedown : évite que le champ perde le focus avant le clic.
        item.addEventListener('mousedown', (event) => event.preventDefault());
        item.addEventListener('click', () => choose(index));
        return item;
      }));

      status.textContent = results.length
        ? `${results.length} résultat${results.length > 1 ? 's' : ''}`
        : `Aucun résultat pour « ${input.value.trim()} »`;
      setActive(-1);
    }

    function run() {
      if (input.value.trim().length < MIN_CHARS) { close(); return; }
      state.terms = V.fold(input.value.trim()).split(/\s+/).filter(Boolean);
      state.results = find(state.terms);
      open();
      render();
    }

    input.addEventListener('input', () => {
      clearTimeout(state.timer);
      if (input.value.trim().length < MIN_CHARS) { close(); return; }
      state.timer = setTimeout(run, DELAY);
    });

    input.addEventListener('keydown', (event) => {
      const count = list.querySelectorAll('[role="option"]').length;
      if (event.key === 'ArrowDown' && !panel.hidden && count) {
        event.preventDefault();
        setActive((state.active + 1) % count);
      } else if (event.key === 'ArrowUp' && !panel.hidden && count) {
        event.preventDefault();
        setActive((state.active - 1 + count) % count);
      } else if (event.key === 'Enter') {
        if (state.active >= 0) { event.preventDefault(); choose(state.active); }
        else { clearTimeout(state.timer); run(); }
      } else if (event.key === 'Escape') {
        if (!panel.hidden) { event.stopPropagation(); close(); }
        else input.value = '';
      }
    });

    input.addEventListener('focus', () => {
      if (input.value.trim().length >= MIN_CHARS && list.children.length) open();
    });

    document.addEventListener('click', (event) => {
      if (!event.target.closest('#site-search')) close();
    });

    root.hidden = false;

    // Une liste Qlik par champ du vocabulaire : valeurs et états suivent les sélections.
    return Promise.all(V.fields.map((field) => window.Q.watch(doc, {
      qInfo: { qType: 'mashup-search-source' },
      qListObjectDef: {
        qDef: { qFieldDefs: [field] },
        qInitialDataFetch: [{ qTop: 0, qLeft: 0, qWidth: 1, qHeight: FETCH }],
      },
    }, (layout, model) => {
      const cells = ((layout.qListObject.qDataPages[0] || {}).qMatrix || []).map((row) => row[0]);
      sources.set(field, {
        model,
        values: cells.map((cell) => {
          const label = V.value(field, cell.qText);
          return { label, folded: V.fold(label), elem: cell.qElemNumber, state: cell.qState };
        }),
      });
      if (!panel.hidden && state.terms.length) { state.results = find(state.terms); render(); }
    })));
  }

  window.Search = { init };
})();
