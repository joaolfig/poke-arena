// Controles no estilo do LoL:
//   botão direito = andar / atacar quem estiver sob o cursor (segurar continua andando)
//   A + clique esquerdo = ataque-mover · S = parar
//   Q W E R = segura para ver o indicador, solta para lançar no cursor · Ctrl + Q/W/E/R = subir habilidade
//   D = Teleporte (Flash) · F = Curar · B = voltar à base · P = loja · Tab = placar
//   Espaço = centralizar a câmera (segurando) · Y = travar/destravar a câmera · roda do mouse = zoom
//   câmera travada se inclina para o lado do mouse; arrastar com o botão esquerdo ou do meio move o mapa (destrava)
//   minimapa: esquerdo move a câmera, direito manda andar

import { MOVES } from '../data/moves.js';
import { moveOf } from '../sim/abilities.js';
import { clampRange } from '../core/math.js';
import { MAP, widenPiece } from '../config.js';

const SLOT = { KeyQ: 0, KeyW: 1, KeyE: 2, KeyR: 3 };

// formato do golpe para o indicador, sempre igual enquanto o cursor não muda
// (os golpes usam Math.random para espalhar; aqui ele é trocado por um gerador fixo só durante a chamada)
function previewPieces(ab, from, to, a) {
  const M = moveOf(ab);
  if (!M) return [];
  const rnd = Math.random;
  let s = 7;
  Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  try { return M.f(from, to, a).map(widenPiece); } finally { Math.random = rnd; }
}

export class Input {
  constructor({ canvas, mini, renderer, send, getFrame, getMe, getChamp, ui, onKey, notify }) {
    Object.assign(this, { canvas, mini, renderer, send, getFrame, getMe, getChamp, ui, onKey, notify });
    this.mouse = { x: 0, y: 0, right: false, inside: true };
    this.held = null;          // habilidade segurada (indicador)
    this.aMode = false;
    this.camLock = true;       // começa travada (Y destrava, como no LoL)
    this.space = false;
    this.lastMoveSend = 0;
    this.bind();
  }

  world() { return this.renderer.toWorld(this.mouse.x, this.mouse.y); }

  // unidade inimiga sob o cursor
  hover() {
    const f = this.getFrame();
    if (!f) return null;
    const w = this.world();
    let best = null, bd = Infinity;
    for (const u of f.units) {
      if (u.team === this.ui.team) continue;
      const cy = u.kind === 'tower' || u.kind === 'nexus' ? u.y - 120 : u.y - 60;
      const r = u.kind === 'tower' ? 140 : u.kind === 'nexus' ? 200 : u.kind === 'champ' ? 95 : 65;
      const d = Math.min(Math.hypot(w.x - u.x, w.y - cy), Math.hypot(w.x - u.x, w.y - u.y));
      if (d < r && d < bd) { bd = d; best = u; }
    }
    return best;
  }

  rightClick(now) {
    const t = this.hover(), w = this.world();
    if (t) { this.send({ c: 'attack', id: t.id }); this.ui.marker = { x: t.x, y: t.y, t: now, attack: true }; this.lastAttackId = t.id; }
    else { this.send({ c: 'move', x: w.x, y: w.y }); this.ui.marker = { x: w.x, y: w.y, t: now }; this.lastAttackId = 0; }
    this.lastMoveSend = now;
  }

  bind() {
    const cv = this.canvas;
    cv.addEventListener('contextmenu', e => e.preventDefault());
    this.mini.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('mousemove', e => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
    document.addEventListener('mouseleave', () => { this.mouse.inside = false; });
    document.addEventListener('mouseenter', () => { this.mouse.inside = true; });
    cv.addEventListener('mousedown', e => {
      // se o teclado escapou da página (barra de endereço, um botão do HUD...), o clique no mapa traz de volta
      if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
      window.focus();
      const now = performance.now() / 1000;
      if (e.button === 2) {
        if (this.held !== null) { this.held = null; this.ui.indicator = null; return; } // botão direito cancela a mira
        this.mouse.right = true; this.aMode = false; this.rightClick(now);
      } else if (e.button === 1) {
        e.preventDefault();
        this.camLock = false;
        this.drag = { mx: e.clientX, my: e.clientY, cx: this.renderer.cam.x, cy: this.renderer.cam.y };
      } else if (e.button === 0) {
        if (this.held !== null) { this.castHeld(); return; }
        if (this.aMode) {
          const w = this.world();
          this.send({ c: 'amove', x: w.x, y: w.y }); this.ui.marker = { x: w.x, y: w.y, t: now, attack: true };
          this.aMode = false;
          return;
        }
        // botão esquerdo segurado: vira arrasto do mapa só depois de andar alguns pixels (um clique simples não faz nada)
        this.leftDown = { mx: e.clientX, my: e.clientY, cx: this.renderer.cam.x, cy: this.renderer.cam.y };
      }
    });
    window.addEventListener('mousemove', e => {
      const l = this.leftDown;
      if (l && !this.drag && Math.hypot(e.clientX - l.mx, e.clientY - l.my) > 6) { this.camLock = false; this.drag = l; }
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 2) this.mouse.right = false;
      if (e.button === 1 || e.button === 0) { this.drag = null; this.leftDown = null; }
    });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const z = this.renderer.cam.zoom * (e.deltaY > 0 ? 0.9 : 1.1);
      this.renderer.cam.zoom = Math.max(0.35, Math.min(1.1, z));
    }, { passive: false });

    // minimapa
    const miniWorld = e => { const r = this.mini.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * MAP.size, y: (e.clientY - r.top) / r.height * MAP.size }; };
    const miniDrag = e => { if (e.buttons & 1) { const w = miniWorld(e); this.renderer.cam.x = w.x; this.renderer.cam.y = w.y; this.camLock = false; } };
    this.mini.addEventListener('mousedown', e => {
      e.stopPropagation();
      const w = miniWorld(e);
      if (e.button === 2) { this.send({ c: 'move', x: w.x, y: w.y }); this.ui.marker = { ...w, t: performance.now() / 1000 }; }
      else miniDrag(e);
    });
    this.mini.addEventListener('mousemove', miniDrag);

    window.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      if (e.code === 'Tab') e.preventDefault();
      // Ctrl + letra das habilidades e Ctrl+R/E/D/F: atalhos do navegador (barra de endereço, recarregar...) ficam com o jogo
      if (e.ctrlKey && ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyD', 'KeyF', 'KeyB', 'KeyP'].includes(e.code)) e.preventDefault();
      if (this.onKey(e)) return;
      const me = this.getMe();
      if (e.code in SLOT) {
        e.preventDefault();
        const s = SLOT[e.code];
        if (e.ctrlKey) { this.send({ c: 'lvl', s }); return; }
        if (e.repeat || !me) return;
        // por que a habilidade não sai (como os avisos do LoL)
        const ab = this.getChamp().abil[s], mu = this.getFrame() && this.getFrame().units.find(u => u.id === me.id);
        if (me.ranks[s] <= 0) { this.notify('Habilidade não aprendida (clique no + ou Ctrl+' + 'QWER'[s] + ')'); return; }
        if (me.cds[s] > 0) { this.notify(`Em recarga (${Math.ceil(me.cds[s])} s)`); return; }
        if (mu && mu.mana < ab.cost[me.ranks[s] - 1]) { this.notify('Sem mana!'); return; }
        this.held = s;
        return;
      }
      const w = this.world();
      switch (e.code) {
        case 'KeyA': this.aMode = true; break;
        case 'KeyS': this.send({ c: 'stop' }); break;
        case 'KeyC': this.ui.showRange = true; break;
        case 'KeyD': this.send({ c: 'summ', k: 'flash', x: w.x, y: w.y }); break;
        case 'KeyF': this.send({ c: 'summ', k: 'heal', x: w.x, y: w.y }); break;
        case 'KeyB': this.send({ c: 'recall' }); break;
        case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5': case 'Digit6': this.send({ c: 'use', i: +e.code.slice(5) - 1 }); break;
        case 'KeyY': this.camLock = !this.camLock; break;
        case 'Space': e.preventDefault(); this.space = true; break;
        case 'Escape': this.held = null; this.aMode = false; this.ui.indicator = null; break;
      }
    });
    window.addEventListener('keyup', e => {
      if (e.code in SLOT && this.held === SLOT[e.code]) this.castHeld();
      if (e.code === 'Space') this.space = false;
      if (e.code === 'KeyC') this.ui.showRange = false;
    });
  }

  castHeld() {
    const w = this.world();
    this.send({ c: 'cast', s: this.held, x: w.x, y: w.y });
    this.held = null; this.ui.indicator = null;
  }

  // chamado a cada quadro: câmera, arrastar com o botão direito, indicador e cursor
  update(dt, now, meUnit) {
    const cam = this.renderer.cam, W = this.renderer.W, H = this.renderer.H, sc = this.renderer.scale;
    if (meUnit && (this.camLock || this.space)) {
      // travada: segue o campeão, mas se inclina para o lado do mouse (até ~1/4 da tela) para ver onde vai mirar
      const lead = this.space ? 0 : 0.5;
      const ox = this.mouse.inside ? (this.mouse.x - W / 2) * lead / sc : 0, oy = this.mouse.inside ? (this.mouse.y - H / 2) * lead / sc : 0;
      const tx = meUnit.x + Math.max(-W * 0.25 / sc, Math.min(W * 0.25 / sc, ox)), ty = meUnit.y + Math.max(-H * 0.25 / sc, Math.min(H * 0.25 / sc, oy));
      const k = 1 - Math.exp(-dt * 8);   // desliza até o alvo em vez de pular
      cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
      this.edge = 0;
    } else if (this.drag) {
      // botão do meio arrasta o mapa
      cam.x = this.drag.cx - (this.mouse.x - this.drag.mx) / sc; cam.y = this.drag.cy - (this.mouse.y - this.drag.my) / sc;
    } else if (this.mouse.inside) {
      // borda da tela move a câmera, acelerando suave
      const m = 18, { x, y } = this.mouse;
      const dx = (x < m ? -1 : x > W - m ? 1 : 0), dy = (y < m ? -1 : y > H - m ? 1 : 0);
      this.edge = dx || dy ? Math.min(1, (this.edge || 0) + dt * 4) : 0;
      const sp = 2800 * dt / cam.zoom * this.edge;
      cam.x += dx * sp; cam.y += dy * sp;
    }
    cam.x = Math.max(0, Math.min(MAP.size, cam.x)); cam.y = Math.max(0, Math.min(MAP.size, cam.y));
    // segurando o botão direito: sobre um inimigo continua atacando (não vira "andar"); no chão, segue o cursor
    if (this.mouse.right && now - this.lastMoveSend > 0.12) {
      const t = this.hover();
      if (t) { if (this.lastAttackId !== t.id) { this.send({ c: 'attack', id: t.id }); this.lastAttackId = t.id; } }
      else { const w = this.world(); this.send({ c: 'move', x: w.x, y: w.y }); this.lastAttackId = 0; }
      this.lastMoveSend = now;
    }
    const h = this.hover();
    this.ui.hoverId = h ? h.id : 0;
    this.canvas.style.cursor = this.aMode || h ? 'crosshair' : 'default';
    // indicador: da habilidade segurada (mira no cursor) ou da que está sob o mouse no HUD (na direção em que você está virado)
    const showSlot = this.held !== null ? this.held : this.ui.hoverSlot;
    if (showSlot === null || showSlot === undefined || !meUnit) { if (this.held === null) this.ui.indicator = null; }
    if (showSlot !== null && showSlot !== undefined && meUnit) {
      const ab = this.getChamp().abil[showSlot];
      const w = this.held !== null ? this.world() : { x: meUnit.x + Math.cos(meUnit.face) * (ab.range || 300), y: meUnit.y + Math.sin(meUnit.face) * (ab.range || 300) };
      const a = Math.atan2(w.y - meUnit.y, w.x - meUnit.x);
      const from = { x: meUnit.x, y: meUnit.y };
      const ind = { range: ab.range || 0, pieces: [] };
      const to = ab.range ? clampRange(from, w, ab.range) : from;
      if (ab.kind === 'heal' || ab.kind === 'shield') ind.radius = ab.range;
      else if (ab.kind === 'buff') { ind.range = 0; ind.radius = ab.enemyRadius || (ab.taunt && ab.taunt.radius) || ab.radius || 120; }
      else if (ab.kind === 'dash') { ind.dashTo = to; ind.pieces = previewPieces(ab, from, to, a).slice(1); }
      else if (ab.kind === 'blink') { ind.dashTo = to; ind.pieces = previewPieces(ab, to, to, a); }
      else if (ab.kind === 'dig' || ab.kind === 'fly') { ind.dashTo = to; ind.under = true; ind.pieces = previewPieces(ab, to, to, a); }
      else if (ab.kind === 'cloud' || ab.kind === 'trap') ind.at = { x: to.x, y: to.y, r: ab.radius };
      else if (ab.kind === 'chain') ind.at = { x: to.x, y: to.y, r: 350 };
      else ind.pieces = previewPieces(ab, from, to, a);
      this.ui.indicator = ind;
    }
  }
}
