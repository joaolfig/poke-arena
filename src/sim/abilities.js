// Habilidades: lançamento (mana, recarga, ranks) e o que cada uma cria no mundo.
// Os formatos vêm dos golpes de chefe do Poké Realm (data/moves.js) ou de um `shape` próprio do campeão.
//
// Peças no chão (g.zones), como no LoL:
//   c / l = área com atraso: o aviso aparece para todos e acerta quando enche
//   p     = projétil: faixa que sai do próprio campeão vira uma flecha que voa (o inimigo só vê o projétil)
//   m     = golpe que anda (tornado, orbe, pedra rolando): o inimigo só vê depois que ele sai
//   a     = nuvem/santuário: fica no chão e age a cada 0,5 s
//   trap  = armadilha escondida do outro time, explode quando um inimigo chega perto
// Viagens (u.travel): Escavar vai por baixo da terra (só o rastro aparece) e Voar sobe e cai longe; nos dois,
// o campeão fica intocável até sair no ponto.

import { MOVES, movePos } from '../data/moves.js';
import { warnTime, hasteCd, SUMMONERS, MOVER_SPEED, widenPiece } from '../config.js';
import { clampRange, lineHit, circleHit } from '../core/math.js';
import { nearestWalkable, walkable } from './map.js';
import { damage, heal, addShield, applyCC, canAct, canMove, taunted } from './combat.js';
import { cancelWindup } from './units.js';
import { passiveAbilityHit, applyStatus } from './status.js';

// elemento de cada estilo visual (só para a cor do golpe)
const FX_TYPE = {
  flame: 'fire', blueflame: 'fire', jet: 'water', drop: 'water', whirl: 'water', bolt: 'electric', spark: 'electric',
  leaf: 'grass', petal: 'grass', sun: 'grass', ice: 'ice', quake: 'ground', rock: 'rock', boulder: 'rock', psy: 'psychic',
  shadow: 'ghost', ghostfire: 'ghost', aura: 'fighting', dust: 'normal', beam: 'normal', star: 'normal', meteor: 'dragon',
  dragon: 'dragon', time: 'dragon', wind: 'flying', bug: 'bug', web: 'bug', slash: 'bug', steel: 'steel', slime: 'poison', fairy: 'fairy',
};
const TRAP_MAX = 3, TRAP_ARM = 1, TRAP_LIFE = 45, TRAP_TRIGGER = 130;
const PROJ_SPEED = 1800;

// golpe de uma habilidade: o do Poké Realm ou o formato próprio
export const moveOf = ab => ab.move ? MOVES[ab.move] : ab.shape ? { f: ab.shape, fx: ab.fx, nome: ab.nome } : null;
export const abilityName = ab => ab.nome || (ab.move ? MOVES[ab.move].nome : '?');

// rank máximo permitido no nível: Q/W/E até ceil(nível/2), R nos níveis 6, 11 e 16
export const maxRank = (slot, lvl) => slot === 3 ? Math.min(3, Math.floor((lvl - 1) / 5)) : Math.min(5, Math.ceil(lvl / 2));

export function levelUpAbility(u, slot) {
  if (u.skillPts <= 0 || slot < 0 || slot > 3 || u.ranks[slot] >= maxRank(slot, u.lvl)) return false;
  u.ranks[slot]++; u.skillPts--;
  return true;
}

// valor do rank atual com os ratios (dano, cura ou escudo)
export function abilityValue(u, base, ratio) {
  const s = u.stats, r = ratio || {};
  return base + (r.ad || 0) * s.ad + (r.bad || 0) * s.bonusAd + (r.ap || 0) * s.ap + (r.hp || 0) * s.maxHp + (r.armor || 0) * s.armor;
}

// uso de cada habilidade (lançamentos e dano em campeões), para o teste de balanceamento
function track(g, cast, dmg, isCast) {
  if (!g.abilityStats) return;
  const s = g.abilityStats.get(cast.key) || { casts: 0, dmg: 0 };
  if (isCast) s.casts++; else s.dmg += dmg;
  g.abilityStats.set(cast.key, s);
}

const enemiesOf = (g, team, x, y, R) => g.near(x, y, R).filter(v => !v.dead && v.team !== team && (v.kind === 'champ' || v.kind === 'minion' || v.kind === 'monster'));
const alliesOf = (g, team, x, y, R) => g.champs.filter(v => v.team === team && !v.dead && Math.hypot(v.x - x, v.y - y) <= R);
const CLEANSE = new Set(['slow', 'stun', 'root']);

// efeitos com valor por rank (v: [..]) pegam o do rank atual
function applyBuffs(u, list, rank) { for (const b of list || []) u.buffs.push({ ...b, v: Array.isArray(b.v) ? b.v[rank - 1] : b.v }); }

export function castAbility(g, u, slot, tx, ty) {
  const ab = u.def.abil[slot], rank = u.ranks[slot];
  if (!ab || rank <= 0 || u.cds[slot] > 0 || !canAct(u) || u.dash || taunted(u)) return false;
  const cost = ab.cost[rank - 1];
  if (u.mana < cost) return false;
  if ((ab.kind === 'dash' || ab.kind === 'blink' || ab.kind === 'dig' || ab.kind === 'fly') && !canMove(u)) return false;
  const aim = ab.range ? clampRange(u, { x: tx, y: ty }, ab.range) : { x: u.x, y: u.y };
  const a = Math.atan2(ty - u.y, tx - u.x) || u.face;
  // raio que salta precisa de um primeiro alvo perto do cursor
  let chainFirst = null;
  if (ab.kind === 'chain') {
    let bd = Infinity;
    for (const v of enemiesOf(g, u.team, aim.x, aim.y, 350)) {
      if (!g.isVisible(u.team, v) || Math.hypot(v.x - u.x, v.y - u.y) > ab.range + 100) continue;
      const d = Math.hypot(v.x - aim.x, v.y - aim.y);
      if (d < bd) { bd = d; chainFirst = v; }
    }
    if (!chainFirst) return false;
  }

  u.mana -= cost;
  u.cds[slot] = hasteCd(ab.cd[rank - 1], u.stats.ah);
  u.recallT = 0;
  u.buffs = u.buffs.filter(b => b.k !== 'stealth' && b.k !== 'disguise');   // agir revela quem está invisível ou disfarçado
  cancelWindup(u);
  u.shotN = (u.shotN + 1) & 255;
  u.face = a;
  const M = moveOf(ab);
  const cast = {
    id: g.nextId++, src: u.id, team: u.team, hit: new Set(), ab,
    value: ab.dmg || ab.amount ? abilityValue(u, (ab.dmg || ab.amount)[rank - 1], ab.ratio) : 0,
    heal: ab.heal ? abilityValue(u, ab.heal[rank - 1], ab.healRatio) : 0,
    elem: (M && FX_TYPE[M.fx]) || u.types[0],
  };
  g.casts.set(cast.id, cast);
  cast.key = u.def.id + ':' + slot;
  track(g, cast, 0, true);
  g.event({ k: 'cast', id: u.id, s: slot, nm: abilityName(ab) }, u.x, u.y);

  // efeitos em você e nos aliados perto (valem para qualquer tipo de habilidade)
  applyBuffs(u, ab.self, rank);
  if (ab.allies) for (const v of alliesOf(g, u.team, u.x, u.y, ab.radius || 700)) { applyBuffs(v, ab.allies, rank); g.event({ k: 'buff', id: v.id, b: 'fury' }, v.x, v.y); }

  switch (ab.kind) {
    case 'heal': case 'shield':
      for (const v of alliesOf(g, u.team, u.x, u.y, ab.range)) {
        if (ab.kind === 'heal') heal(g, v, cast.value); else addShield(v, cast.value, ab.dur);
        if (ab.cleanse) v.buffs = v.buffs.filter(b => !CLEANSE.has(b.k));
        g.event({ k: 'buff', id: v.id, b: ab.kind }, v.x, v.y);
      }
      return true;
    case 'buff':
      if (ab.amount) for (const v of alliesOf(g, u.team, u.x, u.y, ab.radius || 700)) heal(g, v, cast.value);
      if (ab.cc && ab.enemyRadius) for (const v of enemiesOf(g, u.team, u.x, u.y, ab.enemyRadius)) applyCC(g, u, v, ab.cc);
      if (ab.taunt) for (const v of enemiesOf(g, u.team, u.x, u.y, ab.taunt.radius)) applyCC(g, u, v, { taunt: ab.taunt.t });
      if (ab.enemyRadius) g.event({ k: 'burst', z: [0, 0, Math.round(u.x), Math.round(u.y), ab.enemyRadius, 0, 1, u.team, ab.fx || 'aura', cast.elem] }, u.x, u.y);
      return true;
    case 'chain': {
      // salta para o inimigo mais perto que ainda não levou, perdendo uma fração a cada salto
      const pts = [[Math.round(u.x), Math.round(u.y - 60)]];
      let cur = chainFirst, k = 1;
      for (let i = 0; cur && i <= ab.bounces; i++) {
        cast.hit.add(cur.id);
        pts.push([Math.round(cur.x), Math.round(cur.y - 60)]);
        const dc = damage(g, u, cur, cast.value * k, ab.dmgType, { ability: true });
        if (cur.kind === 'champ') track(g, cast, dc);
        if (ab.cc) applyCC(g, u, cur, ab.cc);
        passiveAbilityHit(g, u, cur);
        k *= 1 - ab.falloff;
        let next = null, bd = Infinity;
        for (const v of enemiesOf(g, u.team, cur.x, cur.y, ab.bounceRange)) {
          if (cast.hit.has(v.id) || !g.isVisible(u.team, v)) continue;
          const d = Math.hypot(v.x - cur.x, v.y - cur.y);
          if (d < bd) { bd = d; next = v; }
        }
        cur = next;
      }
      g.event({ k: 'chain', pts, fx: ab.fx }, u.x, u.y);
      return true;
    }
    case 'cloud':
      g.zones.push({ s: 'a', id: g.nextId++, cast: cast.id, team: u.team, fx: ab.fx, elem: cast.elem, x: Math.round(aim.x), y: Math.round(aim.y), r: ab.radius, t: 0.25, max: 0.25, dur: ab.dur, act: 0, tick: 0 });
      return true;
    case 'trap': {
      const mine = g.zones.filter(z => z.s === 'trap' && z.owner === u.id);
      if (mine.length >= TRAP_MAX) mine[0].done = true;
      g.zones.push({ s: 'trap', id: g.nextId++, cast: cast.id, owner: u.id, team: u.team, fx: ab.fx, elem: cast.elem, x: Math.round(aim.x), y: Math.round(aim.y), r: ab.radius, t: TRAP_ARM, max: TRAP_ARM, life: TRAP_LIFE, act: 0 });
      return true;
    }
  }

  let from = { x: u.x, y: u.y };
  if (ab.kind === 'dig' || ab.kind === 'fly') {
    // Escavar: vai por baixo da terra até o ponto (o rastro de terra aparece para todos)
    // Voar: sobe, some do mapa e cai no ponto (só o círculo de pouso aparece)
    const to = nearestWalkable(aim.x, aim.y), dist = Math.hypot(to.x - u.x, to.y - u.y);
    const dur = ab.kind === 'dig' ? Math.max(0.35, dist / 950) : 1.6;
    u.travel = { kind: ab.kind, from, to, t: dur, max: dur };
    u.path = []; u.cmd = null; u.dash = null;
    g.event({ k: ab.kind, id: u.id }, u.x, u.y);
    if (ab.kind === 'dig') g.zones.push({ s: 'm', id: g.nextId++, cast: cast.id, team: u.team, fx: 'quake', elem: 'ground', noHit: true, x: Math.round(u.x), y: Math.round(u.y), a: Math.atan2(to.y - u.y, to.x - u.x), spd: dist / dur, dur, r: 45, t: 0, max: 0, act: 0 });
    for (const p of M.f(to, to, a).map(widenPiece)) g.zones.push({ ...p, id: g.nextId++, cast: cast.id, team: u.team, fx: M.fx, elem: cast.elem, act: 0, t: dur + 0.05, max: dur + 0.05, hide: ab.kind === 'dig' });
    return true;
  }
  if (ab.kind === 'blink') {
    const p = nearestWalkable(aim.x, aim.y);
    g.event({ k: 'blink', id: u.id, x0: Math.round(u.x), y0: Math.round(u.y) }, u.x, u.y);
    u.x = p.x; u.y = p.y; u.path = [];
    from = { x: u.x, y: u.y };
    if (M) spawnZones(g, cast, M.f(from, from, a), M.fx, from, 0, false);
    return true;
  }
  if (ab.kind === 'dash') {
    // avança até o ponto (parando na parede); a faixa do golpe acerta no caminho ao chegar
    const end = clampRange(u, { x: tx, y: ty }, ab.range);
    let len = Math.hypot(end.x - u.x, end.y - u.y);
    for (let s = 0; s <= len; s += 25) if (!walkable(u.x + Math.cos(a) * s, u.y + Math.sin(a) * s)) { len = Math.max(0, s - 25); break; }
    const spd = 1300;
    u.dash = { a, left: len, spd };
    u.path = [];
    if (!M) return true;
    const pieces = M.f(from, { x: from.x + Math.cos(a) * len, y: from.y + Math.sin(a) * len }, a);
    pieces[0] = { ...pieces[0], len: len + 80, d: 0 };
    spawnZones(g, cast, pieces, M.fx, from, len / spd, true);
    return true;
  }
  if (M) spawnZones(g, cast, M.f(from, ab.range ? aim : from, a), M.fx, from, 0, false);
  return true;
}

function spawnZones(g, cast, pieces, fx, origin, delay0, dashFirst) {
  const ab = cast.ab;
  pieces.map(widenPiece).forEach((p, i) => {
    const base = { id: g.nextId++, cast: cast.id, team: cast.team, fx, elem: cast.elem, act: 0 };
    if (dashFirst && i === 0) {
      // a faixa do avanço: acerta ao chegar, sem aviso para o inimigo
      g.zones.push({ ...p, ...base, t: delay0, max: delay0, hide: true });
    } else if (p.s === 'l' && (ab.projectile || Math.hypot(p.x - origin.x, p.y - origin.y) < 40)) {
      // faixa que sai do campeão vira projétil; o atraso do golpe original vira o intervalo entre as flechas
      const t = delay0 + Math.max(0, warnTime(p.d) - warnTime(0.95));
      g.zones.push({ ...p, ...base, s: 'p', spd: ab.projSpeed || PROJ_SPEED, pierce: ab.pierce || 99, hits: 0, t, max: t });
    } else if (p.s === 'm') {
      // golpe que anda: acelerado para a velocidade de skillshot, percorrendo a mesma distância
      const spd = ab.moverSpeed || Math.min(MOVER_SPEED.max, Math.max(MOVER_SPEED.min, p.spd * MOVER_SPEED.mult)), ts = spd / p.spd;
      const t = delay0 + Math.max(0, warnTime(p.d) - warnTime(0.95));
      g.zones.push({ ...p, ...base, spd, dur: p.dur / ts, ts, t, max: t });
    } else {
      const t = delay0 + warnTime(p.d);
      g.zones.push({ ...p, ...base, t, max: t });
    }
  });
}

const zoneHitsUnit = (z, x, y, r) => z.s === 'c' ? circleHit(z.x, z.y, z.r, x, y, r) : lineHit(z, x, y, r);

function hitUnit(g, cast, v, z) {
  if (cast.hit.has(v.id)) return false;
  cast.hit.add(v.id);
  const src = g.units.get(cast.src), live = src && !src.dead ? src : null, ab = cast.ab;
  // mais dano em quem está com o status certo (como o E da Cassiopeia em envenenados)
  const bonus = ab.vsStatus && v.buffs.some(b => b.k === 'dot' && b.tag === ab.vsStatus.tag) ? 1 + ab.vsStatus.v : 1;
  const dealt = damage(g, live, v, cast.value * bonus, ab.dmgType, { ability: true, owner: src });
  if (v.kind === 'champ') track(g, cast, dealt);
  if (ab.cc) applyCC(g, src, v, ab.cc);
  if (ab.status) applyStatus(g, live, v, ab.status);
  if (live && live.kind === 'champ') passiveAbilityHit(g, live, v);
  if (ab.mark) v.buffs.push({ k: 'mark', v: ab.mark, t: 6 });
  // roubo de vida da habilidade: você leva tudo, os aliados perto a metade
  if (ab.vamp && live && dealt > 0) {
    heal(g, live, dealt * ab.vamp);
    for (const a of alliesOf(g, live.team, live.x, live.y, 700)) if (a !== live) heal(g, a, dealt * ab.vamp * 0.5);
  }
  if (z) z.hits = (z.hits || 0) + 1;
  return true;
}

export function updateZones(g, dt) {
  for (const z of g.zones) {
    if (z.done) continue;
    const cast = g.casts.get(z.cast);
    if (!cast) { z.done = true; continue; }
    z.t -= dt;
    if (z.s === 'trap') { updateTrap(g, z, cast, dt); continue; }
    if (z.t > 0) continue;
    if (z.s === 'p') {
      // projétil: testa o trecho percorrido neste tick (não atravessa ninguém por estar rápido)
      const prev = z.act * z.spd;
      z.act += dt;
      const head = Math.min(z.len, z.act * z.spd), seg = { x: z.x + Math.cos(z.a) * prev, y: z.y + Math.sin(z.a) * prev, a: z.a, len: head - prev, w: z.w };
      const mx = seg.x + Math.cos(z.a) * seg.len / 2, my = seg.y + Math.sin(z.a) * seg.len / 2;
      for (const v of enemiesOf(g, z.team, mx, my, seg.len / 2 + z.w + 80)) {
        if (z.hits >= z.pierce) break;
        if (lineHit(seg, v.x, v.y, v.r)) hitUnit(g, cast, v, z);
      }
      if (head >= z.len || z.hits >= z.pierce) {
        z.done = true;
        const ex = z.x + Math.cos(z.a) * head, ey = z.y + Math.sin(z.a) * head;
        g.event({ k: 'burst', z: [0, 0, Math.round(ex), Math.round(ey), Math.min(70, z.w), 0, 1, z.team, z.fx, z.elem] }, ex, ey);
      }
      continue;
    }
    if (z.s === 'm') {
      z.act += dt;
      const q = movePos(z);
      if (!z.noHit) for (const v of enemiesOf(g, z.team, q.x, q.y, z.r + 80)) if (circleHit(q.x, q.y, z.r, v.x, v.y, v.r)) hitUnit(g, cast, v);
      if (z.act >= z.dur || (!z.noHit && !walkable(q.x, q.y))) z.done = true;
      continue;
    }
    if (z.s === 'a') {
      // nuvem / santuário: age a cada 0,5 s
      z.act += dt; z.tick -= dt;
      if (z.tick <= 0) {
        z.tick = 0.5;
        const src = g.units.get(cast.src), live = src && !src.dead ? src : null, ab = cast.ab;
        if (cast.value) for (const v of enemiesOf(g, z.team, z.x, z.y, z.r)) {
          if (!circleHit(z.x, z.y, z.r, v.x, v.y, v.r * 0.5)) continue;
          const dc = damage(g, live, v, cast.value, ab.dmgType, { ability: true, owner: src });
          if (v.kind === 'champ') track(g, cast, dc);
          if (ab.cc) applyCC(g, src, v, ab.cc);
        }
        if (cast.heal || ab.cleanse) for (const v of alliesOf(g, z.team, z.x, z.y, z.r)) {
          if (cast.heal) heal(g, v, cast.heal);
          if (ab.cleanse) v.buffs = v.buffs.filter(b => !CLEANSE.has(b.k));
        }
      }
      if (z.act >= z.dur) z.done = true;
      continue;
    }
    z.done = true;
    const cx = z.s === 'c' ? z.x : z.x + Math.cos(z.a) * z.len / 2, cy = z.s === 'c' ? z.y : z.y + Math.sin(z.a) * z.len / 2;
    const R = z.s === 'c' ? z.r + 100 : z.len / 2 + z.w + 100;
    for (const v of enemiesOf(g, z.team, cx, cy, R)) if (zoneHitsUnit(z, v.x, v.y, v.r)) hitUnit(g, cast, v);
    g.event({ k: 'burst', z: zoneNet(z) }, cx, cy);
  }
  g.zones = g.zones.filter(z => !z.done);
  // lançamentos sem peças pendentes saem da lista
  if (g.casts.size > 64) { const live = new Set(g.zones.map(z => z.cast)); for (const id of g.casts.keys()) if (!live.has(id)) g.casts.delete(id); }
}

function updateTrap(g, z, cast, dt) {
  z.life -= dt;
  if (z.life <= 0) { z.done = true; return; }
  if (z.t > 0) return;   // ainda armando
  const trig = enemiesOf(g, z.team, z.x, z.y, TRAP_TRIGGER).find(v => v.kind !== 'monster');
  if (!trig) return;
  z.done = true;
  for (const v of enemiesOf(g, z.team, z.x, z.y, z.r)) if (circleHit(z.x, z.y, z.r, v.x, v.y, v.r)) { cast.hit.delete(v.id); hitUnit(g, cast, v); }
  g.event({ k: 'burst', z: [0, 0, z.x, z.y, z.r, 0, 1, z.team, z.fx, z.elem] }, z.x, z.y);
}

// formato compacto de uma peça para o cliente
export function zoneNet(z) {
  const h = [z.id, 0, z.x, z.y, z.r || 0, +z.t.toFixed(2), +z.max.toFixed(2), z.team, z.fx || '', z.elem];
  switch (z.s) {
    case 'c': return h;
    case 'l': h[1] = 1; return [...h, z.a, z.len, z.w];
    case 'm': h[1] = 2; return [...h, z.a, z.spd, z.dur, z.wob || 0, z.ph || 0, +z.act.toFixed(2), +(z.ts || 1).toFixed(2)];
    case 'p': h[1] = 3; return [...h, z.a, z.len, z.w, z.spd, +z.act.toFixed(3)];
    case 'a': h[1] = 4; return [...h, z.dur, +z.act.toFixed(2)];
    default: h[1] = 5; return h;   // armadilha
  }
}

// o que cada time enxerga: o próprio time vê tudo; do outro, só as áreas com atraso e os
// projéteis/golpes que já saíram (nunca a mira, o avanço nem as armadilhas)
export function zoneVisibleTo(z, team, visible) {
  if (z.team === team) return true;
  if (z.hide || z.s === 'trap') return false;
  if ((z.s === 'p' || z.s === 'm') && z.t > 0) return false;
  if (z.s === 'p') { const k = Math.min(z.len, z.act * z.spd); return visible(z.x + Math.cos(z.a) * k, z.y + Math.sin(z.a) * k); }
  if (z.s === 'm') { const q = movePos(z); return visible(q.x, q.y); }
  return visible(z.x, z.y);
}

// ---------- feitiços de invocador ----------
export function castSummoner(g, u, k, tx, ty) {
  if (u.dead || u.summ[k] > 0 || !canAct(u)) return false;
  const S = SUMMONERS[k];
  if (k === 'flash') {
    if (!canMove(u) && !u.buffs.some(b => b.k === 'root')) return false;
    const q = clampRange(u, { x: tx, y: ty }, S.range), p = nearestWalkable(q.x, q.y);
    g.event({ k: 'blink', id: u.id, x0: Math.round(u.x), y0: Math.round(u.y) }, u.x, u.y);
    u.x = p.x; u.y = p.y; u.path = []; u.dash = null;
  } else if (k === 'heal') {
    const amt = S.base + S.perLvl * u.lvl;
    heal(g, u, amt);
    u.buffs.push({ k: 'ms', v: S.ms, t: S.msDur });
    // e o aliado mais ferido perto
    let best = null;
    for (const v of g.champs) if (v !== u && v.team === u.team && !v.dead && Math.hypot(v.x - u.x, v.y - u.y) < 850 && (!best || v.hp / v.stats.maxHp < best.hp / best.stats.maxHp)) best = v;
    if (best) { heal(g, best, amt); best.buffs.push({ k: 'ms', v: S.ms, t: S.msDur }); }
    g.event({ k: 'buff', id: u.id, b: 'heal' }, u.x, u.y);
  }
  u.summ[k] = S.cd;
  u.recallT = 0;
  return true;
}
