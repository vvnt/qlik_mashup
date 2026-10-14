// Samsic × Qlik Cloud : version cinéma. Une seule scène pour les deux formats (window.FMT).
// Tout ce qui est 3D, mécanique ou particulaire se calcule à partir du seul temps t (update(t),
// piloté par une horloge de la timeline) : le rendu reste identique quel que soit l'ordre des images.
// Textes, curseur et captures sont animés par GSAP. Repères : assets/cues.js.
(function () {
  const F = window.FMT, W = F.w, H = F.h, V = F.v, C = window.CUE;
  const world = document.getElementById("world");

  // ---- Outils ---------------------------------------------------------------------------------------
  function rng(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, u) => a + (b - a) * u;
  const easeCache = {};
  const ease = (name) => easeCache[name] || (easeCache[name] = gsap.parseEase(name));
  // Piste d'images clés : [[t, valeur, ease vers cette clé], ...]
  function track(keys) {
    return (t) => {
      if (t <= keys[0][0]) return keys[0][1];
      for (let i = 1; i < keys.length; i++) {
        const [t1, v1, e] = keys[i];
        if (t <= t1) {
          const [t0, v0] = keys[i - 1];
          const u = t1 > t0 ? (t - t0) / (t1 - t0) : 1;
          return v0 + (v1 - v0) * (e ? ease(e)(u) : u);
        }
      }
      return keys[keys.length - 1][1];
    };
  }
  // Piste de poses : chaque propriété devient une piste.
  function poseTrack(keys) {
    const props = Object.keys(keys[0][1]);
    const tr = {};
    props.forEach((p) => (tr[p] = track(keys.map(([t, pose, e]) => [t, pose[p], e]))));
    return (t) => { const o = {}; props.forEach((p) => (o[p] = tr[p](t))); return o; };
  }
  const $ = (id) => document.getElementById(id);
  const tl = gsap.timeline({ paused: true });

  // ---- Données de mise en scène ------------------------------------------------------------------
  const ZM = V ? 1.7 : 1.6; // étalement en profondeur de la vue éclatée
  const SHOTS = ["sel-0", "sel-1", "sel-2", "chip-open", "chip-add-1", "chip-add-2", "chip-done", "search-0", "search-1", "search-2", "search-3", "search-done"];
  // Plaques découpées dans la dernière capture (coordonnées CSS 1440 × 900) et leur hauteur dans la pile.
  const PLATES = [
    { id: "p-nav", x: 0, y: 0, w: 1440, h: 90, z: 330, d: 0.0 },
    { id: "p-band", x: 0, y: 90, w: 1440, h: 115, z: 250, d: 0.06 },
    { id: "p-c1", x: 151, y: 205, w: 555, h: 335, z: 175, d: 0.12 },
    { id: "p-c2", x: 734, y: 205, w: 555, h: 335, z: 195, d: 0.16 },
    { id: "p-c3", x: 151, y: 561, w: 555, h: 339, z: 120, d: 0.2 },
    { id: "p-c4", x: 734, y: 561, w: 555, h: 339, z: 140, d: 0.24 },
  ];
  // Mouvement : rouages (dents, rayon extérieur, rayon de pied, centre), balancier, platine.
  const GEARS = [
    { id: "g1", n: 48, ro: 250, ri: 228, cx: 520, cy: 470, z: -300, k: 1 },
    { id: "g4", n: 12, ro: 64, ri: 50, cx: 520, cy: 470, z: -360, k: 1 },
    { id: "g2", n: 24, ro: 128, ri: 108, cx: 855, cy: 348, z: -330, k: -2 },
    { id: "g3", n: 16, ro: 88, ri: 70, cx: 1006, cy: 475, z: -280, k: 3 },
  ];
  const BAL = { cx: 1150, cy: 690, r: 120, z: -250 };
  const MECH = [{ id: "glass", z: -170 }, ...GEARS.map((g) => ({ id: g.id, z: g.z })), { id: "bal", z: BAL.z }, { id: "base", z: -460 }];
  const Z_FRONT = 330, Z_BACK = -460;
  const MZ = 1.6; // le mouvement recule plus loin que les plaques : il se détache derrière la pile

  // ---- Construction du décor ----------------------------------------------------------------------
  const svgNS = "http://www.w3.org/2000/svg";
  const fmt = (n) => Math.round(n * 100) / 100;
  function gearD(g) {
    const st = (2 * Math.PI) / g.n;
    const pts = [];
    for (let i = 0; i < g.n; i++) {
      const a = i * st;
      [[g.ri, a], [g.ro, a + st * 0.16], [g.ro, a + st * 0.42], [g.ri, a + st * 0.58]].forEach(([r, b]) => pts.push([g.cx + r * Math.cos(b), g.cy + r * Math.sin(b)]));
    }
    const hub = g.ri * 0.22;
    return "M" + pts.map((p) => fmt(p[0]) + " " + fmt(p[1])).join("L") + "Z" +
      `M${fmt(g.cx + hub)} ${g.cy}a${fmt(hub)} ${fmt(hub)} 0 1 0 ${fmt(-2 * hub)} 0a${fmt(hub)} ${fmt(hub)} 0 1 0 ${fmt(2 * hub)} 0Z`;
  }
  function gearSVG(g) {
    const rim = g.ri - Math.max(10, g.ri * 0.12);
    const spokes = g.n >= 20 ? 5 : 0;
    let s = `<path d="${gearD(g)}" fill="rgba(0,129,188,0.24)" fill-rule="evenodd" stroke="#5cc0ee" stroke-width="3.5"/>`;
    if (spokes) {
      s += `<circle cx="${g.cx}" cy="${g.cy}" r="${fmt(rim)}" fill="none" stroke="#5cc0ee" stroke-opacity="0.7" stroke-width="2"/>`;
      for (let i = 0; i < spokes; i++) {
        const a = (i * 2 * Math.PI) / spokes;
        s += `<line x1="${fmt(g.cx + g.ri * 0.24 * Math.cos(a))}" y1="${fmt(g.cy + g.ri * 0.24 * Math.sin(a))}" x2="${fmt(g.cx + rim * Math.cos(a))}" y2="${fmt(g.cy + rim * Math.sin(a))}" stroke="#5cc0ee" stroke-width="7" stroke-opacity="0.55"/>`;
      }
    }
    s += `<circle cx="${g.cx}" cy="${g.cy}" r="7" fill="#d9f2ff"/>`;
    return `<svg width="1440" height="900" viewBox="0 0 1440 900"><g id="${g.id}-rot" class="gear">${s}</g></svg>`;
  }
  function balanceSVG() {
    const { cx, cy, r } = BAL;
    let spiral = "";
    for (let i = 0; i <= 160; i++) {
      const a = i * 0.25, rr = 10 + i * 0.42;
      spiral += (i ? "L" : "M") + fmt(cx + rr * Math.cos(a)) + " " + fmt(cy + rr * Math.sin(a));
    }
    let s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#5cc0ee" stroke-width="7"/>`;
    s += `<circle cx="${cx}" cy="${cy}" r="${r + 10}" fill="none" stroke="#5cc0ee" stroke-opacity="0.4" stroke-width="2" stroke-dasharray="4 10"/>`;
    for (let i = 0; i < 3; i++) {
      const a = (i * 2 * Math.PI) / 3;
      s += `<line x1="${cx}" y1="${cy}" x2="${fmt(cx + r * Math.cos(a))}" y2="${fmt(cy + r * Math.sin(a))}" stroke="#5cc0ee" stroke-width="5"/>`;
    }
    s += `<path d="${spiral}" fill="none" stroke="#d9f2ff" stroke-opacity="0.7" stroke-width="1.5"/><circle cx="${cx}" cy="${cy}" r="9" fill="#d9f2ff"/>`;
    return `<svg width="1440" height="900" viewBox="0 0 1440 900"><g id="bal-rot" class="gear">${s}</g></svg>`;
  }
  function baseSVG() {
    const r = rng(11);
    let s = `<defs><pattern id="geneva" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)"><rect width="13" height="26" fill="rgba(255,255,255,0.035)"/></pattern></defs>`;
    s += `<rect x="0" y="0" width="1440" height="900" rx="22" fill="rgba(5,18,33,0.94)" stroke="rgba(92,192,238,0.6)" stroke-width="2.5"/>`;
    s += `<rect x="0" y="0" width="1440" height="900" rx="22" fill="url(#geneva)"/>`;
    for (let i = 0; i < 46; i++) {
      let x = 40 + Math.floor(r() * 34) * 40, y = 40 + Math.floor(r() * 21) * 40, d = `M${x} ${y}`;
      for (let k = 0; k < 4; k++) {
        if (r() < 0.5) x = clamp(x + (r() < 0.5 ? -1 : 1) * 40 * (1 + Math.floor(r() * 4)), 30, 1410);
        else y = clamp(y + (r() < 0.5 ? -1 : 1) * 40 * (1 + Math.floor(r() * 3)), 30, 870);
        d += `L${x} ${y}`;
      }
      s += `<path d="${d}" fill="none" stroke="rgba(92,192,238,0.28)" stroke-width="2"/><circle cx="${x}" cy="${y}" r="4" fill="rgba(92,192,238,0.6)"/>`;
    }
    [...GEARS, BAL].forEach((g) => (s += `<circle cx="${g.cx}" cy="${g.cy}" r="14" fill="#0081bc" stroke="#d9f2ff" stroke-width="2"/>`));
    [[40, 40], [1400, 40], [40, 860], [1400, 860]].forEach(([x, y]) => (s += `<circle cx="${x}" cy="${y}" r="12" fill="none" stroke="#5cc0ee" stroke-width="3"/><line x1="${x - 8}" y1="${y}" x2="${x + 8}" y2="${y}" stroke="#5cc0ee" stroke-width="3"/>`));
    return `<svg width="1440" height="900" viewBox="0 0 1440 900">${s}</svg>`;
  }
  function glassSVG() {
    let s = "";
    PLATES.forEach((p) => {
      s += `<rect x="${p.x + 6}" y="${p.y + 6}" width="${p.w - 12}" height="${p.h - 12}" fill="rgba(0,129,188,0.06)" stroke="rgba(92,192,238,0.75)" stroke-width="2" stroke-dasharray="10 8"/>`;
      [[p.x + 6, p.y + 6], [p.x + p.w - 6, p.y + 6], [p.x + 6, p.y + p.h - 6], [p.x + p.w - 6, p.y + p.h - 6]].forEach(([x, y]) => (s += `<circle cx="${x}" cy="${y}" r="5" fill="#d9f2ff"/>`));
    });
    return `<svg width="1440" height="900" viewBox="0 0 1440 900">${s}</svg>`;
  }

  const shots = SHOTS.map((n) => `<img id="s-${n}" class="shot" src="assets/captures/${n}.jpg" alt="" />`).join("");
  const plates = PLATES.map((p) => `<div id="${p.id}" class="plate" style="left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px;background-position:${-p.x}px ${-p.y}px"><i class="wave"></i>${p.id === "p-nav" ? '<i id="a-ui" class="anchor" style="left:1180px;top:45px"></i>' : ""}</div>`).join("");
  const mech = MECH.map((m) => {
    const g = GEARS.find((x) => x.id === m.id);
    const inner = g ? gearSVG(g) : m.id === "bal" ? balanceSVG() : m.id === "base" ? baseSVG() : glassSVG();
    const anchor = m.id === "g2" ? `<i id="a-eng" class="anchor" style="left:${GEARS[2].cx}px;top:${GEARS[2].cy}px"></i>` : "";
    return `<div id="m-${m.id}" class="l3 mech">${inner}${anchor}</div>`;
  }).reverse().join("");
  const RODS = [[0, 0], [1440, 0], [0, 900], [1440, 900]];
  const rods = RODS.map(([x, y], i) => `<i id="rod-${i}" class="rod" style="left:${x}px;top:${y}px;width:${(Z_FRONT - Z_BACK * MZ) * ZM}px"></i>`).join("");

  const titleLines = V ? ["Pilotage", "de", "l'activité"] : ["Pilotage", "de l'activité"];
  const chars = (line) => [...line].map((c) => `<span class="ch">${c === " " ? "&nbsp;" : c}</span>`).join("");
  const titleHTML = titleLines.map((l) => `<div>${chars(l)}</div>`).join("");

  const CAPS = [
    ["cap-a", "01", "Associativité", ["Un clic,", "toute la page", "<em>se recalcule</em>"]],
    ["cap-b", "02", "Hiérarchie", ["Le fil", "d'Ariane", "<em>se construit</em>"]],
    ["cap-c", "03", "Sélections", ["Modifier", "<em>en place</em>"]],
    ["cap-d", "04", "Recherche", ["Toutes les", "dimensions,", "<em>en toutes lettres</em>"]],
  ];
  const caps = CAPS.map(([id, n, eye, lines]) => `<div id="${id}" class="cap"><p class="eyebrow"><b>${n}</b>${eye}</p>${lines.map((l) => `<div class="cap__line"><span>${l}</span></div>`).join("")}</div>`).join("");

  const heroLines = V ? ["Vos données,", "à la vitesse", "de vos questions"] : ["Vos données, à la vitesse de vos questions"];
  const heroHTML = heroLines.map((l) => `<div>${l.split(" ").map((w) => `<span class="w">${w}</span>`).join(" ")}</div>`).join("");

  world.innerHTML = `
    <div id="bg" class="full"></div>
    <div id="beams" class="abs"></div>
    <div id="floorbox"><div id="floor"></div></div>
    <div id="hookline" class="abs"></div>
    <div id="kpi" class="abs"></div>
    <div id="scene3d">
      <div id="rig">
        ${mech}
        ${rods}
        <div id="reflect" class="l3"></div>
        <div id="screen" class="l3">
          <div id="cam">${shots}<div id="ripple"></div>
            <svg id="cursor" viewBox="0 0 24 24"><path d="M3 2l17 9.5-7.4 1.6L9.3 21z" fill="#fff" stroke="#0b2239" stroke-width="1.4" stroke-linejoin="round"/></svg>
          </div>
          <div id="scanfx"></div>
        </div>
        ${plates}
      </div>
    </div>
    <canvas id="fx" width="${W}" height="${H}"></canvas>
    <div id="title" class="abs"><div class="title__lines">${titleHTML}<div class="title__sheen" aria-hidden="true" data-layout-ignore>${titleHTML}</div></div>
      <p id="subtitle"><i></i>Mashup Qlik Cloud · Samsic<i></i></p></div>
    ${caps}
    <p id="under" class="abs eyebrow">Sous le capot</p>
    <svg id="leaders" width="${W}" height="${H}"><path id="ld-ui"/><path id="ld-eng"/><circle id="dot-ui" r="7"/><circle id="dot-eng" r="7"/></svg>
    <div id="lab-ui" class="lab"><p class="lab__t">Interface</p></div>
    <div id="lab-eng" class="lab"><p class="lab__t">Moteur associatif</p></div>
    <div id="hero" class="abs"><div class="hero__title">${heroHTML}</div><p class="hero__powered">Propulsé par <b>Qlik Cloud</b></p></div>
    <div id="logos"><img class="samsic" src="assets/images/logo.png" alt="Samsic" /><i></i><img class="excelcio" src="assets/images/excelcio-light.svg" alt="Excelcio" /></div>
    <p id="tag" class="abs fictive">Maquette · données fictives</p>
    <p id="endtag" class="abs fictive">Maquette · données fictives</p>
    <div data-layout-ignore id="gl" class="full">${"<i></i>".repeat(12)}</div>
    <div data-layout-ignore id="flare" class="abs"></div>
    <div data-layout-ignore id="flash" class="full"></div>
    <div data-layout-ignore id="grain" class="abs"></div>
    <div data-layout-ignore id="black" class="full"></div>`;

  // Positions propres au format.
  const LAB = V ? { ui: [76, 300], eng: [76, 1600], engRight: false } : { ui: [96, 250], eng: [W - 96, 860], engRight: true };
  gsap.set("#lab-ui", { left: LAB.ui[0], top: LAB.ui[1] });
  if (LAB.engRight) gsap.set("#lab-eng", { right: W - LAB.eng[0], top: LAB.eng[1] });
  else gsap.set("#lab-eng", { left: LAB.eng[0], top: LAB.eng[1] });

  // Chiffre clé de l'accroche : recadrage de la capture d'accueil (57,2 M€, x 190–520, y 468–640).
  const K = V ? 2.9 : 3.2, KW = 330 * K, KH = 172 * K;
  const KPI = { cx: W / 2, cy: H / 2, w: KW, h: KH };
  gsap.set("#kpi", { width: KW, height: KH, marginLeft: -KW / 2, marginTop: -KH / 2, backgroundSize: `${1440 * K}px ${900 * K}px`, backgroundPosition: `${-190 * K}px ${-468 * K}px` });
  // Zone d'arrivée des particules : le titre.
  const TBOX = V ? { cx: 540, cy: 820, w: 820, h: 520 } : { cx: 960, cy: 446, w: 1300, h: 360 };

  // ---- Poses de la caméra (le « rig » porte l'écran, les plaques et le mouvement) ---------------
  const P = V
    ? {
        in: { x: 0, y: 520, s: 0.3, rx: 62, ry: 0, rz: -12 },
        demo: { x: 0, y: 160, s: 0.7, rx: 7, ry: 0, rz: 0 },
        demo2: { x: 0, y: 150, s: 0.71, rx: 4, ry: -4, rz: 0 },
        exA: { x: 30, y: 60, s: 0.46, rx: 60, ry: 0, rz: -24 },
        exB: { x: 10, y: 40, s: 0.49, rx: 54, ry: 0, rz: -8 },
        heroA: { x: 0, y: -310, s: 0.68, rx: 12, ry: 0, rz: 0 },
        heroB: { x: 0, y: -320, s: 0.7, rx: 9, ry: 0, rz: 0 },
      }
    : {
        in: { x: 620, y: 220, s: 0.34, rx: 50, ry: -42, rz: -8 },
        demo: { x: 290, y: 10, s: 0.78, rx: 4, ry: -14, rz: 0 },
        demo2: { x: 290, y: 6, s: 0.79, rx: 3, ry: -10, rz: 0 },
        exA: { x: 20, y: 10, s: 0.42, rx: 22, ry: -56, rz: -4 },
        exB: { x: 10, y: 0, s: 0.45, rx: 16, ry: -36, rz: -2 },
        heroA: { x: 0, y: -150, s: 0.56, rx: 12, ry: 0, rz: 0 },
        heroB: { x: 0, y: -158, s: 0.58, rx: 9, ry: 0, rz: 0 },
      };
  const pose = poseTrack([
    [0, P.in],
    [C.screenIn, P.in],
    [C.screenIn + 0.9, P.demo, "power3.out"],
    [C.explode, P.demo2, "sine.inOut"],
    [C.split + 0.6, P.exA, "power3.inOut"],
    [C.recompose, P.exB, "sine.inOut"],
    [C.land, P.heroA, "power3.inOut"],
    [C.end, P.heroB, "sine.inOut"],
  ]);
  const screenOp = track([[C.screenIn, 0], [C.screenIn + 0.35, 1], [C.split, 1], [C.split + 1.2, 0.1, "power2.inOut"], [C.recompose, 0.1], [C.land - 0.1, 1, "power2.inOut"]]);
  const explode = track([[C.split, 0], [C.split + 1.8, 1, "power3.inOut"], [C.recompose, 1], [C.land, 0, "power3.inOut"]]);
  const squash = track([[C.drop - 0.5, 1], [C.drop, 0.82, "power2.in"], [C.drop + 0.25, 1.35, "expo.out"], [C.drop + 1.6, 1, "power2.inOut"]]);
  const mechOp = track([[C.split + 0.3, 0], [C.split + 1.5, 1, "power2.out"], [C.recompose + 0.2, 1], [C.land - 0.15, 0, "power2.in"]]);
  // Phase des rouages (tours) : lente, puis emballement sur le drop.
  const phase = track([[C.split, 0], [C.drop, 0.9], [C.drop + 1.4, 3.6, "power2.out"], [C.land, 4.6, "power1.out"]]);
  const reflectOp = track([[C.land, 0], [C.land + 0.9, 1, "power2.out"]]);
  const beamsOp = track([[C.land - 0.4, 0], [C.land + 0.7, 1, "power2.out"], [C.end - 0.6, 1], [C.end, 0.5]]);
  const labUi = track([[C.labelUi, 0], [C.labelUi + 0.5, 1, "power2.out"], [C.recompose - 0.45, 1], [C.recompose - 0.1, 0]]);
  const labEng = track([[C.labelEngine, 0], [C.labelEngine + 0.5, 1, "power2.out"], [C.recompose - 0.45, 1], [C.recompose - 0.1, 0]]);
  const dustLvl = track([[0, 0.5], [C.screenIn, 0.5], [C.screenIn + 0.6, 0.25], [C.explode, 0.25], [C.split + 1, 0.8], [C.land, 0.8], [C.land + 1, 1]]);

  // ---- Éléments 3D ---------------------------------------------------------------------------------
  const rig = $("rig"), screen = $("screen"), reflect = $("reflect");
  const plateEls = PLATES.map((p) => ({ p, el: $(p.id), wave: $(p.id).querySelector(".wave") }));
  const mechEls = MECH.map((m) => ({ m, el: $("m-" + m.id) }));
  const rodEls = RODS.map((_, i) => $("rod-" + i));
  const gearRot = GEARS.map((g) => ({ g, el: $(g.id + "-rot") }));
  const balRot = $("bal-rot");

  function worldPoint(el) {
    const wr = world.getBoundingClientRect(), r = el.getBoundingClientRect(), k = wr.width / W || 1;
    return [(r.left + r.width / 2 - wr.left) / k, (r.top + r.height / 2 - wr.top) / k];
  }
  function worldRect(el) {
    const wr = world.getBoundingClientRect(), r = el.getBoundingClientRect(), k = wr.width / W || 1;
    return { l: (r.left - wr.left) / k, t: (r.top - wr.top) / k, r: (r.right - wr.left) / k, b: (r.bottom - wr.top) / k };
  }
  function leader(pathId, dotId, labId, anchorId, op, right) {
    const path = $(pathId), dot = $(dotId), lab = $(labId);
    lab.style.opacity = op;
    if (op <= 0.001) { path.style.opacity = 0; dot.style.opacity = 0; return; }
    const [ax, ay] = worldPoint($(anchorId));
    const lr = worldRect(lab);
    const sx = right ? lr.l - 18 : lr.r + 18, sy = (lr.t + lr.b) / 2;
    const ex = sx + (right ? -70 : 70);
    path.setAttribute("d", `M${fmt(sx)} ${fmt(sy)}L${fmt(ex)} ${fmt(sy)}L${fmt(ax)} ${fmt(ay)}`);
    const L = path.getTotalLength();
    path.style.strokeDasharray = L;
    path.style.strokeDashoffset = L * (1 - op);
    path.style.opacity = 1;
    dot.setAttribute("cx", fmt(ax)); dot.setAttribute("cy", fmt(ay));
    dot.style.opacity = op;
  }

  // ---- Particules (canvas, déterministes) -----------------------------------------------------
  const ctx = $("fx").getContext("2d");
  const COLORS = ["#ffffff", "#d9f2ff", "#5cc0ee", "#0081bc"];
  const r1 = rng(2026);
  const BURST = Array.from({ length: 900 }, () => {
    const x0 = KPI.cx + (r1() - 0.5) * KPI.w, y0 = KPI.cy + (r1() - 0.5) * KPI.h;
    const a = Math.atan2(y0 - KPI.cy, x0 - KPI.cx) + (r1() - 0.5) * 0.9, sp = 250 + r1() * 1100;
    return {
      x0, y0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * (V ? 1.1 : 0.75),
      tx: TBOX.cx + (r1() - 0.5) * TBOX.w, ty: TBOX.cy + (r1() - 0.5) * TBOX.h,
      dur: 0.6 + r1() * 0.35, sw: (r1() - 0.5) * 420, size: 1.2 + r1() * 2.6, c: COLORS[Math.floor(r1() * 4)],
    };
  });
  const TC = C.title - 0.65; // début du regroupement vers le titre
  function burstPos(p, t) {
    if (t < C.shatter) return null;
    const u1 = clamp((t - C.shatter) / (TC - C.shatter));
    const e1 = 1 - Math.pow(1 - u1, 3);
    const x1 = p.x0 + p.vx * e1, y1 = p.y0 + p.vy * e1 + 50 * u1 * u1;
    if (t < TC) return [x1, y1, 1 - 0.3 * u1];
    const u2 = clamp((t - TC) / p.dur), e2 = ease("power3.inOut")(u2);
    const dx = p.tx - x1, dy = p.ty - y1, len = Math.hypot(dx, dy) || 1, sw = Math.sin(Math.PI * u2) * p.sw;
    return [lerp(x1, p.tx, e2) - (dy / len) * sw, lerp(y1, p.ty, e2) + (dx / len) * sw, 0.7 * (1 - clamp((u2 - 0.75) / 0.25))];
  }
  const r2 = rng(7);
  const DUST = Array.from({ length: 170 }, () => ({ x: r2() * W, y: r2() * H, vx: (r2() - 0.5) * 14, vy: -6 - r2() * 18, s: 0.8 + r2() * 2, a: 0.15 + r2() * 0.45, f: 0.5 + r2() * 2, ph: r2() * 6.28 }));
  const r3 = rng(19);
  const SHOCK = Array.from({ length: 520 }, () => ({ a: r3() * Math.PI * 2, sp: 300 + r3() * 1500, s: 1 + r3() * 2.4, d: r3() * 0.12, c: COLORS[Math.floor(r3() * 3)] }));
  const r4 = rng(41);
  const SPARK = Array.from({ length: 140 }, () => ({ x: (r4() - 0.5) * (V ? 900 : 1300), off: r4() * 7, sp: 40 + r4() * 120, s: 0.8 + r4() * 2, a: 0.2 + r4() * 0.6, wob: r4() * 6.28 }));

  function drawFX(t, pz) {
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    // Poussière ambiante.
    const dl = dustLvl(t);
    ctx.fillStyle = "#9fd8f5";
    DUST.forEach((d) => {
      const x = (((d.x + d.vx * t) % W) + W) % W, y = (((d.y + d.vy * t) % H) + H) % H;
      ctx.globalAlpha = d.a * dl * (0.55 + 0.45 * Math.sin(t * d.f + d.ph));
      ctx.fillRect(x, y, d.s, d.s);
    });
    // Éclatement du chiffre clé, puis regroupement en titre (traînées de mouvement).
    if (t >= C.shatter && t < C.title + 0.4) {
      ctx.lineCap = "round";
      BURST.forEach((p) => {
        const a = burstPos(p, t), b = burstPos(p, Math.max(C.shatter, t - 0.035));
        if (!a || a[2] <= 0) return;
        ctx.globalAlpha = a[2];
        ctx.strokeStyle = p.c;
        ctx.lineWidth = p.size;
        ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(a[0] + 0.1, a[1]); ctx.stroke();
      });
    }
    // Onde de choc du drop.
    const u = (t - C.drop) / 1.3;
    if (u >= 0 && u <= 1) {
      const cx = W / 2 + pz.x, cy = H / 2 + pz.y;
      [0, 0.1].forEach((dd, i) => {
        const uu = clamp((t - C.drop - dd) / 1.1);
        if (uu <= 0 || uu >= 1) return;
        ctx.globalAlpha = (1 - uu) * (i ? 0.5 : 0.9);
        ctx.strokeStyle = i ? "#5cc0ee" : "#d9f2ff";
        ctx.lineWidth = 2 + 10 * (1 - uu);
        ctx.beginPath(); ctx.ellipse(cx, cy, 60 + 1500 * ease("expo.out")(uu), (60 + 1500 * ease("expo.out")(uu)) * (V ? 1 : 0.62), 0, 0, Math.PI * 2); ctx.stroke();
      });
      SHOCK.forEach((s) => {
        const uu = clamp((t - C.drop - s.d) / 1.2);
        if (uu <= 0 || uu >= 1) return;
        const e = ease("expo.out")(uu), e0 = ease("expo.out")(Math.max(0, uu - 0.04));
        const k = V ? 1 : 0.62;
        ctx.globalAlpha = 1 - uu;
        ctx.strokeStyle = s.c; ctx.lineWidth = s.s;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(s.a) * s.sp * e0, cy + Math.sin(s.a) * s.sp * e0 * k);
        ctx.lineTo(cx + Math.cos(s.a) * s.sp * e, cy + Math.sin(s.a) * s.sp * e * k);
        ctx.stroke();
      });
    }
    // Étincelles montantes du plan final.
    if (t > C.land) {
      const fade = clamp((t - C.land) / 1);
      const baseY = V ? 1050 : 690;
      ctx.fillStyle = "#d9f2ff";
      SPARK.forEach((s) => {
        const life = ((t - C.land) * s.sp / 600 + s.off / 7) % 1;
        ctx.globalAlpha = s.a * fade * Math.sin(Math.PI * life);
        ctx.fillRect(W / 2 + s.x + Math.sin(t * 1.3 + s.wob) * 20, baseY - life * (V ? 900 : 640), s.s, s.s);
      });
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  // ---- Mise à jour procédurale (appelée à chaque image) ---------------------------------------
  const grain = $("grain"), floor = $("floor"), beams = $("beams");
  function update(t) {
    // Caméra + secousse du drop.
    const pz = pose(t);
    const su = (t - C.drop) / 0.7;
    if (su >= 0 && su <= 1) {
      const amp = 22 * (1 - su) * (1 - su);
      pz.x += Math.sin(t * 93) * amp;
      pz.y += Math.cos(t * 71) * amp;
    }
    rig.style.visibility = t >= C.screenIn ? "visible" : "hidden";
    rig.style.transform = `translate3d(${fmt(pz.x)}px,${fmt(pz.y)}px,0) rotateX(${fmt(pz.rx)}deg) rotateY(${fmt(pz.ry)}deg) rotateZ(${fmt(pz.rz)}deg) scale3d(${pz.s},${pz.s},${pz.s})`;
    screen.style.opacity = screenOp(t);
    reflect.style.opacity = reflectOp(t) * 0.55;

    // Vue éclatée : plaques, mouvement, piliers.
    const sq = squash(t);
    plateEls.forEach(({ p, el, wave }) => {
      const ex = explode(t - p.d);
      el.style.opacity = ex > 0.002 ? 1 : 0;
      el.style.transform = `translateZ(${fmt(p.z * ZM * ex * sq)}px)`;
      // Onde lumineuse à travers les plaques sur l'impulsion et sur le drop.
      const at = t >= C.drop ? C.drop : C.pulse;
      const wu = clamp((t - at - p.d * 0.6) / 0.55);
      wave.style.backgroundPosition = `${fmt(120 - 140 * wu)}% 0`;
      wave.style.opacity = wu > 0 && wu < 1 ? 1 : 0;
    });
    const ex = explode(t), mo = mechOp(t);
    mechEls.forEach(({ m, el }) => {
      el.style.opacity = mo;
      el.style.transform = `translateZ(${fmt(m.z * ZM * MZ * Math.max(ex, 0.25) * sq)}px)`;
    });
    rodEls.forEach((el) => {
      el.style.opacity = mo;
      el.style.transform = `translateZ(${fmt(Z_FRONT * ZM * ex * sq)}px) rotateY(90deg) scaleX(${fmt(ex * sq)})`;
    });
    const rev = phase(t) * 360 * 0.35;
    // k : rapport de démultiplication par rapport à la grande roue (48 dents), signe = sens.
    gearRot.forEach(({ g, el }) => el.setAttribute("transform", `rotate(${fmt(rev * g.k)} ${g.cx} ${g.cy})`));
    const balAmp = t > C.drop && t < C.drop + 2 ? 220 : 150;
    balRot.setAttribute("transform", `rotate(${fmt(balAmp * Math.sin(t * 2 * Math.PI * (t > C.drop ? 3.2 : 2.2)))} ${BAL.cx} ${BAL.cy})`);

    // Étiquettes reliées par un trait.
    leader("ld-ui", "dot-ui", "lab-ui", "a-ui", labUi(t), false);
    leader("ld-eng", "dot-eng", "lab-eng", "a-eng", labEng(t), LAB.engRight);

    // Décor.
    beams.style.opacity = beamsOp(t);
    beams.style.transform = `rotate(${fmt(t * 3)}deg)`;
    floor.style.backgroundPosition = `0 ${fmt(t * 90)}px`;
    const fr = Math.floor(t * 24);
    grain.style.transform = `translate(${(fr * 37) % 100 - 50}px, ${(fr * 61) % 100 - 50}px)`;
    drawFX(t, pz);
  }

  // ---- Effets ponctuels (GSAP) -----------------------------------------------------------------------
  const bars = Array.from(document.querySelectorAll("#gl i"));
  const gr = rng(77);
  function glitch(at, dur = 0.22, target = null, amp = 1) {
    const n = 6, step = dur / n;
    for (let k = 0; k < n; k++) {
      const t = at + k * step;
      bars.forEach((b) => {
        const on = gr() < 0.4 * amp;
        tl.set(b, { opacity: on ? 0.15 + gr() * 0.55 : 0, top: `${fmt(gr() * 100)}%`, height: `${fmt(2 + gr() * 46 * amp)}px` }, t);
      });
      if (target) {
        const a = (6 + gr() * 10) * amp, b = (4 + gr() * 10) * amp;
        tl.set(target, { x: fmt((gr() - 0.5) * 46 * amp), skewX: fmt((gr() - 0.5) * 12 * amp), filter: `drop-shadow(${fmt(a)}px 0 0 rgba(0,190,255,0.85)) drop-shadow(${fmt(-b)}px 0 0 rgba(255,45,85,0.6))` }, t);
      }
    }
    bars.forEach((b) => tl.set(b, { opacity: 0 }, at + dur));
    if (target) tl.set(target, { x: 0, skewX: 0, filter: "none" }, at + dur);
  }
  const flash = (at, peak = 0.8, d = 0.5) => tl.fromTo("#flash", { opacity: peak }, { opacity: 0, duration: d, ease: "power2.out", immediateRender: false }, at);
  const flare = (at, y = H / 2) => {
    tl.set("#flare", { top: y }, at);
    tl.fromTo("#flare", { opacity: 1, scaleX: 0.15, scaleY: 1 }, { opacity: 0, scaleX: 1.3, scaleY: 0.6, duration: 0.8, ease: "power2.out", immediateRender: false }, at);
  };

  // ---- 1. Accroche (0–2 s) ----------------------------------------------------------------------
  tl.fromTo("#hookline", { scaleX: 0, scaleY: 1, opacity: 1 }, { scaleX: 1, duration: 0.2, ease: "expo.out" }, 0.04);
  tl.to("#hookline", { scaleY: 40, opacity: 0, duration: 0.14, ease: "power2.in" }, C.hookOn - 0.06);
  tl.set("#kpi", { opacity: 1 }, C.hookOn);
  tl.fromTo("#kpi", { scale: 1.3 }, { scale: 1, duration: 0.35, ease: "power4.out", immediateRender: false }, C.hookOn);
  glitch(C.hookOn, 0.24, "#kpi", 1.2);
  flash(C.hookOn, 0.5, 0.35);
  tl.to("#kpi", { scale: 1.07, duration: C.shatter - C.hookOn - 0.4, ease: "none" }, C.hookOn + 0.38);
  glitch(C.shatter - 0.13, 0.12, "#kpi", 0.8);
  tl.set("#kpi", { opacity: 0 }, C.shatter);
  flash(C.shatter, 0.9, 0.6);
  flare(C.shatter, KPI.cy);

  // ---- 2. Titre (2,5–5 s) ------------------------------------------------------------------------------
  tl.fromTo("#title .title__lines > div:not(.title__sheen) .ch", { opacity: 0, y: 70, scale: 1.7, filter: "blur(14px)" },
    { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 0.55, ease: "power3.out", stagger: { each: 0.035, from: "center" }, immediateRender: false }, C.title);
  tl.fromTo(".title__sheen", { opacity: 1, "--s": "-30%" }, { "--s": "130%", duration: 0.9, ease: "power2.inOut", immediateRender: false }, C.title + 0.55);
  tl.set(".title__sheen", { opacity: 0 }, 0);
  tl.set(".title__sheen", { opacity: 0 }, C.title + 1.46);
  flare(C.title + 0.6, TBOX.cy);
  tl.fromTo("#subtitle", { opacity: 0, y: 24, letterSpacing: "0.9em" }, { opacity: 1, y: 0, letterSpacing: V ? "0.3em" : "0.42em", duration: 0.8, ease: "power3.out", immediateRender: false }, C.title + 0.7);
  tl.fromTo("#title", { scale: 1 }, { scale: 1.05, duration: C.titleOut - C.title, ease: "none" }, C.title);
  tl.to("#title", { scale: 1.9, opacity: 0, filter: "blur(18px)", duration: 0.45, ease: "power2.in" }, C.titleOut);

  // ---- 3. Démonstration (5–13 s) ------------------------------------------------------------------
  const VW = 1440, VH = 900;
  const showShot = (n, at) => tl.set("#s-" + n, { opacity: 1 }, at);
  const swap = (n, at) => {
    showShot(n, at);
    tl.fromTo("#scanfx", { opacity: 1 }, { opacity: 0, duration: 0.25, ease: "power2.out", immediateRender: false }, at);
  };
  const cur = { x: 760, y: 520 };
  gsap.set("#cursor", { x: cur.x, y: cur.y });
  const move = (x, y, at, d = 0.4) => { tl.to("#cursor", { x, y, duration: d, ease: "power2.inOut" }, at); cur.x = x; cur.y = y; };
  const click = (at) => {
    tl.to("#cursor", { scale: 0.8, duration: 0.07, transformOrigin: "0 0" }, at);
    tl.to("#cursor", { scale: 1, duration: 0.12 }, at + 0.07);
    tl.set("#ripple", { left: cur.x, top: cur.y }, at);
    tl.fromTo("#ripple", { scale: 0.3, opacity: 1 }, { scale: 1.7, opacity: 0, duration: 0.45, ease: "power2.out", immediateRender: false }, at);
  };
  function zoom(at, d, s, px, py, qx = px, qy = py) {
    const x = Math.min(0, Math.max(VW - VW * s, qx - px * s)), y = Math.min(0, Math.max(VH - VH * s, qy - py * s));
    tl.to("#cam", { scale: s, x, y, duration: d, ease: "power3.inOut" }, at);
  }
  const unzoom = (at, d = 0.45) => tl.to("#cam", { scale: 1, x: 0, y: 0, duration: d, ease: "power3.inOut" }, at);
  function capIn(id, at) {
    tl.set("#" + id, { visibility: "visible" }, at);
    tl.fromTo(`#${id} .eyebrow`, { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.4, ease: "power3.out", immediateRender: false }, at);
    tl.fromTo(`#${id} .cap__line span`, { yPercent: 110 }, { yPercent: 0, duration: 0.5, ease: "power4.out", stagger: 0.07, immediateRender: false }, at + 0.05);
  }
  function capOut(id, at) {
    tl.fromTo(`#${id} .cap__line span`, { yPercent: 0 }, { yPercent: -110, duration: 0.3, ease: "power3.in", stagger: 0.04, immediateRender: false }, at);
    tl.fromTo(`#${id} .eyebrow`, { opacity: 1 }, { opacity: 0, duration: 0.25, immediateRender: false }, at);
    tl.set("#" + id, { visibility: "hidden" }, at + 0.45);
  }
  gsap.set(".cap__line span", { yPercent: 110 });
  gsap.set(".cap", { visibility: "hidden" });

  showShot("sel-0", C.screenIn);
  glitch(C.screenIn + 0.6, 0.18, "#screen", 0.7);
  tl.fromTo("#tag", { opacity: 0 }, { opacity: 1, duration: 0.4, immediateRender: false }, C.screenIn + 0.7);
  tl.fromTo("#cursor", { opacity: 0 }, { opacity: 1, duration: 0.2, immediateRender: false }, C.clickA - 0.55);
  // a. Un clic : toute la page se recalcule.
  move(454, 309, C.clickA - 0.45);
  click(C.clickA);
  swap("sel-1", C.clickA + 0.05);
  capIn("cap-a", C.clickA);
  capOut("cap-a", C.crumbs - 0.05);
  // b. Le fil d'Ariane se construit : zoom sur le fil, le second clic se fait dans le zoom.
  zoom(C.crumbs, 0.45, 2.1, 330, 175, 560, 430);
  capIn("cap-b", C.crumbs + 0.15);
  move(456, 309, C.crumbs + 0.3, 0.35);
  click(C.clickB);
  swap("sel-2", C.clickB + 0.05);
  unzoom(C.clickB + 0.15, 0.4);
  capOut("cap-b", C.chip - 0.2);
  // c. Modifier en place (puce « Prestation »).
  move(608, 138, C.chip - 0.4, 0.36);
  click(C.chip);
  swap("chip-open", C.chip + 0.05);
  capIn("cap-c", C.chip - 0.05);
  zoom(C.chip + 0.1, 0.45, 1.6, 580, 250, 700, 420);
  move(577, 266, C.opt1 - 0.3, 0.28);
  click(C.opt1);
  swap("chip-add-1", C.opt1 + 0.05);
  move(577, 302, C.opt2 - 0.22, 0.2);
  click(C.opt2);
  swap("chip-add-2", C.opt2 + 0.05);
  unzoom(C.opt2 + 0.2, 0.4);
  move(1000, 640, C.opt2 + 0.22, 0.26);
  click(C.chipDone);
  swap("chip-done", C.chipDone + 0.05);
  capOut("cap-c", C.searchCut - 0.25);
  // d. Recherche, après une coupe glitch.
  glitch(C.searchCut, 0.24, "#screen", 1);
  flash(C.searchCut, 0.35, 0.3);
  showShot("search-0", C.searchCut + 0.05);
  move(1146, 104, C.searchCut + 0.02, 0.28);
  click(C.searchClick);
  capIn("cap-d", C.searchCut + 0.15);
  zoom(C.searchClick + 0.05, 0.45, 1.8, 1018, 190, 1000, 380);
  C.keys.forEach((t, i) => showShot("search-" + (i + 1), t));
  swap("search-done", C.searchDone);
  unzoom(C.searchDone + 0.3, 0.5);
  tl.to("#cursor", { opacity: 0, duration: 0.2 }, C.searchDone + 0.35);
  capOut("cap-d", C.explode - 0.15);

  // ---- 4. Vue éclatée (13,4–22,6 s) --------------------------------------------------------------
  tl.fromTo("#under", { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.5, ease: "power3.out", immediateRender: false }, C.split + 0.3);
  tl.to("#under", { opacity: 0, duration: 0.3 }, C.recompose - 0.3);
  flash(C.pulse, 0.3, 0.45);
  // Pré-drop : la pile se resserre, puis l'explosion.
  flash(C.drop, 0.95, 0.7);
  flare(C.drop);
  glitch(C.drop, 0.3, null, 1.3);
  glitch(C.land - 0.08, 0.2, "#screen", 0.8);
  flash(C.land, 0.6, 0.6);
  tl.to("#tag", { opacity: 0, duration: 0.3 }, C.recompose);

  // ---- 5. Plan final (22,6–30 s) -------------------------------------------------------------------
  tl.fromTo("#hero .w", { opacity: 0, y: 60, filter: "blur(12px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.6, ease: "power3.out", stagger: 0.07, immediateRender: false }, C.heroTitle);
  tl.fromTo(".hero__powered", { opacity: 0, letterSpacing: "0.9em" }, { opacity: 1, letterSpacing: V ? "0.3em" : "0.4em", duration: 0.9, ease: "power3.out", immediateRender: false }, C.powered);
  tl.fromTo("#logos", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out", immediateRender: false }, C.logos);
  tl.fromTo("#endtag", { opacity: 0 }, { opacity: 1, duration: 0.5, immediateRender: false }, C.logos + 0.4);
  flare(C.flare, V ? 1110 : 755);
  tl.to("#black", { opacity: 1, duration: 0.65, ease: "power2.in" }, C.end - 0.65);

  // ---- Horloge : tout ce qui dépend du seul temps --------------------------------------------------
  const clock = { t: 0 };
  tl.fromTo(clock, { t: 0 }, { t: C.end, duration: C.end, ease: "none", onUpdate: () => update(clock.t) }, 0);
  update(0);
  tl.set({}, {}, C.end);
  window.CINE_TIMELINE = tl; // enregistrée sur window.__timelines par index.html
})();
