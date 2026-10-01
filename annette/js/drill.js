// Descente dans la hiérarchie produit (Catégorie → Sous-catégorie → Produit).
//
// Qlik descend tout seul : quand une seule valeur est sélectionnée au niveau courant,
// le groupe hiérarchique affiche le niveau suivant (qGroupPos). Ce module ne fait que :
//  - afficher le fil d'Ariane construit depuis les sélections des niveaux supérieurs ;
//  - remonter en effaçant les champs des niveaux inférieurs ;
//  - adapter le titre des cartes au niveau courant (attribut data-title-template).

(function () {
  'use strict';

  const { measures: M, dimensions: D } = window.APP_CONFIG;

  async function init(doc) {
    const nav = document.getElementById('crumbs');
    const list = document.getElementById('crumbs-list');
    const titled = Array.from(document.querySelectorAll('[data-title-template]'));

    const dimension = await doc.getDimension(D.hierarchy);
    const fieldDefs = (await dimension.getLayout()).qDim.qFieldDefs;

    const state = { pos: 0, selected: new Map() };

    async function clearFields(names) {
      for (const name of names) (await doc.getField(name)).clear();
    }

    function crumb(label, { onClick, current }) {
      const item = document.createElement('li');
      item.className = 'crumbs__item';
      if (current) {
        const text = document.createElement('span');
        text.className = 'crumbs__current';
        text.setAttribute('aria-current', 'location');
        text.textContent = label;
        item.append(text);
      } else {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'crumbs__link';
        button.textContent = label;
        button.addEventListener('click', onClick);
        item.append(button);
      }
      return item;
    }

    function render() {
      const level = (fieldDefs[state.pos] || '').toLowerCase();
      titled.forEach((el) => { el.textContent = el.dataset.titleTemplate.replace('{level}', level); });

      // Fil d'Ariane : « Toutes catégories › valeur du niveau 1 › valeur du niveau 2 ».
      const items = [];
      items.push(crumb('Toutes catégories', {
        current: state.pos === 0,
        onClick: () => clearFields(fieldDefs),
      }));
      for (let i = 0; i < state.pos; i++) {
        const value = state.selected.get(fieldDefs[i]) || fieldDefs[i];
        items.push(crumb(value, {
          current: i === state.pos - 1,
          onClick: () => clearFields(fieldDefs.slice(i + 1)),
        }));
      }
      list.replaceChildren(...items);
      nav.hidden = false;
    }

    await Promise.all([
      window.Q.watch(doc, {
        qInfo: { qType: 'mashup-drill' },
        qHyperCubeDef: {
          qDimensions: [{ qLibraryId: D.hierarchy }],
          qMeasures: [{ qLibraryId: M.ca }],
          qInitialDataFetch: [{ qTop: 0, qLeft: 0, qWidth: 2, qHeight: 1 }],
        },
      }, (layout) => {
        const info = (layout.qHyperCube.qDimensionInfo || [])[0] || {};
        state.pos = info.qGroupPos || 0;
        render();
      }),
      window.Q.watch(doc, {
        qInfo: { qType: 'mashup-drill-selections' },
        qSelectionObjectDef: {},
      }, (layout) => {
        state.selected = new Map(((layout.qSelectionObject || {}).qSelections || [])
          .map((s) => [s.qField, s.qSelected]));
        render();
      }),
    ]);
  }

  window.Drill = { init };
})();
