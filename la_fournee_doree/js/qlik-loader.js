// Charge le script d'intégration Qlik (@qlik/embed-web-components) avec sa configuration OAuth2 SPA.
//
// Pourquoi ce chargeur plutôt qu'une balise <script data-…> écrite à la main : l'adresse de retour
// OAuth est calculée à partir de l'adresse de la page. Le même fichier fonctionne donc :
//   - en local          http://localhost:8080/index.html    → http://localhost:8080/oauth-callback.html
//   - sur GitHub Pages  https://<compte>.github.io/<dépôt>/ → https://<compte>.github.io/<dépôt>/oauth-callback.html
//   - sur tout autre hébergement, sous-dossier compris.
// Chaque adresse de retour et chaque origine doivent être déclarées dans le client OAuth de Qlik Cloud.
//
// Ordre : à charger APRÈS ECharts (le script Qlik installe un chargeur AMD, voir README) et après
// config.js. async = false garde l'ordre d'exécution des scripts.

(function () {
  'use strict';

  const auth = window.APP_CONFIG && window.APP_CONFIG.auth;
  if (!auth) { console.error('qlik-loader : APP_CONFIG.auth est absent (js/config.js).'); return; }

  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@qlik/embed-web-components@1/dist/index.min.js';
  script.crossOrigin = 'anonymous';
  script.async = false;
  script.dataset.host = auth.host;
  script.dataset.authType = 'Oauth2';
  script.dataset.clientId = auth.clientId;
  script.dataset.redirectUri = new URL('oauth-callback.html', window.location.href).href;
  script.dataset.autoRedirect = String(auth.autoRedirect !== false);   // par défaut : redirection automatique
  script.dataset.accessTokenStorage = 'session';
  document.head.append(script);
})();
