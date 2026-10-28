// Vocabulaire La Fournée Dorée : les données Qlik restent celles de « Distribution démo », seul
// l'affichage change (même principe que le mashup Samsic).
//
//  - FIELDS : champ Qlik ou titre de dimension maître → libellé boulangerie.
//  - VALUES : valeur Qlik → libellé boulangerie, par champ. Une valeur absente garde son texte.
//
// Les sélections portent toujours sur les valeurs Qlik d'origine (qElemNumber) : rien à traduire
// dans l'autre sens, sauf pour la recherche (voir toQlik).

(function () {
  'use strict';

  const FIELDS = {
    'Catégorie': 'Gamme',
    'Sous-catégorie': 'Famille',
    'Produit': 'Produit',
    'Produit (hierarchie)': 'Gammes de produits',
    'Magasin / Produit': 'Point de vente / gamme',
    'Magasin': 'Point de vente',
    'Magasin code': 'Code point de vente',
    'Magasin comparable': 'Point de vente comparable',
    'Magasin ville': 'Ville',
    'Magasin département': 'Département',
    'Magasin département code': 'Code département',
    'Magasin pays code': 'Code pays',
    'Magasin région': 'Région',
    'Magasin canal': 'Circuit',
    'Magasin type': 'Type de client',
    'Magasin catégorie': 'Segment client',
    'Commercial': 'Commercial',
    'Année': 'Année',
    'Mois': 'Mois',
  };

  // Valeurs de « Distribution démo » (prêt-à-porter) → gammes de La Fournée Dorée.
  // Une gamme par catégorie, une famille par sous-catégorie (voir docs/reference.md, « Vocabulaire »).
  const VALUES = {
    'Catégorie': {
      'Chemise Formal': 'Brioches tranchées',
      'Jeans': 'Brioches tressées',
      'Pull / Sweat': 'Pains au lait',
      'T-Shirts / Polos': 'Viennoiseries',
      'Chemise Casual': 'Gâteaux & goûters',
      'Sous-vêtements': 'Navettes & briochettes',
      'Manteau': 'Burgers briochés',
      'Veste': 'Hot-dogs & wraps',
      'Pantalon / Chino': 'Pains de mie briochés',
    },
    'Sous-catégorie': {
      'Chemise micro-rayure': 'Brioche tranchée nature',
      'Chemise Oxford': 'Brioche tranchée pur beurre',
      'Chemise Popeline': 'Brioche tranchée sans sucres ajoutés',
      'Jean Regular': 'Tresse nature',
      'Jean Slim': 'Tresse à la crème fraîche',
      'Jean Skinny': 'Tresse pur beurre',
      'Jean Carrot Slim': 'Tresse pépites de chocolat',
      'Jean Coupe Skinny': 'Tresse au sucre perlé',
      'Pull': 'Pains au lait nature',
      'Sweat': 'Pains au lait pépites',
      'Marinière': 'Pains au lait aux œufs frais',
      'T-Shirt': 'Croissants',
      'Polo': 'Pains au chocolat',
      'Débardeur': 'Chinois à la crème',
      'Chemise unies': 'Gâche vendéenne',
      'Chemise carreaux': 'Brioche vendéenne',
      'Boxer': 'Navettes pépites de chocolat',
      'Chaussettes': 'Briochettes individuelles',
      'Imper': 'Buns burger nature',
      'Parka': 'Buns burger sésame',
      'Trench': 'Buns burger céréales',
      'Duffle-coat': 'Buns burger XXL',
      'Pardessus': 'Mini-buns apéritif',
      'Blouson': 'Pains hot-dog',
      'Doudoune': 'Pains hot-dog XL',
      'Teddy': 'Wraps briochés',
      'Blazer': 'Pains kebab briochés',
      'Pantalon': 'Pain de mie brioché nature',
      'Chino': 'Pain de mie brioché complet',
    },
    'Magasin canal': {
      'Physique': 'Grande distribution',
      'Internet': 'Drive & e-commerce',
    },
    'Magasin type': {
      'Interne': 'Intégré',
      'Franchise': 'Indépendant',
    },
    'Magasin catégorie': {
      'Interne Physique': 'GMS intégrée',
      'Interne Internet': 'Drive intégré',
      'Franchise Physique': 'GMS indépendante',
    },
  };

  const fieldLabel = (field) => FIELDS[field] || field || '';
  const value = (field, text) => {
    const table = field ? VALUES[field] : null;
    if (table && table[text]) return table[text];
    if (!field) for (const name in VALUES) if (VALUES[name][text]) return VALUES[name][text];
    return text;
  };

  // Comparaison sans casse ni accents.
  const fold = (text) => String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  // Recherche : un mot tapé qui correspond à un libellé boulangerie est remplacé par un mot de la
  // valeur Qlik d'origine, pour que la recherche du moteur la trouve.
  function toQlik(term) {
    const wanted = fold(term);
    for (const name in VALUES) {
      for (const original in VALUES[name]) {
        if (fold(VALUES[name][original]).split(/[\s'’-]+/).some((word) => word.startsWith(wanted))) return original;
      }
    }
    return term;
  }

  // Résumé d'une sélection (puces) : « Brioches », « Brioches, Pains » ou « 3 sur 12 ».
  function selectionText(selection) {
    const names = (selection.qSelectedFieldSelectionInfo || []).map((info) => value(selection.qField, info.qName));
    const count = selection.qSelectedCount || names.length;
    if (names.length && names.length === count && count <= 3) return names.join(', ');
    return `${count} sur ${selection.qTotal}`;
  }

  // Champ montré dans la page : hors de cette liste (fournisseurs…), un champ n'apparaît nulle part,
  // ses valeurs trahiraient l'origine des données.
  const isShown = (field) => Object.prototype.hasOwnProperty.call(FIELDS, field);

  window.Vocab = { FIELDS, VALUES, fieldLabel, value, fold, toQlik, selectionText, isShown };
})();
