// Vocabulaire Lahaye Global Logistics : les données Qlik restent celles de « Distribution démo », seul
// l'affichage change (même principe que La Fournée Dorée).
//
//  - FIELDS : champ Qlik ou titre de dimension maître → libellé transport.
//  - VALUES : valeur Qlik → libellé transport, par champ. Une valeur absente garde son texte.
//  - PATTERNS : valeurs numérotées (« Produit 12 » → « Référence 12 »).
//
// Les sélections portent toujours sur les valeurs Qlik d'origine (qElemNumber) : rien à traduire
// dans l'autre sens, sauf pour la recherche (voir toQlik).

(function () {
  'use strict';

  const FIELDS = {
    'Catégorie': 'Famille de prestation',
    'Sous-catégorie': 'Prestation',
    'Produit': 'Référence',
    'Produit (hierarchie)': 'Prestations',
    'Magasin / Produit': 'Agence / prestation',
    'Magasin': 'Agence',
    'Magasin code': 'Code agence',
    'Magasin comparable': 'Agence comparable',
    'Magasin ville': 'Ville',
    'Magasin département': 'Département',
    'Magasin département code': 'Code département',
    'Magasin pays code': 'Code pays',
    'Magasin région': 'Région',
    'Magasin canal': 'Canal de commande',
    'Magasin type': "Type d'agence",
    'Magasin catégorie': "Segment d'agence",
    'Commercial': "Chargé d'affaires",
    'Année': 'Année',
    'Mois': 'Mois',
  };

  // Valeurs de « Distribution démo » (prêt-à-porter) → métiers et prestations de Lahaye Global Logistics
  // (menu « Nos métiers et services » du site). Une famille par catégorie, une prestation par
  // sous-catégorie (voir docs/reference.md, « Vocabulaire »).
  const VALUES = {
    'Catégorie': {
      'Chemise Formal': 'Lot complet & demi-lot',
      'Manteau': 'Affrètement national & international',
      'Pull / Sweat': 'Transport frigorifique',
      'Chemise Casual': 'Location avec conducteur',
      'Veste': 'Lignes ferroviaires',
      'Sous-vêtements': 'Lignes fluviales',
      'Pantalon / Chino': 'Pré & post-acheminement',
      'T-Shirts / Polos': 'Logistique ambiant & frais',
      'Jeans': 'Messagerie palette',
    },
    'Sous-catégorie': {
      'Chemise micro-rayure': 'Lot complet',
      'Chemise Oxford': 'Demi-lot',
      'Chemise Popeline': 'Lot partiel',
      'Imper': 'Affrètement national',
      'Parka': 'Affrètement Europe',
      'Trench': 'Affrètement grand export',
      'Duffle-coat': 'Transport exceptionnel',
      'Pardessus': 'Affrètement urgent',
      'Pull': 'Frais (0 / +4 °C)',
      'Sweat': 'Surgelé (−20 °C)',
      'Marinière': 'Bi-température',
      'Chemise unies': 'Location courte durée',
      'Chemise carreaux': 'Location longue durée',
      'Blouson': 'Caisse mobile rail-route',
      'Doudoune': 'Conteneur ferroviaire',
      'Teddy': 'Autoroute ferroviaire',
      'Blazer': 'Wagon complet',
      'Boxer': 'Conteneur fluvial',
      'Chaussettes': 'Vrac fluvial',
      'Pantalon': 'Pré-acheminement',
      'Chino': 'Post-acheminement',
      'T-Shirt': 'Stockage ambiant',
      'Polo': 'Stockage frais',
      'Débardeur': 'Préparation de commandes',
      'Jean Regular': 'Palette standard',
      'Jean Slim': 'Demi-palette',
      'Jean Skinny': 'Palette hors normes',
      'Jean Carrot Slim': 'Messagerie express J+1',
      'Jean Coupe Skinny': 'Collecte de supports bois',
    },
    'Magasin canal': {
      'Physique': 'En agence',
      'Internet': 'Portail client',
    },
    'Magasin type': {
      'Interne': 'Agence en propre',
      'Franchise': 'Agence partenaire',
    },
    'Magasin catégorie': {
      'Interne Physique': 'En propre · agence',
      'Interne Internet': 'En propre · portail',
      'Franchise Physique': 'Partenaire · agence',
    },
  };

  // Valeurs numérotées : [motif Qlik, remplacement affiché, motif tapé, remplacement Qlik].
  const PATTERNS = [
    [/^Produit (\d+)$/, 'Référence $1', /^r[ée]f(?:[ée]rence)?$/i, 'Produit'],
  ];

  const fieldLabel = (field) => FIELDS[field] || field || '';
  const value = (field, text) => {
    const table = field ? VALUES[field] : null;
    if (table && table[text]) return table[text];
    if (!field) for (const name in VALUES) if (VALUES[name][text]) return VALUES[name][text];
    for (const [from, to] of PATTERNS) if (from.test(text)) return String(text).replace(from, to);
    return text;
  };

  // Comparaison sans casse ni accents.
  const fold = (text) => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  // Recherche : un mot tapé qui correspond à un libellé transport est remplacé par un mot de la
  // valeur Qlik d'origine, pour que la recherche du moteur la trouve.
  function toQlik(term) {
    for (const [, , typed, original] of PATTERNS) if (typed.test(term)) return original;
    const wanted = fold(term);
    for (const name in VALUES) {
      for (const original in VALUES[name]) {
        if (fold(VALUES[name][original]).split(/[\s'’&·()\/-]+/).some((word) => word && word.startsWith(wanted))) return original;
      }
    }
    return term;
  }

  // Résumé d'une sélection (puces) : « Lot complet », « Lot complet, Demi-lot » ou « 3 sur 12 ».
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
