// Tabela de tipos (Gen 6+) e cores, copiadas do Poké Realm (js/rules.js e js/data.js).

export const TYPE_PT = {
  normal: 'Normal', fire: 'Fogo', water: 'Água', grass: 'Planta', electric: 'Elétrico', ice: 'Gelo', fighting: 'Lutador',
  poison: 'Veneno', ground: 'Terra', flying: 'Voador', psychic: 'Psíquico', bug: 'Inseto', rock: 'Pedra', ghost: 'Fantasma',
  dragon: 'Dragão', dark: 'Sombrio', steel: 'Aço', fairy: 'Fada',
};

// tabela oficial (Gen 6+): s = super efetivo (×2), w = pouco efetivo (×½), i = imune (×0)
export const TYPE_CHART = {
  normal: { s: [], w: ['rock', 'steel'], i: ['ghost'] },
  fire: { s: ['grass', 'ice', 'bug', 'steel'], w: ['fire', 'water', 'rock', 'dragon'], i: [] },
  water: { s: ['fire', 'ground', 'rock'], w: ['water', 'grass', 'dragon'], i: [] },
  electric: { s: ['water', 'flying'], w: ['electric', 'grass', 'dragon'], i: ['ground'] },
  grass: { s: ['water', 'ground', 'rock'], w: ['fire', 'grass', 'poison', 'flying', 'bug', 'dragon', 'steel'], i: [] },
  ice: { s: ['grass', 'ground', 'flying', 'dragon'], w: ['fire', 'water', 'ice', 'steel'], i: [] },
  fighting: { s: ['normal', 'ice', 'rock', 'dark', 'steel'], w: ['poison', 'flying', 'psychic', 'bug', 'fairy'], i: ['ghost'] },
  poison: { s: ['grass', 'fairy'], w: ['poison', 'ground', 'rock', 'ghost'], i: ['steel'] },
  ground: { s: ['fire', 'electric', 'poison', 'rock', 'steel'], w: ['grass', 'bug'], i: ['flying'] },
  flying: { s: ['grass', 'fighting', 'bug'], w: ['electric', 'rock', 'steel'], i: [] },
  psychic: { s: ['fighting', 'poison'], w: ['psychic', 'steel'], i: ['dark'] },
  bug: { s: ['grass', 'psychic', 'dark'], w: ['fire', 'fighting', 'poison', 'flying', 'ghost', 'steel', 'fairy'], i: [] },
  rock: { s: ['fire', 'ice', 'flying', 'bug'], w: ['fighting', 'ground', 'steel'], i: [] },
  ghost: { s: ['psychic', 'ghost'], w: ['dark'], i: ['normal'] },
  dragon: { s: ['dragon'], w: ['steel'], i: ['fairy'] },
  dark: { s: ['psychic', 'ghost'], w: ['fighting', 'dark', 'fairy'], i: [] },
  steel: { s: ['ice', 'rock', 'fairy'], w: ['fire', 'water', 'electric', 'steel'], i: [] },
  fairy: { s: ['fighting', 'dragon', 'dark'], w: ['fire', 'poison', 'steel'], i: [] },
};

export const TYPE_COLORS = {
  normal: '#d6d2b8', fire: '#ff7b3a', water: '#4fa3ff', grass: '#6fdc5a', electric: '#ffe14a', ice: '#9ff0ff',
  fighting: '#e0543c', poison: '#c86ee6', ground: '#e3c46d', flying: '#b2a6ff', psychic: '#ff6fa8', bug: '#b8d83a',
  rock: '#c9b25a', ghost: '#9b87e6', dragon: '#8a6cff', dark: '#a07a60', steel: '#c8d0e0', fairy: '#ffb3e6',
};

// multiplicador da tabela oficial (×2, ×½, ×0)
export function typeEff(atk, defs) {
  const c = TYPE_CHART[atk];
  if (!c) return 1;
  let m = 1;
  for (const t of defs) {
    if (c.s.includes(t)) m *= 2;
    else if (c.w.includes(t)) m *= 0.5;
    else if (c.i.includes(t)) m = 0;
  }
  return m;
}
