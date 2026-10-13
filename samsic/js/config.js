// Identifiants des master items de l'application « Distribution démo ».
// Les données restent celles de l'application ; leur vocabulaire est celui de Samsic (voir js/vocab.js).

window.APP_CONFIG = {
  appId: 'bd940433-886e-48b0-a9b1-be5b6770ee3d',

  // Connexion Qlik Cloud (client OAuth2 « Single-page app », public : pas de secret). L'adresse de retour
  // est calculée par js/qlik-loader.js ; chaque origine et chaque adresse de retour doivent être
  // déclarées dans le client OAuth.
  auth: {
    host: 'excelcio-capacity.eu.qlikcloud.com',
    clientId: '01a08f90f9cb22a4baa41889a85b3ddb',
    autoRedirect: true,
  },

  measures: {
    ca: '33cb8862-0011-4a04-bfde-5f7521a1d018',          // CA HT N
    caPrev: '7b42ea98-0015-4c4c-8e74-c646d0ffa721',      // CA HT N-1
    caDelta: '930be982-4370-49d2-8bd6-7dcfb432da7c',     // CA HT N/N-1
    caDeltaPct: '40f33c4f-57bd-46dd-9e75-ee4bf70b9ef1',  // CA HT N/N-1 %
    margin: '14797965-a8b6-4549-b825-818e6af27d60',      // Marge N
    marginPrev: '9017f7bb-f731-4c21-ba48-bb6fb0e6596a',  // Marge N-1
    marginDeltaPct: '6aa4b8f3-2dd9-4c73-9a9c-782917ce5b31', // Marge N/N-1 %
    rate: '0f47caf2-a407-44c2-aaaa-45e1e054da07',        // Marge % N
    ratePrev: 'f3e18f48-b8d7-4c69-8792-8c61eca9e449',    // Marge % N1
    rateDeltaPts: '0622f5d9-8bb1-49f4-a027-d9eb897fafe0', // Marge N/N-1 pts
  },

  dimensions: {
    month: 'cf593f56-7f76-4838-b219-1e810d4f70a3',        // Mois
    year: '5fa04370-938e-461e-839c-1c33dd61e4d8',         // Année
    region: 'etY',                                        // Magasin région
    channel: 'PTzfQw',                                    // Magasin canal
    storeType: '5dd4be61-8e54-457f-af7d-2723e36afdf3',    // Magasin type
  },

  // Hiérarchie Métier → Prestation : groupe de descente défini en ligne sur les deux premiers niveaux
  // de la hiérarchie produit. Le niveau Produit n'a pas d'équivalent crédible chez Samsic : il n'est
  // jamais affiché (sélectionner une prestation la laisse seule à l'écran).
  hierarchyFields: ['Catégorie', 'Sous-catégorie'],

  // Nombre maximal de valeurs affichées par graphique (les plus fortes par CA).
  topN: 15,

  // Filtres affichés, dans l'ordre (libellés : vocabulaire Samsic ; field : champ Qlik, pour traduire les valeurs).
  filters: [
    { key: 'year', field: 'Année', label: 'Année' },
    { key: 'month', field: 'Mois', label: 'Mois' },
    { key: 'region', field: 'Magasin région', label: 'Région' },
    { key: 'channel', field: 'Magasin canal', label: 'Secteur' },
    { key: 'storeType', field: 'Magasin type', label: 'Type de site' },
  ],
};

// Dimension de descente Métier → Prestation, pour les hypercubes (graphiques, tableau, fil d'Ariane).
window.APP_CONFIG.hierarchyDimension = () => ({
  qDef: { qGrouping: 'H', qFieldDefs: window.APP_CONFIG.hierarchyFields.slice() },
  qNullSuppression: true,
});
