// Vocabulaire Samsic : les données Qlik restent celles de « Distribution démo », seul l'affichage change.
//
//  - FIELDS : champs Qlik montrés dans la page, avec leur libellé Samsic. Ce sont aussi les seuls champs
//    proposés par la recherche et par le filtre « joker » : un champ absent d'ici n'apparaît nulle part
//    (ses valeurs trahiraient l'origine des données).
//  - VALUES : correspondance valeur Qlik → libellé Samsic, par champ. Un champ sans table (année, mois,
//    géographie) garde ses valeurs telles quelles.
//
// Les sélections, elles, portent toujours sur les valeurs Qlik d'origine (qElemNumber) : rien à traduire
// dans l'autre sens.

(function () {
  'use strict';

  const FIELDS = {
    'Catégorie': 'Métier',
    'Sous-catégorie': 'Prestation',
    'Magasin région': 'Région',
    'Magasin département': 'Département',
    'Magasin ville': 'Ville',
    'Magasin canal': 'Secteur',
    'Magasin type': 'Type de site',
    'Année': 'Année',
    'Mois': 'Mois',
  };

  const VALUES = {
    'Catégorie': {},
    'Sous-catégorie': {},
    'Magasin canal': {},
    'Magasin type': {},
  };

  const fieldLabel = (field) => FIELDS[field] || field || '';
  const value = (field, text) => {
    const table = VALUES[field];
    return (table && table[text]) || text;
  };
  const isShown = (field) => Object.prototype.hasOwnProperty.call(FIELDS, field);
  const hasTable = (field) => !!VALUES[field] && Object.keys(VALUES[field]).length > 0;

  // Comparaison sans casse ni accents (recherche dans les libellés Samsic).
  const fold = (text) => String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  // Résumé d'une sélection (puces, fil d'Ariane) : « Propreté », « Propreté, Sécurité » ou « 3 sur 12 ».
  // selection : élément de qSelectionObject.qSelections.
  function selectionText(selection) {
    const names = (selection.qSelectedFieldSelectionInfo || []).map((info) => value(selection.qField, info.qName));
    const count = selection.qSelectedCount || names.length;
    if (names.length && names.length === count && count <= 3) return names.join(', ');
    return `${count} sur ${selection.qTotal}`;
  }

  window.Vocab = { FIELDS, fieldLabel, value, isShown, hasTable, fold, selectionText, fields: Object.keys(FIELDS) };
})();
