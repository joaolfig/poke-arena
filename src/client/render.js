// Desenho da partida num canvas 2D: terreno (em pedaços guardados), avisos dos golpes, unidades com
// sprites animados, projéteis, efeitos, névoa de guerra e minimapa.

import { GRID, BRUSHES, FOUNTAIN, LANES, LANE_NAMES, CAMPS } from '../sim/map.js';
import { MAP, TEAM_COLOR, TOWER, MINION, GAME } from '../config.js';
import { TYPE_COLORS } from '../data/types.js';
import { MOVE_STYLE, movePos } from '../data/moves.js';
import { CHAMPIONS, formAt } from '../data/champions.js';
import { MINION_SETS } from '../data/minionSets.js';
import { spriteFrame, drawSprite, ensureSprite } from './sprites.js';
import { segDist2 } from '../core/math.js';
import { SHOT_COLORS } from './fx.js';

const { N, C, walk, brush, lane, river } = GRID;
const BIG_PIDS = new Set(CAMPS.filter(c => c.big).map(c => c.pid));   // chefes do rio: desenhados maiores
const S = MAP.size;
const CHUNK = C * 8;
const BODY = { champ: 150, melee: 80, ranged: 80, siege: 105, monster: 150 };

// campeões crescem a cada evolução: 1º estágio menor, Mega maior
function bodyH(u) {
  if (u.kind === 'monster' && BIG_PIDS.has(u.pid)) return 270;
  if (u.kind !== 'champ') return BODY[u.kind] || 100;
  const def = CHAMPIONS[u.champ], f = formAt(def, u.lvl), dyna = u.dyna ? 1.7 : 1;   // Dynamax: gigante
  if (f.mega) return BODY.champ * 1.15 * dyna;
  return BODY.champ * (def.evo.length === 3 ? [0.72, 0.88, 1] : [0.8, 1])[f.stage] * dyna;
}

// aleatório estável por célula (o terreno sai sempre igual)
const hash = (i, j, k = 0) => { let h = (i * 374761393 + j * 668265263 + k * 1442695041) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const cellWalk = (i, j) => i >= 0 && j >= 0 && i < N && j < N && walk[j * N + i] === 1;
// centro das lanes (terra batida): perto da linha de alguma das três
const onLaneCenter = (x, y) => LANE_NAMES.some(l => { const p = LANES[l]; for (let i = 1; i < p.length; i++) if (segDist2(x, y, p[i - 1].x, p[i - 1].y, p[i].x, p[i].y) < 300 * 300) return true; return false; });

export class Renderer {
  constructor(canvas, mini) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.mini = mini; this.mctx = mini.getContext('2d');
    this.cam = { x: S / 2, y: S / 2, zoom: 0.6 };
    this.chunks = new Map();
    this.anim = new Map();      // estado de animação por unidade
    this.mprev = new Map();     // posição anterior de cada projétil (para a direção da flecha)
    this.fogCv = document.createElement('canvas'); this.fogCv.width = this.fogCv.height = N;
    this.fogCtx = this.fogCv.getContext('2d'); this.fogImg = this.fogCtx.createImageData(N, N);
    this.miniBase = this.paintMinimapBase();
    this.resize();
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.cv.width = this.W * dpr; this.cv.height = this.H * dpr;
    this.cv.style.width = this.W + 'px'; this.cv.style.height = this.H + 'px';
  }

  get scale() { return this.cam.zoom * Math.max(this.W, 1280) / 1920; }
  toScreen = (x, y) => [(x - this.cam.x) * this.scale + this.W / 2, (y - this.cam.y) * this.scale + this.H / 2];
  toWorld(sx, sy) { return { x: (sx - this.W / 2) / this.scale + this.cam.x, y: (sy - this.H / 2) / this.scale + this.cam.y }; }

  // ---------- terreno ----------
  chunk(ci, cj) {
    const key = ci * 1000 + cj;
    let c = this.chunks.get(key);
    if (c) { this.chunks.delete(key); this.chunks.set(key, c); return c; }
    c = document.createElement('canvas'); c.width = c.height = CHUNK;
    const x = c.getContext('2d');
    x.translate(-ci * CHUNK, -cj * CHUNK);
    const i0 = Math.floor(ci * CHUNK / C) - 1, j0 = Math.floor(cj * CHUNK / C) - 1, n = CHUNK / C + 2;
    // chão
    for (let j = j0; j < j0 + n; j++) for (let i = i0; i < i0 + n; i++) {
      if (!cellWalk(i, j)) continue;
      const cx = i * C, cy = j * C, h = hash(i, j);
      const onLane = lane[j * N + i] && onLaneCenter(cx + C / 2, cy + C / 2), water = river[j * N + i];
      const base = FOUNTAIN.map((f, t) => Math.hypot(cx - f.x, cy - f.y) < 1700 ? t : -1).find(t => t >= 0);
      x.fillStyle = base !== undefined ? (base === 0 ? `hsl(215,18%,${36 + h * 6}%)` : `hsl(355,16%,${36 + h * 6}%)`)
        : onLane ? `hsl(35,${28 + h * 8}%,${44 + h * 6}%)` : water ? `hsl(${195 + h * 10},45%,${34 + h * 6}%)` : `hsl(${95 + h * 15},38%,${30 + h * 6}%)`;
      x.fillRect(cx - 1, cy - 1, C + 2, C + 2);
      // detalhes: pedrinhas na lane, tufos na grama
      if (h > 0.7) {
        x.fillStyle = onLane ? 'rgba(90,70,50,.35)' : water ? 'rgba(186,230,253,.35)' : 'rgba(30,70,20,.5)';
        const px = cx + hash(i, j, 1) * C, py = cy + hash(i, j, 2) * C;
        x.beginPath(); x.arc(px, py, 4 + hash(i, j, 3) * 7, 0, 7); x.fill();
      }
    }
    // piso de pedra nas bases
    x.strokeStyle = 'rgba(0,0,0,.12)'; x.lineWidth = 2;
    for (const f of FOUNTAIN) for (let r = 300; r < 1700; r += 300) { x.beginPath(); x.arc(f.x, f.y, r, 0, 7); x.stroke(); }
    // moitas
    for (const b of BRUSHES) {
      for (let k = 0; k < 70; k++) {
        const a = hash(k, b.x | 0) * 6.28, d = Math.sqrt(hash(k, b.y | 0)) * b.r * 0.95;
        const px = b.x + Math.cos(a) * d, py = b.y + Math.sin(a) * d;
        x.fillStyle = `hsl(${110 + hash(k, 7) * 30},45%,${20 + hash(k, 9) * 12}%)`;
        x.beginPath(); x.moveTo(px - 14, py + 10); x.lineTo(px, py - 30 - hash(k, 3) * 20); x.lineTo(px + 14, py + 10); x.fill();
      }
    }
    // paredes: floresta densa com borda escura
    for (let j = j0; j < j0 + n; j++) for (let i = i0; i < i0 + n; i++) {
      if (cellWalk(i, j)) continue;
      const cx = i * C, cy = j * C;
      x.fillStyle = '#15301f'; x.fillRect(cx - 1, cy - 1, C + 2, C + 2);
    }
    for (let j = j0; j < j0 + n; j++) for (let i = i0; i < i0 + n; i++) {
      if (cellWalk(i, j)) continue;
      const edge = cellWalk(i + 1, j) || cellWalk(i - 1, j) || cellWalk(i, j + 1) || cellWalk(i, j - 1);
      const h = hash(i, j);
      const px = i * C + C / 2 + (hash(i, j, 4) - 0.5) * 30, py = j * C + C / 2 + (hash(i, j, 5) - 0.5) * 30;
      if (edge) {
        // pedras na borda
        x.fillStyle = `hsl(30,8%,${30 + h * 12}%)`;
        x.beginPath(); x.ellipse(px, py, 38 + h * 14, 30 + h * 10, h * 3, 0, 7); x.fill();
        x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 3; x.stroke();
      } else if (h > 0.35) {
        // copas de árvore
        x.fillStyle = `hsl(${120 + h * 25},40%,${14 + h * 10}%)`;
        x.beginPath(); x.arc(px, py, 34 + h * 22, 0, 7); x.fill();
        x.fillStyle = 'rgba(255,255,255,.05)'; x.beginPath(); x.arc(px - 10, py - 10, 16 + h * 10, 0, 7); x.fill();
      }
    }
    this.chunks.set(key, c);
    if (this.chunks.size > 90) this.chunks.delete(this.chunks.keys().next().value);
    return c;
  }

  drawTerrain(ctx) {
    const a = this.toWorld(0, 0), b = this.toWorld(this.W, this.H);
    const ci0 = Math.max(0, Math.floor(a.x / CHUNK)), ci1 = Math.min(Math.ceil(S / CHUNK) - 1, Math.floor(b.x / CHUNK));
    const cj0 = Math.max(0, Math.floor(a.y / CHUNK)), cj1 = Math.min(Math.ceil(S / CHUNK) - 1, Math.floor(b.y / CHUNK));
    for (let ci = ci0; ci <= ci1; ci++) for (let cj = cj0; cj <= cj1; cj++) ctx.drawImage(this.chunk(ci, cj), ci * CHUNK, cj * CHUNK);
  }

  // ---------- fonte e loja ----------
  // a fonte cura (círculo brilhando com partículas subindo); a Poké Mart ao lado marca de onde dá para comprar
  drawBases(ctx, ui) {
    const t = performance.now() / 1000;
    FOUNTAIN.forEach((f, team) => {
      const c = TEAM_COLOR[team], R = GAME.fountainRadius;
      ctx.save();
      // área da loja (tracejada) e área de cura (preenchida, pulsando)
      ctx.strokeStyle = 'rgba(253,230,138,.45)'; ctx.lineWidth = 6; ctx.setLineDash([30, 22]); ctx.lineDashOffset = -t * 30;
      ctx.beginPath(); ctx.arc(f.x, f.y, GAME.shopRadius, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      const g = ctx.createRadialGradient(f.x, f.y, R * 0.2, f.x, f.y, R);
      g.addColorStop(0, c + '55'); g.addColorStop(0.85, c + '22'); g.addColorStop(1, c + '00');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, R, 0, 7); ctx.fill();
      ctx.strokeStyle = c; ctx.globalAlpha = 0.5 + Math.sin(t * 3) * 0.2; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(f.x, f.y, R, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
      // a fonte: pedestal com um cristal de cura
      ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.ellipse(f.x, f.y, 150, 70, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#86efac'; ctx.shadowColor = '#4ade80'; ctx.shadowBlur = 40;
      const top = f.y - 200 - Math.sin(t * 2) * 12;
      ctx.beginPath(); ctx.moveTo(f.x, top); ctx.lineTo(f.x + 50, f.y - 110); ctx.lineTo(f.x, f.y - 40); ctx.lineTo(f.x - 50, f.y - 110); ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      // partículas de cura subindo (cruzinhas verdes)
      ctx.fillStyle = 'rgba(134,239,172,.8)';
      for (let i = 0; i < 14; i++) {
        const a = i * 2.4, k = (t * 0.35 + i / 14) % 1, rr = 120 + (i * 53) % (R - 200);
        const px = f.x + Math.cos(a) * rr, py = f.y + Math.sin(a) * rr * 0.7 - k * 160;
        ctx.globalAlpha = 1 - k; ctx.fillRect(px - 10, py - 3, 20, 6); ctx.fillRect(px - 3, py - 10, 6, 20);
      }
      ctx.globalAlpha = 1;
      // Poké Mart (a loja), entre a fonte e a lane
      const dir = team === 0 ? 1 : -1, sx = f.x + dir * 480, sy = f.y - dir * 160;
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(sx - 130, sy - 10, 260, 30);
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(sx - 120, sy - 150, 240, 150);
      ctx.fillStyle = '#2563eb'; ctx.beginPath(); ctx.moveTo(sx - 145, sy - 150); ctx.lineTo(sx + 145, sy - 150); ctx.lineTo(sx + 115, sy - 215); ctx.lineTo(sx - 115, sy - 215); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#1e3a8a'; ctx.fillRect(sx - 35, sy - 80, 70, 80);
      ctx.fillStyle = '#93c5fd'; ctx.fillRect(sx - 105, sy - 120, 50, 40); ctx.fillRect(sx + 55, sy - 120, 50, 40);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 44px system-ui'; ctx.textAlign = 'center'; ctx.fillText('MART', sx, sy - 165);
      ctx.restore();
    });
  }

  // ---------- névoa ----------
  paintFog(vis) {
    const d = this.fogImg.data;
    for (let k = 0; k < N * N; k++) {
      const v = vis[k];
      d[k * 4] = 8; d[k * 4 + 1] = 12; d[k * 4 + 2] = 24;
      d[k * 4 + 3] = v === 1 ? 0 : v === 2 ? 70 : 150;
    }
    this.fogCtx.putImageData(this.fogImg, 0, 0);
  }

  // ---------- quadro ----------
  draw(f, ui, fx, now) {
    const ctx = this.ctx, sc = this.scale;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#0b1a12'; ctx.fillRect(0, 0, this.W, this.H);
    ctx.save();
    ctx.translate(this.W / 2, this.H / 2); ctx.scale(sc, sc); ctx.translate(-this.cam.x, -this.cam.y);
    this.drawTerrain(ctx);
    this.drawBases(ctx, ui);

    if (f) {
      const me = f.units.find(u => u.id === ui.meId);
      // alcance das torres inimigas quando chega perto (como no LoL)
      for (const u of f.units) {
        if (u.kind !== 'tower' || u.team === ui.team || !me || Math.hypot(me.x - u.x, me.y - u.y) > TOWER.range + 700) continue;
        ctx.strokeStyle = 'rgba(239,68,68,.55)'; ctx.lineWidth = 4; ctx.setLineDash([24, 16]);
        ctx.beginPath(); ctx.arc(u.x, u.y, TOWER.range + u.r, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      }
      this.drawZones(ctx, f, ui, fx);
      this.drawIndicator(ctx, ui, me);
      if (ui.marker && now - ui.marker.t < 0.5) {
        const k = (now - ui.marker.t) / 0.5;
        ctx.strokeStyle = ui.marker.attack ? `rgba(248,113,113,${1 - k})` : `rgba(134,239,172,${1 - k})`; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(ui.marker.x, ui.marker.y, 40 * (1 - k * 0.6), 0, 7); ctx.stroke();
      }
      const list = [...f.units].sort((a, b) => a.y - b.y);
      for (const u of list) this.drawUnitBase(ctx, u, ui);
      for (const u of list) this.drawUnit(ctx, u, ui, now);
      for (const m of f.missiles) this.drawMissile(ctx, m, ui, fx);
    }
    fx.drawWorld(ctx);
    // névoa por cima de tudo, borrada (cada pixel do canvas pequeno é uma célula)
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.fogCv, 0, 0, S, S);
    ctx.restore();

    if (f) for (const u of f.units) this.drawBars(ctx, u, ui);
    FOUNTAIN.forEach((fo, team) => {
      const dir = team === 0 ? 1 : -1;
      this.label(ctx, fo.x, fo.y - 260, team === ui.team ? '💚 Fonte' : 'Fonte inimiga', team === ui.team ? '#86efac' : '#fca5a5');
      if (team === ui.team) this.label(ctx, fo.x + dir * 480, fo.y - dir * 160 - 240, '🛒 Loja [P]', '#fde68a');
    });
    fx.drawTexts(ctx, this.toScreen);
    this.drawMinimap(f, ui);
  }

  drawZones(ctx, f, ui, fx) {
    const now = performance.now() / 1000;
    for (const z of f.zones) {
      const [, s, x, y, r, t0, max, team, fxk, elem] = z;
      const t = t0 + f.lag, mine = team === ui.team;
      const S = MOVE_STYLE[fxk], col = (S && S.c[2]) || TYPE_COLORS[elem] || '#ef4444';
      const f0 = mine ? 'rgba(96,165,250,.10)' : 'rgba(220,38,38,.16)', f1 = mine ? 'rgba(147,197,253,.28)' : 'rgba(239,68,68,.38)';
      const k = Math.max(0, Math.min(1, 1 - t / max));
      ctx.save();
      if (s === 2) {
        // golpe que anda: quem lançou vê o caminho enquanto ele não sai; depois todos veem o golpe
        const o = { x, y, a: z[10], spd: z[11], wob: z[13], ph: z[14], ts: z[16] || 1 };
        const dur = z[12];
        if (t > 0) {
          ctx.globalAlpha = 0.6; ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash([16, 12]); ctx.beginPath();
          for (let i = 0; i <= 14; i++) { const q = movePos(o, dur * i / 14); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }
          ctx.stroke(); ctx.setLineDash([]);
        } else {
          const act = Math.min(dur, z[15] - f.lag), q = movePos(o, Math.max(0, act));
          this.drawMover(ctx, q.x, q.y, r, fxk, col, o.a);
          fx.trail(q.x, q.y, r, fxk);
        }
      } else if (s === 3) {
        // projétil: um feixe de luz do tamanho da faixa, voando
        const a = z[10], len = z[11], w = z[12], spd = z[13];
        const head = t > 0 ? -1 : Math.min(len, (z[14] - f.lag) * spd);
        if (head >= 0) {
          const tail = Math.max(0, head - Math.max(w * 1.8, 140));
          const hx = x + Math.cos(a) * head, hy = y + Math.sin(a) * head, tx = x + Math.cos(a) * tail, ty = y + Math.sin(a) * tail;
          const g = ctx.createLinearGradient(tx, ty, hx, hy);
          g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.6, (S && S.c[1]) || col); g.addColorStop(1, '#fff');
          ctx.strokeStyle = g; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(14, w * 0.75);
          ctx.shadowColor = col; ctx.shadowBlur = 20;
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
          fx.trail(hx, hy, w / 2, fxk);
        }
      } else if (s === 4) {
        // nuvem / santuário: círculo pulsando com partículas
        const pulse = 0.85 + Math.sin(now * 5) * 0.08, heal = fxk === 'fairy';
        ctx.globalAlpha = 0.85;
        const gr = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
        gr.addColorStop(0, heal ? 'rgba(253,230,138,.10)' : 'rgba(0,0,0,0)');
        gr.addColorStop(1, heal ? 'rgba(253,230,138,.38)' : fxk === 'dust' ? 'rgba(214,211,209,.42)' : 'rgba(168,85,247,.38)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r * pulse, 0, 7); ctx.fill();
        ctx.strokeStyle = mine ? '#93c5fd' : '#f87171'; ctx.lineWidth = 3; ctx.setLineDash([10, 10]); ctx.lineDashOffset = -now * 40;
        ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
        if (Math.random() < 0.6) fx.trail(x + (Math.random() - 0.5) * r * 1.4, y + (Math.random() - 0.5) * r * 1.4, 30, fxk);
      } else if (s === 5) {
        // armadilha (só o próprio time vê): armando, fica apagada
        ctx.globalAlpha = t > 0 ? 0.4 : 0.9;
        ctx.strokeStyle = '#84cc16'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(x, y, 34, 0, 7); ctx.stroke();
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 34, y + Math.sin(a) * 34); ctx.lineTo(x + Math.cos(a) * 52, y + Math.sin(a) * 52); ctx.stroke(); }
        ctx.globalAlpha = 0.15; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
      } else if (t > -0.05) {
        ctx.globalAlpha = 0.9;
        if (s === 0) {
          ctx.fillStyle = f0; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
          ctx.fillStyle = f1; ctx.beginPath(); ctx.arc(x, y, r * k, 0, 7); ctx.fill();
          ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash([12, 8]); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
        } else {
          const a = z[10], len = z[11], w = z[12];
          ctx.translate(x, y); ctx.rotate(a);
          ctx.fillStyle = f0; ctx.fillRect(0, -w / 2, len, w);
          ctx.fillStyle = f1; ctx.fillRect(0, -w / 2, len * k, w);
          ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash([12, 8]); ctx.strokeRect(0, -w / 2, len, w);
        }
      }
      ctx.restore();
    }
  }

  // golpe que anda: cada estilo tem um desenho próprio (para nenhum parecer com outro)
  drawMover(ctx, x, y, r, fxk, col, a) {
    const t = performance.now() / 1000, S = MOVE_STYLE[fxk];
    const c = i => (S ? S.c[i % S.c.length] : col);
    ctx.save();
    switch (fxk) {
      case 'wind': // tornado
        for (let i = 0; i < 7; i++) {
          const k = i / 6, wob = Math.sin(t * 9 + i) * 8 * k;
          ctx.strokeStyle = `rgba(241,245,249,${0.85 - k * 0.3})`; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.ellipse(x + wob, y + r * 0.4 - i * r * 0.32, r * (0.3 + k * 0.9), r * (0.12 + k * 0.22), 0, 0, 7); ctx.stroke();
        }
        break;
      case 'boulder': case 'rock': // pedra rolando
        ctx.fillStyle = '#78716c'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
        ctx.strokeStyle = '#44403c'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y, r * 0.6, t * 9, t * 9 + 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, r * 0.3, t * 9 + 3, t * 9 + 4.5); ctx.stroke();
        break;
      case 'whirl': // redemoinho
        ctx.fillStyle = 'rgba(37,99,235,.35)'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
        for (let i = 0; i < 4; i++) { ctx.strokeStyle = i % 2 ? '#e0f2fe' : '#60a5fa'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y, r * (0.3 + i * 0.22), t * (6 + i) + i, t * (6 + i) + i + 3.6); ctx.stroke(); }
        break;
      case 'flame': // roda de fogo
        for (let i = 0; i < 8; i++) {
          const ang = t * 14 + i * Math.PI / 4;
          ctx.fillStyle = c(i); ctx.beginPath(); ctx.arc(x + Math.cos(ang) * r * 0.7, y + Math.sin(ang) * r * 0.7, r * 0.35, 0, 7); ctx.fill();
        }
        ctx.fillStyle = '#fef08a'; ctx.beginPath(); ctx.arc(x, y, r * 0.4, 0, 7); ctx.fill();
        break;
      case 'ghostfire': case 'shadow': { // fogo-fátuo / orbe sombrio: chama com cauda e olhinhos
        const back = a + Math.PI;
        for (let i = 4; i >= 0; i--) {
          ctx.globalAlpha = 0.25 + (4 - i) * 0.15; ctx.fillStyle = c(i);
          ctx.beginPath(); ctx.arc(x + Math.cos(back) * i * r * 0.45, y + Math.sin(back) * i * r * 0.45 + Math.sin(t * 12 + i) * 4, r * (1 - i * 0.15), 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1; ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.15, r * 0.15, 0, 7); ctx.arc(x + r * 0.25, y - r * 0.15, r * 0.15, 0, 7); ctx.fill();
        break;
      }
      case 'ice': // cristal de gelo girando
        ctx.translate(x, y); ctx.rotate(t * 8);
        ctx.fillStyle = '#e0f2fe'; ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) { const ang = i * Math.PI / 3, rr = i % 2 ? r * 0.55 : r; i ? ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr) : ctx.moveTo(rr, 0); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      case 'spark': case 'bolt': { // orbe elétrico com faíscas
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.3);
        g.addColorStop(0, '#fff'); g.addColorStop(0.4, '#fde047'); g.addColorStop(1, 'rgba(250,204,21,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.3, 0, 7); ctx.fill();
        ctx.strokeStyle = '#fef9c3'; ctx.lineWidth = 3;
        for (let i = 0; i < 4; i++) { const ang = Math.random() * 6.28; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ang) * r * 1.4, y + Math.sin(ang) * r * 1.4); ctx.stroke(); }
        break;
      }
      case 'aura': // esfera de aura com anel
        ctx.fillStyle = '#2563eb'; ctx.shadowColor = '#60a5fa'; ctx.shadowBlur = 25; ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, 7); ctx.fill();
        ctx.shadowBlur = 0; ctx.strokeStyle = '#bfdbfe'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(x, y, r * 1.2, r * 0.5, t * 6, 0, 7); ctx.stroke();
        break;
      case 'quake': // rastro de terra (Escavar)
        ctx.fillStyle = '#92400e'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.55, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#a16207';
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + (Math.random() - 0.5) * r * 2, y - Math.random() * r * 0.6, 7, 0, 7); ctx.fill(); }
        break;
      case 'psy': // bolha
        ctx.strokeStyle = '#f9a8d4'; ctx.lineWidth = 4; ctx.fillStyle = 'rgba(249,168,212,.25)';
        ctx.beginPath(); ctx.arc(x, y + Math.sin(t * 6) * 6, r, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.18, 0, 7); ctx.fill();
        break;
      case 'star': // estrela girando
        ctx.translate(x, y); ctx.rotate(t * 10); ctx.fillStyle = '#fde68a';
        ctx.beginPath();
        for (let i = 0; i < 10; i++) { const ang = i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; i ? ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr) : ctx.moveTo(rr, 0); }
        ctx.closePath(); ctx.fill();
        break;
      default: {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.3);
        g.addColorStop(0, '#fff'); g.addColorStop(0.35, col); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.3, 0, 7); ctx.fill();
      }
    }
    ctx.restore();
  }

  // indicador da habilidade segurada (alcance + formato do golpe), só para quem vai lançar
  drawIndicator(ctx, ui, me) {
    const ind = ui.indicator || (ui.showRange && ui.myRange ? { attackRange: ui.myRange } : null);
    if (!ind || !me) return;
    if (ui.showRange && ui.myRange) ind.attackRange = ui.myRange;
    ctx.save();
    if (ind.range) { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(me.x, me.y, ind.range, 0, 7); ctx.stroke(); }
    if (ind.attackRange) { ctx.strokeStyle = 'rgba(134,239,172,.6)'; ctx.lineWidth = 4; ctx.setLineDash([16, 10]); ctx.beginPath(); ctx.arc(me.x, me.y, ind.attackRange, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3;
    for (const p of ind.pieces || []) {
      ctx.save();
      if (p.s === 'c') { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); ctx.stroke(); }
      else if (p.s === 'l') { ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillRect(0, -p.w / 2, p.len, p.w); ctx.strokeRect(0, -p.w / 2, p.len, p.w); }
      else { ctx.setLineDash([14, 10]); ctx.beginPath(); ctx.moveTo(p.x, p.y); const q = movePos(p, p.dur); ctx.lineTo(q.x, q.y); ctx.stroke(); ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.stroke(); }
      ctx.restore();
    }
    if (ind.dashTo) {
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 6; ctx.setLineDash(ind.under ? [18, 14] : []);
      ctx.beginPath(); ctx.moveTo(me.x, me.y); ctx.lineTo(ind.dashTo.x, ind.dashTo.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(ind.dashTo.x, ind.dashTo.y, 40, 0, 7); ctx.stroke();
    }
    if (ind.at) { ctx.beginPath(); ctx.arc(ind.at.x, ind.at.y, ind.at.r, 0, 7); ctx.fill(); ctx.stroke(); }
    if (ind.radius) { ctx.beginPath(); ctx.arc(me.x, me.y, ind.radius, 0, 7); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }

  drawUnitBase(ctx, u, ui) {
    if (u.kind === 'tower' || u.kind === 'nexus' || u.travel) return;
    // sombra e anel do time
    const r = (u.kind === 'champ' ? 60 : u.kind === 'monster' ? 70 : 40) * (u.dyna ? 1.7 : 1);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(u.x, u.y, r, r * 0.45, 0, 0, 7); ctx.fill();
    if (u.team < 2) {
      ctx.strokeStyle = u.id === ui.meId ? '#facc15' : TEAM_COLOR[u.team];
      ctx.globalAlpha = u.kind === 'champ' ? 0.9 : 0.5; ctx.lineWidth = u.kind === 'champ' ? 5 : 3;
      ctx.beginPath(); ctx.ellipse(u.x, u.y, r, r * 0.45, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (u.id === ui.hoverId) {
      ctx.strokeStyle = u.team === ui.team ? '#93c5fd' : '#f87171'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(u.x, u.y, r + 12, (r + 12) * 0.45, 0, 0, 7); ctx.stroke();
    }
    const t = performance.now() / 1000;
    if (u.recall) {
      ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 6;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(u.x, u.y - 20 - i * 30, 70 - i * 10, 25, 0, t * 4 + i, t * 4 + i + 3.5); ctx.stroke(); }
    }
    // Ilusão (só o próprio time vê isto): aura roxa tracejada girando
    if (u.disguise) {
      ctx.save();
      ctx.strokeStyle = '#c084fc'; ctx.lineWidth = 5; ctx.setLineDash([14, 10]); ctx.lineDashOffset = -t * 60;
      ctx.beginPath(); ctx.ellipse(u.x, u.y, r + 26, (r + 26) * 0.45, 0, 0, 7); ctx.stroke();
      ctx.restore();
    }
  }

  drawUnit(ctx, u, ui, now) {
    if (u.kind === 'tower') return this.drawTower(ctx, u);
    if (u.kind === 'nexus') return this.drawNexus(ctx, u);
    let st = this.anim.get(u.id);
    if (!st) { st = {}; this.anim.set(u.id, st); if (this.anim.size > 600) this.anim.delete(this.anim.keys().next().value); }
    const melee = u.kind === 'champ' ? CHAMPIONS[u.champ] && !CHAMPIONS[u.champ].missile : u.kind === 'melee' || u.kind === 'monster';
    const h = bodyH(u);
    // Escavar / Voar (só o próprio time vê): uma sombra no caminho
    if (u.travel) {
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(u.x, u.y, 55, 24, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      return;
    }
    // evolução: como nos jogos, a silhueta branca alterna entre a forma antiga e a nova, cada vez mais rápido
    if (u.kind === 'champ') {
      if (st.lastPid !== undefined && st.lastPid !== u.pid) { st.evo = { from: st.lastPid, t0: now }; ensureSprite(st.lastPid); }
      st.lastPid = u.pid;
    }
    const EVO_T = 1.8, evoK = st.evo ? (now - st.evo.t0) / EVO_T : 2;
    if (evoK < 1) {
      this.evoGlow(ctx, u.x, u.y - h / 2, h, evoK, now);
      const blink = Math.sin(Math.pow(evoK, 2) * 60) > 0;   // troca de forma acelerando
      const pid = blink ? st.evo.from : u.pid;
      const ef = spriteFrame(pid, st.evoAnim || (st.evoAnim = {}), { moving: false, shotN: 0, hurtN: 0, face: Math.PI / 2, melee }, now);
      if (ef) drawSprite(ctx, ef, u.x, u.y, h * (blink ? 0.9 : 1), 1, '#ffffff!');
      return;
    }
    if (st.evo && evoK < 1.3) this.evoGlow(ctx, u.x, u.y - h / 2, h, 1, now, 1 - (evoK - 1) / 0.3);   // clarão final se apagando
    const fr = spriteFrame(u.pid, st, { moving: u.moving, shotN: u.shotN, hurtN: u.hurtN, face: u.face, melee }, now);
    const lift = u.cc & 4 ? 70 : 0;   // knockup: no ar
    // lampejo branco rápido ao levar dano; congelado fica azulado
    if (st.lastHurtSeen !== u.hurtN) { if (st.lastHurtSeen !== undefined) st.flashT = now; st.lastHurtSeen = u.hurtN; }
    const flash = now - (st.flashT || -9) < 0.08 ? '#ffffff' : u.cc & 128 ? '#7dd3fc' : null;
    // invisível ou disfarçado: o próprio time vê transparente
    const alpha = u.stealth ? 0.4 : u.disguise ? 0.55 : 1;
    if (u.invul) {
      ctx.save(); ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 6; ctx.shadowColor = '#fde68a'; ctx.shadowBlur = 25;
      ctx.beginPath(); ctx.arc(u.x, u.y - h / 2, h * 0.6, 0, 7); ctx.stroke(); ctx.restore();
    }
    if (fr) drawSprite(ctx, fr, u.x, u.y - lift, h, alpha, flash);
    else {
      ensureSprite(u.pid);
      ctx.globalAlpha = alpha; ctx.fillStyle = TEAM_COLOR[u.team] || '#a16207';
      ctx.beginPath(); ctx.arc(u.x, u.y - h / 2 - lift, h / 3, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    }
    if (u.disguise) {
      // como o inimigo te vê: um Rattata fantasma ao lado, e o selo da Ilusão
      const ghostPid = ui.minionSets ? MINION_SETS[ui.minionSets[1 - ui.team]].melee : MINION.melee.pid;
      const rf = spriteFrame(ghostPid, st.ghost || (st.ghost = {}), { moving: u.moving, shotN: 0, hurtN: 0, face: u.face, melee: true }, now);
      if (rf) drawSprite(ctx, rf, u.x + 80, u.y - 10, 70, 0.6);
    }
    // controle de grupo e status
    const top = u.y - h - 30 - lift;
    if (u.cc & 1) this.stars(ctx, u.x, top);
    if (u.cc & 2) { ctx.strokeStyle = '#65a30d'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(u.x, u.y, 60, 26, 0, 0, 7); ctx.stroke(); }
    if (u.cc & 128) {
      ctx.fillStyle = 'rgba(186,230,253,.45)'; ctx.strokeStyle = '#e0f2fe'; ctx.lineWidth = 3;
      ctx.fillRect(u.x - 55, u.y - h - 10, 110, h + 20); ctx.strokeRect(u.x - 55, u.y - h - 10, 110, h + 20);
    }
    const icons = [];
    if (u.cc & 16) icons.push('🔥');
    if (u.cc & 32) icons.push('☠');
    if (u.cc & 256) icons.push('⚡');
    if (u.cc & 64) icons.push('💤');
    if (u.cc & 512) icons.push('❄');
    if (icons.length) { ctx.font = '34px system-ui'; ctx.textAlign = 'center'; ctx.fillText(icons.join(''), u.x, top - (u.cc & 1 ? 30 : 0)); }
    if (u.shield > 0) { ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(u.x, u.y - h / 2 - lift, h * 0.6, 0, 7); ctx.stroke(); }
  }

  // brilho da evolução: halo branco crescendo e raios de luz girando
  evoGlow(ctx, x, y, h, k, now, fade = 1) {
    ctx.save();
    ctx.globalAlpha = fade;
    const R = h * (0.7 + k * 0.6);
    const g = ctx.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.4, 'rgba(224,242,254,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 6;
    for (let i = 0; i < 10; i++) {
      const a = now * 2.5 + i * Math.PI / 5, r0 = R * 0.5, r1 = R * (1.1 + 0.25 * Math.sin(now * 9 + i));
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); ctx.stroke();
    }
    ctx.restore();
  }

  stars(ctx, x, y) {
    const t = performance.now() / 1000;
    ctx.fillStyle = '#fde047';
    for (let i = 0; i < 3; i++) { const a = t * 5 + i * 2.1; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 34, y + Math.sin(a) * 10, 8, 0, 7); ctx.fill(); }
  }

  drawTower(ctx, u) {
    const c = TEAM_COLOR[u.team];
    ctx.save();
    ctx.globalAlpha = u.invuln ? 0.85 : 1;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(u.x, u.y, 95, 42, 0, 0, 7); ctx.fill();
    // base de pedra, coluna e cristal no topo
    ctx.fillStyle = '#57534e'; ctx.beginPath(); ctx.ellipse(u.x, u.y, 80, 36, 0, 0, 7); ctx.fill();
    const g = ctx.createLinearGradient(u.x - 50, 0, u.x + 50, 0);
    g.addColorStop(0, '#78716c'); g.addColorStop(0.5, '#d6d3d1'); g.addColorStop(1, '#57534e');
    ctx.fillStyle = g; ctx.fillRect(u.x - 45, u.y - 230, 90, 230);
    ctx.fillStyle = '#44403c'; ctx.fillRect(u.x - 58, u.y - 240, 116, 22);
    const t = performance.now() / 1000;
    ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 30;
    ctx.beginPath(); ctx.moveTo(u.x, u.y - 330 - Math.sin(t * 2) * 8); ctx.lineTo(u.x + 34, u.y - 270); ctx.lineTo(u.x, u.y - 245); ctx.lineTo(u.x - 34, u.y - 270); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  drawNexus(ctx, u) {
    const c = TEAM_COLOR[u.team], t = performance.now() / 1000;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(u.x, u.y, 170, 70, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#44403c'; ctx.beginPath(); ctx.ellipse(u.x, u.y, 150, 60, 0, 0, 7); ctx.fill();
    ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 50;
    const top = u.y - 330 - Math.sin(t * 1.5) * 12;
    ctx.beginPath(); ctx.moveTo(u.x, top); ctx.lineTo(u.x + 80, u.y - 160); ctx.lineTo(u.x, u.y - 40); ctx.lineTo(u.x - 80, u.y - 160); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(u.x, top); ctx.lineTo(u.x + 25, u.y - 160); ctx.lineTo(u.x, u.y - 60); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // ataque básico à distância: cada Pokémon com o seu tiro (a direção vem da posição anterior do projétil)
  drawMissile(ctx, m, ui, fx) {
    const [id, x, y, kind, team, shot] = m;
    const prev = this.mprev.get(id) || { x, y, a: 0, tr: [] };
    const a = Math.hypot(x - prev.x, y - prev.y) > 1 ? Math.atan2(y - prev.y, x - prev.x) : prev.a;
    const tr = [...prev.tr, [x, y]].slice(-7);
    this.mprev.set(id, { x, y, a, tr });
    // rastro: linha que afina e some, na cor do tiro
    if (tr.length > 1) {
      const c = SHOT_COLORS[shot] || (kind === 1 ? [TEAM_COLOR[team], TEAM_COLOR[team]] : SHOT_COLORS.orb);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (let i = 1; i < tr.length; i++) {
        const f = i / tr.length;
        ctx.globalAlpha = f * 0.55; ctx.strokeStyle = c[1]; ctx.lineWidth = (kind === 1 ? 22 : 14) * f;
        ctx.beginPath(); ctx.moveTo(tr[i - 1][0], tr[i - 1][1]); ctx.lineTo(tr[i][0], tr[i][1]); ctx.stroke();
      }
      ctx.restore();
    }
    if (this.mprev.size > 400) this.mprev.delete(this.mprev.keys().next().value);
    const t = performance.now() / 1000;
    const glow = (r, inner, outer) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, inner); g.addColorStop(0.45, outer); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };
    ctx.save();
    switch (shot) {
      case 'fireball': glow(26, '#fff7ed', '#f97316'); fx.trail(x, y, 14, 'flame'); break;
      case 'leaf':
        ctx.translate(x, y); ctx.rotate(t * 14); ctx.fillStyle = '#4ade80'; ctx.beginPath(); ctx.ellipse(0, 0, 18, 8, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = '#166534'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(18, 0); ctx.stroke(); break;
      case 'spark':
        ctx.strokeStyle = '#fde047'; ctx.lineWidth = 5; ctx.shadowColor = '#fde047'; ctx.shadowBlur = 14; ctx.beginPath();
        for (let i = 0; i <= 5; i++) { const k = i / 5 - 0.5, px = x - Math.cos(a) * k * 40 + Math.sin(a) * (i % 2 ? 8 : -8), py = y - Math.sin(a) * k * 40 - Math.cos(a) * (i % 2 ? 8 : -8); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.stroke(); break;
      case 'shadowball': glow(24, '#c4b5fd', '#581c87'); ctx.strokeStyle = 'rgba(167,139,250,.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 14, t * 8, t * 8 + 4); ctx.stroke(); fx.trail(x, y, 10, 'shadow'); break;
      case 'psyorb': glow(22, '#fff', '#f472b6'); ctx.strokeStyle = '#f9a8d4'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 18 + Math.sin(t * 12) * 4, 0, 7); ctx.stroke(); break;
      case 'fairystar':
        ctx.translate(x, y); ctx.rotate(t * 10); ctx.fillStyle = '#fbcfe8'; ctx.shadowColor = '#f9a8d4'; ctx.shadowBlur = 16; ctx.beginPath();
        for (let i = 0; i < 10; i++) { const ang = i * Math.PI / 5, rr = i % 2 ? 7 : 17; i ? ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr) : ctx.moveTo(rr, 0); }
        ctx.closePath(); ctx.fill(); break;
      case 'arrow':
        ctx.translate(x, y); ctx.rotate(a); ctx.strokeStyle = '#a3e635'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(10, 0); ctx.stroke();
        ctx.fillStyle = '#ecfccb'; ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(6, -7); ctx.lineTo(6, 7); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#65a30d'; ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(-24, -8); ctx.lineTo(-20, 0); ctx.lineTo(-24, 8); ctx.closePath(); ctx.fill(); break;
      case 'iceshard':
        ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = '#e0f2fe'; ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(0, -7); ctx.lineTo(-16, 0); ctx.lineTo(0, 7); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
      case 'wind': ctx.strokeStyle = 'rgba(241,245,249,.9)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 12, t * 12, t * 12 + 4.5); ctx.stroke(); break;
      case 'bug': glow(18, '#ecfccb', '#84cc16'); break;
      case 'bubble': ctx.strokeStyle = '#7dd3fc'; ctx.lineWidth = 3; ctx.fillStyle = 'rgba(125,211,252,.3)'; ctx.beginPath(); ctx.arc(x, y, 13, 0, 7); ctx.fill(); ctx.stroke(); break;
      default: {
        // torre e projéteis sem estilo: orbe com a cor do time
        const r = kind === 1 ? 26 : 14, c = kind === 1 ? TEAM_COLOR[team] : team === ui.team ? '#bfdbfe' : '#fecaca';
        glow(r * 1.6, '#fff', c);
      }
    }
    ctx.restore();
  }

  label(ctx, x, y, text, color) {
    const [sx, sy] = this.toScreen(x, y);
    if (sx < -200 || sy < -50 || sx > this.W + 200 || sy > this.H + 50) return;
    ctx.save(); ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center';
    const w = ctx.measureText(text).width + 16;
    ctx.fillStyle = 'rgba(15,23,42,.8)'; ctx.fillRect(sx - w / 2, sy - 16, w, 24);
    ctx.fillStyle = color; ctx.fillText(text, sx, sy + 1); ctx.restore();
  }

  // barras de vida no estilo do LoL (marcas a cada 100 de vida), em pixels de tela
  drawBars(ctx, u, ui) {
    if (u.kind === 'nexus' && u.hp >= u.maxHp) return;
    const h = u.kind === 'tower' ? 360 : u.kind === 'nexus' ? 380 : bodyH(u) + 40 + (u.cc & 4 ? 70 : 0);
    const [sx, sy] = this.toScreen(u.x, u.y - h);
    const champ = u.kind === 'champ', w = champ ? 110 : u.kind === 'tower' || u.kind === 'nexus' ? 130 : 56, bh = champ ? 12 : 7;
    const x0 = sx - w / 2, y0 = sy;
    const self = u.id === ui.meId, ally = u.team === ui.team;
    const hpCol = self ? '#4ade80' : u.team === 2 ? '#fbbf24' : ally ? '#60a5fa' : '#ef4444';
    ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, bh + 4 + (champ ? 6 : 0));
    const total = Math.max(u.maxHp, u.hp + (u.shield || 0));
    // ajuda para farmar: quanto o seu ataque básico tira deste minion; dourado quando um ataque mata
    const isMinion = u.kind === 'melee' || u.kind === 'ranged' || u.kind === 'siege';
    const myHit = isMinion && !ally && ui.myAd ? ui.myAd * 100 / (100 + (u.kind === 'siege' ? MINION.siege.armor : 0)) : 0;
    const killable = myHit > 0 && u.hp <= myHit;
    ctx.fillStyle = killable ? '#fbbf24' : hpCol; ctx.fillRect(x0, y0, w * Math.max(0, u.hp) / total, bh);
    if (myHit && !killable) { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(x0 + w * Math.min(1, myHit / total) - 1, y0 - 2, 2, bh + 4); }
    if (killable) { ctx.font = '14px system-ui'; ctx.textAlign = 'center'; ctx.fillText('💰', sx, y0 - 4); }
    if (u.shield) { ctx.fillStyle = '#e5e7eb'; ctx.fillRect(x0 + w * u.hp / total, y0, w * u.shield / total, bh); }
    if (champ) {
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      for (let v = 100; v < total; v += 100) { const xx = x0 + w * v / total; ctx.fillRect(xx, y0, v % 1000 ? 1 : 2, v % 1000 ? bh * 0.5 : bh); }
      ctx.fillStyle = '#3b82f6'; ctx.fillRect(x0, y0 + bh + 1, w * (u.maxMp ? u.mana / u.maxMp : 0), 4);
      // nível e nome
      ctx.fillStyle = '#111827'; ctx.fillRect(x0 - 26, y0 - 4, 24, 22);
      ctx.fillStyle = '#fde68a'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center'; ctx.fillText(u.lvl, x0 - 14, y0 + 12);
      // nome da forma atual (Gastly, Haunter, Gengar, Mega Gengar) e, embaixo dele, o jogador
      const form = formAt(CHAMPIONS[u.champ], u.lvl).nome, player = ui.names.get(u.id);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui'; ctx.fillText(form, sx, y0 - 8);
      if (player && player !== 'Bot') { ctx.fillStyle = '#cbd5e1'; ctx.font = '11px system-ui'; ctx.fillText(player, sx, y0 - 23); }
    }
  }

  // ---------- minimapa ----------
  paintMinimapBase() {
    const c = document.createElement('canvas'); c.width = c.height = N;
    const x = c.getContext('2d'), img = x.createImageData(N, N);
    for (let k = 0; k < N * N; k++) {
      const w = walk[k], b = brush[k] >= 0, l = lane[k], r = river[k];
      const [cr, cg, cb] = !w ? [18, 40, 28] : b ? [40, 90, 40] : r ? [50, 110, 150] : l ? [120, 105, 80] : [70, 100, 60];
      img.data[k * 4] = cr; img.data[k * 4 + 1] = cg; img.data[k * 4 + 2] = cb; img.data[k * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  }

  drawMinimap(f, ui) {
    const m = this.mctx, W = this.mini.width, k = W / S;
    m.imageSmoothingEnabled = true;
    m.drawImage(this.miniBase, 0, 0, W, W);
    m.drawImage(this.fogCv, 0, 0, W, W);
    if (f) for (const u of f.units) {
      const x = u.x * k, y = u.y * k;
      if (u.kind === 'tower' || u.kind === 'nexus') {
        m.fillStyle = TEAM_COLOR[u.team]; m.strokeStyle = '#000'; m.lineWidth = 1;
        const s = u.kind === 'nexus' ? 9 : 6; m.fillRect(x - s / 2, y - s / 2, s, s); m.strokeRect(x - s / 2, y - s / 2, s, s);
      } else if (u.kind === 'champ') {
        m.fillStyle = TEAM_COLOR[u.team]; m.strokeStyle = u.id === ui.meId ? '#facc15' : '#fff'; m.lineWidth = 2;
        m.beginPath(); m.arc(x, y, 6, 0, 7); m.fill(); m.stroke();
      } else {
        m.fillStyle = u.team === 2 ? '#fbbf24' : TEAM_COLOR[u.team];
        m.fillRect(x - 1.5, y - 1.5, 3, 3);
      }
    }
    // retângulo da câmera
    const a = this.toWorld(0, 0), b = this.toWorld(this.W, this.H);
    m.strokeStyle = 'rgba(255,255,255,.8)'; m.lineWidth = 1.5; m.strokeRect(a.x * k, a.y * k, (b.x - a.x) * k, (b.y - a.y) * k);
  }
}
