// Teste de balanceamento: partidas 3x3 só de bots com times sorteados.
// Uso: node tools/balance.js <partidas> <semente> > resultado.jsonl   (uma linha JSON por campeão por partida)
// Depois: node tools/balance-report.js resultado*.jsonl
import { Game } from '../src/sim/game.js';
import { CHAMPIONS } from '../src/data/champions.js';
import { TICK } from '../src/config.js';

const n = +(process.argv[2] || 5);
let seed = +(process.argv[3] || 1);
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const MAX_MIN = 30;

for (let m = 0; m < n; m++) {
  const pool = [...CHAMPIONS].sort(() => rnd() - 0.5);
  const players = pool.slice(0, 6).map((c, i) => ({ pid: null, name: 'Bot', team: i % 2, champ: c.id, bot: true }));
  const g = new Game(players);
  const dmg = new Map(g.champs.map(c => [c.id, 0]));
  for (let i = 0; i < MAX_MIN * 60 / TICK && g.winner < 0; i++) {
    g.step();
    for (const { e } of g.events) if (e.k === 'dmg' && dmg.has(e.s) && dmg.has(e.id)) dmg.set(e.s, dmg.get(e.s) + e.v);
    g.flushEvents();
  }
  // sem vencedor em 30 min: decide por torres e depois por abates
  let w = g.winner;
  if (w < 0) {
    const tw = t => g.towers.filter(x => x.team === t && !x.dead).length, k = t => g.champs.filter(c => c.team === t).reduce((s, c) => s + c.kills, 0);
    w = tw(0) !== tw(1) ? (tw(0) > tw(1) ? 0 : 1) : k(0) !== k(1) ? (k(0) > k(1) ? 0 : 1) : -1;
  }
  const min = g.time / 60;
  for (const c of g.champs) console.log(JSON.stringify({ champ: c.def.id, win: w < 0 ? 0.5 : c.team === w ? 1 : 0, k: c.kills, d: c.deaths, a: c.assists, cs: c.cs, dpm: dmg.get(c.id) / min, min, decided: g.winner >= 0 }));
}
