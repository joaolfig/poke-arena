// A partida: estado completo e o tick fixo que só o host roda. Os clientes recebem snapshots filtrados
// pela visão do time (ninguém recebe a posição de quem está na névoa).

import { TICK, GAME, MINION, xpToNext, respawnTime, KILL_XP } from '../config.js';
import { CHAMPIONS, CHAMP_BY_ID, formAt } from '../data/champions.js';
import { ITEM_BY_ID, MAX_ITEMS, recipe } from '../data/items.js';
import { FOUNTAIN, NEXUS, TOWERS, CAMPS, LANES, alongPath } from './map.js';
import { newVision, computeVision, visionAt } from './vision.js';
import { refreshStats } from './stats.js';
import { heal, damage, canAct, taunted } from './combat.js';
import { makeChampion, makeMinion, makeTower, makeNexus, makeMonster, setDestination, stepMove, separate, chase,
  updateAttack, updateMissiles, cancelWindup, startAttack } from './units.js';
import { castAbility, castSummoner, levelUpAbility, updateZones, zoneNet, zoneVisibleTo, maxRank } from './abilities.js';
import { minionAI, towerAI, monsterAI, callForHelp } from './ai.js';
import { botThink } from './bot.js';
import { tickStatus, passiveAura } from './status.js';
import { MINION_SETS, pickMinionSets } from '../data/minionSets.js';

const XP_SHARE = [1, 0.65, 0.46, 0.36, 0.3];
// funções por tamanho do time: 1v1 e 2v2 ficam no meio e embaixo; de 4 em diante entra a selva
const ROLES = { 1: ['mid'], 2: ['mid', 'bot'], 3: ['top', 'mid', 'bot'], 4: ['top', 'jungle', 'mid', 'bot'], 5: ['top', 'jungle', 'mid', 'bot', 'bot'] };
const KIND_CODE = { champ: 0, tower: 3, nexus: 4, monster: 5 };
const HASH = 400;
// efeitos que aparecem na barra do HUD do jogador
const BUFF_SHOWN = new Set(['disguise', 'stealth', 'dyna', 'invul', 'unstop', 'as', 'ad', 'ap', 'ms', 'armor', 'mr', 'dr', 'shield', 'nextCrit', 'vamp', 'slow', 'paralysis', 'stun', 'root', 'freeze', 'knockup', 'taunt', 'burn', 'poison', 'sleep', 'drowsy', 'chill', 'mark', 'weaken', 'regen']);

export class Game {
  // players: [{ pid (id do jogador ou null para bot), name, team, champ, bot }]
  constructor(players) {
    this.time = 0; this.tickN = 0; this.nextId = 1; this.winner = -1; this.firstBlood = false;
    this.units = new Map(); this.champs = []; this.minions = []; this.towers = []; this.monsters = []; this.nexus = [];
    this.zones = []; this.missiles = []; this.casts = new Map(); this.events = []; this.queue = []; this.wave = 0;
    this.vision = [newVision(), newVision()];
    this.hash = new Map();
    this.byPlayer = new Map();
    this.minionSets = pickMinionSets();   // conjunto de minions de cada time

    for (const t of TOWERS) this.add(makeTower(this, t), this.towers);
    for (const team of [0, 1]) this.nexus[team] = this.add(makeNexus(this, team, NEXUS[team]));
    CAMPS.forEach((c, i) => this.add(makeMonster(this, c, i), this.monsters));
    // chefes do rio aparecem aos 5 min (como o primeiro dragão)
    for (const m of this.monsters) if (m.big) { m.dead = true; m.respawnT = GAME.bossFirst; }

    for (const team of [0, 1]) {
      const list = players.filter(p => p.team === team);
      // funções no mapa (como no LoL): quem joga fica com o meio; os bots dividem o resto
      const roles = [...(ROLES[list.length] || ROLES[5])];
      const take = r => { const k = roles.indexOf(r); return roles.splice(k >= 0 ? k : 0, 1)[0] || 'mid'; };
      const roleOf = new Map(list.filter(p => !p.bot).map(p => [p, take('mid')]));
      for (const p of list) if (p.bot) roleOf.set(p, take(roles[0]));
      list.forEach((p, i) => {
        const f = FOUNTAIN[team];
        const u = makeChampion(this, CHAMP_BY_ID[p.champ] || CHAMPIONS[0], team, p.pid, f.x + (i - 2) * 70, f.y - (i - 2) * 70 * (team ? -1 : 1));
        u.name = p.name; u.bot = !!p.bot; u.gold = GAME.startGold;
        u.role = roleOf.get(p); u.lane = u.role === 'jungle' ? 'mid' : u.role;
        this.add(u, this.champs);
        if (p.pid != null) this.byPlayer.set(p.pid, u);
      });
    }
    this.updateVision();
  }

  add(u, list) { this.units.set(u.id, u); if (list) list.push(u); return u; }
  get mobile() { return this._mobile; }
  nexusOf(team) { return this.nexus[team]; }
  minionPid(team, mtype) { return MINION_SETS[this.minionSets[team]][mtype]; }

  // ---------- consultas ----------
  rebuildHash() {
    this.hash.clear();
    for (const u of this.units.values()) {
      if (u.dead) continue;
      const k = Math.floor(u.x / HASH) * 1000 + Math.floor(u.y / HASH);
      let b = this.hash.get(k);
      if (!b) this.hash.set(k, b = []);
      b.push(u);
    }
    this._mobile = [...this.champs, ...this.minions, ...this.monsters].filter(u => !u.dead);
  }
  near(x, y, r) {
    const out = [], i0 = Math.floor((x - r) / HASH), i1 = Math.floor((x + r) / HASH), j0 = Math.floor((y - r) / HASH), j1 = Math.floor((y + r) / HASH);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const b = this.hash.get(i * 1000 + j);
      if (b) for (const u of b) if ((u.x - x) ** 2 + (u.y - y) ** 2 <= (r + u.r) ** 2) out.push(u);
    }
    return out;
  }
  isVisible(team, u) {
    if (u.team === team || u.kind === 'tower' || u.kind === 'nexus') return true;
    if (u.travel) return false;   // debaixo da terra ou no céu
    // invisível: só quem chega bem perto enxerga
    if (u.stealth) return this.near(u.x, u.y, 300).some(v => v.team === team && !v.dead);
    const v = visionAt(this.vision[team], u.x, u.y);
    return v === 1 || (v === 2 && u.revealT > 0);
  }
  // pode ser escolhido como alvo pela IA do time `team` (a Ilusão engana minions, torres e bots)
  targetable(team, u) { return this.isVisible(team, u) && !(u.disguise && u.team !== team); }
  event(e, x, y) { this.events.push({ e, x, y }); }
  callForHelp(src, victim) { callForHelp(this, src, victim); }

  // ---------- comandos ----------
  // msg do cliente: { c: 'move'|'attack'|'amove'|'stop'|'cast'|'lvl'|'buy'|'sell'|'summ'|'recall', ... }
  command(playerId, m) {
    const u = this.byPlayer.get(playerId);
    if (!u || this.winner >= 0) return;
    const num = v => (typeof v === 'number' && isFinite(v) ? v : 0);
    switch (m.c) {
      case 'move': case 'amove': case 'attack': case 'stop': case 'recall': this.order(u, { c: m.c, x: num(m.x), y: num(m.y), id: num(m.id) }); break;
      case 'cast': this.cast(u, num(m.s) | 0, num(m.x), num(m.y)); break;
      case 'lvl': this.levelAbility(u, num(m.s) | 0); break;
      case 'buy': this.buy(u, String(m.id)); break;
      case 'sell': this.sell(u, num(m.i) | 0); break;
      case 'use': this.useItem(u, num(m.i) | 0); break;
      case 'swap': this.swapItems(u, num(m.a) | 0, num(m.b) | 0); break;
      case 'summ': if (m.k === 'flash' || m.k === 'heal') this.summoner(u, m.k, num(m.x), num(m.y)); break;
    }
  }

  order(u, o) {
    if (u.dead) return;
    const cur = u.cmd;
    if (o.c === 'attack') {
      const t = this.units.get(o.id);
      if (!t || t.dead || t.team === u.team || !this.isVisible(u.team, t)) return;
      if (cur && cur.c === 'attack' && cur.id === o.id) return;
    }
    if (o.c === 'recall') {
      if (u.recallT > 0 || u.dash) return;
      u.path = []; cancelWindup(u); u.cmd = null; u.recallT = GAME.recallTime;
      this.event({ k: 'recall', id: u.id }, u.x, u.y);
      return;
    }
    u.recallT = 0;
    if (o.c === 'stop') { u.cmd = null; u.path = []; cancelWindup(u); return; }
    if (o.c === 'move' || o.c === 'amove') {
      // um novo clique de andar cancela o windup (é assim que se faz kiting)
      cancelWindup(u);
      setDestination(this, u, o.x, o.y);
    }
    u.cmd = o;
  }

  cast(u, s, x, y) { return castAbility(this, u, s, x, y); }
  summoner(u, k, x, y) { return castSummoner(this, u, k, x, y); }
  levelAbility(u, s) {
    const ok = levelUpAbility(u, s);
    if (ok) this.event({ k: 'rank', id: u.id }, u.x, u.y);
    return ok;
  }
  canShop(u) { return u.dead || Math.hypot(u.x - FOUNTAIN[u.team].x, u.y - FOUNTAIN[u.team].y) < GAME.shopRadius; }
  buy(u, id) {
    const it = ITEM_BY_ID[id];
    if (!it || !this.canShop(u)) return false;
    // consumível (Sitrus Berry): ocupa um espaço e acumula até 5 nele, como as poções do LoL
    if (it.consumable) {
      const n = u.stacks[id] || 0;
      const free = u.items.indexOf(null);
      if (n >= 5 || (!n && free < 0) || u.gold < it.cost) return false;
      if (!n) u.items[free] = id;
      u.stacks[id] = n + 1; u.gold -= it.cost;
      return true;
    }
    // receita: os básicos que você já tem são usados e abatidos do preço (como no LoL)
    const r = recipe(u.items, id);
    if (u.gold < r.cost || r.slots > MAX_ITEMS) return false;
    u.gold -= r.cost;
    // o item completo entra no lugar da primeira peça usada (como no LoL); sem peças, no primeiro espaço vazio
    for (const k of r.use) u.items[k] = null;
    u.items[r.use.length ? Math.min(...r.use) : u.items.indexOf(null)] = id;
    refreshStats(u);
    return true;
  }
  sell(u, i) {
    if (!this.canShop(u) || i < 0 || i >= MAX_ITEMS || !u.items[i]) return false;
    const id = u.items[i], it = ITEM_BY_ID[id];
    u.gold += Math.floor(it.cost * 0.7) * (it.consumable ? u.stacks[id] : 1);
    if (it.consumable) delete u.stacks[id];
    u.items[i] = null; refreshStats(u);
    return true;
  }
  // trocar dois espaços do inventário de lugar (escolher a tecla 1-6 de cada item); vale a qualquer hora
  swapItems(u, a, b) {
    if (a < 0 || b < 0 || a >= MAX_ITEMS || b >= MAX_ITEMS || a === b) return false;
    [u.items[a], u.items[b]] = [u.items[b], u.items[a]];
    return true;
  }
  // usar o item do espaço i (teclas 1-6): por enquanto só a Sitrus Berry; não acumula com uma cura em andamento
  useItem(u, i) {
    const id = u.items[i], it = ITEM_BY_ID[id];
    if (u.dead || !it || !it.consumable || u.buffs.some(b => b.k === 'regen')) return false;
    u.buffs.push({ k: 'regen', v: 24, t: 5 });
    this.event({ k: 'buff', id: u.id, b: 'heal' }, u.x, u.y);
    if (--u.stacks[id] <= 0) { delete u.stacks[id]; u.items[i] = null; }
    return true;
  }

  // ---------- recompensas ----------
  giveXp(u, amt) {
    if (u.lvl >= GAME.maxLevel) return;
    u.xp += amt;
    while (u.lvl < GAME.maxLevel && u.xp >= xpToNext(u.lvl)) {
      u.xp -= xpToNext(u.lvl); u.lvl++; u.skillPts++;
      refreshStats(u);
      this.event({ k: 'lvl', id: u.id, l: u.lvl }, u.x, u.y);
      // evolução (e Mega no nível 18): só muda a aparência; os atributos já crescem por nível
      const f = formAt(u.def, u.lvl);
      if (f.pid !== u.pid) { u.pid = f.pid; this.event({ k: 'evo', id: u.id, nm: f.nome, mega: f.mega ? 1 : 0 }, u.x, u.y); }
    }
  }
  shareXp(team, x, y, amt) {
    const near = this.champs.filter(c => c.team === team && !c.dead && Math.hypot(c.x - x, c.y - y) < GAME.xpRange);
    const k = XP_SHARE[Math.min(near.length, 5) - 1] || 0;
    for (const c of near) this.giveXp(c, amt * k);
  }

  kill(v, src) {
    if (v.dead) return;
    v.dead = true; v.hp = 0; v.path = []; v.cmd = null; v.dash = null; v.atk.wind = 0;
    const killer = src && src.kind === 'champ' ? src : null;
    if (v.kind === 'minion') {
      if (killer && killer.team !== v.team) { killer.gold += v.base.gold; killer.cs++; this.event({ k: 'gold', id: killer.id, v: v.base.gold }, v.x, v.y); }
      this.shareXp(1 - v.team, v.x, v.y, v.base.xp);
    } else if (v.kind === 'monster') {
      const k = killer || (src && src.kind === 'champ' ? src : null);
      if (k) {
        k.gold += v.gold; k.cs += 4; this.giveXp(k, v.xp); this.event({ k: 'gold', id: k.id, v: v.gold }, v.x, v.y);
        // abater monstro recupera vida (como o mascote do item de selva do LoL)
        heal(this, k, k.stats.maxHp * 0.15);
        // chefe do rio (como o Barão): o time todo ganha ouro e fica mais forte por 2 min
        if (v.big) for (const c of this.champs) if (c.team === k.team) {
          if (c !== k) c.gold += 150;
          if (!c.dead) c.buffs.push({ k: 'ad', v: 25, t: 120 }, { k: 'ap', v: 40, t: 120 });
          this.event({ k: 'buff', id: c.id, b: 'fury' }, c.x, c.y);
        }
        if (v.big) this.event({ k: 'boss', team: k.team, nm: v.nome }, v.x, v.y);
      }
      v.respawnT = v.big ? GAME.bossRespawn : GAME.campRespawn;
    } else if (v.kind === 'champ') this.champDeath(v, src);
    else if (v.kind === 'tower') {
      for (const c of this.champs) if (c.team !== v.team) c.gold += 150;
      if (killer) killer.gold += 100;
      this.event({ k: 'tower', team: v.team, by: killer ? killer.id : 0 }, v.x, v.y);
    } else if (v.kind === 'nexus') {
      this.winner = 1 - v.team;
      this.event({ k: 'end', w: this.winner }, v.x, v.y);
    }
  }

  champDeath(v, src) {
    v.deaths++; v.deathStreak++; v.respawnT = respawnTime(v.lvl); v.buffs = []; v.recallT = 0;
    // quem matou: o golpe final, ou o último campeão que causou dano nos últimos 10 s
    let killer = src && src.kind === 'champ' && src.team !== v.team ? src : null;
    const recent = [...v.dmgBy.entries()].filter(([, t]) => this.time - t < 10).sort((a, b) => b[1] - a[1]).map(([id]) => this.units.get(id)).filter(Boolean);
    if (!killer && recent.length) killer = recent[0];
    const assists = recent.filter(a => a !== killer && a.team !== v.team);
    // recompensa: 300, mais por sequência de abates da vítima, menos se ela vinha morrendo
    let bounty = v.streak >= 2 ? Math.min(1000, 300 + (v.streak - 1) * 100) : Math.max(100, 300 * (1 - 0.15 * Math.max(0, v.deathStreak - 2)));
    if (!this.firstBlood && killer) { bounty += 100; this.firstBlood = true; }
    v.streak = 0;
    if (killer) {
      killer.kills++; killer.streak++; killer.deathStreak = 0; killer.gold += Math.round(bounty);
      this.event({ k: 'gold', id: killer.id, v: Math.round(bounty) }, v.x, v.y);
    }
    for (const a of assists) { a.assists++; a.gold += Math.round(bounty * 0.5 / assists.length); }
    const takers = [killer, ...assists].filter(c => c && Math.hypot(c.x - v.x, c.y - v.y) < GAME.xpRange);
    for (const c of takers) this.giveXp(c, KILL_XP[v.lvl] / takers.length);
    v.dmgBy.clear();
    this.event({ k: 'kill', v: v.id, by: killer ? killer.id : 0, a: assists.map(a => a.id), src: src ? src.kind : '', vt: v.team, bt: 1 - v.team }, v.x, v.y);
  }

  // ---------- tick ----------
  step() {
    if (this.winner >= 0) return;
    const dt = TICK;
    this.time += dt; this.tickN++;
    this.rebuildHash();
    this.spawnWaves();

    // estruturas: a interna só leva dano depois da externa cair; o nexus, depois de uma interna
    for (const t of this.towers) t.invuln = t.tier === 1 && this.towers.some(o => o.team === t.team && o.lane === t.lane && o.tier === 0 && !o.dead);
    for (const team of [0, 1]) this.nexus[team].invuln = !this.towers.some(t => t.team === team && t.tier === 1 && t.dead);

    for (const u of this.units.values()) {
      if (u.dead) continue;
      tickStatus(this, u, dt, damage);
      if (u.dead) continue;
      for (const b of u.buffs) { b.t -= dt; if (b.k === 'regen' && b.t > 0) heal(this, u, b.v * dt, false); }
      if (u.buffs.length) u.buffs = u.buffs.filter(b => b.t > 0 && !(b.k === 'shield' && b.v <= 0));
      u.stealth = u.buffs.some(b => b.k === 'stealth');
      u.disguise = u.buffs.some(b => b.k === 'disguise');
      if (u.revealT > 0) u.revealT -= dt;
    }
    for (const c of this.champs) this.champTick(c, dt);
    for (const m of this.minions) if (!m.dead) { if (m.buffs.length) refreshStats(m); minionAI(this, m, dt); }
    for (const t of this.towers) if (!t.dead) towerAI(this, t, dt);
    for (const m of this.monsters) this.monsterTick(m, dt);

    for (const u of this.units.values()) if (!u.dead && u.kind !== 'nexus') updateAttack(this, u, dt);
    for (const u of this.mobile) if (!u.dead) stepMove(this, u, dt);
    separate(this);
    updateMissiles(this, dt);
    updateZones(this, dt);

    if (this.tickN % 30 === 0) {
      this.minions = this.minions.filter(m => !m.dead || (this.units.delete(m.id), false));
    }
    if (this.tickN % 3 === 0) this.updateVision();
  }

  champTick(c, dt) {
    if (c.dead) {
      c.respawnT -= dt;
      if (c.respawnT <= 0) {
        const f = FOUNTAIN[c.team];
        Object.assign(c, { dead: false, x: f.x, y: f.y, path: [], cmd: null });
        refreshStats(c);
        c.hp = c.stats.maxHp; c.mana = c.stats.maxMp;
        this.event({ k: 'spawn', id: c.id }, c.x, c.y);
      }
      return;
    }
    refreshStats(c);
    // passivas de área uma vez por segundo
    c.auraT = (c.auraT || 0) - dt;
    if (c.auraT <= 0) { c.auraT = 1; passiveAura(this, c, damage); }
    for (let i = 0; i < 4; i++) if (c.cds[i] > 0) c.cds[i] = Math.max(0, c.cds[i] - dt);
    for (const k of ['flash', 'heal']) if (c.summ[k] > 0) c.summ[k] = Math.max(0, c.summ[k] - dt);
    if (this.time > GAME.passiveGoldAt) { c.gold += GAME.goldPerSec * dt; this.giveXp(c, GAME.xpPerSec * dt); }
    // regeneração (hp5/mp5 = por 5 segundos)
    c.hp = Math.min(c.stats.maxHp, c.hp + c.stats.hp5 / 5 * dt);
    c.mana = Math.min(c.stats.maxMp, c.mana + c.stats.mp5 / 5 * dt);
    // fonte: cura rápido os aliados e destrói quem invadir a do outro time
    const fo = FOUNTAIN[c.team], fe = FOUNTAIN[1 - c.team];
    if (Math.hypot(c.x - fo.x, c.y - fo.y) < GAME.fountainRadius) {
      c.hp = Math.min(c.stats.maxHp, c.hp + c.stats.maxHp * GAME.fountainHealPct * dt);
      c.mana = Math.min(c.stats.maxMp, c.mana + c.stats.maxMp * GAME.fountainHealPct * dt);
    }
    if (Math.hypot(c.x - fe.x, c.y - fe.y) < GAME.fountainRadius) damage(this, null, c, 1200 * dt, 'true');
    if (c.dead) return;
    // recall: canaliza 8 s parado
    if (c.recallT > 0) {
      c.recallT -= dt;
      if (c.recallT <= 0) {
        c.recallT = 0; c.x = fo.x; c.y = fo.y; c.path = [];
        this.event({ k: 'spawn', id: c.id }, c.x, c.y);
      }
      return;
    }
    // Escavar / Voar: intocável até sair no ponto
    if (c.travel) {
      const tr = c.travel;
      tr.t -= dt;
      const k = Math.min(1, 1 - tr.t / tr.max);
      if (tr.kind === 'dig') { c.x = tr.from.x + (tr.to.x - tr.from.x) * k; c.y = tr.from.y + (tr.to.y - tr.from.y) * k; }
      if (tr.t <= 0) { c.x = tr.to.x; c.y = tr.to.y; c.travel = null; this.event({ k: 'land', id: c.id, how: tr.kind }, c.x, c.y); }
      return;
    }
    // Camuflagem (Gengar, como a Evelynn): do nível 6 em diante fica invisível depois de 4 s fora de combate
    const pv = c.def.passive;
    if (pv && pv.camouflage && c.lvl >= 6 && !c.stealth && this.time - (c.lastCombat || 0) > 4 && c.recallT <= 0) {
      c.buffs.push({ k: 'stealth', t: 999 }); c.stealth = true;
    }
    // provocado: vai até quem provocou e ataca, sem ouvir comandos
    const tb = taunted(c);
    if (tb) {
      const s = this.units.get(tb.src);
      if (s && !s.dead) { c.cmd = { c: 'attack', id: s.id }; chase(this, c, s, dt); return; }
    }
    if (c.bot) botThink(this, c, dt);
    this.processOrder(c, dt);
  }

  processOrder(c, dt) {
    const o = c.cmd;
    if (!canAct(c) && !c.path.length) return;
    if (!o) {
      // parado: o jogador só bate quando clica (como o LoL com o "ataque automático" desligado, bom para farmar);
      // só os bots atacam sozinho quem entrar no alcance
      if (!c.bot || c.atk.wind > 0 || c.path.length) return;
      const t = this.nearestEnemy(c, c.stats.range + c.r, false);
      if (t) startAttack(this, c, t);
      return;
    }
    if (o.c === 'move') { if (!c.path.length) c.cmd = null; return; }
    if (o.c === 'attack') {
      const t = this.units.get(o.id);
      if (!t || t.dead || !this.isVisible(c.team, t)) { c.cmd = null; c.path = []; return; }
      chase(this, c, t, dt);
      return;
    }
    if (o.c === 'amove') {
      // ataque-mover: vai até o ponto e ataca o inimigo mais perto que aparecer no caminho
      const t = this.units.get(o.tid);
      if (t && !t.dead && this.isVisible(c.team, t) && Math.hypot(t.x - c.x, t.y - c.y) < c.stats.range + 600) { chase(this, c, t, dt); return; }
      o.tid = 0;
      const n = this.nearestEnemy(c, Math.max(c.stats.range + 150, 500), true);
      if (n) { o.tid = n.id; chase(this, c, n, dt); return; }
      if (!c.path.length) {
        if (Math.hypot(o.x - c.x, o.y - c.y) > 100) setDestination(this, c, o.x, o.y);
        else c.cmd = null;
      }
    }
  }

  nearestEnemy(c, r, champsFirst) {
    let best = null, bs = Infinity;
    for (const v of this.near(c.x, c.y, r)) {
      if (v.dead || v.team === c.team || v.invuln || !this.isVisible(c.team, v)) continue;
      if (v.kind === 'monster' && !v.aggro) continue;
      const s = Math.hypot(v.x - c.x, v.y - c.y) + (champsFirst && v.kind === 'champ' ? -400 : 0) + (v.kind === 'tower' || v.kind === 'nexus' ? 300 : 0);
      if (s < bs) { bs = s; best = v; }
    }
    return best;
  }

  monsterTick(m, dt) {
    if (m.dead) {
      m.respawnT -= dt;
      if (m.respawnT <= 0) {
        Object.assign(m, { dead: false, x: m.home.x, y: m.home.y, aggro: 0, returning: false, path: [] });
        // monstros ficam mais fortes com o tempo de partida (+5% de vida e dano por minuto), como no LoL
        const k = 1 + 0.05 * this.time / 60;
        m.base = { ...m.base0, hp: m.base0.hp * k, ad: m.base0.ad * k };
        refreshStats(m); m.hp = m.stats.maxHp;
      }
      return;
    }
    monsterAI(this, m, dt);
  }

  spawnWaves() {
    if (this.time >= GAME.firstWave + this.wave * GAME.waveEvery) {
      for (const team of [0, 1]) for (const lane of Object.keys(LANES)) {
        const types = ['melee', 'melee', 'melee', ...(this.wave % MINION.siegeEvery === MINION.siegeEvery - 1 ? ['siege'] : []), 'ranged', 'ranged', 'ranged'];
        types.forEach((mt, i) => this.queue.push({ at: this.time + i * 0.8, mt, team, lane, wave: this.wave }));
      }
      this.wave++;
    }
    for (const q of this.queue) {
      if (q.at > this.time) continue;
      q.done = true;
      const pts = LANES[q.lane], path = q.team === 0 ? pts : [...pts].reverse();
      const start = alongPath(path, 0.07);
      const m = makeMinion(this, q.mt, q.team, q.lane, [start, ...path.slice(1)], q.wave);
      m.pid = this.minionPid(q.team, q.mt);
      m.shot = MINION_SETS[this.minionSets[q.team]].shot;
      this.add(m, this.minions);
    }
    this.queue = this.queue.filter(q => !q.done);
  }

  updateVision() {
    for (const team of [0, 1]) {
      const obs = [];
      for (const u of this.units.values()) if (!u.dead && u.team === team) obs.push({ x: u.x, y: u.y, sight: u.sight || 1000 });
      computeVision(obs, this.vision[team]);
    }
  }

  // ---------- rede ----------
  unitNet(u, viewer) {
    // Ilusão: para o outro time, você é um minion corpo a corpo dele mesmo
    if (u.disguise && viewer !== u.team) {
      const m = MINION.melee;
      return [u.id, 1, viewer, this.minionPid(viewer, 'melee'), Math.round(u.x), Math.round(u.y), Math.round(m.hp * u.hp / u.stats.maxHp), m.hp, Math.round(u.face * 100), u.moving ? 1 : 0, u.shotN, u.hurtN];
    }
    let flags = (u.moving ? 1 : 0) | (u.recallT > 0 ? 2 : 0) | (u.invuln ? 4 : 0) | (u.dash ? 32 : 0) | (u.stealth ? 64 : 0)
      | (u.buffs.some(b => b.k === 'dyna') ? 128 : 0) | (u.travel ? 256 : 0) | (u.disguise ? 512 : 0) | (u.buffs.some(b => b.k === 'invul') ? 1024 : 0);
    const kc = u.kind === 'minion' ? ({ melee: 1, ranged: 2, siege: 6 })[u.mtype] : KIND_CODE[u.kind];
    const a = [u.id, kc, u.team, u.pid || 0, Math.round(u.x), Math.round(u.y), Math.max(0, Math.round(u.hp)), Math.round(u.stats.maxHp),
      Math.round(u.face * 100), flags, u.shotN, u.hurtN];
    if (u.kind === 'champ') {
      let shield = 0, cc = 0;
      for (const b of u.buffs) {
        if (b.k === 'shield') shield += b.v;
        else if (b.k === 'stun') cc |= 1; else if (b.k === 'root') cc |= b.tag === 'freeze' ? 128 : 2; else if (b.k === 'knockup') cc |= 4;
        else if (b.k === 'slow') cc |= b.tag === 'paralysis' ? 256 : 8;
        else if (b.k === 'dot') cc |= b.tag === 'burn' ? 16 : 32;
        else if (b.k === 'sleep' || b.k === 'drowsy') cc |= 64;
        else if (b.k === 'chill') cc |= 512;
      }
      a.push(CHAMPIONS.indexOf(u.def), u.lvl, Math.round(u.mana), Math.round(u.stats.maxMp), Math.round(shield), cc);
    }
    return a;
  }

  // snapshot para um time; me = campeão do jogador que vai receber
  snapshot(team, playerId, withScore) {
    const vis = this.vision[team];
    const units = [];
    for (const u of this.units.values()) if (!u.dead && this.isVisible(team, u)) units.push(this.unitNet(u, team));
    const zones = this.zones.filter(z => zoneVisibleTo(z, team, (x, y) => visionAt(vis, x, y) === 1)).map(zoneNet);
    const missiles = this.missiles.filter(m => m.team === team || visionAt(vis, m.x, m.y) === 1).map(m => [m.id, Math.round(m.x), Math.round(m.y), m.kind, m.team, m.shot]);
    const ev = this.events.filter(({ e, x, y }) => e.k === 'kill' || e.k === 'tower' || e.k === 'boss' || e.k === 'end' || e.k === 'lvl' || visionAt(vis, x, y) === 1).map(({ e }) => e);
    const snap = { t: 's', time: +this.time.toFixed(3), u: units, z: zones, m: missiles, e: ev, w: this.winner, ms: this.minionSets };
    const me = this.byPlayer.get(playerId);
    if (me) snap.me = this.meNet(me);
    if (withScore) snap.sb = this.scoreboard();
    return snap;
  }

  meNet(u) {
    const s = u.stats;
    return {
      id: u.id, gold: Math.floor(u.gold), lvl: u.lvl, xp: Math.round(u.xp), xpNext: xpToNext(u.lvl), pts: u.skillPts,
      ranks: [...u.ranks], cds: u.cds.map(v => +v.toFixed(2)), maxRank: [0, 1, 2, 3].map(i => maxRank(i, u.lvl)),
      summ: { flash: +u.summ.flash.toFixed(1), heal: +u.summ.heal.toFixed(1) }, items: [...u.items], stacks: { ...u.stacks },
      buffs: u.buffs.filter(b => BUFF_SHOWN.has(b.tag || b.k) && b.t < 900 || b.k === 'stealth').map(b => [b.tag || b.k, +Math.min(b.t, 99).toFixed(1)]),
      fountain: !u.dead && Math.hypot(u.x - FOUNTAIN[u.team].x, u.y - FOUNTAIN[u.team].y) < GAME.fountainRadius,
      dead: u.dead, respawn: +Math.max(0, u.respawnT).toFixed(1), recall: +u.recallT.toFixed(2), shop: this.canShop(u),
      st: { ad: Math.round(s.ad), ap: Math.round(s.ap), armor: Math.round(s.armor), mr: Math.round(s.mr), as: +s.as.toFixed(2), ms: Math.round(s.ms),
        crit: Math.round(s.crit * 100), ah: Math.round(s.ah), range: s.range },
    };
  }

  // placar (Tab): abates, itens e atributos de cada campeão, com o DPS do ataque básico e a vida efetiva
  scoreboard() {
    return this.champs.map(c => {
      const s = c.stats;
      const dps = s.ad * s.as * (1 + s.crit * (s.critMult - 1));   // dano por segundo só com ataque básico (crítico médio)
      const st = [s.maxHp, s.ad, s.ap, s.armor, s.mr, s.as, s.ms, s.crit * 100, dps, s.maxHp * (1 + s.armor / 100), s.maxHp * (1 + s.mr / 100)].map(v => Math.round(v * 100) / 100);
      return [c.id, CHAMPIONS.indexOf(c.def), c.team, c.name, c.kills, c.deaths, c.assists, c.cs, c.lvl, c.items.filter(Boolean), c.dead ? Math.ceil(c.respawnT) : 0, st];
    });
  }

  flushEvents() { this.events = []; }
}
