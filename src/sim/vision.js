// Névoa de guerra no grid (seção 8 de matematica-moba.md). Usado pelo host (quem cada time vê) e pelo
// cliente (desenho da névoa), com o mesmo código.
// Raios saem de cada observador até o alcance de visão; paredes bloqueiam (a parede em si fica visível).
// Moita: as células dentro de uma moita só ficam visíveis (1) para quem está na mesma moita; para os
// outros ficam 2 = "ao alcance, mas escondido" (quem ataca de dentro da moita se revela por um instante).

import { GRID, onMapChange } from './map.js';

let N, C, walk, brush;
onMapChange(() => ({ N, C, walk, brush } = GRID));

export function newVision() { return new Uint8Array(N * N); }

// observers: [{ x, y, sight }]
export function computeVision(observers, out) {
  out.fill(0);
  // observadores quase no mesmo lugar (minions da mesma onda) enxergam quase o mesmo: basta um deles
  const done = [];
  for (const o of observers) {
    if (done.some(p => p.sight >= o.sight && (p.x - o.x) ** 2 + (p.y - o.y) ** 2 < 90 * 90)) continue;
    done.push(o);
    const ox = o.x / C, oy = o.y / C, R = o.sight / C;
    const ob = brush[Math.floor(oy) * N + Math.floor(ox)] ?? -1;
    const rays = Math.ceil(2 * Math.PI * R);   // um raio por célula da borda do círculo
    const k0 = Math.floor(oy) * N + Math.floor(ox);
    if (k0 >= 0 && k0 < out.length) out[k0] = 1;
    for (let r = 0; r < rays; r++) {
      const a = r / rays * 2 * Math.PI, dx = Math.cos(a) * 0.75, dy = Math.sin(a) * 0.75;
      let x = ox, y = oy;
      for (let s = 0; s < R / 0.75; s++) {
        x += dx; y += dy;
        const i = Math.floor(x), j = Math.floor(y);
        if (i < 0 || j < 0 || i >= N || j >= N) break;
        const k = j * N + i;
        if (!walk[k]) { out[k] = 1; break; }
        const b = brush[k];
        if (b >= 0 && b !== ob) { if (!out[k]) out[k] = 2; }
        else out[k] = 1;
      }
    }
  }
  return out;
}

// valor da névoa na posição (0 escuro, 1 visível, 2 moita fechada)
export const visionAt = (vis, x, y) => {
  const i = Math.floor(x / C), j = Math.floor(y / C);
  return i < 0 || j < 0 || i >= N || j >= N ? 0 : vis[j * N + i];
};
