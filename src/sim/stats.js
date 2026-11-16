// Atributos dos campeões: base + crescimento por nível + itens + efeitos ativos (seções 2, 4 e 5 da matemática).

import { growth, softCapMS, AS_CAP, CRIT_MULT } from '../config.js';
import { ITEM_BY_ID } from '../data/items.js';

const ZERO = () => ({
  hp: 0, mp: 0, ad: 0, ap: 0, armor: 0, mr: 0, as: 0, crit: 0, lethality: 0, armorPenPct: 0, magicPen: 0, magicPenPct: 0,
  ah: 0, ms: 0, msPct: 0, lifesteal: 0, omnivamp: 0, hp5: 0, mp5: 0,
});

// soma dos itens (botas não acumulam; tenacidade combina multiplicando)
function itemTotals(items) {
  const t = ZERO();
  let boots = false, ten = 1, apMult = 0, critMult = 0, thorns = 0;
  for (const id of items) {
    const it = ITEM_BY_ID[id];
    if (!it || !it.stats) continue;
    if (it.boots) { if (boots) continue; boots = true; }
    for (const [k, v] of Object.entries(it.stats)) {
      if (k === 'tenacity') ten *= 1 - v;
      else t[k] += v;
    }
    apMult += it.apMult || 0; critMult += it.critMult || 0; thorns += it.thorns || 0;
  }
  return { t, tenacity: 1 - ten, apMult, critMult, thorns };
}

// efeitos ativos: lentidão (só a mais forte vale), bônus de velocidade, armadura/RM temporárias
function buffTotals(u) {
  let slow = 0, msPct = 0, armor = 0, mr = 0, as = 0, ad = 0, ap = 0, vamp = 0;
  for (const b of u.buffs) {
    if (b.k === 'slow') slow = Math.max(slow, b.v);
    else if (b.k === 'ms') msPct += b.v;
    else if (b.k === 'armor') armor += b.v;
    else if (b.k === 'mr') mr += b.v;
    else if (b.k === 'as') as += b.v;
    else if (b.k === 'ad') ad += b.v;
    else if (b.k === 'ap') ap += b.v;
    else if (b.k === 'vamp') vamp += b.v;
  }
  return { slow, msPct, armor, mr, as, ad, ap, vamp };
}

export function champStats(u) {
  const b = u.def.base, L = u.lvl;
  const { t, tenacity, apMult, critMult, thorns } = itemTotals(u.items);
  const bf = buffTotals(u);
  const baseAd = growth(b.ad, b.adG, L);
  // velocidade de ataque: AS base × (1 + bônus do nível + bônus dos itens), com teto de 2,5
  const asBonus = (b.asG / 100) * (L - 1) * (0.7025 + 0.0175 * (L - 1)) + t.as + bf.as;
  const msRaw = (b.ms + t.ms) * (1 + t.msPct + bf.msPct) * (1 - bf.slow);
  return {
    maxHp: (growth(b.hp, b.hpG, L) + t.hp) * (u.buffs.some(x => x.k === 'dyna') ? 1.35 : 1),   // Dynamax: +35% de vida
    maxMp: growth(b.mp, b.mpG, L) + t.mp,
    baseAd, ad: baseAd + t.ad + bf.ad, bonusAd: t.ad + bf.ad,
    ap: (t.ap + bf.ap) * (1 + apMult),
    armor: growth(b.armor, b.armorG, L) + t.armor + bf.armor,
    mr: growth(b.mr, b.mrG, L) + t.mr + bf.mr,
    as: Math.min(AS_CAP, b.as * (1 + asBonus)),
    ms: softCapMS(msRaw),
    range: u.def.range,
    crit: Math.min(1, t.crit), critMult: CRIT_MULT + critMult,
    lethality: t.lethality, armorPenPct: t.armorPenPct, magicPen: t.magicPen, magicPenPct: t.magicPenPct,
    ah: t.ah, lifesteal: t.lifesteal + bf.vamp, omnivamp: t.omnivamp,
    // regeneração por 5 s: base + crescimento por nível (como no LoL) + itens
    hp5: b.hp5 + 0.6 * (L - 1) + t.hp5, mp5: b.mp5 + 0.7 * (L - 1) + t.mp5,
    tenacity: 1 - (1 - tenacity) * (1 - ((u.def.passive && u.def.passive.tenacity) || 0)), thorns,
  };
}

// minions, torres e monstros: atributos fixos + lentidão
export function simpleStats(u) {
  const bf = buffTotals(u), s = u.base;
  return {
    maxHp: s.hp, maxMp: 0, baseAd: s.ad, ad: s.ad, bonusAd: 0, ap: 0,
    armor: s.armor + bf.armor, mr: s.mr + bf.mr, as: s.as, ms: softCapMS(s.ms * (1 - bf.slow) * (1 + bf.msPct)),
    range: s.range, crit: 0, critMult: CRIT_MULT, lethality: 0, armorPenPct: 0, magicPen: 0, magicPenPct: 0,
    ah: 0, lifesteal: 0, omnivamp: 0, hp5: 0, mp5: 0, tenacity: 0, thorns: 0,
  };
}

export function refreshStats(u) {
  const old = u.stats;
  u.stats = u.kind === 'champ' ? champStats(u) : simpleStats(u);
  // ganhar vida máxima (nível, item) também cura a diferença, como no LoL
  if (old && u.stats.maxHp > old.maxHp && !u.dead) u.hp += u.stats.maxHp - old.maxHp;
  if (old && u.stats.maxMp > old.maxMp) u.mana += u.stats.maxMp - old.maxMp;
  u.hp = Math.min(u.hp, u.stats.maxHp);
  if (u.mana !== undefined) u.mana = Math.min(u.mana, u.stats.maxMp);
}
