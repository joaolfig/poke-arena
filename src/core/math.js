// Vetores e testes geométricos (tudo no plano 2D; ver seção 6 de matematica-moba.md).

export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;
export const angleTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// círculo × círculo
export const circleHit = (ax, ay, ar, bx, by, br) => dist2(ax, ay, bx, by) <= (ar + br) ** 2;

// distância² de um ponto (px, py) ao segmento (x0, y0)-(x1, y1)
export function segDist2(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy;
  const t = L ? clamp(((px - x0) * dx + (py - y0) * dy) / L, 0, 1) : 0;
  return dist2(px, py, x0 + t * dx, y0 + t * dy);
}

// faixa (retângulo que sai de x,y no ângulo a, comprimento len, largura w) × círculo
export function lineHit(o, x, y, r) {
  const dx = x - o.x, dy = y - o.y, c = Math.cos(o.a), s = Math.sin(o.a);
  const u = dx * c + dy * s, v = -dx * s + dy * c;
  return u > -r && u < o.len + r && Math.abs(v) < o.w / 2 + r;
}

// ponto a no máximo `max` de distância de `from` na direção de `to`
export function clampRange(from, to, max) {
  const d = Math.hypot(to.x - from.x, to.y - from.y);
  if (d <= max) return { x: to.x, y: to.y };
  return { x: from.x + (to.x - from.x) / d * max, y: from.y + (to.y - from.y) / d * max };
}

// pseudo-random distribution: chance cresce a cada tentativa sem sucesso (P(N) = C × N)
const PRD_C = new Map();
export function prdC(p) {
  if (PRD_C.has(p)) return PRD_C.get(p);
  // acha C por bisseção: a chance média resultante tem que ser p
  let lo = 0, hi = p;
  for (let i = 0; i < 40; i++) {
    const c = (lo + hi) / 2;
    let pOk = 0, pPrev = 1, sumN = 0;
    for (let n = 1; pPrev > 1e-9 && n < 1000; n++) {
      const pn = Math.min(1, c * n) * pPrev;
      sumN += n * pn; pOk += pn; pPrev -= pn;
    }
    if (1 / sumN > p) hi = c; else lo = c;
  }
  const c = (lo + hi) / 2;
  PRD_C.set(p, c);
  return c;
}
