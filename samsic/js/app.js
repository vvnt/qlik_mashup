// Point d'entrée : connexion à Qlik puis initialisation des modules.

(async function () {
  'use strict';

  const status = document.getElementById('status');
  const say = (text) => { status.textContent = text; status.hidden = !text; };

  say('Connexion à Qlik…');
  const doc = await window.Q.getDoc();
  if (!doc) {
    say('Connexion à Qlik impossible. Rechargez la page pour vous authentifier.');
    document.querySelectorAll('.qcard__loader').forEach((el) => { el.textContent = 'Connexion à Qlik impossible'; });
    return;
  }
  say('');

  const modules = [
    window.Selections.init(doc),
    window.Filters.init(doc),
    window.MoreFilters.init(doc),
    window.Kpis.init(doc),
    window.Search.init(doc),
  ];
  // ECharts vient d'un CDN : s'il manque, filtres et indicateurs restent utilisables.
  if (typeof echarts === 'undefined') {
    say('Bibliothèque de graphiques indisponible (réseau). Rechargez la page.');
  } else {
    modules.push(window.Drill.init(doc), window.Charts.init(doc), window.Trends.init(doc), window.DetailTable.init(doc));
  }

  try {
    await Promise.all(modules);
  } catch (error) {
    console.error(error);
    say('Erreur au chargement des données Qlik : voir la console.');
  }
})();
