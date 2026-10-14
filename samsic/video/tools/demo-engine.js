// Moteur de démonstration : imite le moteur Qlik (sélections, états, descente de niveau, historique)
// avec des DONNÉES FICTIVES, pour tourner la vidéo sans authentification.
// Il ne prouve rien sur Qlik lui-même : il reproduit seulement ce que la page lui demande.
// Chargé à la place de js/qlik-loader.js, après js/qlik.js (il remplace Q.getDoc).

(function () {
  'use strict';

  const C = window.APP_CONFIG;
  const M = Object.fromEntries(Object.entries(C.measures).map(([k, v]) => [v, k]));

  // ---- Données fictives -------------------------------------------------------------------
  const TREE = {   // métier → prestations (CA N en millions d'euros)
    'Propreté': { 'Nettoyage de bureaux': 8.2, 'Bionettoyage hospitalier': 3.4, 'Propreté industrielle': 4.6, 'Propreté des transports': 2.3, 'Vitrerie': 2.1, 'Remise en état': 1.6 },
    'Sécurité': { 'Surveillance humaine': 5.2, 'Sécurité incendie': 2.4, 'Sûreté aéroportuaire': 1.9, 'Télésurveillance': 1.8 },
    'Facility management': { 'Multiservices': 3.0, 'Gestion de site': 2.4, 'Services aux occupants': 1.5 },
    'Accueil': { 'Accueil en entreprise': 3.1, 'Standard téléphonique': 1.4, 'Accueil événementiel': 1.2 },
    'Maintenance technique': { 'Maintenance multitechnique': 2.6, 'CVC': 1.4, 'Électricité': 1.1 },
    'Services aéroportuaires': { 'Assistance en escale': 2.0, 'Assistance PMR': 1.5 },
    'Ressources humaines': { 'Intérim': 1.6, 'Recrutement': 0.9 },
  };
  const GEO = [   // ville, département, région, poids
    ['Paris', 'Paris', 'Île-de-France', 16], ['Nanterre', 'Hauts-de-Seine', 'Île-de-France', 7], ['Créteil', 'Val-de-Marne', 'Île-de-France', 4],
    ['Lyon', 'Rhône', 'Auvergne-Rhône-Alpes', 8], ['Grenoble', 'Isère', 'Auvergne-Rhône-Alpes', 3], ['Clermont-Ferrand', 'Puy-de-Dôme', 'Auvergne-Rhône-Alpes', 2],
    ['Rennes', 'Ille-et-Vilaine', 'Bretagne', 6], ['Brest', 'Finistère', 'Bretagne', 3], ['Vannes', 'Morbihan', 'Bretagne', 2],
    ['Lille', 'Nord', 'Hauts-de-France', 6], ['Amiens', 'Somme', 'Hauts-de-France', 2],
    ['Marseille', 'Bouches-du-Rhône', 'Provence-Alpes-Côte d’Azur', 5], ['Nice', 'Alpes-Maritimes', 'Provence-Alpes-Côte d’Azur', 3],
    ['Toulouse', 'Haute-Garonne', 'Occitanie', 5], ['Montpellier', 'Hérault', 'Occitanie', 3],
    ['Bordeaux', 'Gironde', 'Nouvelle-Aquitaine', 5], ['Poitiers', 'Vienne', 'Nouvelle-Aquitaine', 1.5],
    ['Nantes', 'Loire-Atlantique', 'Pays de la Loire', 5], ['Angers', 'Maine-et-Loire', 'Pays de la Loire', 2],
    ['Strasbourg', 'Bas-Rhin', 'Grand Est', 4], ['Metz', 'Moselle', 'Grand Est', 2],
  ];
  const SECTEURS = { 'Tertiaire': 38, 'Industrie': 24, 'Santé': 14, 'Commerce et distribution': 12, 'Transport et logistique': 12 };
  const TYPES = { 'Grand compte': 45, 'ETI': 27, 'PME': 16, 'Secteur public': 12 };
  const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const SEASON = [8.4, 8.0, 8.7, 8.3, 8.2, 8.6, 7.6, 6.4, 8.9, 9.1, 8.8, 9.0];
  const YEARS = ['2024', '2025', '2026'];

  const hash = (t) => Array.from(String(t)).reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
  const rnd = (t) => { const x = Math.sin(hash(t) * 9301 + 49297) * 233280; return x - Math.floor(x); };
  const growth = (p) => -0.03 + 0.17 * rnd(p + 'g');          // évolution N / N-1 par prestation
  const rate = (p) => 0.07 + 0.11 * rnd(p + 'r');             // taux de marge N
  const ratePrev = (p) => rate(p) - 0.012 + 0.03 * rnd(p + 'q');
  const monthGrowth = (i) => -0.03 + 0.12 * rnd('m' + i);

  const PREST = [];
  Object.entries(TREE).forEach(([m, ps]) => Object.entries(ps).forEach(([p, v]) => PREST.push({ m, p, v: v * 1e6 })));

  const FIELDS = {
    'Catégorie': Object.keys(TREE),
    'Sous-catégorie': PREST.map((x) => x.p),
    'Magasin région': [...new Set(GEO.map((g) => g[2]))],
    'Magasin département': GEO.map((g) => g[1]),
    'Magasin ville': GEO.map((g) => g[0]),
    'Magasin canal': Object.keys(SECTEURS),
    'Magasin type': Object.keys(TYPES),
    'Année': YEARS,
    'Mois': MONTHS,
  };
  const LIB = {
    [C.dimensions.month]: 'Mois', [C.dimensions.year]: 'Année', [C.dimensions.region]: 'Magasin région',
    [C.dimensions.channel]: 'Magasin canal', [C.dimensions.storeType]: 'Magasin type',
  };

  // ---- Sélections et historique ------------------------------------------------------------
  let sel = {};                            // champ → Set de valeurs
  const past = [];
  const future = [];
  const listeners = new Set();
  const snapshot = () => Object.fromEntries(Object.entries(sel).map(([f, s]) => [f, [...s]]));
  const restore = (snap) => { sel = Object.fromEntries(Object.entries(snap).map(([f, a]) => [f, new Set(a)])); };
  const fire = () => setTimeout(() => listeners.forEach((fn) => fn()), 30);
  function change(mutate) {
    past.push(snapshot());
    future.length = 0;
    mutate();
    Object.keys(sel).forEach((f) => { if (!sel[f].size) delete sel[f]; });
    fire();
  }
  const has = (f) => sel[f] && sel[f].size > 0;
  const ok = (f, v, except) => f === except || !has(f) || sel[f].has(v);

  // Compatibilité d'une valeur avec les sélections des AUTRES champs (associativité).
  function compatible(field, value) {
    if (field === 'Catégorie') return PREST.some((x) => x.m === value && ok('Sous-catégorie', x.p));
    if (field === 'Sous-catégorie') { const m = PREST.find((x) => x.p === value).m; return ok('Catégorie', m); }
    const col = { 'Magasin ville': 0, 'Magasin département': 1, 'Magasin région': 2 }[field];
    if (col !== undefined) {
      return GEO.some((g) => g[col] === value
        && ok('Magasin ville', g[0], field) && ok('Magasin département', g[1], field) && ok('Magasin région', g[2], field));
    }
    return true;
  }
  const possible = (f, v) => compatible(f, v) && (!has(f) || sel[f].has(v));
  function state(f, v) {
    if (has(f) && sel[f].has(v)) return 'S';
    if (!compatible(f, v)) return 'X';
    return has(f) ? 'A' : 'O';
  }

  // ---- Mesures --------------------------------------------------------------------------------
  const share = (table, f) => {
    const all = Object.values(table).reduce((a, b) => a + b, 0);
    return Object.entries(table).filter(([k]) => ok(f, k)).reduce((a, [, w]) => a + w, 0) / all;
  };
  function geoShare() {
    const all = GEO.reduce((a, g) => a + g[3], 0);
    return GEO.filter((g) => ok('Magasin ville', g[0]) && ok('Magasin département', g[1]) && ok('Magasin région', g[2]))
      .reduce((a, g) => a + g[3], 0) / all;
  }
  function monthShare(only) {
    const all = SEASON.reduce((a, b) => a + b, 0);
    return MONTHS.reduce((a, m, i) => a + ((only ? m === only : ok('Mois', m)) ? SEASON[i] : 0), 0) / all;
  }
  const yearFactor = () => (has('Année') ? Math.max(...[...sel['Année']].map((y) => ({ 2024: 0.82, 2025: 0.91, 2026: 1 })[y])) : 1);

  // Agrégat sur un filtre de prestations (et éventuellement un seul mois).
  function totals(filter, month) {
    const k = geoShare() * share(SECTEURS, 'Magasin canal') * share(TYPES, 'Magasin type') * monthShare(month) * yearFactor();
    const mi = MONTHS.indexOf(month);
    const mg = month ? monthGrowth(mi) : 0;
    // Le taux de marge varie un peu d'un mois à l'autre (sinon les courbes mensuelles sont plates).
    const mr = month ? 1 + 0.12 * (rnd('mr' + mi) - 0.5) : 1;
    const mrPrev = month ? 1 + 0.12 * (rnd('mp' + mi) - 0.5) : 1;
    let ca = 0; let caPrev = 0; let margin = 0; let marginPrev = 0;
    PREST.filter((x) => ok('Catégorie', x.m) && ok('Sous-catégorie', x.p) && filter(x)).forEach((x) => {
      const n = x.v * k;
      const p = n / (1 + growth(x.p) + mg);
      ca += n; caPrev += p; margin += n * rate(x.p) * mr; marginPrev += p * ratePrev(x.p) * mrPrev;
    });
    const r = ca ? margin / ca : null;
    const rp = caPrev ? marginPrev / caPrev : null;
    return {
      ca, caPrev, caDelta: ca - caPrev, caDeltaPct: caPrev ? ca / caPrev - 1 : null,
      margin, marginPrev, marginDeltaPct: marginPrev ? margin / marginPrev - 1 : null,
      rate: r, ratePrev: rp, rateDeltaPts: r != null && rp != null ? (r - rp) * 100 : null,
    };
  }
  const cell = (v) => ({ qNum: v == null ? NaN : v, qText: v == null ? '-' : String(v) });

  // ---- Objets ---------------------------------------------------------------------------------
  function fold(t) { return String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  // byState : tri par état comme qSortByState (sélectionnées, puis possibles, puis exclues).
  const RANK = { S: 0, O: 1, A: 1, X: 2 };
  function listLayout(field, search, byState) {
    const values = FIELDS[field] || [];
    let rows = values.map((v, i) => ({ v, i }));
    if (search) rows = rows.filter((r) => fold(r.v).includes(fold(search)));
    if (byState) rows.sort((a, b) => RANK[state(field, a.v)] - RANK[state(field, b.v)] || a.i - b.i);
    return {
      qListObject: {
        qDimensionInfo: { qCardinal: values.length, qStateCounts: { qSelected: has(field) ? sel[field].size : 0 } },
        qDataPages: [{ qMatrix: rows.map((r) => [{ qText: r.v, qElemNumber: r.i, qState: state(field, r.v) }]) }],
      },
    };
  }

  function cubeLayout(def) {
    const ms = def.qMeasures.map((m) => M[m.qLibraryId]);
    const grand = totals(() => true);
    const qGrandTotalRow = ms.map((k) => cell(grand[k]));
    if (!def.qDimensions.length) return { qHyperCube: { qGrandTotalRow, qDimensionInfo: [], qDataPages: [{ qMatrix: [] }] } };

    const dim = def.qDimensions[0];
    const height = def.qInitialDataFetch[0].qHeight;
    if (dim.qLibraryId === C.dimensions.month) {
      const rows = MONTHS.filter((m) => ok('Mois', m)).map((m) => {
        const t = totals(() => true, m);
        return [{ qText: m, qElemNumber: MONTHS.indexOf(m), qState: state('Mois', m) }, ...ms.map((k) => cell(t[k]))];
      });
      return { qHyperCube: { qGrandTotalRow, qDimensionInfo: [{}], qDataPages: [{ qMatrix: rows }] } };
    }

    // Groupe de descente Métier → Prestation : on descend quand un seul métier est possible.
    const fields = dim.qDef.qFieldDefs;
    const metiers = FIELDS['Catégorie'].filter((m) => possible('Catégorie', m));
    const pos = metiers.length === 1 ? 1 : 0;
    const field = fields[pos];
    let rows = FIELDS[field].filter((v) => possible(field, v)).map((v) => {
      const t = totals((x) => (pos === 0 ? x.m === v : x.p === v));
      return { v, t };
    }).filter((r) => r.t.ca > 0);
    rows.sort((a, b) => b.t.ca - a.t.ca);
    rows = rows.slice(0, height);
    return {
      qHyperCube: {
        qGrandTotalRow,
        qDimensionInfo: [{ qGroupPos: pos, qGroupFieldDefs: fields }],
        qDataPages: [{ qMatrix: rows.map((r) => [{ qText: r.v, qElemNumber: FIELDS[field].indexOf(r.v), qState: state(field, r.v) }, ...ms.map((k) => cell(r.t[k]))]) }],
      },
    };
  }

  function selectionLayout() {
    return {
      qSelectionObject: {
        qBackCount: past.length,
        qForwardCount: future.length,
        qSelections: Object.keys(FIELDS).filter(has).map((f) => ({
          qField: f,
          qSelectedCount: sel[f].size,
          qTotal: FIELDS[f].length,
          qSelectedFieldSelectionInfo: FIELDS[f].filter((v) => sel[f].has(v)).map((v) => ({ qName: v })),
        })),
      },
    };
  }

  function pick(field, elems, toggle) {
    change(() => {
      const values = elems.map((i) => FIELDS[field][i]);
      if (!toggle) sel[field] = new Set(values);
      else {
        sel[field] = sel[field] || new Set();
        values.forEach((v) => (sel[field].has(v) ? sel[field].delete(v) : sel[field].add(v)));
      }
    });
    return Promise.resolve(true);
  }

  let ids = 0;
  const doc = {
    createSessionObject(props) {
      let search = '';
      const self = { id: 'demo-' + (++ids) };
      const fieldOf = () => {
        const def = props.qListObjectDef;
        return def.qLibraryId ? LIB[def.qLibraryId] : def.qDef.qFieldDefs[0];
      };
      const fns = new Set();
      Object.assign(self, {
        on(event, fn) { if (event === 'changed') { fns.add(fn); listeners.add(fn); } },
        getLayout() {
          if (props.qSelectionObjectDef) return Promise.resolve(selectionLayout());
          if (props.qListObjectDef) {
            const sort = ((props.qListObjectDef.qDef || {}).qSortCriterias || [])[0] || {};
            return Promise.resolve(listLayout(fieldOf(), search, !!sort.qSortByState));
          }
          return Promise.resolve(cubeLayout(props.qHyperCubeDef));
        },
        selectListObjectValues(path, elems, toggle) { return pick(fieldOf(), elems, toggle); },
        selectHyperCubeValues(path, d, elems, toggle) {
          const dim = props.qHyperCubeDef.qDimensions[d];
          let field;
          if (dim.qLibraryId) field = LIB[dim.qLibraryId];
          else field = FIELDS['Catégorie'].filter((m) => possible('Catégorie', m)).length === 1 ? 'Sous-catégorie' : 'Catégorie';
          return pick(field, elems, toggle);
        },
        searchListObjectFor(path, text) { search = text; fns.forEach((fn) => fn()); return Promise.resolve(true); },
        abortListObjectSearch() { search = ''; fns.forEach((fn) => fn()); return Promise.resolve(); },
        _destroy() { fns.forEach((fn) => listeners.delete(fn)); },
      });
      doc._objects.set(self.id, self);
      return Promise.resolve(self);
    },
    _objects: new Map(),
    destroySessionObject(id) { const o = doc._objects.get(id); if (o) o._destroy(); doc._objects.delete(id); return Promise.resolve(); },
    getField(name) {
      return Promise.resolve({ clear() { if (has(name)) change(() => { delete sel[name]; }); return Promise.resolve(true); } });
    },
    back() { if (past.length) { future.push(snapshot()); restore(past.pop()); fire(); } return Promise.resolve(); },
    forward() { if (future.length) { past.push(snapshot()); restore(future.pop()); fire(); } return Promise.resolve(); },
    clearAll() { if (Object.keys(sel).length) change(() => { sel = {}; }); return Promise.resolve(); },
  };

  window.Q.getDoc = () => Promise.resolve(doc);
  window.__demo = { doc, select: (f, values) => change(() => { sel[f] = new Set(values); }) };
})();
