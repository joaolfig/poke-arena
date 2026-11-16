// Ritmo da partida: ouro total ganho (gasto + no bolso) e nível médio aos 5, 10, 15 e 20 min, em partidas de bots.
// Uso: node tools/economy.js [partidas] [tamanho do time]
import { Game } from '../src/sim/game.js';
import { CHAMPIONS } from '../src/data/champions.js';
import { ITEM_BY_ID } from '../src/data/items.js';
import { TICK } from '../src/config.js';

const runs = +(process.argv[2] || 3), size = +(process.argv[3] || 5);
const marks = [5, 10, 15, 20], acc = marks.map(() => ({ gold: 0, lvl: 0, cs: 0, n: 0 }));
for (let r = 0; r < runs; r++) {
  const pool = [...CHAMPIONS].sort(() => Math.random() - 0.5);
  const g = new Game(pool.slice(0, size * 2).map((c, i) => ({ pid: null, name: 'Bot', team: i % 2, champ: c.id, bot: true })));
  // ouro gasto em itens (as receitas abatem os básicos, então soma o que sai do bolso em cada compra)
  const spent = new Map(g.champs.map(c => [c.id, 0]));
  const buy = g.buy.bind(g);
  g.buy = (u, id) => { const before = u.gold, ok = buy(u, id); if (ok) spent.set(u.id, spent.get(u.id) + before - u.gold); return ok; };
  const sell = g.sell.bind(g);
  g.sell = (u, i) => { const before = u.gold, ok = sell(u, i); if (ok) spent.set(u.id, spent.get(u.id) - (u.gold - before)); return ok; };
  for (let i = 0; i < 20 * 60 / TICK + 1 && g.winner < 0; i++) {
    g.step(); g.flushEvents();
    const k = marks.indexOf(Math.round(g.time * 30) / 30 / 60);
    if (k >= 0) for (const c of g.champs) { acc[k].gold += c.gold + spent.get(c.id); acc[k].lvl += c.lvl; acc[k].cs += c.cs; acc[k].n++; }
  }
}
for (let k = 0; k < marks.length; k++) {
  const a = acc[k];
  if (a.n) console.log(`${marks[k]} min: ouro total ${Math.round(a.gold / a.n)} | nível ${(a.lvl / a.n).toFixed(1)} | CS ${(a.cs / a.n).toFixed(0)}`);
}
