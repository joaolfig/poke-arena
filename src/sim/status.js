// Status de Pokémon traduzidos para efeitos do LoL, e as passivas dos campeões.
//   burn      Queimadura: dano mágico por 3 s (renova, não acumula)
//   poison    Veneno: dano mágico por 4 s, acumula até 3 vezes
//   paralysis Paralisia: lentidão forte por 1,5 s
//   chill     Gelado: acumula; na 3ª vez o alvo congela (preso por 1 s)
//   sleep     Sono: não age nem anda; acorda ao levar dano (como a Lillia)
//   drowsy    Sonolento: dorme quando o efeito acaba (Bocejo, Pó do Sono)

const STATUS_T = { burn: 3, poison: 4, paralysis: 1.5, chill: 4, sleep: 1.5, drowsy: 1.2 };

// dano por segundo da queimadura/veneno, pelo nível e AP de quem aplicou
const dotDps = (src, k) => {
  const lvl = src && src.lvl ? src.lvl : 1, ap = src && src.stats ? src.stats.ap : 0;
  return k === 'burn' ? 8 + 2.5 * lvl + 0.12 * ap : 4 + 1.5 * lvl + 0.06 * ap;
};

export function applyStatus(g, src, tgt, k) {
  if (!tgt || tgt.dead || tgt.kind === 'tower' || tgt.kind === 'nexus' || isInvul(tgt)) return;
  if (k !== 'burn' && k !== 'poison' && tgt.buffs.some(b => b.k === 'unstop')) return;
  const ten = tgt.stats.tenacity || 0;
  const sid = src ? src.id : 0;
  switch (k) {
    case 'burn': {
      const b = tgt.buffs.find(x => x.k === 'dot' && x.tag === 'burn' && x.src === sid);
      if (b) b.t = STATUS_T.burn; else tgt.buffs.push({ k: 'dot', tag: 'burn', src: sid, v: dotDps(src, 'burn'), t: STATUS_T.burn, acc: 0 });
      break;
    }
    case 'poison': {
      const mine = tgt.buffs.filter(x => x.k === 'dot' && x.tag === 'poison' && x.src === sid);
      mine.forEach(x => { x.t = STATUS_T.poison; });
      if (mine.length < 3) tgt.buffs.push({ k: 'dot', tag: 'poison', src: sid, v: dotDps(src, 'poison'), t: STATUS_T.poison, acc: 0 });
      break;
    }
    case 'paralysis': tgt.buffs.push({ k: 'slow', tag: 'paralysis', v: 0.45, t: STATUS_T.paralysis * (1 - ten) }); break;
    case 'chill': {
      const n = tgt.buffs.filter(x => x.k === 'chill').length;
      if (n >= 2) {
        tgt.buffs = tgt.buffs.filter(x => x.k !== 'chill');
        tgt.buffs.push({ k: 'root', tag: 'freeze', t: 1 * (1 - ten) });
        g.event({ k: 'freeze', id: tgt.id }, tgt.x, tgt.y);
      } else tgt.buffs.push({ k: 'chill', t: STATUS_T.chill });
      break;
    }
    case 'sleep': tgt.buffs.push({ k: 'sleep', t: STATUS_T.sleep * (1 - ten), at: g.time }); tgt.atk.wind = 0; tgt.recallT = 0; break;
    case 'drowsy': if (!tgt.buffs.some(x => x.k === 'drowsy' || x.k === 'sleep')) tgt.buffs.push({ k: 'drowsy', t: STATUS_T.drowsy }); break;
  }
}

export const isInvul = u => u.buffs.some(b => b.k === 'invul' && b.t > 0) || !!u.travel;

// por tick, para cada unidade viva: dano contínuo e sonolento -> dormindo
export function tickStatus(g, u, dt, damage) {
  for (const b of u.buffs) {
    if (b.k === 'dot') {
      b.acc += dt;
      if (b.acc >= 0.5) { b.acc -= 0.5; const src = g.units.get(b.src); damage(g, src && !src.dead ? src : null, u, b.v * 0.5, 'magic', { dot: true, owner: src }); }
    } else if (b.k === 'drowsy' && b.t - dt <= 0 && !u.dead) {
      u.buffs.push({ k: 'sleep', t: STATUS_T.sleep * (1 - (u.stats.tenacity || 0)), at: g.time });
      u.atk.wind = 0; u.recallT = 0;
    }
  }
}

// ---------- passivas ----------
const P = u => (u && u.def && u.def.passive) || null;

// multiplicador de dano de quem ataca e de quem recebe (antes dos escudos)
export function passiveDamageMult(src, tgt, type) {
  let m = 1;
  const ps = P(src), pt = P(tgt);
  if (ps && ps.lowHpDmg && src.hp < src.stats.maxHp * 0.35) m *= 1 + ps.lowHpDmg;
  if (src && src.buffs.some(b => b.k === 'weaken')) m *= 1 - src.buffs.find(b => b.k === 'weaken').v;
  if (pt && pt.multiscale && tgt.hp >= tgt.stats.maxHp - 1) m *= 1 - pt.multiscale;
  if (pt && pt.thickFat && type === 'magic') m *= 1 - pt.thickFat;
  return m;
}

// Robustez: um golpe que mataria deixa com 1 de vida (recarga em segundos)
export function sturdySave(g, tgt) {
  const pt = P(tgt);
  if (!pt || !pt.sturdy || tgt.kind !== 'champ' || (tgt.sturdyAt !== undefined && g.time - tgt.sturdyAt < pt.sturdy)) return false;
  tgt.sturdyAt = g.time; tgt.hp = 1;
  g.event({ k: 'passive', id: tgt.id, nm: pt.nome }, tgt.x, tgt.y);
  return true;
}

// habilidade acertou: status e maldição da passiva
export function passiveAbilityHit(g, src, tgt) {
  const ps = P(src);
  if (!ps || tgt.dead) return;
  if (ps.onAbility) applyStatus(g, src, tgt, ps.onAbility);
  if (ps.onAbilityMark) tgt.buffs.push({ k: 'mark', v: ps.onAbilityMark, t: 4 });
}

// ataque básico: a cada N ataques, bônus ou status; tiro de longe dói mais
export function passiveAutoMod(u, t, hit) {
  const ps = P(u);
  if (!ps) return hit;
  if (ps.onAuto) {
    u.autoN = (u.autoN || 0) + 1;
    if (u.autoN % (ps.onAuto.every + 1) === 0) {
      if (ps.onAuto.bonus) hit.dmg *= 1 + ps.onAuto.bonus;
      if (ps.onAuto.status) hit.status = ps.onAuto.status;
      hit.proc = true;
    }
  }
  if (ps.longReach && Math.hypot(u.x - t.x, u.y - t.y) > 450) hit.dmg *= 1 + ps.longReach;
  return hit;
}

// quem recebeu o ataque básico reage (Pele Áspera)
export function passiveOnAutoTaken(g, src, tgt, damage) {
  const pt = P(tgt);
  if (pt && pt.roughSkin && src && !src.dead && src.kind === 'champ') damage(g, tgt, src, 15 + 2 * tgt.lvl, 'magic');
}

// quem aplicou controle de grupo em você (Sincronizar) e o que você ganha (Justiça)
export function passiveOnCC(g, src, tgt) {
  const pt = P(tgt);
  if (!pt) return;
  if (pt.steadfast) tgt.buffs.push({ k: 'ms', v: pt.steadfast, t: 2 });
  if (pt.synchronize && src && !src.dead && src.team !== tgt.team) src.buffs.push({ k: 'slow', v: 0.3, t: 1.5 });
}

// passivas de área (a cada segundo): Tempestade de Areia e Intimidação
export function passiveAura(g, c, damage) {
  const pc = P(c);
  if (!pc || c.dead) return;
  if (pc.sandStream) for (const v of g.near(c.x, c.y, 450)) {
    if (v.dead || v.team === c.team || (v.kind !== 'champ' && v.kind !== 'minion' && v.kind !== 'monster')) continue;
    damage(g, c, v, 4 + 1.5 * c.lvl, 'magic', { dot: true });
  }
  if (pc.intimidate) for (const v of g.champs) {
    if (v.dead || v.team === c.team || Math.hypot(v.x - c.x, v.y - c.y) > 500) continue;
    const b = v.buffs.find(x => x.k === 'weaken');
    if (b) b.t = 1.1; else v.buffs.push({ k: 'weaken', v: pc.intimidate, t: 1.1 });
  }
}
