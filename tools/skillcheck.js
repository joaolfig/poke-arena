// Teste de mira: para cada habilidade de dano, um alvo parado onde o jogador mira tem que ser atingido.
// Alvo: no ponto mirado (golpes no ponto), a 400 à frente (projéteis e golpes que andam) ou a 200 (golpes em volta de si).
import { CHAMPIONS } from '../src/data/champions.js';
import { moveOf } from '../src/sim/abilities.js';
import { widenPiece } from '../src/config.js';
import { movePos } from '../src/data/moves.js';
import { lineHit, circleHit } from '../src/core/math.js';

const R = 65;   // raio de acerto de um campeão
let bad = 0;
for (const c of CHAMPIONS) c.abil.forEach((ab, slot) => {
  const M = moveOf(ab);
  if (!M || !ab.dmg || ab.kind === 'chain' || ab.kind === 'cloud' || ab.kind === 'trap') return;
  const range = ab.range || 0, e = { x: 0, y: 0 };
  // distância do alvo: no ponto mirado (até 600), ou perto quando o golpe é em volta de si
  const dists = range ? [Math.min(range, 600) * 0.6, Math.min(range, 600)] : [150, 250];
  const res = dists.map(dist => {
    const t = { x: dist, y: 0 };
    const from = ab.kind === 'blink' || ab.kind === 'dig' || ab.kind === 'fly' ? t : e;
    const pieces = M.f(from, ab.kind === 'blink' || ab.kind === 'dig' || ab.kind === 'fly' ? t : range ? t : e, 0).map(widenPiece);
    if (ab.kind === 'dash') pieces[0] = { ...pieces[0], len: dist + 80 };
    let hits = 0;
    for (const p of pieces) {
      if (p.s === 'c' && circleHit(p.x, p.y, p.r, t.x, t.y, R)) hits++;
      else if (p.s === 'l' && lineHit(p, t.x, t.y, R)) hits++;
      else if (p.s === 'm') { for (let k = 0; k <= 40; k++) { const q = movePos(p, p.dur * k / 40); if (circleHit(q.x, q.y, p.r, t.x, t.y, R)) { hits++; break; } } }
    }
    return hits;
  });
  const ok = res.every(h => h > 0);
  if (!ok) bad++;
  console.log(`${ok ? 'ok ' : 'ERRO'} ${c.nome.padEnd(10)} ${'QWER'[slot]} ${(ab.nome || ab.move).padEnd(24)} peças que acertam o alvo: ${res.join(' / ')}`);
});
console.log(bad ? `\n${bad} habilidade(s) erram o alvo mirado` : '\nTodas acertam o alvo mirado');
