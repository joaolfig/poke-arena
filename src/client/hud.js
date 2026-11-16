// Interface em HTML por cima do canvas: painel do campeão, habilidades, itens, placar, loja e avisos.

import { CHAMPIONS, SLOT_KEYS, formAt } from '../data/champions.js';
import { ITEMS, ITEM_BY_ID, MAX_ITEMS, BUILDS_INTO, recipe, nextBuildStep } from '../data/items.js';
import { MOVES } from '../data/moves.js';
import { TEAM_NAME, SUMMONERS } from '../config.js';
import { portrait } from './sprites.js';
import { MINION_SETS } from '../data/minionSets.js';

const $ = id => document.getElementById(id);
const fmtTime = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
// ícone de item: sprite da PokeAPI; se não carregar, volta para o emoji
export const itemImg = (it, cls = '') => `<img class="isprite ${cls}" src="${it.sprite}" alt="${it.icon}" title="${it.nome}" onerror="this.replaceWith(document.createTextNode('${it.icon}'))">`;
// nome no botão: o emoji em cima e o texto embaixo, que encolhe até caber inteiro no quadrado
const nameHtml = n => { const m = n.match(/^(\S+)\s+(.*)$/); return m && !/\p{L}/u.test(m[1]) ? `<b>${m[1]}</b><span>${m[2]}</span>` : `<span>${n}</span>`; };
function fitNames(root) {
  for (const el of root.querySelectorAll('.ab-name')) {
    const sp = el.querySelector('span');
    if (!sp) continue;
    for (let fs = 11; fs >= 7; fs -= 0.5) {
      sp.style.fontSize = fs + 'px';
      if (el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1) break;
    }
  }
}

// dicas ao passar o mouse (title) feitas à mão: a nativa do navegador não aparece enquanto o Tab está apertado
const tipEl = document.createElement('div');
tipEl.id = 'hovertip'; tipEl.className = 'hidden';
document.body.append(tipEl);
document.addEventListener('mouseover', e => {
  const t = e.target.closest && e.target.closest('#hud [title], #hud [data-tip]');
  if (t && t.title) { t.dataset.tip = t.title; t.removeAttribute('title'); }
  if (!t || !t.dataset.tip) { tipEl.classList.add('hidden'); return; }
  tipEl.textContent = t.dataset.tip; tipEl.classList.remove('hidden');
});
document.addEventListener('mousemove', e => {
  if (tipEl.classList.contains('hidden')) return;
  const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  tipEl.style.left = Math.min(innerWidth - w - 6, e.clientX + 14) + 'px';
  tipEl.style.top = (e.clientY + 18 + h > innerHeight ? e.clientY - h - 10 : e.clientY + 18) + 'px';
});

export const abilName = ab => ab.nome || (ab.move ? MOVES[ab.move].nome : '?');

export class Hud {
  constructor({ send, team, champ, names, ui }) {
    Object.assign(this, { send, team, champ, names, ui });
    this.def = CHAMPIONS.find(c => c.id === champ);
    this.feed = [];
    this.lastPaint = 0;
    this.build();
  }

  build() {
    $('hud').classList.remove('hidden');
    this.showForm(1);
    const pv = this.def.passive;
    $('passive').innerHTML = pv ? `<span class="pv">${pv.nome}</span><div class="tip"><b>Passiva: ${pv.nome}</b><br>${pv.desc}</div>` : '';
    // botões das habilidades
    $('abilities').innerHTML = this.def.abil.map((ab, i) => `
      <div class="ab" data-s="${i}" title="">
        <button class="lvlup" data-s="${i}">+</button>
        <div class="key">${SLOT_KEYS[i]}</div>
        <div class="ab-name">${nameHtml(abilName(ab))}</div>
        <div class="cd"></div><div class="cdtxt"></div>
        <div class="pips">${(i === 3 ? [0, 1, 2] : [0, 1, 2, 3, 4]).map(() => '<i></i>').join('')}</div>
        <div class="tip"><b>${abilName(ab)}</b> <span class="kind">${KIND_PT[ab.kind]}</span><br>${ab.desc || ''}<span class="tipnum"></span></div>
      </div>`).join('') + `
      <div class="ab summ" data-k="flash"><div class="key">D</div><div class="ab-name"><b>✨</b>Teleporte</div><div class="cd"></div><div class="cdtxt"></div><div class="tip"><b>Teleporte (Flash)</b><br>Teleporta ${SUMMONERS.flash.range} unidades na direção do cursor.</div></div>
      <div class="ab summ" data-k="heal"><div class="key">F</div><div class="ab-name"><b>💚</b>Curar</div><div class="cd"></div><div class="cdtxt"></div><div class="tip"><b>Curar</b><br>Cura você e o aliado mais ferido perto, e dá velocidade por 1 s.</div></div>`;
    fitNames($('abilities'));
    // clicar em qualquer parte do botão (ou no +) sobe a habilidade, se houver ponto para gastar
    $('abilities').onclick = e => { const b = e.target.closest('.ab[data-s]'); if (b) this.send({ c: 'lvl', s: +b.dataset.s }); };
    // passar o mouse no botão mostra a área da habilidade no mapa
    $('abilities').onmouseover = e => { const ab = e.target.closest('.ab[data-s]'); this.ui.hoverSlot = ab ? +ab.dataset.s : null; };
    $('abilities').onmouseleave = () => { this.ui.hoverSlot = null; };
    // clique: usa o consumível; outros itens só se vendem na base (botão direito vende qualquer um na base)
    for (const id of ['items', 'shop-inv']) {
      const box = $(id);
      box.onclick = e => {
        const el = e.target.closest('.item[data-i]');
        if (!el || !this.me) return;
        const it = ITEM_BY_ID[this.me.items[+el.dataset.i]];
        if (it && it.consumable) this.send({ c: 'use', i: +el.dataset.i });
        else if (it && this.me.shop) this.send({ c: 'sell', i: +el.dataset.i });
      };
      box.oncontextmenu = e => { const el = e.target.closest('.item[data-i]'); if (el && this.me && this.me.shop && this.me.items[+el.dataset.i]) this.send({ c: 'sell', i: +el.dataset.i }); };
      this.bindInventoryDrag(box);
    }
    this.buildShop();
  }

  // retrato e nome da forma atual (muda ao evoluir e na Mega)
  showForm(lvl) {
    const f = formAt(this.def, lvl);
    if (f.pid === this.shownPid) return;
    this.shownPid = f.pid;
    $('portrait').replaceChildren(portrait(f.pid, 72));
    $('champ-name').textContent = f.nome;
  }

  buildShop() {
    const groups = [['Básicos', ITEMS.filter(i => !i.from && i.cost <= 700)], ['Botas', ITEMS.filter(i => i.boots && i.from)], ['Completos', ITEMS.filter(i => i.from && !i.boots)]];
    const icons = ids => ids.map(id => itemImg(ITEM_BY_ID[id], 'tiny')).join('');
    $('shop-list').innerHTML = groups.map(([g, list]) => `<h3>${g}</h3><div class="shop-grid">${list.map(it => `
      <button class="shop-item" data-id="${it.id}"><span class="ic">${itemImg(it)}</span><b>${it.nome}</b><span class="price">${it.cost}</span>
      <small>${statText(it)}</small>
      ${it.from ? `<small class="recipe">Feito de: ${icons(it.from)} + ${it.cost - it.from.reduce((s, c) => s + ITEM_BY_ID[c].cost, 0)}</small>` : ''}
      ${BUILDS_INTO[it.id] ? `<small class="recipe">Vira: ${icons(BUILDS_INTO[it.id])}</small>` : ''}</button>`).join('')}</div>`).join('');
    $('shop-list').onclick = e => { const b = e.target.closest('.shop-item'); if (b) this.send({ c: 'buy', id: b.dataset.id }); };
    $('shop-rec').onclick = e => { const b = e.target.closest('[data-buy]'); if (b) this.send({ c: 'buy', id: b.dataset.buy }); };
    $('shop-close').onclick = () => this.toggleShop(false);
    $('basehint').onclick = () => this.toggleShop(true);
  }

  // 6 espaços do inventário; cada um pode ser arrastado para outro (troca a tecla 1-6 do item)
  inventoryHtml(me) {
    let html = '';
    for (let i = 0; i < MAX_ITEMS; i++) {
      const it = ITEM_BY_ID[me.items[i]];
      const n = it && it.consumable ? (me.stacks || {})[me.items[i]] || 0 : 0;
      const how = it && it.consumable ? ` (tecla ${i + 1} ou clique para usar${me.shop ? '; botão direito vende' : ''})` : me.shop ? ` (clique para vender por ${Math.floor(it ? it.cost * 0.7 : 0)})` : '';
      html += it ? `<div class="item${it.consumable ? ' use' : ''}" data-i="${i}" draggable="true" title="${it.nome} — ${statText(it)}${how}. Arraste para trocar de espaço.">${itemImg(it)}<span class="slot">${i + 1}</span>${n ? `<b class="n">${n}</b>` : ''}</div>`
        : `<div class="item empty" data-i="${i}"><span class="slot">${i + 1}</span></div>`;
    }
    return html;
  }

  // arrastar e soltar: troca os dois espaços no servidor
  bindInventoryDrag(el) {
    el.addEventListener('dragstart', e => { const s = e.target.closest('.item[data-i]'); if (!s) return; e.dataTransfer.setData('text/plain', s.dataset.i); e.dataTransfer.effectAllowed = 'move'; });
    el.addEventListener('dragover', e => { if (e.target.closest('.item[data-i]')) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } });
    el.addEventListener('drop', e => {
      const t = e.target.closest('.item[data-i]');
      if (!t) return;
      e.preventDefault();
      const a = +e.dataTransfer.getData('text/plain'), b = +t.dataset.i;
      if (a !== b) this.send({ c: 'swap', a, b });
    });
  }

  // aviso no começo da partida: quais minions cada time trouxe
  minionSets(ms) {
    this.pushFeed(`Minions: <b class="t0">${MINION_SETS[ms[0]].nome}</b> x <b class="t1">${MINION_SETS[ms[1]].nome}</b>`);
  }

  toggleShop(v) { $('shop').classList.toggle('hidden', v === undefined ? !$('shop').classList.contains('hidden') : !v); }
  toggleScore(v) { $('score').classList.toggle('hidden', !v); }

  event(e, unitName) {
    if (e.k === 'kill') {
      const by = e.by ? unitName(e.by) : e.src === 'tower' ? 'Torre' : e.src === 'minion' ? 'Minions' : 'Executado';
      this.pushFeed(`<b class="t${e.bt}">${by}</b> ⚔ <b class="t${e.vt}">${unitName(e.v)}</b>`);
    } else if (e.k === 'boss') this.pushFeed(`O time <b class="t${e.team}">${TEAM_NAME[e.team]}</b> derrotou ${e.nm}! 💪`);
    else if (e.k === 'tower') this.pushFeed(`Uma torre do time <b class="t${e.team}">${TEAM_NAME[e.team]}</b> caiu!`);
  }
  pushFeed(html) {
    this.feed.push({ html, t: performance.now() });
    if (this.feed.length > 6) this.feed.shift();
    $('feed').innerHTML = this.feed.map(f => `<div>${f.html}</div>`).join('');
  }

  update(me, mu, view, time) {
    this.me = me;
    const now = performance.now();
    if (this.feed.length && now - this.feed[0].t > 9000) { this.feed.shift(); $('feed').innerHTML = this.feed.map(f => `<div>${f.html}</div>`).join(''); }
    if (now - this.lastPaint < 90 || !me) return;
    this.lastPaint = now;
    $('clock').textContent = fmtTime(time);
    // placar no topo
    const k = [0, 0];
    for (const r of view.sb) k[r[2]] += r[4];
    $('kills').innerHTML = `<b class="t0">${k[0]}</b> ⚔ <b class="t1">${k[1]}</b>`;
    // painel do campeão
    this.showForm(me.lvl);
    $('lvl').textContent = me.lvl;
    $('xpbar').style.width = `${me.lvl >= 18 ? 100 : me.xp / me.xpNext * 100}%`;
    if (mu) {
      $('hpbar').style.width = `${mu.hp / mu.maxHp * 100}%`; $('hptxt').textContent = `${Math.ceil(mu.hp)} / ${mu.maxHp}`;
      $('mpbar').style.width = `${mu.maxMp ? mu.mana / mu.maxMp * 100 : 0}%`; $('mptxt').textContent = `${mu.mana} / ${mu.maxMp}`;
    }
    const st = me.st;
    $('stats').innerHTML = `<span title="Dano de ataque">⚔ ${st.ad}</span><span title="Poder de habilidade">✦ ${st.ap}</span>
      <span title="Armadura">🛡 ${st.armor}</span><span title="Resistência mágica">🔰 ${st.mr}</span>
      <span title="Velocidade de ataque">⚡ ${st.as}</span><span title="Chance de crítico">💥 ${st.crit}%</span>
      <span title="Aceleração de habilidade">⏱ ${st.ah}</span><span title="Velocidade de movimento">👟 ${st.ms}</span>`;
    $('gold').textContent = `💰 ${me.gold}`;
    // efeitos ativos (como a barra de buffs do LoL)
    const seen = new Map();
    for (const [k, t] of me.buffs || []) if (!seen.has(k) || seen.get(k) < t) seen.set(k, t);
    $('buffs').innerHTML = [...seen].filter(([k]) => BUFF_UI[k]).map(([k, t]) => {
      const [ic, nm, good] = BUFF_UI[k];
      return `<span class="buff ${good ? 'good' : 'bad'}" title="${nm}">${ic}<small>${t >= 99 ? '' : Math.ceil(t)}</small></span>`;
    }).join('');
    // habilidades
    document.querySelectorAll('#abilities .ab[data-s]').forEach(el => {
      const s = +el.dataset.s, ab = this.def.abil[s], rank = me.ranks[s], cd = me.cds[s];
      el.classList.toggle('locked', rank === 0);
      el.classList.toggle('nomana', rank > 0 && mu && mu.mana < ab.cost[rank - 1]);
      const canUp = me.pts > 0 && rank < me.maxRank[s];
      el.querySelector('.lvlup').classList.toggle('show', canUp);
      el.classList.toggle('can-up', canUp);
      el.querySelectorAll('.pips i').forEach((p, i) => p.classList.toggle('on', i < rank));
      const max = rank ? ab.cd[rank - 1] : 1;
      el.querySelector('.cd').style.height = cd > 0 ? `${Math.min(100, cd / max * 100)}%` : '0';
      el.querySelector('.cdtxt').textContent = cd > 0 ? (cd < 1 ? cd.toFixed(1) : Math.ceil(cd)) : '';
      const r = Math.max(1, rank), val = (ab.dmg || ab.amount);
      el.querySelector('.tipnum').innerHTML = `<br><small>${val ? `${ab.dmg ? 'Dano' : 'Valor'}: ${val.join(' / ')} ${ratioText(ab.ratio)} · ` : ''}Recarga: ${ab.cd.join(' / ')} s · Mana: ${ab.cost[r - 1]}${ab.cc ? ' · ' + ccText(ab.cc) : ''}</small>`;
    });
    document.querySelectorAll('#abilities .summ').forEach(el => {
      const cd = me.summ[el.dataset.k];
      el.querySelector('.cd').style.height = cd > 0 ? `${cd / SUMMONERS[el.dataset.k].cd * 100}%` : '0';
      el.querySelector('.cdtxt').textContent = cd > 0 ? Math.ceil(cd) : '';
    });
    // itens: os 6 espaços (teclas 1-6), no HUD e no topo da loja; só redesenha quando muda (para não cortar um arrasto)
    const key = JSON.stringify([me.items, me.stacks, me.shop]);
    if (key !== this.invKey) {
      this.invKey = key;
      $('items').innerHTML = this.inventoryHtml(me);
      $('shop-inv').innerHTML = this.inventoryHtml(me);
    }
    $('shop-gold').textContent = `💰 ${me.gold}` + (me.shop ? '' : ' · só dá para comprar na base ou morto');
    // build recomendada: os 6 itens (os que você já tem marcados) e o próximo passo, com botão de comprar
    const recKey = JSON.stringify([me.items, Math.floor(me.gold / 25), me.shop]);
    if (recKey !== this.recKey) {
      this.recKey = recKey;
      const build = this.def.build, nx = nextBuildStep(build, me.items, me.gold);
      const icons = build.map(id => `<span class="rec-it${me.items.includes(id) ? ' have' : nx && nx.target.id === id ? ' next' : ''}">${itemImg(ITEM_BY_ID[id])}</span>`).join('<i>›</i>');
      let step = '<b>Build completa! 🎉</b>';
      if (nx) {
        const r = recipe(me.items, nx.step.id), can = me.shop && me.gold >= r.cost && r.slots <= MAX_ITEMS;
        const part = nx.step !== nx.target ? ` (peça de ${nx.target.nome})` : '';
        step = `Próximo: <button data-buy="${nx.step.id}" class="rec-buy${can ? '' : ' cant'}">${itemImg(nx.step)} ${nx.step.nome}${part} · ${r.cost}</button>`
          + (me.gold < r.cost ? ` <small>faltam ${r.cost - me.gold} de ouro</small>` : '');
      }
      $('shop-rec').innerHTML = `<div class="rec-title">⭐ Recomendado para ${this.def.nome}</div><div class="rec-build">${icons}</div><div class="rec-step">${step}</div>`;
    }
    // preço para você (básicos da receita que você tem já entram na conta) e se cabe no inventário
    document.querySelectorAll('.shop-item').forEach(b => {
      const it = ITEM_BY_ID[b.dataset.id], r = it.consumable ? { cost: it.cost, slots: me.items.filter(Boolean).length + (me.items.includes(it.id) ? 0 : 1), use: [] } : recipe(me.items, it.id);
      b.classList.toggle('cant', !me.shop || r.cost > me.gold || r.slots > MAX_ITEMS);
      b.classList.toggle('owned-parts', r.use.length > 0);
      b.querySelector('.price').textContent = r.cost;
    });
    // na base: avisa da loja e da cura (abre a loja com P ou clicando no aviso)
    const hint = me.dead ? '' : [me.shop ? '🛒 Loja aberta: aperte P' : '', me.fountain && mu && (mu.hp < mu.maxHp || mu.mana < mu.maxMp) ? '💚 Recuperando na fonte' : ''].filter(Boolean).join(' · ');
    $('basehint').classList.toggle('hidden', !hint);
    $('basehint').textContent = hint;
    // morte e recall
    $('death').classList.toggle('hidden', !me.dead);
    if (me.dead) $('death-t').textContent = Math.ceil(me.respawn);
    $('recall').classList.toggle('hidden', !(me.recall > 0));
    if (me.recall > 0) $('recall-bar').style.width = `${(1 - me.recall / 8) * 100}%`;
    if (!$('score').classList.contains('hidden')) this.paintScore(view.sb);
  }

  paintScore(sb) {
    // colunas de atributos: o maior valor de cada uma fica destacado
    const COLS = [[0, v => Math.round(v)], [1, v => Math.round(v)], [2, v => Math.round(v)], [3, v => Math.round(v)], [4, v => Math.round(v)],
      [5, v => v.toFixed(2)], [6, v => Math.round(v)], [7, v => Math.round(v) + '%'], [8, v => Math.round(v)]];
    const best = [...COLS.map(([i]) => i), 9, 10].map(i => Math.max(...sb.map(r => r[11] ? r[11][i] : 0)));
    const top = (st, i, k) => st[i] && st[i] === best[k] && best[k] > 0 ? ' top' : '';
    const row = r => {
      const st = r[11] || [];
      const items = r[9].map(i => ITEM_BY_ID[i] ? itemImg(ITEM_BY_ID[i], 'tiny') : '').join('');
      // Pokémon e jogador na mesma célula (bots não mostram o nome)
      const who = `${formAt(CHAMPIONS[r[1]], r[8]).nome}${r[3] && r[3] !== 'Bot' ? `<small> ${r[3]}</small>` : ''}`;
      return `<tr class="${r[0] === this.me.id ? 'me' : ''}"><td>${who}${r[10] ? ` <span class="dead">💀${r[10]}</span>` : ''}</td><td>${r[8]}</td><td>${r[4]}/${r[5]}/${r[6]}</td><td>${r[7]}</td>
        <td class="it">${items}</td>${COLS.map(([i, f], k) => `<td class="num${top(st, i, k)}">${st[i] !== undefined ? f(st[i]) : ''}</td>`).join('')}
        <td class="num"><span class="${top(st, 9, 9).trim()}">${Math.round(st[9] || 0)}</span>/<span class="${top(st, 10, 10).trim()}">${Math.round(st[10] || 0)}</span></td></tr>`;
    };
    $('score-body').innerHTML = [0, 1].map(t => `<tr><th colspan="15" class="t${t}">Time ${TEAM_NAME[t]}</th></tr>` + sb.filter(r => r[2] === t).map(row).join('')).join('');
  }

  end(winner) {
    $('end').classList.remove('hidden');
    $('end-title').textContent = winner === this.team ? 'VITÓRIA' : 'DERROTA';
    $('end-title').className = winner === this.team ? 'win' : 'lose';
  }
}

const KIND_PT = { zone: 'Golpe', dash: 'Avanço', blink: 'Teleporte', heal: 'Cura', shield: 'Escudo', buff: 'Efeito', chain: 'Corrente', cloud: 'Área contínua',
  trap: 'Armadilha', dig: 'Escavar', fly: 'Voar' };
// barra de efeitos ativos: ícone, nome e se é bom (verde) ou ruim (vermelho)
const BUFF_UI = {
  disguise: ['🦊', 'Ilusão: o inimigo te vê como minion dele', 1], stealth: ['👁', 'Invisível', 1], dyna: ['🔴', 'Dynamax', 1], invul: ['✋', 'Imune', 1],
  unstop: ['🛡', 'Imparável', 1], as: ['⚡', 'Velocidade de ataque', 1], ad: ['⚔', 'Dano de ataque', 1], ap: ['✦', 'Poder de habilidade', 1], ms: ['👟', 'Velocidade', 1],
  armor: ['🛡', 'Armadura', 1], mr: ['🔰', 'Resistência mágica', 1], dr: ['📿', 'Redução de dano', 1], shield: ['⬜', 'Escudo', 1], nextCrit: ['💥', 'Próximo ataque crítico', 1],
  regen: ['🫐', 'Recuperando vida', 1], vamp: ['🩸', 'Roubo de vida', 1],
  slow: ['🐌', 'Lento', 0], paralysis: ['⚡', 'Paralisado', 0], stun: ['💫', 'Atordoado', 0], root: ['🌿', 'Preso', 0], freeze: ['🧊', 'Congelado', 0],
  knockup: ['⤴', 'No ar', 0], taunt: ['😠', 'Provocado', 0], burn: ['🔥', 'Queimando', 0], poison: ['☠', 'Envenenado', 0], sleep: ['💤', 'Dormindo', 0],
  drowsy: ['🥱', 'Sonolento', 0], chill: ['❄', 'Gelado', 0], mark: ['🎯', 'Marcado', 0], weaken: ['😨', 'Intimidado', 0],
};
const RATIO_PT = { ad: 'AD', bad: 'AD bônus', ap: 'AP', hp: 'vida máx.', armor: 'armadura' };
const ratioText = r => r ? Object.entries(r).map(([k, v]) => `(+${Math.round(v * 100)}% ${RATIO_PT[k]})`).join(' ') : '';
const ccText = c => c.stun ? `atordoa ${c.stun} s` : c.root ? `prende ${c.root} s` : c.knockup ? `arremessa ${c.knockup} s` : c.slow ? `lentidão ${Math.round(c.slow * 100)}% por ${c.dur} s` : '';
const STAT_PT = { ad: 'AD', ap: 'AP', hp: 'Vida', mp: 'Mana', armor: 'Armadura', mr: 'Res. mágica', as: 'Vel. ataque', crit: 'Crítico', lethality: 'Letalidade',
  armorPenPct: 'Pen. armadura', magicPen: 'Pen. mágica', magicPenPct: 'Pen. mágica', ah: 'Acel. hab.', ms: 'Vel.', msPct: 'Vel.', lifesteal: 'Roubo de vida',
  omnivamp: 'Onivampirismo', hp5: 'Regen.', mp5: 'Regen. mana', tenacity: 'Tenacidade' };
const PCT = new Set(['as', 'crit', 'armorPenPct', 'magicPenPct', 'msPct', 'lifesteal', 'omnivamp', 'tenacity']);
export const statText = it => (it.stats ? Object.entries(it.stats).map(([k, v]) => `+${PCT.has(k) ? Math.round(v * 100) + '%' : v} ${STAT_PT[k]}`).join(', ') : '') + (it.desc ? ` ${it.desc}` : '');
