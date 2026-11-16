// Partículas, números de dano e explosões dos golpes (estilos do Poké Realm: MOVE_STYLE).

import { MOVE_STYLE } from '../data/moves.js';
import { TYPE_COLORS } from '../data/types.js';
import { rand } from '../core/math.js';

// cores de cada tiro (as mesmas do projétil em render.js) para o impacto e o rastro
export const SHOT_COLORS = {
  melee: ['#ffffff', '#e2e8f0', '#94a3b8'], orb: ['#ffffff', '#e2e8f0', '#cbd5e1'], tower: ['#ffffff', '#93c5fd', '#60a5fa'],
  fireball: ['#fff7ed', '#fb923c', '#ef4444'], leaf: ['#bbf7d0', '#4ade80', '#16a34a'], spark: ['#fef9c3', '#fde047', '#facc15'],
  shadowball: ['#ddd6fe', '#a78bfa', '#6d28d9'], psyorb: ['#fff', '#f472b6', '#ec4899'], fairystar: ['#fff', '#fbcfe8', '#f9a8d4'],
  arrow: ['#ecfccb', '#a3e635', '#65a30d'], iceshard: ['#f0f9ff', '#bae6fd', '#38bdf8'], wind: ['#fff', '#f1f5f9', '#cbd5e1'],
  bug: ['#ecfccb', '#bef264', '#84cc16'], bubble: ['#e0f2fe', '#7dd3fc', '#38bdf8'],
};

export class Fx {
  constructor() { this.parts = []; this.texts = []; this.rings = []; this.beams = []; this.bolts = []; this.hits = []; }

  // impacto do ataque básico: corte em meia-lua no corpo a corpo, clarão com faíscas da cor do tiro à distância;
  // crítico = maior, dourado e com um corte em X. a = direção de quem bateu para o alvo
  impact(x, y, style, crit, a) {
    const cols = SHOT_COLORS[style] || SHOT_COLORS.orb, k = crit ? 1.6 : 1;
    if (style === 'melee') {
      this.hits.push({ t: 'slash', x, y, a: a + Math.PI / 2 + rand(-0.4, 0.4), r: 62 * k, color: crit ? '#fde047' : '#f8fafc', glow: crit ? '#f59e0b' : '#94a3b8', life: 0.2, max: 0.2 });
      if (crit) this.hits.push({ t: 'slash', x, y, a: a - 0.3, r: 70, color: '#fef3c7', glow: '#f59e0b', life: 0.24, max: 0.24, flip: true });
    }
    this.hits.push({ t: 'flash', x, y, r: (style === 'melee' ? 34 : 40) * k, color: crit ? '#fde047' : cols[1], life: 0.16, max: 0.16 });
    const n = crit ? 14 : 8;
    for (let i = 0; i < n; i++) {
      const d = a + rand(-1.1, 1.1), sp = rand(160, 420) * k;
      this.parts.push({ x, y, vx: Math.cos(d) * sp, vy: Math.sin(d) * sp - rand(0, 60), life: rand(0.15, 0.32), color: crit && i % 2 ? '#fde047' : cols[i % cols.length], size: rand(3, 6) * (crit ? 1.3 : 1), glow: true });
    }
    if (crit) this.ring(x, y, 70, '#fde047', 0.25);
  }


  text(x, y, s, color, size = 22, life = 0.9) { this.texts.push({ x, y, s, color, size, life, max: life, vy: -70 }); }
  ring(x, y, R, color, life = 0.4, fill = false) { this.rings.push({ x, y, R, color, life, max: life, fill }); }
  burstColor(x, y, color, n = 14) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, sp = rand(60, 220); this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.3, 0.6), color, size: rand(4, 8) }); }
  }

  // golpe estourou: z no formato de rede [id, s, x, y, r, t, max, team, fx, elem, a, len, w...]
  burst(z) {
    const s = z[1], x = z[2], y = z[3], fx = z[8], elem = z[9];
    const S = MOVE_STYLE[fx];
    const col = () => S ? S.c[Math.floor(Math.random() * S.c.length)] : (TYPE_COLORS[elem] || '#fca5a5');
    const big = S && S.big ? 3 : 0;
    if (s === 1) {
      const a = z[10], len = z[11], w = z[12], ca = Math.cos(a), sa = Math.sin(a);
      for (let i = 0; i < 40; i++) {
        const k = Math.random() * len, side = (Math.random() - 0.5) * w * 0.8, sp = rand(200, 520);
        this.parts.push({ x: x + ca * k - sa * side, y: y + sa * k + ca * side, vx: ca * sp + (S && S.swirl ? -sa * rand(-150, 150) : 0), vy: sa * sp + (S && S.swirl ? ca * rand(-150, 150) : 0) - (S && S.rise ? rand(30, 100) : 0), life: rand(0.3, 0.6), color: col(), size: rand(5, 9) + big });
      }
      if (S && S.beam) this.beams.push({ x, y, a, len, w: w * 0.7, color: S.beam, life: 0.25, max: 0.25 });
    } else {
      const R = z[4] || 50;
      for (let i = 0; i < (s === 2 ? 12 : 22); i++) {
        const a = Math.random() * 6.28, d = Math.random() * R * 0.8, sp = rand(80, 260);
        this.parts.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: S && S.swirl ? -Math.sin(a) * sp : Math.cos(a) * sp, vy: (S && S.swirl ? Math.cos(a) * sp : Math.sin(a) * sp) - (S && S.rise ? rand(80, 200) : 0), life: rand(0.3, 0.7), color: col(), size: rand(5, 9) + big });
      }
      if (S && S.sky) {
        const pts = []; for (let i = 0; i <= 6; i++) pts.push([x + (fx === 'meteor' ? -200 * (1 - i / 6) : (i && i < 6 ? rand(-28, 28) : 0)), y - 520 * (1 - i / 6)]);
        this.bolts.push({ pts, color: S.c[1], life: 0.22, max: 0.22 });
      }
      this.ring(x, y, R, (S && S.c[1]) || TYPE_COLORS[elem] || '#fca5a5', 0.35, true);
    }
  }

  // Cetro Relampejante: raios ligando os alvos
  chain(pts) {
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], seg = [];
      for (let k = 0; k <= 6; k++) seg.push([x0 + (x1 - x0) * k / 6 + (k && k < 6 ? rand(-30, 30) : 0), y0 + (y1 - y0) * k / 6 + (k && k < 6 ? rand(-30, 30) : 0)]);
      this.bolts.push({ pts: seg, color: '#fde047', life: 0.3, max: 0.3 });
      this.burstColor(x1, y1, '#fef9c3', 8);
    }
  }

  // rastro dos golpes que andam
  trail(x, y, r, fx) {
    const S = MOVE_STYLE[fx];
    if (!S || Math.random() > 0.5) return;
    this.parts.push({ x: x + rand(-r * 0.6, r * 0.6), y: y + rand(-r * 0.6, r * 0.6), vx: rand(-40, 40), vy: S.rise ? -rand(40, 100) : rand(-40, 40), life: rand(0.25, 0.5), color: S.c[Math.floor(Math.random() * S.c.length)], size: rand(3, 7) });
  }

  update(dt) {
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt; }
    for (const t of this.texts) { t.y += t.vy * dt; t.vy *= 0.94; t.life -= dt; }
    for (const l of [this.rings, this.beams, this.bolts, this.hits]) for (const o of l) o.life -= dt;
    this.hits = this.hits.filter(o => o.life > 0);
    this.parts = this.parts.filter(p => p.life > 0);
    if (this.parts.length > 1500) this.parts.splice(0, this.parts.length - 1500);
    this.texts = this.texts.filter(t => t.life > 0);
    this.rings = this.rings.filter(o => o.life > 0); this.beams = this.beams.filter(o => o.life > 0); this.bolts = this.bolts.filter(o => o.life > 0);
  }

  // desenho em coordenadas do mundo (ctx já transformado)
  drawWorld(ctx) {
    for (const b of this.beams) {
      ctx.save(); ctx.globalAlpha = b.life / b.max; ctx.translate(b.x, b.y); ctx.rotate(b.a);
      ctx.fillStyle = b.color; ctx.fillRect(0, -b.w / 2, b.len, b.w); ctx.restore();
    }
    for (const r of this.rings) {
      const k = 1 - r.life / r.max;
      ctx.save(); ctx.globalAlpha = (1 - k) * 0.8; ctx.strokeStyle = r.color; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.R * (0.4 + k * 0.7), 0, 7); ctx.stroke();
      if (r.fill) { ctx.globalAlpha = (1 - k) * 0.25; ctx.fillStyle = r.color; ctx.fill(); }
      ctx.restore();
    }
    for (const b of this.bolts) {
      ctx.save(); ctx.globalAlpha = b.life / b.max; ctx.strokeStyle = b.color; ctx.lineWidth = 10; ctx.beginPath();
      b.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke(); ctx.restore();
    }
    for (const p of this.parts) if (!p.glow) { ctx.globalAlpha = Math.min(1, p.life * 3); ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
    // impactos dos ataques básicos, com brilho somado (fica luminoso sobre o chão)
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const h of this.hits) {
      const k = 1 - h.life / h.max;
      if (h.t === 'flash') {
        const r = h.r * (0.5 + k * 0.8), g = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, r);
        g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.35, h.color); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 1 - k; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(h.x, h.y, r, 0, 7); ctx.fill();
      } else {
        // meia-lua que varre: cresce do começo ao fim do arco e some
        const sweep = 2.2, a0 = h.a - sweep / 2, a1 = a0 + sweep * Math.min(1, k * 2.5), dir = h.flip ? -1 : 1;
        ctx.save(); ctx.translate(h.x, h.y); ctx.scale(dir, 0.6); ctx.globalAlpha = 1 - k * k;
        ctx.lineCap = 'round'; ctx.shadowColor = h.glow; ctx.shadowBlur = 18;
        ctx.strokeStyle = h.glow; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(0, 0, h.r, a0, a1); ctx.stroke();
        ctx.strokeStyle = h.color; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, h.r, a0 + 0.15, a1); ctx.stroke();
        ctx.restore();
      }
    }
    for (const p of this.parts) if (p.glow) { ctx.globalAlpha = Math.min(1, p.life * 4); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size / 2, 0, 7); ctx.fill(); }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // textos ficam do mesmo tamanho na tela, qualquer que seja o zoom
  drawTexts(ctx, toScreen) {
    ctx.save();
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const [sx, sy] = toScreen(t.x, t.y);
      ctx.globalAlpha = Math.min(1, t.life / t.max * 2);
      ctx.font = `bold ${t.size}px system-ui, sans-serif`;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.strokeText(t.s, sx, sy);
      ctx.fillStyle = t.color; ctx.fillText(t.s, sx, sy);
    }
    ctx.restore();
  }
}
