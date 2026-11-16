// Partida só de bots, sem tela: confere que a simulação roda até o fim e mostra um resumo.
// Uso: node tools/simtest.js [minutos] [tamanho do time]
import { Game } from '../src/sim/game.js';
import { CHAMPIONS } from '../src/data/champions.js';
import { TICK } from '../src/config.js';

const mins = +(process.argv[2] || 20), size = +(process.argv[3] || 5);
const players = [];
for (const team of [0, 1]) for (let i = 0; i < size; i++) players.push({ pid: null, name: `Bot ${team}${i}`, team, champ: CHAMPIONS[(team * size + i) % CHAMPIONS.length].id, bot: true });
const g = new Game(players);
const t0 = performance.now();
let snapBytes = 0, snaps = 0, worst = 0;
for (let i = 0; i < mins * 60 / TICK && g.winner < 0; i++) {
  const a = performance.now();
  g.step();
  worst = Math.max(worst, performance.now() - a);
  if (i % 2 === 0) { snapBytes += JSON.stringify(g.snapshot(0, null, false)).length; snaps++; }
  g.flushEvents();
  if (i % (60 * 30 * 5) === 0 && i) {
    const alive = t => g.towers.filter(x => x.team === t && !x.dead).length;
    console.log(`${(g.time / 60).toFixed(0)} min | torres ${alive(0)} x ${alive(1)} | minions ${g.minions.length} | abates ${g.champs.filter(c => c.team === 0).reduce((s, c) => s + c.kills, 0)} x ${g.champs.filter(c => c.team === 1).reduce((s, c) => s + c.kills, 0)}`);
  }
}
const ms = performance.now() - t0;
console.log(`\n${(g.time / 60).toFixed(1)} min simulados em ${(ms / 1000).toFixed(1)} s (${(ms / (g.time / TICK)).toFixed(2)} ms/tick, pior ${worst.toFixed(1)} ms) | vencedor: ${g.winner < 0 ? 'ninguém' : g.winner === 0 ? 'Azul' : 'Vermelho'}`);
console.log(`snapshot médio: ${(snapBytes / snaps / 1024).toFixed(1)} KB`);
for (const c of g.champs) console.log(`${c.team ? 'V' : 'A'} ${c.def.nome.padEnd(10)} ${c.role.padEnd(6)} nv ${String(c.lvl).padStart(2)}  ${c.kills}/${c.deaths}/${c.assists}  cs ${String(c.cs).padStart(3)}  ouro ${Math.floor(c.gold)}  itens ${c.items.join(',')}`);
