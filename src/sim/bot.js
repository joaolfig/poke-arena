// Campeões controlados pelo computador. Árvore de prioridades, como os bots do LoL: recuar > luta > comprar >
// suporte > estruturas > último golpe > esperar na linha de frente. Ideias da Riot (avaliação de ameaça pelo
// burst disponível), dos bots do Paragon (linha de frente e área segura da torre) e do Dota (vontade de empurrar).

import { FOUNTAIN, LANES, CAMPS } from './map.js';
import { ITEM_BY_ID, MAX_ITEMS, recipe, nextBuildStep } from '../data/items.js';
import { TOWER, GAME } from '../config.js';
import { edgeDist } from './units.js';
import { abilityValue, moveOf } from './abilities.js';

const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ordem de compra por função
// ordem de ranks: R sempre que der, depois maximiza Q, W, E
// ordem de ranks como no LoL: Q, W e E nos três primeiros níveis; depois R sempre que der e maximiza Q > W > E
const SKILL_ORDER = [3, 0, 1, 2];

function botLevelUp(g, u) {
  while (u.skillPts > 0) {
    const first = [0, 1, 2].find(s => u.ranks[s] === 0 && g.levelAbility(u, s));
    if (first !== undefined) continue;
    let done = false;
    for (const s of SKILL_ORDER) if (g.levelAbility(u, s)) { done = true; break; }
    if (!done) break;
  }
}

// alcance real de um golpe: até onde vai a peça mais distante (golpes em volta de si não alcançam só 280)
const REACH = new Map();
function reachOf(ab) {
  if (ab.range) return ab.range + 50;
  if (REACH.has(ab)) return REACH.get(ab);
  const M = moveOf(ab);
  let r = 280;
  if (M) for (const p of M.f({ x: 0, y: 0 }, { x: 0, y: 0 }, 0)) {
    const far = p.s === 'l' ? Math.hypot(p.x, p.y) + p.len : p.s === 'm' ? p.spd * p.dur : Math.hypot(p.x, p.y) + p.r;
    r = Math.max(r, far * 0.8);
  }
  REACH.set(ab, r);
  return r;
}

// próximo item da build do campeão (a mesma que a loja recomenda ao jogador)
const nextItem = u => { const n = nextBuildStep(u.def.build, u.items, u.gold); return n && n.step; };

function botShop(g, u) {
  const it = nextItem(u);
  if (!it) return;
  const r = recipe(u.items, it.id);
  // inventário cheio: vende um básico que não entra na receita para abrir espaço
  if (r.slots > MAX_ITEMS) {
    const cheap = u.items.findIndex((x, k) => x && !r.use.includes(k) && ITEM_BY_ID[x].cost < 700 && !ITEM_BY_ID[x].boots);
    if (cheap < 0) return;
    g.sell(u, cheap);
  }
  if (u.gold >= recipe(u.items, it.id).cost) g.buy(u, it.id);
}

// posição de frente da lane: o minion aliado mais avançado, ou atrás da torre aliada mais avançada
function laneFront(g, u) {
  const lane = LANES[u.lane], forward = u.team === 0 ? lane : [...lane].reverse();
  let best = null, bt = -1;
  for (const m of g.minions) {
    if (m.dead || m.team !== u.team || m.lane !== u.lane) continue;
    const prog = m.wp * 100000 - d(m, forward[Math.min(m.wp, forward.length - 1)]);
    if (prog > bt) { bt = prog; best = m; }
  }
  if (best) return { x: best.x, y: best.y };
  let tw = null;
  for (const t of g.towers) if (t.team === u.team && t.lane === u.lane && !t.dead && (!tw || t.tier < tw.tier)) tw = t;
  return tw ? { x: tw.x + (FOUNTAIN[u.team].x - tw.x) * 0.08, y: tw.y + (FOUNTAIN[u.team].y - tw.y) * 0.08 } : FOUNTAIN[u.team];
}

// torre inimiga perigosa: perto do ponto e sem minions aliados dentro do alcance dela para tankar
// (regra dos bots do Paragon: a área da torre só é segura enquanto ela tem minions para atacar)
const allyMinionsNear = (g, u, p, r) => g.minions.filter(m => !m.dead && m.team === u.team && d(m, p) < r).length;
const dangerTower = (g, u, p) => g.towers.find(t => !t.dead && t.team !== u.team && d(t, p) < TOWER.range + 120 && (t.target === u.id || allyMinionsNear(g, u, t, TOWER.range) < 2));

// dano mitigado aproximado (para decidir trocas e último golpe)
const mitigated = (raw, type, tgt) => raw * (type === 'magic' ? 100 / (100 + Math.max(0, tgt.stats.mr)) : type === 'true' ? 1 : 100 / (100 + Math.max(0, tgt.stats.armor)));

// burst disponível agora: habilidades fora de recarga com mana + 3 ataques básicos (avaliação da Riot de 2014)
function burst(u, t) {
  let dmg = mitigated(u.stats.ad * 3, 'physical', t);
  u.def.abil.forEach((ab, s) => {
    const r = u.ranks[s];
    if (!r || !ab.dmg || u.cds[s] > 0 || u.mana < ab.cost[r - 1]) return;
    dmg += mitigated(abilityValue(u, ab.dmg[r - 1], ab.ratio), ab.dmgType, t);
  });
  return dmg;
}

// vida prevista do minion quando meu ataque chegar: tira os projéteis já a caminho e o dano dos minions batendo nele
function predictedHp(g, u, m) {
  const travel = u.def.missile ? d(u, m) / u.def.missile : 0;
  const tHit = (1 / u.stats.as) * u.def.windup + travel;
  let hp = m.hp;
  for (const ms of g.missiles) if (ms.tid === m.id && d(ms, m) / ms.spd < tHit) hp -= mitigated(ms.hit.dmg, ms.hit.type, m);
  for (const e of g.minions) if (!e.dead && e.team !== m.team && e.target === m.id) hp -= mitigated(e.stats.ad * e.stats.as * tHit, 'physical', m);
  return hp;
}

// vontade de empurrar a lane: cresce com o tempo e com a vantagem de minions perto (desejo de "push" dos bots do Dota)
function pushDesire(g, u, front) {
  const mine = g.minions.filter(m => !m.dead && m.team === u.team && d(m, front) < 1200).length;
  const theirs = g.minions.filter(m => !m.dead && m.team !== u.team && d(m, front) < 1200).length;
  return 0.3 + 0.08 * (mine - theirs) + g.time / 900;
}

const GROUP_AT = 14 * 60;

export function botThink(g, u, dt) {
  u.botT = (u.botT || 0) - dt;
  if (u.dead) return;
  if (u.skillPts > 0) botLevelUp(g, u);
  if (u.botT > 0) return;
  // meio de jogo (como no LoL): a partir dos 14 min o time se junta no meio para derrubar as torres
  if (g.time > GROUP_AT) u.lane = 'mid';
  u.botT = 0.15 + Math.random() * 0.15;   // cada bot decide num ritmo um pouco diferente
  if (u.spread === undefined) u.spread = { side: (Math.random() - 0.5) * 2, depth: Math.random() };
  const home = FOUNTAIN[u.team], hpPct = u.hp / u.stats.maxHp;
  const atHome = d(u, home) < GAME.shopRadius;
  if (atHome) botShop(g, u);
  if (u.recallT > 0) return;

  const enemies = g.champs.filter(e => e.team !== u.team && !e.dead && g.targetable(u.team, e) && d(e, u) < 1300);
  const nearest = enemies.sort((a, b) => d(a, u) - d(b, u))[0];
  // a torre inimiga está mirando em mim: sai na hora
  const shooter = g.towers.find(t => !t.dead && t.team !== u.team && t.target === u.id);

  // recua: pouca vida, ou o burst dos inimigos perto mata
  const threat = enemies.filter(e => d(e, u) < 900).reduce((s, e) => s + burst(e, u), 0);
  if (hpPct < 0.3 || threat > u.hp * 1.1 || u.retreat || (shooter && hpPct < 0.6)) {
    u.retreat = hpPct < 0.8 && (hpPct < 0.3 || threat > u.hp * 0.8 || u.retreat);
    if (d(u, home) < GAME.fountainRadius * 0.6) { u.retreat = hpPct < 0.95; g.order(u, { c: 'stop' }); return; }
    if (atHome) { g.order(u, { c: 'move', x: home.x, y: home.y }); return; }
    if (nearest && d(nearest, u) < 550) {
      if (hpPct < 0.25 && u.summ.heal <= 0) g.summoner(u, 'heal', u.x, u.y);
      if (hpPct < 0.15 && u.summ.flash <= 0) g.summoner(u, 'flash', home.x, home.y);
      for (let s = 0; s < 3; s++) if (['dash', 'blink', 'dig'].includes(u.def.abil[s].kind)) g.cast(u, s, home.x, home.y);
      g.order(u, { c: 'move', x: home.x, y: home.y });
    } else if (!nearest && hpPct < 0.5) g.order(u, { c: 'recall' });
    else g.order(u, { c: 'move', x: home.x, y: home.y });
    return;
  }
  if (shooter) { g.order(u, { c: 'move', x: home.x, y: home.y }); return; }

  // luta: compara o meu burst com a vida dele e o burst dele com a minha (com ajuda de aliados perto)
  if (nearest) {
    const allies = g.champs.filter(a => a.team === u.team && !a.dead && d(a, nearest) < 1000);
    const foes = enemies.filter(e => d(e, nearest) < 1000);
    const ourBurst = allies.reduce((s, a) => s + burst(a, nearest), 0);
    const theirBurst = foes.reduce((s, e) => s + burst(e, u), 0);
    const win = ourBurst >= nearest.hp * 0.9 && theirBurst < u.hp;
    const even = hpPct > nearest.hp / nearest.stats.maxHp * 0.9 && allies.length >= foes.length;
    const safe = !dangerTower(g, u, nearest) || nearest.hp < ourBurst * 0.6;
    // trocar no meio da onda inimiga atrai os minions dela (como no LoL): só se a troca for boa
    const crowd = g.minions.filter(m => !m.dead && m.team !== u.team && d(m, u) < 650).length;
    if ((win || (even && crowd < 3)) && safe && d(nearest, u) < 1000) {
      useAbilities(g, u, nearest, win || allies.length > foes.length);
      g.order(u, { c: 'attack', id: nearest.id });
      return;
    }
    if (d(nearest, u) < 650 && !win) {
      // troca ruim: fica fora do alcance dele, atrás da própria onda
      g.order(u, { c: 'move', x: u.x + (u.x - nearest.x) * 0.6, y: u.y + (u.y - nearest.y) * 0.6 });
      return;
    }
  }
  // volta para comprar quando tem ouro sobrando e ninguém por perto
  const nb = nextBuildStep(u.def.build, u.items, 1e9), want = nb && nb.target;
  if (!nearest && !atHome && want && u.gold >= recipe(u.items, want.id).cost && (want.cost >= 900 || u.gold >= 1200)) { g.order(u, { c: 'recall' }); return; }
  // cura e escudo nos aliados
  for (let s = 0; s < 3; s++) {
    const ab = u.def.abil[s];
    if ((ab.kind === 'heal' || ab.kind === 'shield') && g.champs.some(a => a.team === u.team && !a.dead && d(a, u) < ab.range && a.hp / a.stats.maxHp < 0.6)) g.cast(u, s, u.x, u.y);
  }

  if (u.role === 'jungle' && jungle(g, u)) return;

  const front = laneFront(g, u);
  const push = pushDesire(g, u, front);
  // levando agro de minions: volta para trás da própria onda
  const aggro = g.minions.filter(m => !m.dead && m.team !== u.team && m.target === u.id).length;
  if (aggro >= 2 || (aggro >= 1 && hpPct < 0.6)) {
    const f = FOUNTAIN[u.team], k = 500 / Math.max(1, d(front, f));
    g.order(u, { c: 'move', x: front.x + (f.x - front.x) * k, y: front.y + (f.y - front.y) * k });
    return;
  }
  // estruturas: ataca a torre quando os minions aliados estão tankando, e o nexus quando ele fica vulnerável
  const tower = g.towers.find(t => !t.dead && !t.invuln && t.team !== u.team && d(t, u) < TOWER.range + 400);
  const tank = tower ? allyMinionsNear(g, u, tower, TOWER.range) : 0;
  if (tower && tower.target !== u.id && (tank >= 2 || (tank >= 1 && push > 0.8))) { g.order(u, { c: 'attack', id: tower.id }); return; }
  const nx = g.nexusOf(1 - u.team);
  if (!nx.invuln && d(nx, u) < 1300 && !dangerTower(g, u, nx)) { g.order(u, { c: 'attack', id: nx.id }); return; }

  // farm: último golpe pela vida prevista; com vontade de empurrar, bate em qualquer minion
  const minions = g.minions.filter(m => !m.dead && m.team !== u.team && d(m, u) < 1000 && !dangerTower(g, u, m));
  const myHit = m => mitigated(u.stats.ad, 'physical', m);
  const lastHit = minions.map(m => ({ m, p: predictedHp(g, u, m) })).filter(o => o.p > 0 && o.p <= myHit(o.m)).sort((a, b) => a.p - b.p)[0];
  if (lastHit) { g.order(u, { c: 'attack', id: lastHit.m.id }); return; }
  if (minions.length && push > 0.6) {
    if (u.mana / u.stats.maxMp > 0.6 && minions.filter(m => d(m, minions[0]) < 300).length >= 3) tryCast(g, u, 0, minions[0]);
    g.order(u, { c: 'attack', id: minions.sort((a, b) => a.hp - b.hp)[0].id });
    return;
  }
  // espera na linha de frente: o atirador mais atrás, o corpo a corpo colado nos minions
  // cada bot tem o seu lugar na formação: mais para um lado da lane e mais ou menos recuado
  const f = FOUNTAIN[u.team], back = (u.def.missile ? 260 : 100) + u.spread.depth * 160, k = back / Math.max(1, d(front, f));
  const along = { x: (f.x - front.x) / Math.max(1, d(front, f)), y: (f.y - front.y) / Math.max(1, d(front, f)) };
  const spot = { x: front.x + (f.x - front.x) * k - along.y * u.spread.side * 260, y: front.y + (f.y - front.y) * k + along.x * u.spread.side * 260 };
  if (d(spot, u) > 140) g.order(u, { c: 'move', x: spot.x + (Math.random() - 0.5) * 140, y: spot.y + (Math.random() - 0.5) * 140 });
}

// mira com interceptação: acha o ponto onde o projétil encontra o alvo andando em linha reta
function tryCast(g, u, s, t) {
  const ab = u.def.abil[s];
  if (!ab || u.ranks[s] <= 0 || u.cds[s] > 0 || u.mana < ab.cost[u.ranks[s] - 1]) return false;
  const moving = t.path && t.path.length;
  const vx = moving ? Math.cos(t.face) * t.stats.ms : 0, vy = moving ? Math.sin(t.face) * t.stats.ms : 0;
  const spd = ab.projSpeed || 1800, delay = 0.3;
  let tt = delay + d(u, t) / spd;
  for (let i = 0; i < 3; i++) tt = delay + Math.hypot(t.x + vx * tt - u.x, t.y + vy * tt - u.y) / spd;
  return g.cast(u, s, t.x + vx * tt, t.y + vy * tt);
}

function useAbilities(g, u, t, canDive = true) {
  const dist = d(u, t), hpPct = u.hp / u.stats.maxHp;
  for (const s of [3, 0, 1, 2]) {
    const ab = u.def.abil[s];
    if (ab.kind === 'heal' || ab.kind === 'shield') continue;
    if (s === 3 && t.hp / t.stats.maxHp > 0.7 && hpPct > 0.5) continue; // guarda a ultimate
    if (ab.kind === 'buff') {
      // buffs: na luta; Descansar só com pouca vida; Ilusão os bots não usam
      if (ab.self && ab.self.some(b => b.k === 'disguise')) continue;
      if (ab.self && ab.self.some(b => b.k === 'sleep') && hpPct > 0.35) continue;
      if (dist > 650) continue;
      if (g.cast(u, s, u.x, u.y)) return;
      continue;
    }
    if ((ab.kind === 'dash' || ab.kind === 'blink' || ab.kind === 'dig' || ab.kind === 'fly') && (!canDive || dist < u.stats.range + 100 || dist > ab.range + 200)) continue;
    const reach = reachOf(ab);
    if (dist > reach) continue;
    if (tryCast(g, u, s, t)) return;
  }
}

function jungle(g, u) {
  const mine = CAMPS.map((c, i) => ({ c, i })).filter(({ c }) => (u.team === 0 ? c.y > c.x : c.y < c.x));
  const live = mine.map(({ i }) => g.monsters.find(m => m.camp === i && !m.dead)).filter(Boolean);
  const m = live.sort((a, b) => d(a, u) - d(b, u))[0];
  if (!m || u.lvl >= 16 || g.time > GROUP_AT) return false; // sem acampamentos vivos: ajuda no meio (u.lane)
  if (!g.isVisible(u.team, m)) { if (!u.cmd || u.cmd.c !== 'move' || u.cmd.x !== m.home.x) g.order(u, { c: 'move', x: m.home.x, y: m.home.y }); return true; }
  if (edgeDist(u, m) < 400) tryCast(g, u, 0, m);
  g.order(u, { c: 'attack', id: m.id });
  return true;
}
