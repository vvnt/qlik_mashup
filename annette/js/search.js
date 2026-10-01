// Recherche intelligente (équivalent de la « Smart Search » de Qlik Sense) dans l'en-tête.
//
// Il n'existe pas de composant qlik-embed pour elle : on utilise l'API du moteur.
//  - doc.searchResults(options, termes, page) : correspondances groupées, classées par Qlik ;
//  - doc.selectAssociations(options, termes, index) : sélectionne toutes les valeurs d'un groupe.
// Plusieurs mots = recherche combinée (ex. « manteau bretagne »). La recherche porte sur les
// valeurs possibles avec les sélections courantes (contexte CurrentSelections, comme Qlik Sense)
// et sur les champs de APP_CONFIG.searchFields (les champs techniques sont exclus).
//
// Accessibilité : motif « combobox » (le focus reste dans le champ ; flèches haut/bas pour
// parcourir, Entrée pour choisir, Échap pour fermer, aria-activedescendant).

(function () {
  'use strict';

  const MIN_CHARS = 2;
  const DELAY = 250;          // ms d'attente après la dernière frappe
  const GROUPS = 12;          // résultats affichés
  const VALUES_SHOWN = 3;     // valeurs affichées par champ dans un résultat

  function init(doc) {
    const root = document.getElementById('site-search');
    const input = document.getElementById('search-input');
    const panel = document.getElementById('search-panel');
    const status = document.getElementById('search-status');
    const list = document.getElementById('search-results');

    const options = { qContext: 'CurrentSelections', qSearchFields: window.APP_CONFIG.searchFields };
    const page = {
      qOffset: 0, qCount: GROUPS, qMaxNbrFieldMatches: 5,
      qGroupOptions: [{ qGroupType: 'DATASET_GROUP', qOffset: 0, qCount: GROUPS }],
      qGroupItemOptions: [{ qGroupItemType: 'FIELD', qOffset: 0, qCount: GROUPS }],
    };

    const state = { terms: [], active: -1, sequence: 0, timer: 0 };

    // Texte avec les caractères trouvés (qRanges) entourés de <mark>.
    function highlight(match) {
      const fragment = document.createDocumentFragment();
      const text = match.qText;
      let cursor = 0;
      (match.qRanges || []).slice().sort((a, b) => a.qCharPos - b.qCharPos).forEach((range) => {
        if (range.qCharPos < cursor) return;
        if (range.qCharPos > cursor) fragment.append(text.slice(cursor, range.qCharPos));
        const mark = document.createElement('mark');
        mark.textContent = text.slice(range.qCharPos, range.qCharPos + range.qCharCount);
        fragment.append(mark);
        cursor = range.qCharPos + range.qCharCount;
      });
      if (cursor < text.length) fragment.append(text.slice(cursor));
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
      const terms = state.terms;
      close();
      input.value = '';
      list.replaceChildren();
      await doc.selectAssociations(options, terms, index);
    }

    function render(result) {
      const groups = result.qSearchGroupArray || [];
      list.replaceChildren(...groups.map((group, index) => {
        const item = document.createElement('li');
        item.id = 'search-option-' + index;
        item.className = 'search__option';
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', 'false');

        (group.qItems || []).forEach((entry) => {
          const line = document.createElement('div');
          line.className = 'search__line';
          const field = document.createElement('span');
          field.className = 'search__field';
          field.textContent = entry.qIdentifier;
          const values = document.createElement('span');
          values.className = 'search__values';
          const matches = entry.qItemMatches || [];
          matches.slice(0, VALUES_SHOWN).forEach((match, i) => {
            if (i) values.append(', ');
            values.append(highlight(match));
          });
          const more = (entry.qTotalNumberOfMatches || matches.length) - Math.min(matches.length, VALUES_SHOWN);
          if (more > 0) {
            const extra = document.createElement('span');
            extra.className = 'search__more';
            extra.textContent = ` +${more}`;
            values.append(extra);
          }
          line.append(field, values);
          item.append(line);
        });

        // mousedown : évite que le champ perde le focus avant le clic.
        item.addEventListener('mousedown', (event) => event.preventDefault());
        item.addEventListener('click', () => choose(index));
        return item;
      }));

      status.textContent = groups.length
        ? `${groups.length} résultat${groups.length > 1 ? 's' : ''}`
        : `Aucun résultat pour « ${state.terms.join(' ')} »`;
      setActive(-1);
    }

    async function run() {
      const terms = input.value.trim().split(/\s+/).filter(Boolean);
      if (input.value.trim().length < MIN_CHARS) { close(); return; }
      state.terms = terms;
      const mine = ++state.sequence;
      status.textContent = 'Recherche…';
      open();
      try {
        const result = await doc.searchResults(options, terms, page);
        if (mine === state.sequence) render(result);   // ignore une réponse périmée
      } catch (error) {
        console.error('Recherche Qlik :', error);
        if (mine === state.sequence) {
          list.replaceChildren();
          status.textContent = 'La recherche a échoué.';
        }
      }
    }

    input.addEventListener('input', () => {
      clearTimeout(state.timer);
      state.sequence++;                       // invalide la recherche en cours
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
  }

  window.Search = { init };
})();
