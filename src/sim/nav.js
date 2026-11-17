// A* no grid de 8 vizinhos (sem cortar quinas) + suavização por linha de visada.

import { GRID, cellOf, clearLine, nearestWalkable, onMapChange } from './map.js';

let N, C, walk, g, from, seen, closed, fv, stamp = 0;
const heap = [];   // heap binário de índices de célula, ordenado por f
onMapChange(() => {
  ({ N, C, walk } = GRID);
  g = new Float32Array(N * N); from = new Int32Array(N * N); seen = new Uint32Array(N * N); closed = new Uint32Array(N * N);
  fv = new Float32Array(N * N); stamp = 0;
});
function push(k) {
  heap.push(k);
  let i = heap.length - 1;
  while (i > 0) { const p = (i - 1) >> 1; if (fv[heap[p]] <= fv[k]) break; heap[i] = heap[p]; i = p; }
  heap[i] = k;
}
function pop() {
  const top = heap[0], last = heap.pop();
  if (heap.length) {
    let i = 0;
    for (;;) {
      const l = i * 2 + 1, r = l + 1;
      let m = i, mv = fv[last];
      if (l < heap.length && fv[heap[l]] < mv) { m = l; mv = fv[heap[l]]; }
      if (r < heap.length && fv[heap[r]] < mv) m = r;
      if (m === i) break;
      heap[i] = heap[m]; i = m;
    }
    heap[i] = last;
  }
  return top;
}

const SQ2 = Math.SQRT2;
const octile = (i, j, ti, tj) => { const dx = Math.abs(i - ti), dy = Math.abs(j - tj); return (dx + dy) + (SQ2 - 2) * Math.min(dx, dy); };

// devolve a lista de pontos (sem a origem) ou null
export function findPath(x0, y0, x1, y1) {
  const end = nearestWalkable(x1, y1);
  if (clearLine(x0, y0, end.x, end.y)) return [end];
  const si = cellOf(x0), sj = cellOf(y0), ti = cellOf(end.x), tj = cellOf(end.y);
  const start = sj * N + si, goal = tj * N + ti;
  stamp++;
  heap.length = 0;
  g[start] = 0; seen[start] = stamp; from[start] = -1;
  fv[start] = octile(si, sj, ti, tj);
  push(start);
  let found = false, iter = 0;
  while (heap.length && iter++ < 12000) {
    const k = pop();
    if (closed[k] === stamp) continue;
    closed[k] = stamp;
    if (k === goal) { found = true; break; }
    const i = k % N, j = (k / N) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
      const nk = nj * N + ni;
      if (!walk[nk] || closed[nk] === stamp) continue;
      if (di && dj && (!walk[j * N + ni] || !walk[nj * N + i])) continue; // não corta quina
      const ng = g[k] + (di && dj ? SQ2 : 1);
      if (seen[nk] === stamp && ng >= g[nk]) continue;
      seen[nk] = stamp; g[nk] = ng; from[nk] = k;
      fv[nk] = ng + octile(ni, nj, ti, tj);
      push(nk);
    }
  }
  if (!found) return null;
  const cells = [];
  for (let k = goal; k !== -1; k = from[k]) cells.push({ x: (k % N + 0.5) * C, y: (((k / N) | 0) + 0.5) * C });
  cells.reverse();
  cells[cells.length - 1] = end;
  // suavização: pula todos os pontos intermediários que têm visada direta
  const out = [];
  let cur = { x: x0, y: y0 }, idx = 0;
  while (idx < cells.length) {
    let far = idx;
    for (let k = cells.length - 1; k > idx; k--) if (clearLine(cur.x, cur.y, cells[k].x, cells[k].y)) { far = k; break; }
    out.push(cells[far]);
    cur = cells[far];
    idx = far + 1;
  }
  return out;
}
