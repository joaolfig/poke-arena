// Campeões: atributos na escala do LoL; habilidades tiradas dos golpes de chefe do Poké Realm (moves.js),
// dos especiais das classes do herói (Cetro Relampejante, Manto Sombrio, Berserk...) e dos golpes de suporte
// da Forma Selvagem. Regra do elenco: nenhum golpe se repete e nenhum kit tem dois golpes de mesmo formato.
//
// Tipos de habilidade (kind):
//   zone  = peças no chão: áreas com atraso (aviso para todos) e faixas que saem do campeão (viram projéteis)
//   dash  = avança até o ponto; a 1ª faixa acerta no caminho e o resto sai do ponto de chegada
//   blink = some e reaparece no ponto, o golpe sai de lá
//   chain = raio que acerta o inimigo mais perto do cursor e salta para outros
//   cloud = nuvem/santuário que fica no chão e age a cada 0,5 s
//   trap  = armadilha escondida que explode quando um inimigo chega perto
//   heal / shield / buff = suporte em você e nos aliados perto
// Campos extras: self/allies = efeitos em você / nos aliados (raio `radius`); cc = controle de grupo; status =
// status de Pokémon (burn, poison, paralysis, chill, sleep, drowsy); pierce = quantos o projétil atravessa;
// projectile = toda faixa vira projétil; shot = desenho do ataque básico à distância. ratio: ad, bad (AD bônus), ap, hp (vida máx.), armor.
// Valores de efeitos (v) podem ser uma lista por rank.

import { tL, tC, tM } from './moves.js';

const ranks5 = (b, s) => [0, 1, 2, 3, 4].map(i => b + s * i);
const ranks3 = (b, s) => [0, 1, 2].map(i => b + s * i);

// formatos próprios (os que não vêm dos chefes)
const par = (e, a, offs, len, w) => offs.map(o => tL(e.x - Math.sin(a) * o, e.y + Math.cos(a) * o, a, len, w, 0.95));
const SHAPE = {
  hipnose: (e, t, a) => [tL(e.x, e.y, a, 750, 120, 0.95)],
  posono: (e, t) => [[0, 0], [120, 0], [-120, 0], [0, 120], [0, -120]].map(([dx, dy], i) => tC(t.x + dx, t.y + dy, 75, 1.0 + i * 0.15)),
  escudoimpacto: (e, t, a) => [-3, -2, -1, 0, 1, 2, 3].map(i => tL(e.x, e.y, a + i * 0.12, 480, 55, 0.95)),
  aljavaarcana: (e, t, a) => par(e, a, [-70, 0, 70], 950, 45),
  aljavapesada: (e, t, a) => [tL(e.x, e.y, a, 2200, 140, 0.95)],
  caudadragao: (e, t, a) => [tL(e.x, e.y, a, 420, 260, 0.95)],
  bocejo: (e, t, a) => [tM(e.x, e.y, a, 900, 0.95, 55, 0.95)],
  cranio: (e, t) => [tC(t.x, t.y, 230, 1.15)],
  // Surf: três ondas lado a lado que saem de você (a do meio acerta quem está na mira)
  surf: (e, t, a) => par(e, a, [-120, 0, 120], 760, 110),
  // Lua Mágica: um anel de luas e uma lua no centro, onde se mira
  luamagica: (e, t) => [tC(t.x, t.y, 85, 1.2), ...Array.from({ length: 6 }, (_, i) => tC(t.x + Math.cos(i * 1.047) * 130, t.y + Math.sin(i * 1.047) * 130, 60, 1.35))],
  // Golpe Psíquico: explosão no ponto e três anéis se espalhando a partir dele
  psicoonda: (e, t) => [tC(t.x, t.y, 130, 1.0), ...[150, 280, 410].flatMap((R, k) => Array.from({ length: 8 + k * 4 }, (_, i) => tC(t.x + Math.cos(i * 6.283 / (8 + k * 4)) * R, t.y + Math.sin(i * 6.283 / (8 + k * 4)) * R, 48, 1.0 + (k + 1) * 0.5)))],
  // Nevasca: cruz de gelo centrada no ponto mirado, com uma explosão no meio
  nevasca: (e, t, a) => [tC(t.x, t.y, 150, 1.0), ...[0, Math.PI / 2].map(k => tL(t.x - Math.cos(a + k + 0.785) * 300, t.y - Math.sin(a + k + 0.785) * 300, a + k + 0.785, 600, 90, 1.25))],
  // Fogo-Fátuo: cinco chamas num leque fechado
  fogofatuo: (e, t, a) => [-0.3, -0.15, 0, 0.15, 0.3].map((k, i) => tM(e.x, e.y, a + k, 150, 4.6, 30, 1.0 + i * 0.08, 30, i * 1.3)),
  // Redemoinho: um redemoinho grande em linha reta
  redemoinho: (e, t, a) => [tM(e.x, e.y, a, 170, 3.6, 75, 0.95)],
  saida: (e, t) => [tC(t.x, t.y, 250, 0.95)],
  pouso: (e, t) => [tC(t.x, t.y, 320, 0.95), tC(t.x, t.y, 140, 0.95)],
  garranoturna: (e, t, a) => [-0.5, 0, 0.5].map(k => tL(e.x, e.y, a + k, 330, 110, 0.95)),
};

// Campeão do LoL de referência para cada Pokémon (mecânica parecida). Atributos base aproximados do LoL
// (vida/mana/AD/armadura/RM com crescimento por nível, AS e % de AS por nível, velocidade e alcance).
// Campeões sem mana no LoL (Sett, Mordekaiser) ganham mana de lutador.
const LOL = {
  Brand: { hp: 570, hpG: 105, mp: 469, mpG: 21, ad: 57, adG: 3, armor: 27, armorG: 4.2, mr: 30, mrG: 1.3, as: 0.681, asG: 2, ms: 340, range: 550, hp5: 5.5, mp5: 8 },
  Malphite: { hp: 644, hpG: 104, mp: 280, mpG: 60, ad: 62, adG: 4, armor: 37, armorG: 4.95, mr: 28, mrG: 2.05, as: 0.736, asG: 3, ms: 335, range: 125, hp5: 7, mp5: 7.3 },
  Cassiopeia: { hp: 630, hpG: 104, mp: 400, mpG: 40, ad: 53, adG: 3, armor: 18, armorG: 4.7, mr: 32, mrG: 1.3, as: 0.647, asG: 1.5, ms: 328, range: 550, hp5: 5.5, mp5: 8 },
  Zeri: { hp: 600, hpG: 110, mp: 250, mpG: 45, ad: 56, adG: 2, armor: 24, armorG: 4.2, mr: 30, mrG: 1.3, as: 0.658, asG: 2, ms: 330, range: 500, hp5: 3.25, mp5: 7 },
  Evelynn: { hp: 642, hpG: 98, mp: 315, mpG: 42, ad: 61, adG: 3, armor: 37, armorG: 4.7, mr: 32, mrG: 2.05, as: 0.667, asG: 2.1, ms: 335, range: 425, hp5: 8.5, mp5: 8 },
  Syndra: { hp: 563, hpG: 104, mp: 480, mpG: 28, ad: 54, adG: 2.9, armor: 25, armorG: 4.6, mr: 30, mrG: 1.3, as: 0.658, asG: 2, ms: 330, range: 550, hp5: 6.5, mp5: 8 },
  Sett: { hp: 670, hpG: 114, mp: 300, mpG: 40, ad: 60, adG: 4, armor: 33, armorG: 5.2, mr: 28, mrG: 2.05, as: 0.625, asG: 1.75, ms: 340, range: 125, hp5: 7, mp5: 7 },
  Rammus: { hp: 675, hpG: 94, mp: 310, mpG: 33, ad: 55, adG: 3.5, armor: 35, armorG: 4.4, mr: 32, mrG: 2.05, as: 0.656, asG: 2.2, ms: 335, range: 125, hp5: 8, mp5: 7.8 },
  Fiora: { hp: 620, hpG: 99, mp: 300, mpG: 60, ad: 66, adG: 3.3, armor: 33, armorG: 4.7, mr: 32, mrG: 2.05, as: 0.69, asG: 3.2, ms: 345, range: 150, hp5: 8.5, mp5: 8 },
  RekSai: { hp: 600, hpG: 99, mp: 300, mpG: 40, ad: 58, adG: 3.35, armor: 36, armorG: 4.2, mr: 32, mrG: 2.05, as: 0.667, asG: 2, ms: 340, range: 175, hp5: 2.5, mp5: 7 },
  Pantheon: { hp: 650, hpG: 109, mp: 317, mpG: 31, ad: 64, adG: 3, armor: 40, armorG: 4.95, mr: 28, mrG: 2.05, as: 0.658, asG: 2.95, ms: 345, range: 175, hp5: 6, mp5: 7.4 },
  Soraka: { hp: 605, hpG: 88, mp: 425, mpG: 40, ad: 50, adG: 3, armor: 32, armorG: 5, mr: 30, mrG: 1.3, as: 0.658, asG: 2.14, ms: 325, range: 550, hp5: 2.5, mp5: 11.5 },   // AS da Soraka (0,625) subiu: ficava lento demais
  Caitlyn: { hp: 580, hpG: 107, mp: 315, mpG: 40, ad: 60, adG: 3.2, armor: 27, armorG: 4.7, mr: 30, mrG: 1.3, as: 0.681, asG: 3, ms: 325, range: 600, hp5: 3.5, mp5: 7.4 },
  ChoGath: { hp: 644, hpG: 94, mp: 270, mpG: 60, ad: 69, adG: 4.2, armor: 38, armorG: 4.5, mr: 32, mrG: 2.05, as: 0.658, asG: 1.44, ms: 345, range: 125, hp5: 9, mp5: 7.2 },
  Mordekaiser: { hp: 645, hpG: 104, mp: 300, mpG: 40, ad: 61, adG: 4, armor: 37, armorG: 4.2, mr: 32, mrG: 2.05, as: 0.625, asG: 1, ms: 335, range: 175, hp5: 5, mp5: 7 },
  Olaf: { hp: 645, hpG: 119, mp: 316, mpG: 50, ad: 68, adG: 4.7, armor: 35, armorG: 4.2, mr: 32, mrG: 2.05, as: 0.694, asG: 2.7, ms: 350, range: 125, hp5: 6.5, mp5: 7.5 },
  Lissandra: { hp: 620, hpG: 110, mp: 475, mpG: 30, ad: 53, adG: 2.7, armor: 22, armorG: 4.9, mr: 30, mrG: 1.3, as: 0.656, asG: 1.36, ms: 325, range: 550, hp5: 7, mp5: 8 },
  Shaco: { hp: 630, hpG: 99, mp: 297, mpG: 40, ad: 63, adG: 3, armor: 30, armorG: 4.5, mr: 32, mrG: 2.05, as: 0.694, asG: 3, ms: 345, range: 125, hp5: 8.5, mp5: 7.2 },
};
// atributos, alcance e projétil a partir do campeão de referência
const lol = name => {
  const L = LOL[name];
  // windup = fração do intervalo entre ataques até o dano sair (LoL: ~17-20%); projétil dos atiradores ~2000-2500/s
  return { lol: name, base: L, range: L.range, missile: L.range > 300 ? 2200 : 0, windup: L.range > 300 ? 0.18 : 0.2 };
};

export const CHAMPIONS = [
  {
    id: 'charizard', pid: 6, nome: 'Charizard', types: ['fire', 'flying'], funcao: 'Mago', ...lol('Brand'), shot: 'fireball',
    passive: { nome: '🔥 Chama', desc: 'Suas habilidades queimam: dano mágico por 3 s.', onAbility: 'burn' },
    abil: [
      { move: 'lancachamas', kind: 'zone', dmgType: 'magic', dmg: ranks5(80, 40), ratio: { ap: 0.7 }, cd: ranks5(7, -0.5), cost: ranks5(60, 5), range: 640,
        vsStatus: { tag: 'burn', v: 0.25 }, desc: 'Três jatos de fogo em leque; +25% de dano em quem está queimando.' },
      { move: 'erupcao', kind: 'zone', dmgType: 'magic', dmg: ranks5(70, 35), ratio: { ap: 0.55 }, cd: ranks5(10, -0.5), cost: ranks5(70, 5), range: 850,
        desc: 'Erupção: seis bolas de fogo caem em volta do ponto.' },
      { move: 'investidafogo', kind: 'dash', dmgType: 'magic', dmg: ranks5(60, 30), ratio: { ap: 0.4 }, cd: ranks5(14, -1), cost: ranks5(50, 0), range: 450,
        desc: 'Avança em chamas, ferindo quem estiver no caminho.' },
      { move: 'labareda', kind: 'zone', dmgType: 'magic', dmg: ranks3(200, 100), ratio: { ap: 0.9 }, cd: ranks3(80, -15), cost: ranks3(100, 0), range: 820,
        desc: 'Uma coluna de fogo enorme que explode em estrela no ponto.' },
    ],
  },
  {
    id: 'blastoise', pid: 9, nome: 'Blastoise', types: ['water'], funcao: 'Tanque', ...lol('Malphite'),
    passive: { nome: '💧 Torrente', desc: 'Com menos de 35% de vida, causa 20% a mais de dano.', lowHpDmg: 0.2 },
    abil: [
      { move: 'jato', kind: 'zone', dmgType: 'magic', dmg: ranks5(70, 35), ratio: { ap: 0.5, hp: 0.02 }, cd: ranks5(8, -0.5), cost: ranks5(50, 5), range: 700,
        desc: "Rajada de quatro jatos d'água seguidos." },
      { move: null, kind: 'zone', nome: '🌊 Surf', fx: 'jet', shape: SHAPE.surf, projectile: true, projSpeed: 1300, dmgType: 'magic', dmg: ranks5(60, 30), ratio: { ap: 0.4, hp: 0.03 }, cd: ranks5(12, -1), cost: ranks5(70, 5), range: 760,
        cc: { slow: 0.35, dur: 1.5 }, desc: 'Três ondas lado a lado que avançam e deixam lento.' },
      { move: null, kind: 'zone', nome: '🛡 Escudo de Impacto', fx: 'steel', shape: SHAPE.escudoimpacto, projectile: true, projSpeed: 2200, pierce: 1,
        dmgType: 'physical', dmg: ranks5(60, 30), ratio: { armor: 0.5, bad: 0.4 }, cd: ranks5(10, -0.5), cost: ranks5(50, 5), range: 480,
        cc: { slow: 0.3, dur: 1 }, allies: [{ k: 'as', v: 0.3, t: 3 }], radius: 600,
        desc: 'Golpeia à frente com 7 estilhaços que deixam lento; você e os aliados perto entram em fúria (+30% de vel. de ataque) por 3 s.' },
      { move: 'origem', kind: 'zone', dmgType: 'magic', dmg: ranks3(180, 90), ratio: { ap: 0.6, hp: 0.05 }, cd: ranks3(90, -15), cost: ranks3(100, 0), range: 620,
        cc: { knockup: 0.6 }, desc: "Pulso Original: duas ondas de jatos d'água em estrela que jogam para o alto." },
    ],
  },
  {
    id: 'venusaur', pid: 3, nome: 'Venusaur', types: ['grass', 'poison'], funcao: 'Mago', ...lol('Cassiopeia'), shot: 'leaf',
    passive: { nome: '☠ Ponto Venenoso', desc: 'Suas habilidades envenenam (acumula até 3 vezes).', onAbility: 'poison' },
    abil: [
      { move: 'petalas', kind: 'zone', dmgType: 'magic', dmg: ranks5(60, 30), ratio: { ap: 0.6 }, cd: ranks5(7, -0.5), cost: ranks5(55, 5), range: 800,
        vsStatus: { tag: 'poison', v: 0.15 }, desc: 'Dança das Pétalas: uma espiral de pétalas a partir do ponto; +15% de dano em envenenados.' },
      { move: null, kind: 'cloud', nome: '☠ Frasco de Veneno', fx: 'slime', dmgType: 'magic', dmg: ranks5(14, 6), ratio: { ap: 0.1 }, cd: ranks5(12, -0.5), cost: ranks5(70, 5), range: 850,
        radius: 260, dur: 4, cc: { slow: 0.3, dur: 0.6 }, self: [{ k: 'stealth', t: 1 }],
        desc: 'Arremessa um frasco: a nuvem fere a cada 0,5 s por 4 s e deixa lento. Você some nas sombras por 1 s.' },
      { move: null, kind: 'zone', nome: '💤 Pó do Sono', fx: 'petal', shape: SHAPE.posono, dmgType: 'magic', dmg: ranks5(30, 15), ratio: { ap: 0.2 }, cd: ranks5(15, -1), cost: ranks5(80, 0), range: 800,
        status: 'drowsy', desc: 'Pó do sono em cruz: quem for pego fica sonolento e dorme 1,2 s depois (acorda ao levar dano).' },
      { move: 'raiosolar', kind: 'zone', dmgType: 'magic', dmg: ranks3(250, 125), ratio: { ap: 1 }, cd: ranks3(70, -10), cost: ranks3(100, 0), range: 860,
        projSpeed: 1300, desc: 'Um raio solar largo e lento, que dói muito.' },
    ],
  },
  {
    id: 'raichu', pid: 26, nome: 'Raichu', types: ['electric'], funcao: 'Atirador', ...lol('Zeri'), shot: 'spark',
    passive: { nome: '⚡ Estática', desc: 'A cada 3 ataques básicos, o próximo paralisa (lentidão forte por 1,5 s).', onAuto: { every: 3, status: 'paralysis' } },
    abil: [
      { move: 'canhaozap', kind: 'zone', dmgType: 'magic', dmg: ranks5(85, 45), ratio: { ap: 0.5, bad: 0.5 }, cd: ranks5(8, -0.5), cost: ranks5(50, 5), range: 650,
        status: 'paralysis', moverSpeed: 850, desc: 'Canhão Zap: um orbe elétrico lento e grande que paralisa.' },
      { move: null, kind: 'chain', nome: '⚡ Cetro Relampejante', fx: 'bolt', dmgType: 'magic', dmg: ranks5(80, 40), ratio: { ap: 0.6, bad: 0.5 }, cd: ranks5(10, -1), cost: ranks5(60, 5), range: 700,
        bounces: 5, bounceRange: 450, falloff: 0.15, desc: 'Um raio acerta o inimigo mais perto do cursor e salta para até 5 outros, perdendo 15% a cada salto.' },
      { move: 'derrapagem', kind: 'dash', dmgType: 'physical', dmg: ranks5(50, 25), ratio: { bad: 0.5 }, cd: ranks5(14, -1.5), cost: ranks5(40, 0), range: 425,
        desc: 'Derrapagem elétrica e um corte em X na chegada.' },
      { move: 'trovao', kind: 'zone', dmgType: 'magic', dmg: ranks3(150, 100), ratio: { ad: 0.6, ap: 0.6 }, cd: ranks3(80, -15), cost: ranks3(100, 0), range: 900,
        cc: { stun: 0.75 }, desc: 'Quatro trovões caem do céu em sequência e atordoam.' },
    ],
  },
  {
    id: 'gengar', pid: 94, nome: 'Gengar', types: ['ghost', 'poison'], funcao: 'Assassino', ...lol('Evelynn'), shot: 'shadowball',
    passive: { nome: '👻 Camuflagem', desc: 'A partir do nível 6, fica invisível depois de 4 s sem causar nem levar dano (atacar ou lançar revela).', camouflage: true },
    abil: [
      { move: null, kind: 'zone', nome: '🌀 Hipnose', fx: 'psy', shape: SHAPE.hipnose, projSpeed: 1100, pierce: 1, dmgType: 'magic', dmg: ranks5(60, 30), ratio: { ap: 0.3 }, cd: ranks5(12, -1), cost: ranks5(60, 5), range: 750,
        status: 'sleep', desc: 'Onda hipnótica lenta: o primeiro inimigo atingido dorme por 1,5 s (acorda ao levar dano).' },
      { move: null, kind: 'zone', nome: '💀 Crânio Ceifador', fx: 'shadow', shape: SHAPE.cranio, dmgType: 'magic', dmg: ranks5(100, 50), ratio: { ap: 0.65 }, cd: ranks5(9, -0.5), cost: ranks5(70, 5), range: 800,
        vamp: 0.5, desc: 'Explosão sombria no ponto. Você se cura em 50% do dano causado e os aliados perto na metade disso.' },
      { move: null, kind: 'buff', nome: '🌑 Manto Sombrio', cd: ranks5(18, -1.5), cost: ranks5(60, 0), range: 0,
        self: [{ k: 'stealth', t: 1.5 }, { k: 'ms', v: 0.25, t: 1.5 }, { k: 'nextCrit', t: 4 }], desc: 'Fica invisível por 1,5 s e mais rápido; o próximo ataque básico é crítico.' },
      { move: null, kind: 'zone', nome: '👻 Fogo-Fátuo', fx: 'ghostfire', shape: SHAPE.fogofatuo, dmgType: 'magic', dmg: ranks3(230, 110), ratio: { ap: 0.85 }, cd: ranks3(70, -10), cost: ranks3(100, 0), range: 700,
        status: 'burn', desc: 'Cinco fogos-fátuos serpenteando num leque fechado, que queimam.' },
    ],
  },
  {
    id: 'alakazam', pid: 65, nome: 'Alakazam', types: ['psychic'], funcao: 'Mago', ...lol('Syndra'), shot: 'psyorb',
    passive: { nome: '🧠 Foco Interno', desc: '30% de tenacidade: controle de grupo dura menos em você.', tenacity: 0.3 },
    abil: [
      { move: 'psicorte', kind: 'zone', dmgType: 'magic', dmg: ranks5(70, 35), ratio: { ap: 0.75 }, cd: ranks5(7, -0.5), cost: ranks5(60, 5), range: 850,
        desc: 'Dois cortes psíquicos em X no ponto.' },
      { move: 'psiquico', kind: 'zone', dmgType: 'magic', dmg: ranks5(70, 35), ratio: { ap: 0.5 }, cd: ranks5(12, -1), cost: ranks5(70, 5), range: 900,
        cc: { root: 1.25 }, desc: 'Prende quem estiver no círculo.' },
      { move: null, kind: 'blink', nome: '🔷 Prisma Ilusório', cd: ranks5(18, -1.5), cost: ranks5(50, 0), range: 450,
        self: [{ k: 'stealth', t: 1.5 }, { k: 'nextCrit', t: 4 }], desc: 'Teleporta até o cursor e fica invisível por 1,5 s; o próximo ataque básico é crítico.' },
      { move: null, kind: 'zone', nome: '🔮 Golpe Psíquico', fx: 'psy', shape: SHAPE.psicoonda, dmgType: 'magic', dmg: ranks3(180, 90), ratio: { ap: 0.75 }, cd: ranks3(90, -15), cost: ranks3(100, 0), range: 700,
        desc: 'Explosão psíquica no ponto mirado e três anéis se espalhando a partir dela.' },
    ],
  },
  {
    id: 'machamp', pid: 68, nome: 'Machamp', types: ['fighting'], funcao: 'Lutador', ...lol('Sett'),
    passive: { nome: '👊 Punhos de Ferro', desc: 'A cada 3 ataques básicos, o próximo causa 70% a mais de dano.', onAuto: { every: 3, bonus: 0.7 } },
    abil: [
      { move: 'ondachoque', kind: 'zone', dmgType: 'physical', dmg: ranks5(70, 35), ratio: { bad: 0.8 }, cd: ranks5(8, -0.5), cost: ranks5(45, 5), range: 650,
        cc: { slow: 0.3, dur: 1.5 }, desc: 'Ondas de choque em linha até o ponto, que deixam lento.' },
      { move: null, kind: 'buff', nome: '😤 Berserk', cd: ranks5(16, -1), cost: ranks5(50, 5), range: 0, radius: 700,
        allies: [{ k: 'as', v: 0.4, t: 5 }, { k: 'ms', v: 0.2, t: 5 }, { k: 'ad', v: ranks5(10, 5), t: 5 }],
        desc: 'Você e os aliados perto ganham +40% de vel. de ataque, +20% de velocidade e AD extra por 5 s.' },
      { move: 'chutegiratorio', kind: 'zone', dmgType: 'physical', dmg: ranks5(60, 35), ratio: { ad: 0.8 }, cd: ranks5(9, -0.5), cost: ranks5(35, 5), range: 0,
        desc: 'Chute giratório em volta de si.' },
      { move: 'esmagar', kind: 'zone', dmgType: 'physical', dmg: ranks3(200, 100), ratio: { bad: 1.2 }, cd: ranks3(80, -15), cost: ranks3(100, 0), range: 500,
        cc: { knockup: 0.75 }, desc: 'Garra esmagadora que joga os inimigos para o alto.' },
    ],
  },
  {
    id: 'steelix', pid: 208, nome: 'Steelix', types: ['steel', 'ground'], funcao: 'Tanque', ...lol('Rammus'),
    passive: { nome: '🪨 Robustez', desc: 'Uma vez a cada 90 s, um golpe que mataria deixa você com 1 de vida.', sturdy: 90 },
    abil: [
      { move: 'rolagem', kind: 'zone', dmgType: 'physical', dmg: ranks5(60, 30), ratio: { ad: 0.45, armor: 0.35 }, cd: ranks5(9, -0.5), cost: ranks5(50, 5), range: 790,
        desc: 'Três pedras rolando em leque. Escala com armadura.' },
      { move: 'tumba', kind: 'zone', dmgType: 'magic', dmg: ranks5(60, 30), ratio: { hp: 0.02 }, cd: ranks5(14, -1), cost: ranks5(60, 5), range: 800,
        cc: { root: 1 }, desc: 'Anel de pedras que prende no lugar.' },
      { move: null, kind: 'buff', nome: '⛓ Defesa de Ferro', cd: ranks5(16, -1), cost: ranks5(40, 5), range: 0,
        self: [{ k: 'armor', v: ranks5(30, 15), t: 4 }, { k: 'mr', v: ranks5(30, 15), t: 4 }], taunt: { radius: 350, t: 1.25 },
        desc: 'Endurece o corpo (muita armadura e resistência mágica por 4 s) e provoca os inimigos perto: eles só podem te atacar por 1,25 s.' },
      { move: 'deslizamento', kind: 'zone', dmgType: 'magic', dmg: ranks3(180, 90), ratio: { hp: 0.06 }, cd: ranks3(80, -15), cost: ranks3(100, 0), range: 900,
        cc: { knockup: 1 }, desc: 'Deslizamento de pedras que joga para o alto.' },
    ],
  },
  {
    id: 'lucario', pid: 448, nome: 'Lucario', types: ['fighting', 'steel'], funcao: 'Lutador', ...lol('Fiora'),
    passive: { nome: '🛡 Justiça', desc: 'Ao sofrer controle de grupo, ganha 30% de velocidade por 2 s.', steadfast: 0.3 },
    abil: [
      { move: 'esferaaura', kind: 'zone', dmgType: 'physical', dmg: ranks5(60, 35), ratio: { ad: 0.9 }, cd: ranks5(6, -0.5), cost: ranks5(40, 5), range: 680,
        desc: 'Três esferas de aura em leque.' },
      { move: null, kind: 'buff', nome: '🎺 Hino de Batalha', fx: 'aura', cd: ranks5(16, -1), cost: ranks5(60, 5), range: 0, radius: 700, amount: ranks5(40, 20), ratio: { bad: 0.3 },
        allies: [{ k: 'as', v: 0.35, t: 4 }], enemyRadius: 450, cc: { slow: 0.4, dur: 1.5 },
        desc: 'Você e os aliados perto entram em fúria (+35% de vel. de ataque) e são curados; inimigos perto ficam lentos.' },
      { move: null, kind: 'buff', nome: '✋ Detectar', cd: ranks5(18, -1.5), cost: ranks5(40, 0), range: 0,
        self: [{ k: 'invul', t: 0.75, riposte: true }, { k: 'nextCrit', t: 4 }],
        desc: 'Fica imune a dano e controle por 0,75 s; quem tentar te controlar nesse tempo fica atordoado 1 s. O próximo ataque básico é crítico.' },
      { move: 'espadagigante', kind: 'dash', dmgType: 'physical', dmg: ranks3(220, 110), ratio: { bad: 1.3 }, cd: ranks3(80, -15), cost: ranks3(100, 0), range: 550,
        desc: 'Avança com uma espada de aura e corta dos dois lados na chegada.' },
    ],
  },
  {
    id: 'garchomp', pid: 445, nome: 'Garchomp', types: ['dragon', 'ground'], funcao: 'Assassino', ...lol('RekSai'),
    passive: { nome: '🦈 Pele Áspera', desc: 'Quem te acerta com ataque básico leva 15 + 2 por nível de dano mágico.', roughSkin: true },
    abil: [
      { move: 'precipicio', kind: 'zone', dmgType: 'physical', dmg: ranks5(75, 40), ratio: { bad: 0.8 }, cd: ranks5(8, -0.5), cost: ranks5(45, 5), range: 420,
        desc: 'Lâminas do Precipício: três trilhas de pedras em leque.' },
      { move: null, kind: 'dig', nome: '🕳 Escavar', fx: 'quake', shape: SHAPE.saida, dmgType: 'physical', dmg: ranks5(70, 35), ratio: { bad: 0.7 }, cd: ranks5(14, -1), cost: ranks5(50, 5), range: 900,
        cc: { knockup: 0.6 }, self: [{ k: 'shield', v: ranks5(80, 30), t: 3.5 }],
        desc: 'Vai por baixo da terra (intocável, só o rastro aparece) e sai no ponto jogando os inimigos para o alto, com um escudo por 3,5 s.' },
      { move: null, kind: 'buff', nome: '⚔ Dança das Espadas', cd: ranks5(16, -1), cost: ranks5(40, 5), range: 0,
        self: [{ k: 'ad', v: ranks5(20, 12), t: 5 }, { k: 'ms', v: 0.2, t: 5 }, { k: 'vamp', v: 0.2, t: 5 }], desc: 'Afia as garras: AD extra, +20% de velocidade e 20% de roubo de vida por 5 s.' },
      { move: 'cometa', kind: 'zone', dmgType: 'physical', dmg: ranks3(200, 100), ratio: { bad: 1.1 }, cd: ranks3(80, -15), cost: ranks3(100, 0), range: 900,
        desc: 'Cometa Draco: cometas caem em volta do ponto.' },
    ],
  },
  {
    id: 'dragonite', pid: 149, nome: 'Dragonite', types: ['dragon', 'flying'], funcao: 'Lutador', ...lol('Pantheon'),
    passive: { nome: '🐉 Multiescala', desc: 'Com a vida cheia, recebe 35% menos dano.', multiscale: 0.35 },
    abil: [
      { move: null, kind: 'zone', nome: '🐲 Cauda do Dragão', fx: 'dragon', shape: SHAPE.caudadragao, projSpeed: 1600, dmgType: 'physical', dmg: ranks5(80, 40), ratio: { bad: 0.8 }, cd: ranks5(7, -0.5), cost: ranks5(45, 5), range: 420,
        cc: { slow: 0.35, dur: 1 }, desc: 'Um golpe de cauda largo à frente que deixa lento.' },
      { move: 'furacao', kind: 'zone', dmgType: 'magic', dmg: ranks5(70, 35), ratio: { bad: 0.4, ap: 0.4 }, cd: ranks5(11, -1), cost: ranks5(60, 5), range: 700,
        cc: { slow: 0.25, dur: 1.5 }, desc: 'Três tornados que avançam serpenteando.' },
      { move: 'ataqueaereo', kind: 'dash', dmgType: 'physical', dmg: ranks5(50, 30), ratio: { bad: 0.6 }, cd: ranks5(12, -1), cost: ranks5(40, 0), range: 475,
        desc: 'Mergulho em linha reta.' },
      { move: null, kind: 'fly', nome: '🪽 Voar', fx: 'wind', shape: SHAPE.pouso, dmgType: 'physical', dmg: ranks3(200, 100), ratio: { bad: 1.1 }, cd: ranks3(80, -15), cost: ranks3(100, 0), range: 3000,
        cc: { knockup: 0.75 }, desc: 'Levanta voo (intocável) e cai em qualquer ponto até 3000 de distância; o pouso joga os inimigos para o alto. O inimigo só vê o círculo de pouso.' },
    ],
  },
  {
    id: 'gardevoir', pid: 282, nome: 'Gardevoir', types: ['psychic', 'fairy'], funcao: 'Suporte', ...lol('Soraka'), shot: 'fairystar',
    passive: { nome: '💞 Sincronizar', desc: 'Quem te aplica controle de grupo fica 30% mais lento por 1,5 s.', synchronize: true },
    abil: [
      { move: null, kind: 'zone', nome: '🌙 Lua Mágica', fx: 'fairy', shape: SHAPE.luamagica, dmgType: 'magic', dmg: ranks5(80, 40), ratio: { ap: 0.5 }, cd: ranks5(8, -0.5), cost: ranks5(60, 5), range: 850,
        cc: { slow: 0.3, dur: 1.5 }, desc: 'Uma lua cai no ponto e seis em anel logo depois, deixando lento.' },
      { move: null, kind: 'heal', nome: '📖 Tomo Sagrado', amount: ranks5(70, 30), ratio: { ap: 0.35 }, cd: ranks5(12, -0.5), cost: ranks5(70, 10), range: 650, cleanse: true,
        desc: 'Cura você e os aliados perto e tira lentidão, atordoamento e raízes.' },
      { move: null, kind: 'shield', nome: '🛡 Barreira', amount: ranks5(60, 35), ratio: { ap: 0.4 }, dur: 2.5, cd: ranks5(14, -1), cost: ranks5(60, 5), range: 650,
        desc: 'Escudo em você e nos aliados perto.' },
      { move: null, kind: 'cloud', nome: '🌟 Santuário', fx: 'fairy', dmgType: 'magic', dmg: ranks3(20, 10), ratio: { ap: 0.08 }, heal: ranks3(20, 10), healRatio: { ap: 0.08 },
        cd: ranks3(90, -15), cost: ranks3(100, 0), range: 800, radius: 400, dur: 6, cleanse: true, cc: { slow: 0.3, dur: 0.6 },
        desc: 'Santuário por 6 s: cura os aliados dentro a cada 0,5 s e tira controle de grupo; fere e deixa lentos os inimigos.' },
    ],
  },
  {
    id: 'decidueye', pid: 724, nome: 'Decidueye', types: ['grass', 'ghost'], funcao: 'Atirador', ...lol('Caitlyn'), shot: 'arrow',
    passive: { nome: '🎯 Tiro Certeiro', desc: 'A cada 5 ataques básicos, o próximo é um tiro certeiro com 40% a mais de dano.', onAuto: { every: 5, bonus: 0.4 } },
    abil: [
      { move: null, kind: 'zone', nome: '🏹 Aljava Arcana', fx: 'leaf', shape: SHAPE.aljavaarcana, projectile: true, projSpeed: 2200, pierce: 1,
        dmgType: 'physical', dmg: ranks5(40, 25), ratio: { ad: 0.9 }, cd: ranks5(7, -0.5), cost: ranks5(50, 5), range: 950,
        cc: { slow: 0.3, dur: 1 }, desc: 'Três flechas paralelas; cada uma acerta o primeiro inimigo e deixa lento.' },
      { move: null, kind: 'trap', nome: '🪤 Armadilha da Caçadora', fx: 'leaf', dmgType: 'magic', dmg: ranks5(80, 40), ratio: { ap: 0.6, bad: 0.4 }, cd: ranks5(12, -1), cost: ranks5(50, 5), range: 650,
        radius: 260, cc: { slow: 0.4, dur: 1.5 }, mark: 0.15,
        desc: 'Arma uma armadilha escondida que explode quando um inimigo chega perto: fere, deixa lento e marca (+15% de dano recebido por 6 s). Até 3.' },
      { move: null, kind: 'dash', nome: '🍃 Rolamento', cd: ranks5(12, -1), cost: ranks5(30, 0), range: 300,
        self: [{ k: 'as', v: 0.4, t: 3 }], desc: 'Rola uma curta distância e ganha +40% de vel. de ataque por 3 s.' },
      { move: null, kind: 'zone', nome: '🎯 Aljava Pesada', fx: 'leaf', shape: SHAPE.aljavapesada, projSpeed: 1700, dmgType: 'physical', dmg: ranks3(175, 100), ratio: { bad: 1 },
        cd: ranks3(80, -15), cost: ranks3(100, 0), range: 2200, cc: { slow: 0.5, dur: 3 },
        desc: 'Uma flecha enorme e perfurante que cruza a lane e deixa lento por 3 s.' },
    ],
  },
  {
    id: 'snorlax', pid: 143, nome: 'Snorlax', types: ['normal'], funcao: 'Tanque', ...lol('ChoGath'),
    passive: { nome: '🍖 Sebo Grosso', desc: 'Recebe 15% menos dano mágico.', thickFat: 0.15 },
    abil: [
      { move: null, kind: 'zone', nome: '🥱 Bocejo', fx: 'psy', shape: SHAPE.bocejo, dmgType: 'magic', dmg: ranks5(60, 30), ratio: { hp: 0.02 }, cd: ranks5(12, -1), cost: ranks5(50, 5), range: 850,
        status: 'drowsy', moverSpeed: 900, desc: 'Uma bolha de bocejo: quem ela tocar fica sonolento e dorme 1,2 s depois.' },
      { move: null, kind: 'buff', nome: '💤 Descansar', cd: ranks5(22, -2), cost: ranks5(60, 0), range: 0, radius: 1, amount: ranks5(150, 50), ratio: { hp: 0.08 },
        self: [{ k: 'sleep', t: 1.5 }], desc: 'Dorme na hora e recupera muita vida (acorda ao levar dano).' },
      { move: 'pisotear', kind: 'zone', dmgType: 'physical', dmg: ranks5(80, 40), ratio: { hp: 0.05 }, cd: ranks5(10, -0.5), cost: ranks5(50, 5), range: 0,
        cc: { slow: 0.35, dur: 1.5 }, desc: 'Pisotões em volta de si que deixam lento.' },
      { move: null, kind: 'buff', nome: '🔴 Dynamax', cd: ranks3(80, -15), cost: ranks3(100, 0), range: 0,
        self: [{ k: 'dyna', t: ranks3(8, 2) }, { k: 'ad', v: ranks3(30, 20), t: ranks3(8, 2) }], desc: 'Fica gigante: +35% de vida, AD extra, e os ataques básicos explodem em volta do alvo (40% do dano).' },
    ],
  },
  {
    id: 'tyranitar', pid: 248, nome: 'Tyranitar', types: ['rock', 'dark'], funcao: 'Lutador', ...lol('Mordekaiser'),
    passive: { nome: '🌪 Tempestade de Areia', desc: 'Inimigos perto (450) levam 4 + 1,5 por nível de dano mágico por segundo.', sandStream: true },
    abil: [
      { move: 'pedraafiada', kind: 'zone', dmgType: 'physical', dmg: ranks5(70, 35), ratio: { bad: 0.8 }, cd: ranks5(8, -0.5), cost: ranks5(45, 5), range: 700,
        desc: 'Pedras afiadas brotam em linha até o ponto.' },
      { move: null, kind: 'cloud', nome: '⏳ Areia Movediça', fx: 'dust', dmgType: 'magic', dmg: ranks5(8, 4), ratio: { bad: 0.05 }, cd: ranks5(14, -1), cost: ranks5(60, 5), range: 750,
        radius: 320, dur: 4, cc: { slow: 0.45, dur: 0.6 }, desc: 'Um redemoinho de areia que deixa muito lento quem estiver dentro.' },
      { move: 'cabecada', kind: 'dash', dmgType: 'physical', dmg: ranks5(60, 35), ratio: { bad: 0.7 }, cd: ranks5(13, -1), cost: ranks5(50, 0), range: 475,
        desc: 'Cabeçada dura em linha reta.' },
      { move: 'pulsosombrio', kind: 'zone', dmgType: 'physical', dmg: ranks3(220, 110), ratio: { bad: 1.1 }, cd: ranks3(80, -15), cost: ranks3(100, 0), range: 0,
        cc: { stun: 0.6 }, desc: 'Pulso sombrio enorme à sua volta que atordoa.' },
    ],
  },
  {
    id: 'gyarados', pid: 130, nome: 'Gyarados', types: ['water', 'flying'], funcao: 'Lutador', ...lol('Olaf'),
    passive: { nome: '😠 Intimidação', desc: 'Campeões inimigos perto (500) causam 10% menos dano.', intimidate: 0.1 },
    abil: [
      { move: null, kind: 'zone', nome: '🌀 Redemoinho', fx: 'whirl', shape: SHAPE.redemoinho, dmgType: 'magic', dmg: ranks5(70, 35), ratio: { bad: 0.5 }, cd: ranks5(9, -0.5), cost: ranks5(50, 5), range: 600,
        cc: { slow: 0.3, dur: 1 }, moverSpeed: 800, desc: 'Um redemoinho largo que avança em linha reta e deixa lento.' },
      { move: null, kind: 'buff', nome: '🐉 Dança do Dragão', cd: ranks5(16, -1), cost: ranks5(40, 5), range: 0,
        self: [{ k: 'as', v: 0.4, t: 5 }, { k: 'ms', v: 0.25, t: 5 }, { k: 'ad', v: ranks5(10, 5), t: 5 }, { k: 'unstop', t: 3 }],
        desc: 'Dança: +40% de vel. de ataque, +25% de velocidade e AD extra por 5 s; imparável (ignora controle) nos 3 primeiros segundos.' },
      { move: 'aquacauda', kind: 'dash', dmgType: 'physical', dmg: ranks5(60, 30), ratio: { bad: 0.6 }, cd: ranks5(12, -1), cost: ranks5(40, 0), range: 475,
        desc: "Avanço com um jato d'água." },
      { move: 'hidrobomba', kind: 'zone', dmgType: 'physical', dmg: ranks3(200, 100), ratio: { bad: 1.1 }, cd: ranks3(80, -15), cost: ranks3(100, 0), range: 820,
        cc: { knockup: 0.5 }, desc: 'Três canhões de água em sequência que jogam para o alto.' },
    ],
  },
  {
    id: 'froslass', pid: 478, nome: 'Froslass', types: ['ice', 'ghost'], funcao: 'Mago', ...lol('Lissandra'), shot: 'iceshard',
    passive: { nome: '❄ Corpo Gelado', desc: 'Suas habilidades gelam: na 3ª vez seguida, o alvo congela (fica preso 1 s).', onAbility: 'chill' },
    abil: [
      { move: 'raiogelo', kind: 'zone', dmgType: 'magic', dmg: ranks5(80, 45), ratio: { ap: 0.65 }, cd: ranks5(7, -0.5), cost: ranks5(55, 5), range: 720,
        desc: 'Raio de Gelo: um feixe central e dois laterais logo depois.' },
      { move: 'avalanche', kind: 'zone', dmgType: 'magic', dmg: ranks5(60, 30), ratio: { ap: 0.5 }, cd: ranks5(12, -1), cost: ranks5(70, 5), range: 630,
        cc: { slow: 0.3, dur: 1.5 }, desc: 'Uma muralha de gelo que avança e deixa lento.' },
      { move: 'giragelo', kind: 'zone', dmgType: 'magic', dmg: ranks5(60, 30), ratio: { ap: 0.5 }, cd: ranks5(10, -0.5), cost: ranks5(60, 5), range: 700,
        status: 'chill', desc: 'Pirueta de Gelo: três cristais girando em leque que gelam.' },
      { move: null, kind: 'zone', nome: '❄ Nevasca', fx: 'ice', shape: SHAPE.nevasca, dmgType: 'magic', dmg: ranks3(200, 100), ratio: { ap: 0.85 }, cd: ranks3(80, -15), cost: ranks3(100, 0), range: 750,
        status: 'chill', desc: 'Nevasca: explosão de gelo no ponto mirado e uma cruz de gelo em seguida, que gela.' },
    ],
  },
  {
    id: 'zoroark', pid: 571, nome: 'Zoroark', types: ['dark'], funcao: 'Assassino', ...lol('Shaco'),
    passive: { nome: '🎭 Ilusionista', desc: 'Ao sair da Ilusão atacando, o primeiro ataque básico é crítico.', illusionist: true },
    abil: [
      { move: null, kind: 'zone', nome: '🌑 Garra Noturna', fx: 'shadow', shape: SHAPE.garranoturna, projSpeed: 2000, dmgType: 'physical', dmg: ranks5(95, 50), ratio: { bad: 0.9 }, cd: ranks5(6, -0.5), cost: ranks5(40, 5), range: 330,
        desc: 'Três garradas curtas e largas à frente.' },
      { move: null, kind: 'buff', nome: '🦊 Ilusão', cd: ranks5(20, -2), cost: ranks5(50, 0), range: 0,
        self: [{ k: 'disguise', t: 8 }, { k: 'ms', v: 0.15, t: 8 }],
        desc: 'Vira um minion do time inimigo por 8 s: para eles você é um Rattata, e os minions e torres te ignoram. Atacar, lançar ou levar dano desfaz.' },
      { move: 'emboscada', kind: 'blink', dmgType: 'physical', dmg: ranks5(80, 40), ratio: { bad: 0.7 }, cc: { slow: 0.3, dur: 1 }, cd: ranks5(14, -1), cost: ranks5(50, 0), range: 550,
        desc: 'Emboscada: aparece no ponto e golpeia em volta.' },
      { move: 'explosaonoturna', kind: 'zone', dmgType: 'magic', dmg: ranks3(220, 110), ratio: { bad: 1.1, ap: 0.6 }, cd: ranks3(80, -15), cost: ranks3(100, 0), range: 0,
        cc: { slow: 0.4, dur: 2 }, desc: 'Explosão Noturna: uma onda sombria à sua volta e um anel mais longe.' },
    ],
  },
];

// Linha evolutiva: [nível, pid, nome]. Todos começam no 1º estágio (ou bebê) e evoluem nos níveis 6 e 11
// (junto com os ranks do R); linhas de dois estágios evoluem no 9. A Mega vem no nível 18, só para quem tem
// sprite da Mega no PMDCollab (Blastoise, Venusaur e Garchomp têm Mega nos jogos, mas ainda não lá).
const EVOS = {
  charizard: { evo: [[1, 4, 'Charmander'], [6, 5, 'Charmeleon'], [11, 6, 'Charizard']], mega: [18, 10034, 'Mega Charizard X'] },
  blastoise: { evo: [[1, 7, 'Squirtle'], [6, 8, 'Wartortle'], [11, 9, 'Blastoise']] },
  venusaur: { evo: [[1, 1, 'Bulbasaur'], [6, 2, 'Ivysaur'], [11, 3, 'Venusaur']] },
  raichu: { evo: [[1, 172, 'Pichu'], [6, 25, 'Pikachu'], [11, 26, 'Raichu']] },
  gengar: { evo: [[1, 92, 'Gastly'], [6, 93, 'Haunter'], [11, 94, 'Gengar']], mega: [18, 10038, 'Mega Gengar'] },
  alakazam: { evo: [[1, 63, 'Abra'], [6, 64, 'Kadabra'], [11, 65, 'Alakazam']], mega: [18, 10037, 'Mega Alakazam'] },
  machamp: { evo: [[1, 66, 'Machop'], [6, 67, 'Machoke'], [11, 68, 'Machamp']] },
  steelix: { evo: [[1, 95, 'Onix'], [9, 208, 'Steelix']], mega: [18, 10072, 'Mega Steelix'] },
  lucario: { evo: [[1, 447, 'Riolu'], [9, 448, 'Lucario']], mega: [18, 10059, 'Mega Lucario'] },
  garchomp: { evo: [[1, 443, 'Gible'], [6, 444, 'Gabite'], [11, 445, 'Garchomp']] },
  dragonite: { evo: [[1, 147, 'Dratini'], [6, 148, 'Dragonair'], [11, 149, 'Dragonite']] },
  gardevoir: { evo: [[1, 280, 'Ralts'], [6, 281, 'Kirlia'], [11, 282, 'Gardevoir']], mega: [18, 10051, 'Mega Gardevoir'] },
  decidueye: { evo: [[1, 722, 'Rowlet'], [6, 723, 'Dartrix'], [11, 724, 'Decidueye']] },
  snorlax: { evo: [[1, 446, 'Munchlax'], [9, 143, 'Snorlax']] },
  tyranitar: { evo: [[1, 246, 'Larvitar'], [6, 247, 'Pupitar'], [11, 248, 'Tyranitar']], mega: [18, 10049, 'Mega Tyranitar'] },
  gyarados: { evo: [[1, 129, 'Magikarp'], [9, 130, 'Gyarados']] },
  froslass: { evo: [[1, 361, 'Snorunt'], [9, 478, 'Froslass']] },
  zoroark: { evo: [[1, 570, 'Zorua'], [9, 571, 'Zoroark']] },
};
for (const c of CHAMPIONS) Object.assign(c, EVOS[c.id]);

// Build recomendada (botas + 5 itens, na ordem de compra), pelo que cada um escala: ratios das habilidades e passiva.
// A loja mostra o próximo passo dela e os bots seguem a mesma lista.
const BUILDS = {
  charizard: ['botasmago', 'orbevida', 'oculosescolhidos', 'lentesabia', 'pocaosombria', 'coleteassalto'],      // mago de dano: AP e penetração
  blastoise: ['botasaco', 'restos', 'capacete', 'coleteassalto', 'eviolito', 'faixaescolhida'],                 // tanque: golpes escalam com vida e armadura
  venusaur: ['botasmago', 'oculosescolhidos', 'pocaosombria', 'orbevida', 'lentesabia', 'coleteassalto'],       // mago de dano contínuo: AP, mana e roubo de vida
  raichu: ['botasvel', 'garrarapida', 'lentefoco', 'garracortante', 'conchasino', 'capacete'],                   // atirador: vel. de ataque e crítico (Estática a cada 3 ataques)
  gengar: ['botasmago', 'orbevida', 'lentesabia', 'oculosescolhidos', 'pocaosombria', 'eviolito'],              // assassino mágico: AP alto para o combo
  alakazam: ['botasmago', 'oculosescolhidos', 'orbevida', 'lentesabia', 'pocaosombria', 'coleteassalto'],       // mago de controle: AP e aceleração
  machamp: ['botasaco', 'faixaescolhida', 'conchasino', 'dentepiercing', 'coleteassalto', 'eviolito'],          // lutador: AD bônus, roubo de vida e defesa
  steelix: ['botasaco', 'capacete', 'eviolito', 'restos', 'coleteassalto', 'faixaescolhida'],                   // tanque: Rolagem escala com armadura
  lucario: ['botasvel', 'faixaescolhida', 'conchasino', 'garracortante', 'lentefoco', 'coleteassalto'],         // duelista: AD bônus e críticos (Detectar dá crítico)
  garchomp: ['botasaco', 'dentepiercing', 'faixaescolhida', 'garracortante', 'conchasino', 'eviolito'],         // assassino físico: letalidade e AD bônus
  dragonite: ['botasaco', 'faixaescolhida', 'dentepiercing', 'conchasino', 'coleteassalto', 'eviolito'],        // lutador: AD bônus (Multiescala já protege)
  gardevoir: ['botasmerc', 'oculosescolhidos', 'pocaosombria', 'eviolito', 'coleteassalto', 'orbevida'],        // suporte: AP para cura e escudo, mana e resistência
  decidueye: ['botasvel', 'lentefoco', 'garrarapida', 'garracortante', 'conchasino', 'capacete'],               // atirador de crítico (Tiro Certeiro)
  snorlax: ['botasaco', 'restos', 'coleteassalto', 'capacete', 'eviolito', 'faixaescolhida'],                   // tanque: golpes escalam com vida (Dynamax dá +35%)
  tyranitar: ['botasaco', 'faixaescolhida', 'conchasino', 'restos', 'coleteassalto', 'capacete'],               // lutador resistente: aguenta enquanto a areia fere
  gyarados: ['botasvel', 'conchasino', 'faixaescolhida', 'dentepiercing', 'coleteassalto', 'eviolito'],         // lutador de vel. de ataque (Dança do Dragão)
  froslass: ['botasmago', 'oculosescolhidos', 'orbevida', 'lentesabia', 'pocaosombria', 'eviolito'],            // maga: AP e penetração
  zoroark: ['botasvel', 'dentepiercing', 'garracortante', 'lentefoco', 'faixaescolhida', 'coleteassalto'],      // assassino: letalidade e críticos (sai da Ilusão com crítico)
};
for (const c of CHAMPIONS) c.build = BUILDS[c.id];

// forma no nível: { pid, nome, stage } (stage 0 = 1º estágio ... última = forma final, mega = stage extra)
export function formAt(def, lvl) {
  const forms = def.mega ? [...def.evo, def.mega] : def.evo;
  let i = 0;
  while (i + 1 < forms.length && lvl >= forms[i + 1][0]) i++;
  return { pid: forms[i][1], nome: forms[i][2], stage: i, last: forms.length - 1, mega: !!def.mega && i === forms.length - 1 };
}

export const CHAMP_BY_ID = Object.fromEntries(CHAMPIONS.map(c => [c.id, c]));
export const SLOT_KEYS = ['Q', 'W', 'E', 'R'];
