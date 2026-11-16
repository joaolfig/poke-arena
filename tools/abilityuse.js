// Uso das habilidades: lançamentos por minuto e dano em campeões por lançamento, em partidas 3x3 de bots.
// Uso: node tools/abilityuse.js <partidas> <semente> > r.json ; node tools/abilityuse.js report r1.json r2.json ...
import fs from 'node:fs';
import { Game } from '../src/sim/game.js';
import { CHAMPIONS, CHAMP_BY_ID } from '../src/data/champions.js';
import { TICK } from '../src/config.js';
import { abilityName } from '../src/sim/abilities.js';

if (process.argv[2] === 'report') {
  const tot = {};
  for (const f of process.argv.slice(3)) for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(f, 'utf8')))) {
    const t = tot[k] || (tot[k] = { casts: 0, dmg: 0, min: 0 });
    t.casts += v.casts; t.dmg += v.dmg; t.min += v.min;
  }
  for (const c of CHAMPIONS) {
    const row = c.abil.map((ab, s) => {
      const t = tot[c.id + ':' + s];
      if (!t || !t.min) return `${'QWER'[s]} -`;
      return `${'QWER'[s]} ${abilityName(ab).replace(/^\S+ /, '').slice(0, 16).padEnd(16)} ${(t.casts / t.min).toFixed(2)}/min ${ab.dmg ? Math.round(t.dmg / Math.max(1, t.casts)) + ' dano' : '(suporte)'}`;
    });
    console.log(c.nome.padEnd(10), row.join(' | '));
  }
} else {
  const n = +(process.argv[2] || 4);
  let seed = +(process.argv[3] || 1);
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const out = {};
  for (let m = 0; m < n; m++) {
    const pool = [...CHAMPIONS].sort(() => rnd() - 0.5);
    const g = new Game(pool.slice(0, 6).map((c, i) => ({ pid: null, name: 'Bot', team: i % 2, champ: c.id, bot: true })));
    g.abilityStats = new Map();
    for (let i = 0; i < 25 * 60 / TICK && g.winner < 0; i++) { g.step(); g.flushEvents(); }
    for (const c of g.champs) for (let s = 0; s < 4; s++) {
      const k = c.def.id + ':' + s, st = g.abilityStats.get(k) || { casts: 0, dmg: 0 }, o = out[k] || (out[k] = { casts: 0, dmg: 0, min: 0 });
      o.casts += st.casts; o.dmg += st.dmg; o.min += g.time / 60;
    }
  }
  console.log(JSON.stringify(out));
}
