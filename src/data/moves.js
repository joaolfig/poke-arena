// Formatos dos golpes, copiados do Poké Realm (js/sigs.js: SIG_MOVES e SIG_STYLE).
// Cada golpe é uma função (e, t, a) -> lista de avisos no chão:
//   c = círculo, l = faixa, m = golpe que anda (tornado, orbe, pedra rolando).
// e = quem lança, t = ponto mirado, a = ângulo da mira; d = segundos até acertar.
// Mudanças em relação ao original: módulo ES, near2 local e sem os golpes de suporte do Druida
// (as habilidades de suporte ficam em champions.js).

const near2 = (t, r) => { const a = Math.random() * 6.28, d = Math.random() * r; return [t.x + Math.cos(a) * d, t.y + Math.sin(a) * d]; };
export const tC = (x, y, r, delay) => ({ s: 'c', x: Math.round(x), y: Math.round(y), r, d: +delay.toFixed(2) });
export const tL = (x, y, a, len, w, delay) => ({ s: 'l', x: Math.round(x), y: Math.round(y), a: +a.toFixed(3), len, w, d: +delay.toFixed(2) });
const sRing = (x, y, R, n, r, d, a0 = Math.random() * 6.28) => Array.from({ length: n }, (_, i) => tC(x + Math.cos(a0 + i * 6.283 / n) * R, y + Math.sin(a0 + i * 6.283 / n) * R, r, d));
const sChain = (e, t, n, r, d0, dd) => { const a = Math.atan2(t.y - e.y, t.x - e.x), L = Math.max(160, Math.hypot(t.x - e.x, t.y - e.y) + 80); return Array.from({ length: n }, (_, i) => tC(e.x + Math.cos(a) * L * (i + 1) / n, e.y + Math.sin(a) * L * (i + 1) / n, r, d0 + i * dd)); };
const sFan = (e, a, ks, len, w, d) => ks.map(k => tL(e.x, e.y, a + k, len, w, d));
const sPar = (e, a, offs, len, w, d) => offs.map(o => tL(e.x - Math.sin(a) * o, e.y + Math.cos(a) * o, a, len, w, d));
const sX = (t, a, len, w, d) => [tL(t.x - Math.cos(a + 0.785) * len / 2, t.y - Math.sin(a + 0.785) * len / 2, a + 0.785, len, w, d), tL(t.x - Math.cos(a - 0.785) * len / 2, t.y - Math.sin(a - 0.785) * len / 2, a - 0.785, len, w, d)];
const sRain = (t, n, R, r, d0, dd) => Array.from({ length: n }, (_, i) => tC(...near2(t, R), r, d0 + (i % 3) * dd));
// golpe que anda: sai de (x, y) na direção a, a spd px/s por dur s; wob = quanto serpenteia para os lados
export const tM = (x, y, a, spd, dur, r, d, wob = 0, ph = 0) => ({ s: 'm', x: Math.round(x), y: Math.round(y), a: +a.toFixed(3), spd, dur, r, d: +d.toFixed(2), wob, ph: +ph.toFixed(2) });
const fwd = (e, a, k) => [e.x + Math.cos(a) * k, e.y + Math.sin(a) * k];

export const MOVES = {
  // ---------- fogo ----------
  lancachamas: { nome: '🔥 Lança-Chamas', fx: 'flame', f: (e, t, a) => sFan(e, a, [-0.3, 0, 0.3], 640, 64, 1.1) },
  labareda: { nome: '🔥 Labareda', fx: 'flame', f: (e, t, a) => [tL(e.x, e.y, a, 820, 105, 1.2), ...[0, 1, 2, 3, 4].map(i => tL(t.x, t.y, a + i * 1.2566, 190, 46, 1.75))] },
  erupcao: { nome: '🌋 Erupção', fx: 'flame', f: (e, t) => Array.from({ length: 6 }, (_, i) => tC(...near2(t, 190), 70, 1.2 + (i % 2) * 0.35)) },
  anelfogo: { nome: '🔥 Redemoinho de Fogo', fx: 'flame', f: (e, t) => [...sRing(t.x, t.y, 150, 8, 58, 1.2), tC(t.x, t.y, 60, 2.1)] },
  rodafogo: { nome: '🔥 Roda de Fogo', fx: 'flame', f: (e, t, a) => [-0.4, 0, 0.4].map((k, i) => tM(e.x, e.y, a + k, 300, 2.4, 30, 1.0 + i * 0.25)) },
  investidafogo: { nome: '🔥 Investida Flamejante', fx: 'flame', dash: 1, f: (e, t, a) => [tL(e.x, e.y, a, 560, 100, 0.95)] },
  chamaazul: { nome: '💙 Chama Azul', fx: 'blueflame', f: (e, t, a) => [...sFan(e, a, [-0.5, -0.25, 0, 0.25, 0.5], 680, 58, 1.2), tC(t.x, t.y, 110, 1.9)] },
  tempestademagma: { nome: '🌋 Tempestade de Magma', fx: 'flame', f: (e, t) => [...sRing(t.x, t.y, 200, 10, 55, 1.1), ...sRing(t.x, t.y, 110, 6, 55, 1.7), tC(t.x, t.y, 60, 2.3)] },
  // ---------- água ----------
  hidrobomba: { nome: '💦 Hidro Bomba', fx: 'jet', f: (e, t, a) => [tL(e.x, e.y, a, 820, 90, 1.05), tL(e.x, e.y, a + 0.35, 780, 70, 1.6), tL(e.x, e.y, a - 0.35, 780, 70, 2.1)] },
  jato: { nome: "💧 Jato d'Água", fx: 'jet', f: (e, t, a) => [0, 1, 2, 3].map(i => tL(e.x, e.y, a + (i - 1.5) * 0.12, 700, 46, 1.0 + i * 0.28)) },
  surf: { nome: '🌊 Surf', fx: 'jet', f: (e, t, a) => sPar(e, a, [-150, 150], 760, 120, 1.25) },
  redemoinho: { nome: '🌀 Redemoinho', fx: 'whirl', f: (e, t, a) => [tM(...fwd(e, a + 0.5, 40), a + 0.35, 170, 3.4, 50, 1.2, 70, 0), tM(...fwd(e, a - 0.5, 40), a - 0.35, 170, 3.4, 50, 1.5, 70, 3.1)] },
  chuva: { nome: '💧 Chuva Torrencial', fx: 'drop', f: (e, t) => sRain(t, 10, 260, 48, 1.0, 0.35) },
  giro: { nome: '⭐ Giro Rápido', fx: 'star', f: (e, t, a) => [tM(e.x, e.y, a, 400, 1.7, 32, 1.0), tM(e.x, e.y, a + 0.45, 400, 1.7, 32, 1.45), tM(e.x, e.y, a - 0.45, 400, 1.7, 32, 1.9)] },
  origem: { nome: '🌊 Pulso Original', fx: 'jet', f: (e, t, a) => [...Array.from({ length: 8 }, (_, i) => tL(e.x, e.y, a + i * 0.785, 620, 60, 1.2)), ...Array.from({ length: 8 }, (_, i) => tL(e.x, e.y, a + 0.39 + i * 0.785, 620, 60, 2.0))] },
  aquacauda: { nome: '💧 Aqua Jato', fx: 'jet', dash: 1, f: (e, t, a) => [tL(e.x, e.y, a, 600, 85, 0.95)] },
  // ---------- elétrico ----------
  trovao: { nome: '⚡ Trovão', fx: 'bolt', f: (e, t) => [0.9, 1.35, 1.8, 2.25].map(d => tC(...near2(t, 70), 65, d)) },
  raio: { nome: '⚡ Raio', fx: 'bolt', f: (e, t, a) => [tL(e.x, e.y, a, 760, 60, 1.0), tL(e.x, e.y, a + 0.3, 700, 50, 1.5), tL(e.x, e.y, a - 0.3, 700, 50, 1.5)] },
  rede: { nome: '⚡ Rede Elétrica', fx: 'bolt', f: (e, t, a) => sX(t, a, 620, 58, 1.2) },
  descarga: { nome: '⚡ Descarga', fx: 'spark', f: e => [tC(e.x, e.y, 190, 1.2), ...sRing(e.x, e.y, 300, 8, 55, 1.9)] },
  bolaeletrica: { nome: '⚡ Bola Elétrica', fx: 'spark', f: (e, t, a) => [-0.5, -0.17, 0.17, 0.5].map((k, i) => tM(e.x, e.y, a + k, 260, 2.6, 28, 1.0 + i * 0.2, 35, i)) },
  investidaeletrica: { nome: '⚡ Investida Selvagem', fx: 'spark', dash: 1, f: (e, t, a) => [tL(e.x, e.y, a, 580, 95, 0.95)] },
  canhaozap: { nome: '⚡ Canhão Zap', fx: 'spark', st: 2, f: (e, t, a) => [tM(e.x, e.y, a, 150, 4, 52, 1.3, 25)] },
  // ---------- planta ----------
  folhas: { nome: '🍃 Tempestade de Folhas', fx: 'leaf', f: (e, t, a) => [-0.4, 0, 0.4].map(k => tL(e.x, e.y, a + k, 620, 60, 1.1)) },
  petalas: { nome: '🌸 Dança das Pétalas', fx: 'petal', f: (e, t) => Array.from({ length: 9 }, (_, i) => tC(t.x + Math.cos(i * 0.9) * (40 + i * 22), t.y + Math.sin(i * 0.9) * (40 + i * 22), 55, 1.0 + i * 0.15)) },
  raizes: { nome: '🌿 Planta Frenética', fx: 'leaf', f: (e, t) => [...sRing(t.x, t.y, 130, 6, 58, 1.1), tC(t.x, t.y, 70, 2.0)] },
  raiosolar: { nome: '☀ Raio Solar', fx: 'sun', f: (e, t, a) => [tL(e.x, e.y, a, 860, 125, 1.6)] },
  laminafolha: { nome: '🍃 Lâmina de Folha', fx: 'leaf', f: (e, t, a) => [...sX(t, a, 560, 56, 1.05), ...sX(t, a + 0.785, 560, 56, 1.7)] },
  // ---------- gelo ----------
  nevasca: { nome: '❄ Nevasca', fx: 'ice', f: (e, t, a) => [0, 1, 2, 3].map(k => tL(e.x, e.y, a + 0.4 + k * Math.PI / 2, 560, 70, 1.2)) },
  raiogelo: { nome: '❄ Raio de Gelo', fx: 'ice', f: (e, t, a) => [tL(e.x, e.y, a, 720, 70, 1.0), tL(e.x, e.y, a + 0.22, 720, 70, 1.7), tL(e.x, e.y, a - 0.22, 720, 70, 1.7)] },
  granizo: { nome: '🧊 Granizo', fx: 'ice', f: (e, t) => sRain(t, 9, 240, 55, 1.0, 0.4) },
  presagelo: { nome: '🧊 Queda de Gelo', fx: 'ice', f: (e, t) => sChain(e, t, 6, 62, 0.95, 0.18) },
  // ---------- terra / pedra ----------
  terremoto: { nome: '🌍 Terremoto', fx: 'quake', f: e => [tC(e.x, e.y, 240, 1.5)] },
  fissura: { nome: '🌍 Fissura', fx: 'quake', f: (e, t, a) => sPar(e, a, [-110, 0, 110], 640, 55, 1.2) },
  escavar: { nome: '🕳 Escavar', fx: 'quake', tp: 1, f: (e, t) => [tC(t.x, t.y, 120, 1.4), ...sRing(t.x, t.y, 230, 6, 55, 2.0)] },
  precipicio: { nome: '⛰ Lâminas do Precipício', fx: 'rock', f: (e, t, a) => [-0.45, 0, 0.45].flatMap((k, i) => { const tt = { x: e.x + Math.cos(a + k) * 420, y: e.y + Math.sin(a + k) * 420 }; return sChain(e, tt, 5, 55, 1.0 + i * 0.15, 0.14); }) },
  broca: { nome: '🌀 Broca Giratória', fx: 'rock', dash: 1, f: (e, t, a) => [tL(e.x, e.y, a, 600, 90, 0.95)] },
  deslizamento: { nome: '🪨 Deslizamento', fx: 'rock', f: (e, t) => Array.from({ length: 7 }, (_, i) => tC(...near2(t, 230), 60, 1.1 + i * 0.08)) },
  tumba: { nome: '🪨 Tumba de Rochas', fx: 'rock', f: (e, t) => sRing(t.x, t.y, 120, 8, 52, 1.3) },
  pedraafiada: { nome: '🪨 Pedra Afiada', fx: 'rock', f: (e, t) => sChain(e, t, 6, 62, 0.95, 0.18) },
  rolagem: { nome: '🪨 Rolagem', fx: 'boulder', f: (e, t, a) => [tM(e.x, e.y, a, 330, 2.4, 38, 0.95), tM(e.x, e.y, a + 0.3, 330, 2.4, 38, 1.6), tM(e.x, e.y, a - 0.3, 330, 2.4, 38, 2.2)] },
  cabecada: { nome: '💥 Cabeçada Dura', fx: 'rock', dash: 1, f: (e, t, a) => [tL(e.x, e.y, a, 620, 110, 1.0)] },
  // ---------- psíquico / fantasma / sombrio ----------
  psiquico: { nome: '🔮 Psíquico', fx: 'psy', f: (e, t) => [tC(t.x, t.y, 125, 1.25)] },
  psicorte: { nome: '🔮 Psicorte', fx: 'psy', f: (e, t, a) => sX(t, a, 600, 62, 1.15) },
  futuro: { nome: '🔮 Visão do Futuro', fx: 'psy', f: (e, t) => [1.1, 1.9, 2.7].map(d => tC(...near2(t, 120), 95, d)) },
  psicoonda: { nome: '🔮 Golpe Psíquico', fx: 'psy', f: e => [...sRing(e.x, e.y, 150, 8, 48, 1.0), ...sRing(e.x, e.y, 280, 12, 48, 1.5), ...sRing(e.x, e.y, 410, 16, 48, 2.0)] },
  lustro: { nome: '✨ Brilho Purificador', fx: 'psy', f: (e, t, a) => [tL(e.x, e.y, a, 820, 100, 1.2), tC(t.x, t.y, 120, 1.8)] },
  bolasombria: { nome: '👻 Bola Sombria', fx: 'shadow', f: (e, t, a) => [0, 1, 2].map(i => tM(e.x, e.y, a + (i - 1) * 0.2, 280, 2.4, 34, 1.0 + i * 0.35)) },
  pesadelo: { nome: '👻 Pesadelo', fx: 'shadow', f: (e, t) => [...sRing(t.x, t.y, 170, 8, 55, 1.2), ...sRing(t.x, t.y, 90, 5, 50, 1.9)] },
  sombra: { nome: '👻 Sombra Ardilosa', fx: 'shadow', tp: 1, f: e => [tC(e.x, e.y, 145, 1.0)] },
  fogofatuo: { nome: '👻 Fogo-Fátuo', fx: 'ghostfire', st: 3, f: (e, t, a) => [-0.6, -0.3, 0, 0.3, 0.6].map((k, i) => tM(e.x, e.y, a + k, 150, 3.6, 26, 1.0 + i * 0.12, 45, i * 1.3)) },
  emboscada: { nome: '🌑 Emboscada', fx: 'shadow', tp: 1, f: e => [tC(e.x, e.y, 145, 1.0)] },
  pulsosombrio: { nome: '🌑 Pulso Sombrio', fx: 'shadow', f: e => [tC(e.x, e.y, 210, 1.3)] },
  golpebaixo: { nome: '🌑 Golpe Baixo', fx: 'shadow', tp: 1, f: (e, t, a) => sX(t, a, 520, 60, 1.05) },
  // ---------- lutador / normal ----------
  investida: { nome: '💥 Investida', fx: 'dust', dash: 1, f: (e, t, a) => [tL(e.x, e.y, a, 540, 95, 0.95)] },
  ondachoque: { nome: '👊 Onda de Choque', fx: 'quake', f: (e, t) => sChain(e, t, 5, 75, 0.95, 0.2) },
  chutegiratorio: { nome: '🦵 Chute Giratório', fx: 'dust', f: e => [tC(e.x, e.y, 170, 1.1), ...sRing(e.x, e.y, 280, 6, 60, 1.7)] },
  esferaaura: { nome: '🔵 Esfera de Aura', fx: 'aura', f: (e, t, a) => [-0.35, 0, 0.35].map((k, i) => tM(e.x, e.y, a + k, 340, 2.0, 32, 1.0 + i * 0.3)) },
  socodinamico: { nome: '👊 Soco Dinâmico', fx: 'quake', st: 6, f: (e, t) => [tC(t.x, t.y, 130, 1.3)] },
  espadasanta: { nome: '⚔ Espada Sagrada', fx: 'steel', dash: 1, f: (e, t, a) => [tL(e.x, e.y, a, 560, 90, 1.0), ...sX(t, a, 480, 50, 1.6)] },
  hiperraio: { nome: '💥 Hiper Raio', fx: 'beam', f: (e, t, a) => [tL(e.x, e.y, a, 860, 115, 1.45)] },
  pisotear: { nome: '💥 Pisotear', fx: 'quake', f: e => sRing(e.x, e.y, 150, 7, 70, 1.15) },
  esmagar: { nome: '✊ Garra Esmagadora', fx: 'quake', f: (e, t) => [tC(t.x, t.y, 150, 1.6), tC(e.x, e.y, 200, 1.1)] },
  // ---------- dragão / voador / inseto ----------
  cometa: { nome: '☄ Cometa Draco', fx: 'meteor', f: (e, t) => Array.from({ length: 5 }, (_, i) => tC(...near2(t, 200), 85, 1.2 + i * 0.22)) },
  furia: { nome: '🐉 Fúria do Dragão', fx: 'dragon', f: (e, t, a) => sFan(e, a, [-0.6, -0.3, 0, 0.3, 0.6], 600, 52, 1.2) },
  pulsodragao: { nome: '🐉 Pulso do Dragão', fx: 'dragon', f: (e, t) => [tC(t.x, t.y, 110, 1.1), ...sRing(t.x, t.y, 210, 7, 60, 1.8)] },
  garradragao: { nome: '🐉 Fúria Total', fx: 'dragon', dash: 1, f: (e, t, a) => [tL(e.x, e.y, a, 580, 100, 0.95), ...sRing(t.x, t.y, 160, 6, 55, 1.8)] },
  furacao: { nome: '🌪 Furacão', fx: 'wind', f: (e, t, a) => [-0.7, 0, 0.7].map((k, i) => tM(...fwd(e, a + k, 60), a + k * 0.45, 190, 3.6, 42, 1.1 + i * 0.25, 70, i * 2)) },
  ataqueaereo: { nome: '🪶 Ataque Aéreo', fx: 'wind', dash: 1, f: (e, t, a) => [tL(e.x, e.y, a, 600, 85, 0.95)] },
  rajada: { nome: '🌬 Rajada', fx: 'wind', f: (e, t, a) => sPar(e, a, [-140, 0, 140], 700, 60, 1.15) },
  aeroblast: { nome: '🌪 Aeroblast', fx: 'wind', f: (e, t, a) => [tL(e.x, e.y, a, 880, 110, 1.2), tM(...fwd(e, a + 1.2, 80), a + 0.5, 180, 3.2, 44, 1.9, 60), tM(...fwd(e, a - 1.2, 80), a - 0.5, 180, 3.2, 44, 1.9, 60, 3)] },
  enxame: { nome: '🐝 Enxame', fx: 'bug', f: (e, t) => Array.from({ length: 9 }, (_, i) => tC(...near2(t, 260), 45, 1.0 + (i % 3) * 0.25)) },
  teia: { nome: '🕸 Teia', fx: 'web', f: (e, t, a) => [...sX(t, a, 560, 50, 1.1), tC(t.x, t.y, 70, 1.8)] },
  picada: { nome: '🐛 Picada', fx: 'bug', dash: 1, f: (e, t, a) => [tL(e.x, e.y, a, 520, 80, 0.95)] },
  xtesoura: { nome: '✂ Tesoura X', fx: 'slash', f: (e, t, a) => [...sX(t, a, 520, 56, 1.0), ...sX(t, a + 0.785, 520, 56, 1.55)] },
  // ---------- aço / veneno / fada ----------
  chuvaaco: { nome: '⚙ Chuva de Aço', fx: 'steel', f: (e, t) => { const o = []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if ((i + j) % 2 === 0) o.push(tC(t.x + i * 120, t.y + j * 120, 60, 1.2)); return o; } },
  caudaferro: { nome: '⚙ Cauda de Ferro', fx: 'steel', dash: 1, f: (e, t, a) => [tL(e.x, e.y, a, 560, 100, 1.0)] },
  canhaoflash: { nome: '⚙ Canhão Flash', fx: 'beam', f: (e, t, a) => [tL(e.x, e.y, a, 820, 120, 1.5)] },
  rugidotempo: { nome: '⏳ Rugido do Tempo', fx: 'time', f: (e, t) => [tC(e.x, e.y, 260, 1.7), ...sRing(t.x, t.y, 130, 6, 55, 1.1)] },
  bombalodo: { nome: '☠ Bomba de Lodo', fx: 'slime', st: 4, f: (e, t) => Array.from({ length: 4 }, () => tC(...near2(t, 150), 85, 1.2)) },
  ondatoxica: { nome: '☠ Onda Tóxica', fx: 'slime', st: 4, f: e => [tC(e.x, e.y, 200, 1.3)] },
  espinhostox: { nome: '☠ Espinhos Tóxicos', fx: 'slime', st: 4, f: (e, t) => sChain(e, t, 5, 65, 1.0, 0.2) },
  explosao: { nome: '💥 Explosão', fx: 'flame', f: e => [tC(e.x, e.y, 250, 1.9)] },
  luamagica: { nome: '🌙 Lua Mágica', fx: 'fairy', f: (e, t) => Array.from({ length: 6 }, (_, i) => tC(t.x + Math.cos(i * 1.047) * 150, t.y + Math.sin(i * 1.047) * 150, 62, 1.2)) },
  vozencantada: { nome: '🎶 Voz Encantada', fx: 'fairy', f: e => [tC(e.x, e.y, 200, 1.25)] },
  brilho: { nome: '✨ Brilho Deslumbrante', fx: 'fairy', f: (e, t) => sRain(t, 8, 220, 60, 1.0, 0.35) },
  // ---------- golpes das regiões novas (Kalos, Galar, Paldea) e dos lendários ----------
  avalanche: { nome: '🧊 Avalanche', fx: 'ice', f: (e, t, a) => [-2, -1, 0, 1, 2].map(i => tM(e.x - Math.sin(a) * i * 58, e.y + Math.cos(a) * i * 58, a, 210, 3, 34, 1.15)) },
  giragelo: { nome: '⛸ Pirueta de Gelo', fx: 'ice', f: (e, t, a) => [-0.5, 0, 0.5].map((k, i) => tM(e.x, e.y, a + k, 260, 2.6, 34, 1.0 + i * 0.3, 55, i * 2)) },
  geomancia: { nome: '🌈 Geomancia', fx: 'fairy', f: e => [...sRing(e.x, e.y, 160, 8, 55, 1.1), ...sRing(e.x, e.y, 300, 12, 55, 1.6), ...sRing(e.x, e.y, 440, 16, 55, 2.1)] },
  asamorte: { nome: '🦅 Asa da Morte', fx: 'shadow', f: (e, t, a) => [...sFan(e, a, [-0.5, -0.25, 0, 0.25, 0.5], 700, 60, 1.15), tC(t.x, t.y, 100, 1.9)] },
  eternabeam: { nome: '☠ Raio Eterno', fx: 'dragon', f: (e, t, a) => [tL(e.x, e.y, a, 900, 150, 1.6), ...sRing(e.x, e.y, 260, 10, 55, 2.3)] },
  colisao: { nome: '🦖 Curso de Colisão', fx: 'dust', dash: 1, f: (e, t, a) => [tL(e.x, e.y, a, 600, 110, 1.0), tC(t.x, t.y, 150, 1.7)] },
  derrapagem: { nome: '⚡ Derrapagem Elétrica', fx: 'spark', dash: 1, f: (e, t, a) => [tL(e.x, e.y, a, 600, 105, 1.0), ...sX(t, a, 520, 55, 1.7)] },
  homenagem: { nome: '👻 Última Homenagem', fx: 'ghostfire', f: (e, t) => sRain(t, 9, 250, 52, 1.0, 0.35) },
  julgamento: { nome: '✨ Julgamento', fx: 'meteor', f: (e, t) => Array.from({ length: 10 }, (_, i) => tC(...near2(t, 300), 70, 1.1 + (i % 4) * 0.25)) },
  raiocruzado: { nome: '⚡ Raio Cruzado', fx: 'bolt', dash: 1, f: (e, t, a) => [tL(e.x, e.y, a, 580, 100, 0.95), ...[1.2, 1.6, 2.0].map(d => tC(...near2(t, 90), 65, d))] },
  espadagigante: { nome: '🗡 Espada Gigante', fx: 'steel', dash: 1, f: (e, t, a) => [tL(e.x, e.y, a, 620, 120, 1.0), ...sFan(t, a, [-1.2, 1.2], 300, 50, 1.6)] },
  escudogigante: { nome: '🛡 Escudo Gigante', fx: 'steel', f: (e, t, a) => [tC(e.x, e.y, 200, 1.2), ...sPar(e, a, [-120, 0, 120], 640, 60, 1.7)] },
  explosaonoturna: { nome: '🌑 Explosão Noturna', fx: 'shadow', f: e => [tC(e.x, e.y, 200, 0.6), ...sRing(e.x, e.y, 320, 10, 55, 1.0)] },
  terablast: { nome: '💎 Explosão Tera', fx: 'star', f: (e, t, a) => [tL(e.x, e.y, a, 840, 110, 1.3), ...sRing(t.x, t.y, 150, 8, 50, 1.9)] },
};

// estilo visual de cada golpe quando estoura (cores das partículas; beam = faixa de luz; sky = cai do céu)
export const MOVE_STYLE = {
  flame: { c: ['#fef08a', '#fde047', '#fdba74', '#fb923c', '#f97316', '#ef4444'], beam: '#fb923c', rise: 1 },
  blueflame: { c: ['#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8', '#60a5fa', '#ffffff'], beam: '#38bdf8', rise: 1 },
  jet: { c: ['#ffffff', '#e0f2fe', '#7dd3fc', '#38bdf8', '#3b82f6'], beam: '#60a5fa' },
  drop: { c: ['#e0f2fe', '#7dd3fc', '#3b82f6'] },
  whirl: { c: ['#e0f2fe', '#7dd3fc', '#2563eb'] },
  star: { c: ['#fde68a', '#c4b5fd', '#ffffff'] },
  bolt: { c: ['#fef9c3', '#fde047', '#facc15', '#ffffff'], beam: '#fde047', sky: 1 },
  spark: { c: ['#fef9c3', '#fde047', '#facc15'] },
  leaf: { c: ['#bbf7d0', '#4ade80', '#16a34a', '#a3e635'], swirl: 1 },
  petal: { c: ['#fbcfe8', '#f9a8d4', '#f472b6', '#ffffff'], swirl: 1 },
  sun: { c: ['#ffffff', '#fef9c3', '#fde047'], beam: '#fef08a' },
  ice: { c: ['#ffffff', '#e0f2fe', '#a5f3fc', '#67e8f9'] },
  quake: { c: ['#a16207', '#92400e', '#d6d3d1', '#78716c'] },
  rock: { c: ['#78716c', '#a8a29e', '#57534e', '#d6d3d1'], big: 1 },
  boulder: { c: ['#78716c', '#a8a29e', '#d6d3d1'] },
  psy: { c: ['#f9a8d4', '#f472b6', '#e879f9'], rings: 1 },
  shadow: { c: ['#581c87', '#7c3aed', '#1f1235', '#a78bfa'], rise: 1 },
  ghostfire: { c: ['#c4b5fd', '#8b5cf6', '#6d28d9'], rise: 1 },
  aura: { c: ['#bfdbfe', '#60a5fa', '#2563eb', '#ffffff'] },
  dust: { c: ['#d6d3d1', '#a8a29e', '#e7e5e4'] },
  beam: { c: ['#ffffff', '#fde68a', '#fdba74'], beam: '#fff7ed' },
  meteor: { c: ['#c4b5fd', '#a78bfa', '#f0abfc', '#ffffff'], sky: 1, big: 1 },
  dragon: { c: ['#a78bfa', '#818cf8', '#c084fc', '#f0abfc'], rise: 1 },
  wind: { c: ['#ffffff', '#e2e8f0', '#cbd5e1'], swirl: 1 },
  bug: { c: ['#bef264', '#a3e635', '#65a30d'] },
  web: { c: ['#ffffff', '#e5e7eb'] },
  slash: { c: ['#ffffff', '#d9f99d', '#a3e635'], beam: '#ecfccb' },
  steel: { c: ['#ffffff', '#e5e7eb', '#9ca3af', '#fde68a'] },
  time: { c: ['#a5f3fc', '#60a5fa', '#ffffff'], rings: 1 },
  slime: { c: ['#c084fc', '#a855f7', '#7e22ce', '#d8b4fe'], big: 1 },
  fairy: { c: ['#fbcfe8', '#ffffff', '#f9a8d4', '#fde68a'] },
};

// posição de um golpe que anda depois de k segundos andando (ts: fator de aceleração, mantém a mesma ondulação)
export function movePos(o, k = o.act || 0) {
  const along = o.spd * k, side = (o.wob || 0) * Math.sin(k * (o.ts || 1) * 3.2 + (o.ph || 0));
  return { x: o.x + Math.cos(o.a) * along - Math.sin(o.a) * side, y: o.y + Math.sin(o.a) * along + Math.cos(o.a) * side };
}

