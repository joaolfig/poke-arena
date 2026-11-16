// Conjuntos de minions: cada time sorteia um no começo da partida (nunca o mesmo do outro time).
// Só Pokémon que não são campeões jogáveis, e sempre de um mesmo lugar: corpo a corpo, à distância e cerco.
// Os atributos continuam os de config.js (MINION); aqui só muda quem aparece e o desenho do tiro (shot).

export const MINION_SETS = [
  { id: 'campo', nome: '🌾 Campos de Kanto', melee: 19, ranged: 21, siege: 128, shot: 'wind' },        // Rattata, Spearow, Tauros
  { id: 'caverna', nome: '🪨 Caverna', melee: 74, ranged: 41, siege: 76, shot: 'shadowball' },                // Geodude, Zubat, Golem
  { id: 'usina', nome: '⚡ Usina Elétrica', melee: 100, ranged: 81, siege: 125, shot: 'spark' },        // Voltorb, Magnemite, Electabuzz
  { id: 'bosque', nome: '🐛 Bosque dos Insetos', melee: 46, ranged: 48, siege: 127, shot: 'bug' },    // Paras, Venonat, Pinsir
  { id: 'mar', nome: '🌊 Mar Aberto', melee: 98, ranged: 116, siege: 131, shot: 'bubble' },              // Krabby, Horsea, Lapras
  { id: 'torre', nome: '👻 Torre Assombrada', melee: 353, ranged: 200, siege: 477, shot: 'shadowball' },     // Shuppet, Misdreavus, Dusknoir
  { id: 'vulcao', nome: '🌋 Vulcão', melee: 322, ranged: 218, siege: 323, shot: 'fireball' },              // Numel, Slugma, Camerupt
  { id: 'neve', nome: '❄ Montanha Nevada', melee: 220, ranged: 459, siege: 460, shot: 'iceshard' },        // Swinub, Snover, Abomasnow
  { id: 'lua', nome: '🌙 Monte Lua', melee: 35, ranged: 39, siege: 40, shot: 'fairystar' },                 // Clefairy, Jigglypuff, Wigglytuff
];

// sorteia dois conjuntos diferentes (um por time)
export function pickMinionSets() {
  const a = Math.floor(Math.random() * MINION_SETS.length);
  let b = Math.floor(Math.random() * (MINION_SETS.length - 1));
  if (b >= a) b++;
  return [a, b];
}
