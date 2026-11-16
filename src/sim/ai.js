// IA de minions, torres e monstros da selva (seção 9 de matematica-moba.md).

import { MINION } from '../config.js';
import { chase, startAttack, edgeDist, setDestination } from './units.js';
import { canAct } from './combat.js';

const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const alive = t => t && !t.dead;

// alvo do minion: minions primeiro, depois estruturas, campeões por último (a não ser que chamem ajuda)
function minionAcquire(g, u) {
  let best = null, bs = Infinity;
  for (const v of g.near(u.x, u.y, MINION.aggroRange)) {
    if (v.dead || v.team === u.team || v.team === 2 || v.invuln) continue;
    const pen = v.kind === 'minion' ? 0 : v.kind === 'champ' ? 600 : 300;
    if (v.kind === 'champ' && !g.targetable(u.team, v)) continue;
    const s = Math.sqrt(d2(u, v)) + pen;
    if (s < bs) { bs = s; best = v; }
  }
  return best;
}

export function minionAI(g, u, dt) {
  const tb = u.buffs.find(b => b.k === 'taunt');
  const ts = tb && g.units.get(tb.src);
  if (ts && !ts.dead) { chase(g, u, ts, dt); return; }
  let t = g.units.get(u.target);
  if (!alive(t) || d2(u, t) > (MINION.aggroRange + 400) ** 2 || t.invuln || !g.targetable(u.team, t)) t = null;
  u.thinkT = (u.thinkT || 0) - dt;
  if (u.thinkT <= 0) {
    u.thinkT = 0.25;
    const h = u.help && g.time - u.help.t < 2.5 ? g.units.get(u.help.id) : null;
    if (alive(h) && d2(u, h) < MINION.aggroRange ** 2) t = h;
    else if (!t || t.kind !== 'minion') t = minionAcquire(g, u) || t;
    u.target = t ? t.id : 0;
  }
  if (t) { chase(g, u, t, dt); return; }
  // segue a lane
  const lp = u.lanePath;
  while (u.wp < lp.length && d2(u, lp[u.wp]) < 150 * 150) u.wp++;
  const w = u.wp < lp.length ? lp[u.wp] : g.nexusOf(1 - u.team);
  if (!u.path.length || u.path[u.path.length - 1] !== w) u.path = [w];
}

export function towerAI(g, u, dt) {
  if (!canAct(u)) return;
  const inRange = v => alive(v) && v.team !== u.team && v.team !== 2 && edgeDist(u, v) <= u.stats.range && g.targetable(u.team, v);
  let t = g.units.get(u.target);
  const h = u.help && g.time - u.help.t < 2 ? g.units.get(u.help.id) : null;
  if (inRange(h) && (!t || t.kind !== 'champ')) t = h;
  if (!inRange(t)) {
    // minions mais perto primeiro; campeões só sem minions
    let best = null, bs = Infinity;
    for (const v of g.near(u.x, u.y, u.stats.range + 100)) {
      if (!inRange(v) || v.kind === 'tower' || v.kind === 'nexus') continue;
      if (v.kind === 'champ' && !g.isVisible(u.team, v)) continue;
      const s = Math.sqrt(d2(u, v)) + (v.kind === 'champ' ? 5000 : 0);
      if (s < bs) { bs = s; best = v; }
    }
    t = best;
  }
  u.target = t ? t.id : 0;
  if (!t) { u.ramp = 0; u.rampTid = 0; return; }
  startAttack(g, u, t);
}

export function monsterAI(g, u, dt) {
  const home = u.home;
  if (u.returning) {
    u.hp = Math.min(u.stats.maxHp, u.hp + u.stats.maxHp * 0.3 * dt);
    if (d2(u, home) < 80 * 80) { u.returning = false; u.path = []; u.face = 1.57; }
    else if (!u.path.length) setDestination(g, u, home.x, home.y);
    return;
  }
  const t = g.units.get(u.aggro);
  if (!alive(t) || d2(u, home) > 900 * 900 || d2(t, home) > 1100 * 1100) {
    if (u.aggro || d2(u, home) > 100 * 100) { u.aggro = 0; u.returning = true; u.atk.wind = 0; setDestination(g, u, home.x, home.y); }
    return;
  }
  chase(g, u, t, dt);
}

// avisa minions e torres do time da vítima de que `src` agrediu um campeão aliado
export function callForHelp(g, src, victim) {
  for (const v of g.near(victim.x, victim.y, 1100)) {
    if (v.team !== victim.team || v.dead) continue;
    if (v.kind === 'minion' && d2(v, victim) < MINION.callForHelp ** 2) v.help = { id: src.id, t: g.time };
    else if (v.kind === 'tower' && edgeDist(v, src) <= v.stats.range) v.help = { id: src.id, t: g.time };
  }
}
