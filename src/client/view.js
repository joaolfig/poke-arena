// O que o cliente sabe da partida: snapshots recebidos, interpolados com um pequeno atraso
// (seção 11 de matematica-moba.md: o cliente desenha ~100 ms no passado, entre dois snapshots).

import { INTERP_DELAY } from '../config.js';

const KINDS = ['champ', 'melee', 'ranged', 'tower', 'nexus', 'monster', 'siege'];

function parseUnit(a) {
  const u = { id: a[0], kind: KINDS[a[1]], team: a[2], pid: a[3], x: a[4], y: a[5], hp: a[6], maxHp: a[7], face: a[8] / 100,
    moving: !!(a[9] & 1), recall: !!(a[9] & 2), invuln: !!(a[9] & 4), dash: !!(a[9] & 32), stealth: !!(a[9] & 64), dyna: !!(a[9] & 128),
    travel: !!(a[9] & 256), disguise: !!(a[9] & 512), invul: !!(a[9] & 1024), shotN: a[10], hurtN: a[11], cc: 0 };
  if (a[1] === 0) Object.assign(u, { champ: a[12], lvl: a[13], mana: a[14], maxMp: a[15], shield: a[16], cc: a[17] });
  return u;
}

export class View {
  constructor() {
    this.snaps = [];        // [{ time, units: Map, zones, missiles }]
    this.me = null; this.sb = []; this.winner = -1;
    this.clock = null;      // relação entre o relógio do servidor e o local
    this.events = [];       // eventos ainda não tratados pela tela
  }

  receive(s) {
    const now = performance.now() / 1000;
    const units = new Map();
    for (const a of s.u) { const u = parseUnit(a); units.set(u.id, u); }
    this.snaps.push({ time: s.time, units, zones: s.z, missiles: s.m });
    if (this.snaps.length > 30) this.snaps.shift();
    // relógio: servidor - local, suavizado (nunca anda para trás bruscamente)
    const off = s.time - now;
    // salto grande (voltou da pausa, aba ficou parada): acerta o relógio de uma vez
    this.clock = this.clock === null || Math.abs(off - this.clock) > 0.5 ? off : this.clock + (off - this.clock) * 0.05;
    if (s.me) this.me = s.me;
    if (s.sb) this.sb = s.sb;
    this.winner = s.w;
    if (s.ms) this.minionSets = s.ms;
    for (const e of s.e) this.events.push(e);
  }

  get serverTime() { return this.snaps.length ? this.snaps[this.snaps.length - 1].time : 0; }

  // estado interpolado no instante de desenho
  frame() {
    if (!this.snaps.length) return null;
    const t = performance.now() / 1000 + this.clock - INTERP_DELAY;
    let a = this.snaps[0], b = a;
    for (let i = this.snaps.length - 1; i >= 0; i--) if (this.snaps[i].time <= t) { a = this.snaps[i]; b = this.snaps[i + 1] || a; break; }
    const k = b === a ? 0 : Math.max(0, Math.min(1, (t - a.time) / (b.time - a.time)));
    const units = [];
    for (const ub of b.units.values()) {
      const ua = a.units.get(ub.id);
      // quem pulou longe (Flash, renascer, recall) não desliza pelo mapa
      if (!ua || Math.hypot(ub.x - ua.x, ub.y - ua.y) > 500) { units.push(ub); continue; }
      units.push({ ...ub, x: ua.x + (ub.x - ua.x) * k, y: ua.y + (ub.y - ua.y) * k, hp: ua.hp + (ub.hp - ua.hp) * k });
    }
    // os avisos vêm do snapshot mais novo; lag = quanto o desenho está atrás dele
    return { time: t, units, zones: b.zones, missiles: b.missiles, lag: b.time - t };
  }
}
