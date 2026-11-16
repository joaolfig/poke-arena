// Procura ticks lentos e mostra quanto tempo cada parte da simulação gastou neles.
// Uso: node tools/spikes.js [partidas] [tamanho do time] [minutos]
import { Game } from '../src/sim/game.js';
import { CHAMPIONS } from '../src/data/champions.js';

const runs = +(process.argv[2] || 4), size = +(process.argv[3] || 3), mins = +(process.argv[4] || 6);
let worst = 0;
for (let r = 0; r < runs; r++) {
  const pool = [...CHAMPIONS].sort(() => Math.random() - 0.5);
  const g = new Game(pool.slice(0, size * 2).map((c, i) => ({ pid: null, name: 'Bot', team: i % 2, champ: c.id, bot: true })));
  const T = {};
  const wrap = (name) => { const f = g[name].bind(g); g[name] = (...a) => { const s = performance.now(); try { return f(...a); } finally { T[name] = (T[name] || 0) + performance.now() - s; } }; };
  for (const m of ['champTick', 'updateVision', 'spawnWaves', 'rebuildHash', 'order', 'cast', 'kill']) wrap(m);
  for (let i = 0; i < 30 * 60 * mins; i++) {
    for (const k in T) T[k] = 0;
    const a = performance.now();
    g.step(); g.flushEvents();
    const d = performance.now() - a;
    if (d > 40) console.log(`partida ${r} t=${g.time.toFixed(1)}s tick ${d.toFixed(0)}ms zonas=${g.zones.length} minions=${g.minions.length}`, JSON.stringify(Object.fromEntries(Object.entries(T).filter(([, v]) => v > 2).map(([k, v]) => [k, Math.round(v)]))));
    worst = Math.max(worst, d);
  }
}
console.log('pior tick', worst.toFixed(0), 'ms');
