// « Nos métiers à la carte » : quatre cartes (Transport, Multimodal, Logistique, Palette, comme sur la
// page d'accueil du site) qui sélectionnent dans Qlik les valeurs listées dans APP_CONFIG.metiers.
// Clic = sélection ; second clic sur la carte active = sélection retirée.
// L'état « enfoncé » suit les sélections Qlik : il reste juste si l'on sélectionne ailleurs.

(function () {
  'use strict';

  async function init(doc) {
    const cfg = window.APP_CONFIG.metiers;
    const section = document.getElementById('metiers');
    if (!cfg || !cfg.field || !cfg.choices || !cfg.choices.every((choice) => choice.values.length)) return;

    const field = await doc.getField(cfg.field);
    const cards = cfg.choices.map((choice) => {
      const button = section.querySelector(`[data-metier="${choice.key}"]`);
      button.setAttribute('aria-pressed', 'false');
      button.querySelector('[data-metier-hint]').textContent =
        choice.values.map((text) => window.Vocab.value(cfg.field, text)).join(' · ');
      button.addEventListener('click', async () => {
        if (button.getAttribute('aria-pressed') === 'true') await field.clear();
        else await field.selectValues(choice.values.map((text) => ({ qText: text })), false, false);
      });
      return { button, values: new Set(choice.values) };
    });
    section.hidden = false;

    // Valeurs sélectionnées du champ : une carte est « enfoncée » quand la sélection est exactement
    // sa liste de valeurs.
    await window.Q.watch(doc, {
      qInfo: { qType: 'metiers' },
      qListObjectDef: {
        qDef: { qFieldDefs: [cfg.field] },
        qInitialDataFetch: [{ qTop: 0, qLeft: 0, qWidth: 1, qHeight: 200 }],
      },
    }, (layout) => {
      const rows = (layout.qListObject.qDataPages[0] || { qMatrix: [] }).qMatrix;
      const selected = new Set(rows.filter((row) => row[0].qState === 'S').map((row) => row[0].qText));
      cards.forEach(({ button, values }) => {
        const same = selected.size === values.size && [...values].every((value) => selected.has(value));
        button.setAttribute('aria-pressed', String(same));
        button.querySelector('.metier__cta').textContent = same ? 'Sélectionné' : 'Sélectionner';
      });
    });
  }

  window.Metiers = { init };
})();
