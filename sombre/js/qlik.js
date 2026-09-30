// Couche Qlik : obtention du document (Engine API) et petits utilitaires.
// Qlik ne sert que de moteur de données et de sélections : aucun rendu Qlik.

(function () {
  'use strict';

  const ANCHOR_ID = 'qlik-anchor';
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const withTimeout = (promise, ms) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);

  // Le ref-api n'est disponible qu'une fois authentifié. Avec data-auto-redirect="true",
  // un visiteur non connecté est redirigé vers Qlik puis revient ici.
  async function getDoc() {
    const anchor = document.getElementById(ANCHOR_ID);
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const refApi = await withTimeout(anchor.getRefApi(), 4000);
        const doc = await withTimeout(refApi.getDoc(), 8000);
        if (doc) return doc;
      } catch (e) { /* nouvel essai */ }
      await sleep(1000);
    }
    return null;
  }

  // Crée un objet de session et rappelle `onLayout(layout, model)` à chaque changement
  // de sélection (propagation associative : rien à câbler entre objets).
  async function watch(doc, properties, onLayout) {
    const model = await doc.createSessionObject(properties);
    const refresh = async () => {
      try { onLayout(await model.getLayout(), model); }
      catch (error) { console.error('Objet Qlik', properties.qInfo.qType, ':', error); }
    };
    model.on('changed', refresh);
    await refresh();
    return model;
  }

  window.Q = { getDoc, watch };
})();
