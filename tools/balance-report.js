// Junta os resultados de tools/balance.js e mostra a tabela por campeão.
import fs from 'node:fs';
import { CHAMP_BY_ID } from '../src/data/champions.js';
const rows = process.argv.slice(2).flatMap(f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)));
const by = {};
for (const r of rows) (by[r.champ] = by[r.champ] || []).push(r);
const avg = (a, k) => a.reduce((s, r) => s + r[k], 0) / a.length;
const games = rows.length / 6;
console.log(`${games} partidas, ${(rows.filter(r => r.decided).length / rows.length * 100).toFixed(0)}% terminaram com nexus destruído, duração média ${avg(rows, 'min').toFixed(1)} min\n`);
console.log('Campeão     ref.LoL      jogos  vitórias  abates mortes assist  cs   dano/min');
for (const [id, a] of Object.entries(by).sort((x, y) => avg(y[1], 'win') - avg(x[1], 'win'))) {
  const c = CHAMP_BY_ID[id];
  console.log(`${c.nome.padEnd(11)} ${c.lol.padEnd(12)} ${String(a.length).padStart(4)}   ${(avg(a, 'win') * 100).toFixed(0).padStart(4)}%   ${avg(a, 'k').toFixed(1).padStart(5)} ${avg(a, 'd').toFixed(1).padStart(5)} ${avg(a, 'a').toFixed(1).padStart(5)} ${avg(a, 'cs').toFixed(0).padStart(4)}  ${avg(a, 'dpm').toFixed(0).padStart(6)}`);
}
