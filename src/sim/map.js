// Mapa de 3 lanes (como o Summoner's Rift): bases nos cantos, lanes de cima, do meio e de baixo, um rio na
// diagonal oposta à lane do meio e a selva entre as lanes, com paredes, acampamentos e dois chefes no rio.
// Espelhado em ponto (o lado vermelho é o azul girado 180°). O grid de navegação (seção 7 de
// matematica-moba.md) sai daqui: célula andável se fica numa lane, no rio, numa base ou na selva fora das paredes.

import { MAP } from '../config.js';
import { segDist2 } from '../core/math.js';

const S = MAP.size, C = MAP.cell, N = Math.round(S / C);
const P = (x, y) => ({ x: x * S, y: y * S });
const mirror = p => ({ ...p, x: S - p.x, y: S - p.y });
// reflexo pela lane do meio (troca o lado de cima pelo de baixo, no mesmo time)
const reflect = p => ({ ...p, x: S - p.y, y: S - p.x });

export const BASE = [P(0.12, 0.88), P(0.88, 0.12)];
export const FOUNTAIN = [P(0.06, 0.94), P(0.94, 0.06)];
export const NEXUS = [P(0.17, 0.83), P(0.83, 0.17)];
const BASE_R = 1350;

// as lanes, do azul para o vermelho (a de baixo é a de cima refletida pelo meio)
const TOP = [BASE[0], P(0.075, 0.74), P(0.075, 0.15), P(0.15, 0.075), P(0.74, 0.075), BASE[1]];
export const LANES = { top: TOP, mid: [BASE[0], BASE[1]], bot: TOP.map(reflect) };
export const LANE_NAMES = ['top', 'mid', 'bot'];

// rio: do canto de cima à esquerda ao de baixo à direita, cruzando o meio
const RIVER = [P(0.1, 0.1), P(0.9, 0.9)];
const RIVER_W = 300;

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

// ---------- selva (lado azul de cima; o resto sai por reflexo e espelho) ----------
// acampamentos: pid = Pokémon selvagem; big = chefe do rio (vale para o time todo)
const CAMPS_TOP_BLUE = [
  { ...P(0.22, 0.44), pid: 217 },   // Ursaring
  { ...P(0.31, 0.63), pid: 214 },   // Heracross
  { ...P(0.17, 0.30), pid: 198 },   // Murkrow
];
const CAMPS_BLUE = [...CAMPS_TOP_BLUE, ...CAMPS_TOP_BLUE.map(reflect)];
export const CAMPS = [
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
const WALLS = [...WALLS_BLUE, ...WALLS_BLUE.map(mirror)];
const CLEARING = 380;

// moitas: nas beiras das lanes, nas entradas da selva e no rio
const BRUSH_TOP_BLUE = [
  [0.115, 0.46, 230], [0.115, 0.22, 220], [0.20, 0.115, 200],    // lane de cima
  [0.35, 0.57, 200], [0.44, 0.50, 180],                          // lane do meio, lado da selva
  [0.25, 0.27, 210], [0.40, 0.40, 190],                          // rio
  [0.30, 0.44, 170],                                             // dentro da selva
].map(([x, y, r]) => ({ ...P(x, y), r }));
const BRUSH_BLUE = [...BRUSH_TOP_BLUE, ...BRUSH_TOP_BLUE.map(reflect)];
// sem repetir as que caem em cima do próprio reflexo/espelho (no rio)
export const BRUSHES = [];
for (const b of [...BRUSH_BLUE, ...BRUSH_BLUE.map(mirror)]) if (!BRUSHES.some(o => Math.hypot(o.x - b.x, o.y - b.y) < 200)) BRUSHES.push({ x: b.x, y: b.y, r: b.r });

const WIDTH = { lane: 480 };

// torres de cada lane: externa (tier 0) e interna (tier 1), pela distância andando desde a base
const TOWER_DIST = { top: [5000, 2700], mid: [3700, 2300], bot: [5000, 2700] };
export const TOWERS = [];
for (const lane of LANE_NAMES) for (const tier of [0, 1]) {
  const pts = LANES[lane], d = TOWER_DIST[lane][tier];
  TOWERS.push({ team: 0, lane, tier, ...atDist(pts, d) });
  TOWERS.push({ team: 1, lane, tier, ...atDist([...pts].reverse(), d) });
}

const near = (x, y, pts, w) => {
  for (let i = 1; i < pts.length; i++) if (segDist2(x, y, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y) < w * w) return true;
  return false;
};
const inCircle = (x, y, c, r = c.r) => (x - c.x) ** 2 + (y - c.y) ** 2 < r * r;

// ---------- grid ----------
// lane: 1 = chão de lane ou base; river: 1 = água
export const GRID = { N, C, S, walk: new Uint8Array(N * N), brush: new Int8Array(N * N).fill(-1), lane: new Uint8Array(N * N), river: new Uint8Array(N * N) };

for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const x = (i + 0.5) * C, y = (j + 0.5) * C, k = j * N + i;
  const inBase = BASE.some(b => inCircle(x, y, b, BASE_R));
  const onLane = LANE_NAMES.some(l => near(x, y, LANES[l], WIDTH.lane));
  const inRiver = near(x, y, RIVER, RIVER_W);
  const clearing = CAMPS.some(c => inCircle(x, y, c, c.big ? CLEARING + 150 : CLEARING));
  const wall = WALLS.some(w => inCircle(x, y, w));
  const inside = x > C * 2 && y > C * 2 && x < S - C * 2 && y < S - C * 2;
  // a selva fica entre as lanes: fora delas (beiradas do mapa e os cantos de cima e de baixo) só lane e base
  const fx = x / S, fy = y / S, between = fx > 0.075 && fy > 0.075 && fx < 0.925 && fy < 0.925 && fx + fy > 0.225 && fx + fy < 1.775;
  GRID.walk[k] = inside && (inBase || onLane || (between && (inRiver || clearing || !wall))) ? 1 : 0;
  GRID.lane[k] = onLane || inBase ? 1 : 0;
  GRID.river[k] = inRiver && !onLane && !inBase ? 1 : 0;
  if (GRID.walk[k]) BRUSHES.forEach((b, bi) => { if (inCircle(x, y, b)) GRID.brush[k] = bi; });
}

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
