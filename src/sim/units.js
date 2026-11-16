// Unidades: criação, movimento (caminho + colisão), ataque básico com windup e projéteis teleguiados.

import { MINION, TOWER, SIGHT, CRIT_MULT } from '../config.js';
import { walkable, clearLine, nearestWalkable } from './map.js';
import { findPath } from './nav.js';
import { refreshStats } from './stats.js';
import { damage, canMove, canAct } from './combat.js';
import { prdC } from '../core/math.js';
import { formAt } from '../data/champions.js';
import { applyStatus, passiveAutoMod } from './status.js';

function baseUnit(g, kind, team, x, y, r) {
  return {
    id: g.nextId++, kind, team, x, y, r, face: team === 0 ? -0.78 : 2.36,
    hp: 1, mana: 0, dead: false, buffs: [], stats: null, types: [],
    cmd: null, path: [], repathT: 0,
    atk: { cd: 0, wind: 0, tid: 0, prd: 0 },
    shotN: 0, hurtN: 0, revealT: 0, dash: null, recallT: 0, moving: false, invuln: false,
  };
}

export function makeChampion(g, def, team, player, x, y) {
  const u = baseUnit(g, 'champ', team, x, y, 65);
  Object.assign(u, {
    def, pid: formAt(def, 1).pid, types: def.types, player, lvl: 1, xp: 0, gold: 0, items: Array(6).fill(null), stacks: {},
    ranks: [0, 0, 0, 0], skillPts: 1, cds: [0, 0, 0, 0], summ: { flash: 0, heal: 0 },
    kills: 0, deaths: 0, assists: 0, cs: 0, streak: 0, deathStreak: 0, respawnT: 0, dmgBy: new Map(), sight: SIGHT.champion,
  });
  refreshStats(u);
  u.hp = u.stats.maxHp; u.mana = u.stats.maxMp;
  return u;
}

export function makeMinion(g, mtype, team, lane, path, wave) {
  const b = MINION[mtype];
  const base = { ...b, hp: b.hp * (1 + MINION.hpPerWave * wave), ad: b.ad * (1 + MINION.adPerWave * wave) };
  const u = baseUnit(g, 'minion', team, path[0].x, path[0].y, b.radius);
  Object.assign(u, { mtype, base, pid: b.pid, lane, lanePath: path, wp: 1, sight: b.sight, missile: b.missile || 0, windup: b.windup });
  refreshStats(u);
  u.hp = u.stats.maxHp;
  return u;
}

export function makeTower(g, t) {
  const base = { hp: TOWER.hp[t.tier], ad: TOWER.dmg, armor: TOWER.armor, mr: TOWER.mr, as: 1 / TOWER.attackTime, ms: 0, range: TOWER.range };
  const u = baseUnit(g, 'tower', t.team, t.x, t.y, TOWER.radius);
  Object.assign(u, { base, lane: t.lane, tier: t.tier, sight: SIGHT.tower, missile: 1200, windup: 0.15, ramp: 0, rampTid: 0 });
  refreshStats(u);
  u.hp = u.stats.maxHp;
  return u;
}

export function makeNexus(g, team, p) {
  const base = { hp: TOWER.nexusHp, ad: 0, armor: 0, mr: 0, as: 0, ms: 0, range: 0 };
  const u = baseUnit(g, 'nexus', team, p.x, p.y, 150);
  Object.assign(u, { base, sight: 1000 });
  refreshStats(u);
  u.hp = u.stats.maxHp;
  return u;
}

export function makeMonster(g, camp, idx) {
  // chefes do rio: bem mais fortes e valem para o time todo (game.kill)
  const base = camp.big ? { hp: 6000, ad: 140, armor: 60, mr: 60, as: 0.7, ms: 380, range: 250 } : { hp: 1200, ad: 28, armor: 15, mr: 10, as: 0.75, ms: 380, range: 175 };
  const u = baseUnit(g, 'monster', 2, camp.x, camp.y, camp.big ? 130 : 80);
  Object.assign(u, { base, base0: base, pid: camp.pid, camp: idx, home: { x: camp.x, y: camp.y }, aggro: 0, sight: SIGHT.monster, windup: 0.3,
    gold: camp.big ? 300 : 90, xp: camp.big ? 600 : 190, big: !!camp.big, nome: camp.nome });
  refreshStats(u);
  u.hp = u.stats.maxHp;
  return u;
}

// ---------- movimento ----------
// caminho até o ponto. Cada tick tem um orçamento de buscas A*: quem passar dele vai em linha reta neste tick
// e tenta de novo logo depois (evita travar a partida quando muitas unidades pedem caminho ao mesmo tempo)
const PATH_BUDGET = 12;
export function setDestination(g, u, x, y) {
  if (g.pathTick !== g.tickN) { g.pathTick = g.tickN; g.pathCalls = 0; }
  if (g.pathCalls >= PATH_BUDGET) { u.path = [{ x, y }]; u.repathT = 0.05; return; }
  g.pathCalls++;
  const p = findPath(u.x, u.y, x, y);
  u.path = p || [];
  u.repathT = 0.25;
}

// distância de borda a borda (como o alcance de ataque do LoL)
export const edgeDist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r;
export const inAttackRange = (u, t) => edgeDist(u, t) <= u.stats.range;

export function stepMove(g, u, dt) {
  u.moving = false;
  if (u.dash) {
    const d = u.dash, step = Math.min(d.left, d.spd * dt);
    const nx = u.x + Math.cos(d.a) * step, ny = u.y + Math.sin(d.a) * step;
    if (walkable(nx, ny)) { u.x = nx; u.y = ny; d.left -= step; } else d.left = 0;
    u.face = d.a; u.moving = true;
    if (d.left <= 0) u.dash = null;
    return;
  }
  if (!u.path.length || !canMove(u) || u.atk.wind > 0) return;
  let left = u.stats.ms * dt;
  while (left > 0 && u.path.length) {
    const w = u.path[0], dx = w.x - u.x, dy = w.y - u.y, d = Math.hypot(dx, dy);
    if (d <= left) { u.x = w.x; u.y = w.y; left -= d; u.path.shift(); continue; }
    const nx = u.x + dx / d * left, ny = u.y + dy / d * left;
    // desliza pela parede eixo a eixo
    if (walkable(nx, ny)) { u.x = nx; u.y = ny; }
    else if (walkable(nx, u.y)) u.x = nx;
    else if (walkable(u.x, ny)) u.y = ny;
    else { u.path = []; }
    u.face = Math.atan2(dy, dx);
    left = 0;
  }
  u.moving = true;
}

// empurra unidades sobrepostas (raio de colisão menor que o de acerto) e tira de dentro das estruturas
export function separate(g) {
  const list = g.mobile;
  for (const a of list) {
    if (a.dead || a.dash) continue;
    const ra = a.r * 0.55;
    for (const b of g.near(a.x, a.y, 200)) {
      if (b === a || b.dead) continue;
      const solid = b.kind === 'tower' || b.kind === 'nexus';
      if (!solid && (b.id < a.id || b.dash)) continue;
      const rb = solid ? b.r : b.r * 0.55, dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy) || 0.01, over = ra + rb - d;
      if (over <= 0) continue;
      const nx = dx / d, ny = dy / d;
      // quem está parado atacando cede menos (minions se espalham em volta do alvo)
      const ka = solid ? 1 : 0.5, kb = solid ? 0 : 0.5;
      const ax = a.x + nx * over * ka, ay = a.y + ny * over * ka;
      if (walkable(ax, ay)) { a.x = ax; a.y = ay; }
      if (kb) { const bx = b.x - nx * over * kb, by = b.y - ny * over * kb; if (walkable(bx, by)) { b.x = bx; b.y = by; } }
    }
    if (!walkable(a.x, a.y)) { const p = nearestWalkable(a.x, a.y); a.x = p.x; a.y = p.y; }
  }
}

// vai até o alvo e ataca; devolve true se está em alcance
export function chase(g, u, t, dt) {
  if (inAttackRange(u, t)) { u.path = []; startAttack(g, u, t); return true; }
  u.repathT -= dt;
  if (u.repathT <= 0 || !u.path.length) {
    if (clearLine(u.x, u.y, t.x, t.y)) u.path = [{ x: t.x, y: t.y }];
    else setDestination(g, u, t.x, t.y);
    u.repathT = 0.25;
  }
  return false;
}

// ---------- ataque básico ----------
// intervalo = 1/AS; o dano sai no fim do windup. Mover durante o windup cancela o ataque (sem gastar o tempo).
export function startAttack(g, u, t) {
  if (u.atk.wind > 0 || u.atk.cd > 0 || !canAct(u) || u.dash || t.travel) return;
  const interval = 1 / u.stats.as;
  u.atk.cd = interval;
  u.atk.wind = interval * (u.def ? u.def.windup : u.windup || 0.3);
  u.atk.tid = t.id;
  u.face = Math.atan2(t.y - u.y, t.x - u.x);
  u.shotN = (u.shotN + 1) & 255;
  u.recallT = 0;
  // atacar revela quem está invisível ou disfarçado
  if (u.disguise && u.def && u.def.passive && u.def.passive.illusionist) u.buffs.push({ k: 'nextCrit', t: 1 });
  if (u.stealth || u.disguise) u.buffs = u.buffs.filter(b => b.k !== 'stealth' && b.k !== 'disguise');
}

export function cancelWindup(u) {
  if (u.atk.wind > 0) { u.atk.wind = 0; u.atk.cd = 0; }
}

export function updateAttack(g, u, dt) {
  const a = u.atk;
  a.cd -= dt;
  if (a.wind <= 0) return;
  const t = g.units.get(a.tid);
  if (!t || t.dead || !canAct(u) || edgeDist(u, t) > u.stats.range + 200) { cancelWindup(u); return; }
  a.wind -= dt;
  if (a.wind > 0) return;
  a.wind = 0;
  const hit = rollAuto(u, t);
  const missile = u.def ? u.def.missile : u.missile;
  const shot = u.kind === 'tower' ? 'tower' : u.def ? u.def.shot : u.shot;
  hit.fx = missile ? shot || 'orb' : 'melee';   // desenho do impacto no cliente
  if (missile) g.missiles.push({ id: g.nextId++, src: u.id, team: u.team, tid: t.id, x: u.x, y: u.y - 40, spd: missile, hit, kind: u.kind === 'tower' ? 1 : 0, shot: shot || '' });
  else applyAuto(g, u, t, hit);
}

// crítico com PRD (seção 3); torres têm dano próprio
function rollAuto(u, t) {
  if (u.kind === 'tower') return towerShot(u, t);
  let dmg = u.stats.ad, crit = false;
  const nc = u.buffs.findIndex(b => b.k === 'nextCrit');
  if (nc >= 0) { u.buffs.splice(nc, 1); return passiveAutoMod(u, t, { dmg: dmg * (u.stats.critMult || CRIT_MULT), crit: true, type: 'physical' }); }
  if (u.stats.crit > 0) {
    const c = prdC(Math.round(u.stats.crit * 100) / 100);
    u.atk.prd++;
    if (Math.random() < c * u.atk.prd) { crit = true; u.atk.prd = 0; dmg *= u.stats.critMult || CRIT_MULT; }
  }
  return passiveAutoMod(u, t, { dmg, crit, type: 'physical' });
}

// torres: tiros seguidos no mesmo campeão doem mais; minions perdem uma fração fixa da vida
function towerShot(tw, t) {
  if (t.kind === 'minion') return { dmg: t.stats.maxHp * TOWER.minionDmgPct[t.mtype], type: 'true' };
  if (t.kind === 'champ') {
    if (tw.rampTid === t.id) tw.ramp = Math.min(TOWER.rampMax, tw.ramp + TOWER.rampPerShot);
    else { tw.rampTid = t.id; tw.ramp = 0; }
  }
  return { dmg: tw.stats.ad * (1 + tw.ramp), type: 'physical' };
}

export function applyAuto(g, u, t, hit) {
  if (t.dead) return;
  const src = u.dead ? null : u;
  damage(g, src, t, hit.dmg, hit.type, { auto: true, crit: hit.crit, fx: hit.fx, owner: u });
  if (hit.status) applyStatus(g, src, t, hit.status);
  if (hit.proc && src) g.event({ k: 'proc', id: t.id }, t.x, t.y);
  // Dynamax: o ataque básico explode em volta do alvo
  if (src && src.buffs && src.buffs.some(b => b.k === 'dyna')) {
    for (const v of g.near(t.x, t.y, 260)) if (v !== t && !v.dead && v.team !== src.team && (v.kind === 'champ' || v.kind === 'minion' || v.kind === 'monster')) damage(g, src, v, hit.dmg * 0.4, hit.type);
    g.event({ k: 'burst', z: [0, 0, Math.round(t.x), Math.round(t.y), 260, 0, 1, src.team, 'quake', 'normal'] }, t.x, t.y);
  }
}

export function updateMissiles(g, dt) {
  for (const m of g.missiles) {
    const t = g.units.get(m.tid);
    if (!t || t.dead) { m.done = true; continue; }
    const dx = t.x - m.x, dy = t.y - 40 - m.y, d = Math.hypot(dx, dy), step = m.spd * dt;
    if (d <= step + 10) {
      m.done = true;
      const src = g.units.get(m.src);
      applyAuto(g, src || { dead: true, types: [], kind: 'x' }, t, m.hit);
      continue;
    }
    m.x += dx / d * step; m.y += dy / d * step;
  }
  g.missiles = g.missiles.filter(m => !m.done);
}
