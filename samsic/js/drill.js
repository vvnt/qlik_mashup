// Descente dans la hiérarchie Métier → Prestation (champs Qlik Catégorie → Sous-catégorie).
//
// Qlik descend tout seul : quand une seule valeur est sélectionnée au niveau courant,
// le groupe hiérarchique affiche le niveau suivant (qGroupPos). Ce module ne fait que :
//  - afficher le fil d'Ariane construit depuis les sélections des niveaux supérieurs ;
//  - remonter en effaçant les champs des niveaux inférieurs ;
//  - adapter le titre des cartes au niveau courant (attribut data-title-template) ;
//  - rejouer le balayage des graphiques quand le niveau change (js/wipe.js).
// Libellés des niveaux et des valeurs : vocabulaire Samsic (js/vocab.js).

(function () {
  'use strict';

  const { measures: M, hierarchyFields: fieldDefs, hierarchyDimension } = window.APP_CONFIG;
  const V = window.Vocab;

  async function init(doc) {
    const nav = document.getElementById('crumbs');
    const list = document.getElementById('crumbs-list');
    const titled = Array.from(document.querySelectorAll('[data-title-template]'));
    const levelCharts = titled.map((el) => el.closest('.qcard')).filter((card) => card && card.querySelector('[data-chart]'));

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
      const level = V.fieldLabel(fieldDefs[Math.min(state.pos, fieldDefs.length - 1)]).toLowerCase();
      titled.forEach((el) => { el.textContent = el.dataset.titleTemplate.replace('{level}', level); });

      // Fil d'Ariane : « Tous les métiers › valeur du niveau 1 ».
      const items = [];
      items.push(crumb('Tous les métiers', {
        current: state.pos === 0,
        onClick: () => clearFields(fieldDefs),
      }));
      for (let i = 0; i < state.pos; i++) {
        const value = state.selected.get(fieldDefs[i]) || V.fieldLabel(fieldDefs[i]);
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
          qDimensions: [hierarchyDimension()],
          qMeasures: [{ qLibraryId: M.ca }],
          qInitialDataFetch: [{ qTop: 0, qLeft: 0, qWidth: 2, qHeight: 1 }],
        },
      }, (layout) => {
        const info = (layout.qHyperCube.qDimensionInfo || [])[0] || {};
        const pos = info.qGroupPos || 0;
        if (pos !== state.pos) window.Wipe.replay(levelCharts);
        state.pos = pos;
        render();
      }),
      window.Q.watch(doc, {
        qInfo: { qType: 'mashup-drill-selections' },
        qSelectionObjectDef: {},
      }, (layout) => {
        state.selected = new Map(((layout.qSelectionObject || {}).qSelections || [])
          .map((s) => [s.qField, V.selectionText(s)]));
        render();
      }),
    ]);
  }

  window.Drill = { init };
})();
