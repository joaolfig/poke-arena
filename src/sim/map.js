// Mapas: "rift" = 3 lanes (como o Summoner's Rift): bases nos cantos, lanes de cima, do meio e de baixo, um rio
// na diagonal oposta à lane do meio e a selva entre as lanes, com paredes, acampamentos e dois chefes no rio.
// "aram" = uma lane só (estilo ARAM): lane diagonal com recuos laterais e moitas, sem selva.
// Os dois são espelhados em ponto (o lado vermelho é o azul girado 180°). O grid de navegação (seção 7 de
// matematica-moba.md) sai daqui. O mapa é escolhido na sala: setMap(id) monta tudo antes da partida começar
// (os exports são "let", então quem importa vê o mapa novo; quem guarda cópias se registra em onMapChange).

import { MAP, GAME, MAPS } from '../config.js';
import { segDist2 } from '../core/math.js';

let S, C, N;
const P = (x, y) => ({ x: x * S, y: y * S });
const mirror = p => ({ ...p, x: S - p.x, y: S - p.y });
// reflexo pela lane do meio (troca o lado de cima pelo de baixo, no mesmo time)
const reflect = p => ({ ...p, x: S - p.y, y: S - p.x });

export let MAP_ID, BASE, FOUNTAIN, NEXUS, LANES, LANE_NAMES, CAMPS, BRUSHES, TOWERS, GRID;
let BASE_R, WIDTH, WALLS, CLEARING, RIVER, RIVER_W, ALCOVES;

// ponto a uma fração t do comprimento de uma polilinha
export function alongPath(pts, t) {
  let total = 0;
  const seg = [];
  for (let i = 1; i < pts.length; i++) { const L = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); seg.push(L); total += L; }
  let k = t * total;
  for (let i = 0; i < seg.length; i++) {
    if (k <= seg[i] || i === seg.length - 1) {
      const f = Math.min(1, k / seg[i]);
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * f, y: pts[i].y + (pts[i + 1].y - pts[i].y) * f };
    }
    k -= seg[i];
  }
  return { ...pts[pts.length - 1] };
}
const pathLen = pts => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);
// ponto a uma distância d do começo da polilinha
const atDist = (pts, d) => alongPath(pts, d / pathLen(pts));

// ---------- 3 lanes ----------
function buildRift() {
  BASE = [P(0.12, 0.88), P(0.88, 0.12)];
  FOUNTAIN = [P(0.06, 0.94), P(0.94, 0.06)];
  NEXUS = [P(0.17, 0.83), P(0.83, 0.17)];
  BASE_R = 1350;
  // as lanes, do azul para o vermelho (a de baixo é a de cima refletida pelo meio)
  const TOP = [BASE[0], P(0.075, 0.74), P(0.075, 0.15), P(0.15, 0.075), P(0.74, 0.075), BASE[1]];
  LANES = { top: TOP, mid: [BASE[0], BASE[1]], bot: TOP.map(reflect) };
  LANE_NAMES = ['top', 'mid', 'bot'];
  // rio: do canto de cima à esquerda ao de baixo à direita, cruzando o meio
  RIVER = [P(0.1, 0.1), P(0.9, 0.9)];
  RIVER_W = 300;

  // selva (lado azul de cima; o resto sai por reflexo e espelho)
  // acampamentos: pid = Pokémon selvagem; big = chefe do rio (vale para o time todo)
  const CAMPS_TOP_BLUE = [
    { ...P(0.22, 0.44), pid: 217 },   // Ursaring
    { ...P(0.31, 0.63), pid: 214 },   // Heracross
    { ...P(0.17, 0.30), pid: 198 },   // Murkrow
  ];
  const CAMPS_BLUE = [...CAMPS_TOP_BLUE, ...CAMPS_TOP_BLUE.map(reflect)];
  CAMPS = [
    ...CAMPS_BLUE, ...CAMPS_BLUE.map(mirror),
    // chefes do rio: Kyogre perto da lane de cima, Groudon perto da de baixo
    { ...P(0.31, 0.31), pid: 382, big: true, nome: 'Kyogre' },
    { ...P(0.69, 0.69), pid: 383, big: true, nome: 'Groudon' },
  ];

  // paredes (círculos de rocha e mata fechada): lanes, rio, bases e clareiras dos acampamentos passam por cima delas
  const WALLS_TOP_BLUE = [
    [0.155, 0.36, 300], [0.155, 0.56, 330], [0.16, 0.74, 260],     // beira da lane de cima, com entradas entre elas
    [0.28, 0.52, 300], [0.36, 0.45, 250], [0.24, 0.35, 230],       // miolo da selva
    [0.40, 0.62, 260], [0.27, 0.74, 230], [0.37, 0.75, 180],       // beira da lane do meio e da base
    [0.22, 0.20, 200], [0.42, 0.36, 170],                           // perto do rio
    [0.19, 0.52, 230], [0.25, 0.60, 250], [0.33, 0.55, 220], [0.29, 0.39, 200], [0.20, 0.385, 170],
    [0.33, 0.40, 210], [0.145, 0.65, 200], [0.21, 0.70, 220], [0.23, 0.27, 150],
  ].map(([x, y, r]) => ({ ...P(x, y), r: r * 1.2 }));
  const WALLS_BLUE = [...WALLS_TOP_BLUE, ...WALLS_TOP_BLUE.map(reflect)];
  WALLS = [...WALLS_BLUE, ...WALLS_BLUE.map(mirror)];
  CLEARING = 380;
  ALCOVES = [];

  // moitas: nas beiras das lanes, nas entradas da selva e no rio
  const BRUSH_TOP_BLUE = [
    [0.115, 0.46, 230], [0.115, 0.22, 220], [0.20, 0.115, 200],    // lane de cima
    [0.35, 0.57, 200], [0.44, 0.50, 180],                          // lane do meio, lado da selva
    [0.25, 0.27, 210], [0.40, 0.40, 190],                          // rio
    [0.30, 0.44, 170],                                             // dentro da selva
  ].map(([x, y, r]) => ({ ...P(x, y), r }));
  const BRUSH_BLUE = [...BRUSH_TOP_BLUE, ...BRUSH_TOP_BLUE.map(reflect)];
  // sem repetir as que caem em cima do próprio reflexo/espelho (no rio)
  BRUSHES = [];
  for (const b of [...BRUSH_BLUE, ...BRUSH_BLUE.map(mirror)]) if (!BRUSHES.some(o => Math.hypot(o.x - b.x, o.y - b.y) < 200)) BRUSHES.push({ x: b.x, y: b.y, r: b.r });

  WIDTH = { lane: 480 };

  // torres de cada lane: externa (tier 0) e interna (tier 1), pela distância andando desde a base
  const TOWER_DIST = { top: [5000, 2700], mid: [3700, 2300], bot: [5000, 2700] };
  TOWERS = [];
  for (const lane of LANE_NAMES) for (const tier of [0, 1]) {
    const pts = LANES[lane], d = TOWER_DIST[lane][tier];
    TOWERS.push({ team: 0, lane, tier, ...atDist(pts, d) });
    TOWERS.push({ team: 1, lane, tier, ...atDist([...pts].reverse(), d) });
  }
}

// ---------- 1 lane ----------
function buildAram() {
  BASE = [P(0.13, 0.87), P(0.87, 0.13)];
  FOUNTAIN = [P(0.07, 0.93), P(0.93, 0.07)];
  NEXUS = [P(0.19, 0.81), P(0.81, 0.19)];
  BASE_R = 1250;
  LANES = { mid: [BASE[0], BASE[1]] };
  LANE_NAMES = ['mid'];
  CAMPS = [];   // sem selva
  RIVER = null; WALLS = []; CLEARING = 0;
  // recuos dos dois lados da lane (lado azul; o vermelho é o espelho), cada um com uma moita
  const PERP = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
  const ALCOVES_BLUE = [[0.3, 1], [0.3, -1], [0.44, 1], [0.44, -1]].map(([t, side]) => {
    const p = alongPath(LANES.mid, t);
    return { x: p.x + PERP.x * side * 620, y: p.y + PERP.y * side * 620, r: 360 };
  });
  ALCOVES = [...ALCOVES_BLUE, ...ALCOVES_BLUE.map(a => ({ ...mirror(a), r: a.r }))];
  BRUSHES = ALCOVES.map(a => ({ x: a.x, y: a.y, r: 300 }));
  WIDTH = { lane: 520 };
  // torres: externa (t = 0,32) e interna (t = 0,2) de cada time
  TOWERS = [];
  for (const [tier, t] of [[0, 0.32], [1, 0.2]]) {
    TOWERS.push({ team: 0, lane: 'mid', tier, ...alongPath(LANES.mid, t) });
    TOWERS.push({ team: 1, lane: 'mid', tier, ...alongPath(LANES.mid, 1 - t) });
  }
}

const near = (x, y, pts, w) => {
  for (let i = 1; i < pts.length; i++) if (segDist2(x, y, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y) < w * w) return true;
  return false;
};
const inCircle = (x, y, c, r = c.r) => (x - c.x) ** 2 + (y - c.y) ** 2 < r * r;

// ---------- grid ----------
// lane: 1 = chão de lane ou base; river: 1 = água
function buildGrid() {
  GRID = { N, C, S, walk: new Uint8Array(N * N), brush: new Int8Array(N * N).fill(-1), lane: new Uint8Array(N * N), river: new Uint8Array(N * N) };
  const rift = MAP_ID === 'rift', edge = C * (rift ? 2 : 1);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = (i + 0.5) * C, y = (j + 0.5) * C, k = j * N + i;
    const inBase = BASE.some(b => inCircle(x, y, b, BASE_R));
    const onLane = LANE_NAMES.some(l => near(x, y, LANES[l], WIDTH.lane));
    const inside = x > edge && y > edge && x < S - edge && y < S - edge;
    let open, inRiver = false;
    if (rift) {
      inRiver = near(x, y, RIVER, RIVER_W);
      const clearing = CAMPS.some(c => inCircle(x, y, c, c.big ? CLEARING + 150 : CLEARING));
      const wall = WALLS.some(w => inCircle(x, y, w));
      // a selva fica entre as lanes: fora delas (beiradas do mapa e os cantos de cima e de baixo) só lane e base
      const fx = x / S, fy = y / S, between = fx > 0.075 && fy > 0.075 && fx < 0.925 && fy < 0.925 && fx + fy > 0.225 && fx + fy < 1.775;
      open = between && (inRiver || clearing || !wall);
    } else open = ALCOVES.some(a => inCircle(x, y, a));
    GRID.walk[k] = inside && (inBase || onLane || open) ? 1 : 0;
    GRID.lane[k] = onLane || inBase ? 1 : 0;
    GRID.river[k] = inRiver && !onLane && !inBase ? 1 : 0;
    if (GRID.walk[k]) BRUSHES.forEach((b, bi) => { if (inCircle(x, y, b)) GRID.brush[k] = bi; });
  }
}

// quem guarda cópias do grid (navegação, visão, desenho) se registra aqui e refaz quando o mapa muda
const listeners = [];
export function onMapChange(fn) { listeners.push(fn); if (GRID) fn(); }

// monta o mapa escolhido: geometria, grid, tamanho (MAP.size) e a economia própria dele (GAME)
export function setMap(id) {
  if (!MAPS[id]) id = 'rift';
  if (id === MAP_ID) return;
  MAP_ID = id;
  MAP.size = MAPS[id].size;
  Object.assign(GAME, MAPS[id].game);
  S = MAP.size; C = MAP.cell; N = Math.round(S / C);
  (id === 'rift' ? buildRift : buildAram)();
  buildGrid();
  for (const fn of listeners) fn();
}
setMap('rift');

export const cellOf = v => Math.max(0, Math.min(N - 1, Math.floor(v / C)));
export const walkable = (x, y) => x >= 0 && y >= 0 && x < S && y < S && GRID.walk[cellOf(y) * N + cellOf(x)] === 1;
export const brushAt = (x, y) => GRID.brush[cellOf(y) * N + cellOf(x)];

// linha de visada no grid (amostra a cada meia célula)
export function clearLine(x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / (C * 0.5));
  for (let s = 1; s < n; s++) if (!walkable(x0 + (x1 - x0) * s / n, y0 + (y1 - y0) * s / n)) return false;
  return true;
}

// célula andável mais próxima (busca em anéis)
export function nearestWalkable(x, y) {
  if (walkable(x, y)) return { x, y };
  const ci = cellOf(x), cj = cellOf(y);
  for (let r = 1; r < 40; r++) {
    let best = null, bd = Infinity;
    for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
      if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r || i < 0 || j < 0 || i >= N || j >= N || !GRID.walk[j * N + i]) continue;
      const px = (i + 0.5) * C, py = (j + 0.5) * C, d = (px - x) ** 2 + (py - y) ** 2;
      if (d < bd) { bd = d; best = { x: px, y: py }; }
    }
    if (best) return best;
  }
  return { ...BASE[0] };
}
