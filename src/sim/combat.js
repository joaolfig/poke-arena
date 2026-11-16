// Dano, cura, escudos e controle de grupo (seções 3 e 4 de matematica-moba.md).

import { mitigation } from '../config.js';
import { isInvul, passiveDamageMult, sturdySave, passiveOnAutoTaken, passiveOnCC } from './status.js';

// armadura/RM efetiva depois de penetração, na ordem do LoL: % de penetração, depois penetração fixa (lethality)
function effectiveResist(R, pctPen, flatPen) {
  if (R <= 0) return R;
  return Math.max(0, R * (1 - pctPen) - flatPen);
}

// dano bruto -> dano final. type: 'physical' | 'magic' | 'true'. o: { auto, crit, ability, dot }
// Os tipos de Pokémon não mudam o dano (só a aparência): o balanceamento segue o do LoL.
export function damage(g, src, tgt, raw, type, o = {}) {
  if (!tgt || tgt.dead || raw <= 0 || tgt.invuln || isInvul(tgt)) return 0;
  const s = src ? src.stats : null;
  let mult = 1;
  if (type === 'physical') mult = mitigation(effectiveResist(tgt.stats.armor, s ? s.armorPenPct : 0, s ? s.lethality : 0));
  else if (type === 'magic') mult = mitigation(effectiveResist(tgt.stats.mr, s ? s.magicPenPct : 0, s ? s.magicPen : 0));
  let dmg = raw * mult * passiveDamageMult(src, tgt, type);
  // marcado: recebe mais dano de todo mundo; redução de dano (Selo Sagrado)
  for (const b of tgt.buffs) if (b.k === 'mark' && b.t > 0) dmg *= 1 + b.v; else if (b.k === 'dr' && b.t > 0) dmg *= 1 - b.v;

  // escudos absorvem primeiro
  for (const b of tgt.buffs) {
    if (b.k !== 'shield' || dmg <= 0) continue;
    const ab = Math.min(b.v, dmg);
    b.v -= ab; dmg -= ab;
    if (b.v <= 0) b.t = 0;
  }
  const dealt = Math.min(dmg, tgt.hp);
  tgt.lastCombat = g.time; if (src) src.lastCombat = g.time;
  tgt.hp -= dmg;
  tgt.hurtN = (tgt.hurtN + 1) & 255;
  if (tgt.recallT > 0) tgt.recallT = 0;
  // dano (que não seja de queimadura/veneno) acorda quem dorme e desfaz a Ilusão
  if (!o.dot && dmg > 0) tgt.buffs = tgt.buffs.filter(b => !(b.k === 'sleep' && g.time - b.at > 0.05) && b.k !== 'disguise');

  if (src && src.kind === 'champ') {
    const vamp = (o.auto ? s.lifesteal : 0) + s.omnivamp;
    if (vamp > 0) heal(g, src, dealt * vamp, false);
    if (tgt.kind === 'champ') {
      tgt.dmgBy.set(src.id, g.time);
      src.revealT = Math.max(src.revealT, 1.2);
      // "chamar ajuda": minions e torres do alvo passam a mirar quem agrediu um campeão
      g.callForHelp(src, tgt);
    }
  }
  if (o.auto && src) {
    if (tgt.stats.thorns) damage(g, tgt, src, tgt.stats.thorns, 'magic');
    passiveOnAutoTaken(g, src, tgt, damage);
  }
  if (tgt.kind === 'monster' && src) tgt.aggro = src.id;

  g.event({ k: 'dmg', id: tgt.id, s: src ? src.id : 0, v: Math.round(dmg), t: o.dot ? 'd' : type[0], c: o.crit ? 1 : 0, ...(o.fx ? { a: o.fx } : {}) }, tgt.x, tgt.y);
  // abate vale para quem lançou mesmo se ele já morreu (golpe, projétil ou queimadura chegando depois, como no LoL)
  if (tgt.hp <= 0 && !sturdySave(g, tgt)) g.kill(tgt, src || o.owner);
  return dmg;
}

export function heal(g, u, amt, show = true) {
  if (u.dead || amt <= 0) return;
  const before = u.hp;
  u.hp = Math.min(u.stats.maxHp, u.hp + amt);
  if (show && u.hp - before >= 1) g.event({ k: 'heal', id: u.id, v: Math.round(u.hp - before) }, u.x, u.y);
}

export function addShield(u, amt, dur) {
  u.buffs.push({ k: 'shield', v: amt, t: dur });
}

// cc: { slow, dur } | { stun } | { root } | { knockup }. Tenacidade encurta tudo menos o knockup.
export function applyCC(g, src, tgt, cc) {
  if (!cc || tgt.dead || tgt.kind === 'tower' || tgt.kind === 'nexus') return;
  // Aparar (Detectar do Lucario, como o W da Fiora): quem tenta controlar fica atordoado
  const parry = tgt.buffs.find(b => b.k === 'invul' && b.riposte && b.t > 0);
  if (parry && src && !src.dead && src.team !== tgt.team) {
    parry.riposte = false;
    src.buffs.push({ k: 'stun', t: 1 }); src.atk.wind = 0;
    g.event({ k: 'passive', id: tgt.id, nm: '✋ Aparou!' }, tgt.x, tgt.y);
  }
  if (isInvul(tgt) || tgt.buffs.some(b => b.k === 'unstop')) return;   // imparável: ignora controle (como o R do Olaf)
  const ten = tgt.stats.tenacity || 0;
  if (cc.slow) tgt.buffs.push({ k: 'slow', v: cc.slow, t: cc.dur * (1 - ten) });
  if (cc.stun) tgt.buffs.push({ k: 'stun', t: cc.stun * (1 - ten) });
  if (cc.root) tgt.buffs.push({ k: 'root', t: cc.root * (1 - ten) });
  if (cc.knockup) tgt.buffs.push({ k: 'knockup', t: cc.knockup });
  if (cc.taunt && src) { tgt.buffs.push({ k: 'taunt', t: cc.taunt * (1 - ten), src: src.id }); tgt.recallT = 0; }
  if (cc.stun || cc.knockup) { tgt.atk.wind = 0; tgt.recallT = 0; }
  if (cc.stun || cc.root || cc.knockup || cc.taunt) { tgt.dash = null; passiveOnCC(g, src, tgt); }
}

export const hasBuff = (u, k) => u.buffs.some(b => b.k === k && b.t > 0);
const HARD = new Set(['stun', 'knockup', 'sleep']);
// provocado: só pode atacar quem provocou (não lança habilidades nem obedece comandos)
export const taunted = u => u.buffs.find(b => b.k === 'taunt' && b.t > 0);
export const canMove = u => !u.dead && !u.travel && !u.buffs.some(b => b.t > 0 && (HARD.has(b.k) || b.k === 'root'));
export const canAct = u => !u.dead && !u.travel && !u.buffs.some(b => b.t > 0 && HARD.has(b.k));
