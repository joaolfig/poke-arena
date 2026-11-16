// Loja: itens segurados clássicos das batalhas de Pokémon (nomes em inglês, como nos jogos), com atributos e
// preços na escala do LoL. Como no LoL, os itens completos são feitos de básicos (`from`): ao comprar, os básicos
// que você já tem entram na conta e você paga só a diferença. As "botas" são os itens de velocidade.
// Atributos: ad, ap, hp, mp, armor, mr, as (fração: 0.25 = +25%), crit (fração), lethality, armorPenPct,
// magicPen (fixa), magicPenPct, ah (aceleração de habilidade), ms (fixa), msPct, lifesteal, omnivamp,
// hp5, mp5, tenacity. Botas não acumulam (só a primeira conta).
// Preços pelo valor em ouro de cada atributo no LoL (1 AD ≈ 35, 1 AP ≈ 22, 1 vida ≈ 2,7, 1 armadura ≈ 20,
// 1 RM ≈ 18, 1% vel. ataque ≈ 25, 1% crítico ≈ 40): os completos ficam entre ~95% e ~110% do valor.

export const ITEMS = [
  // consumível
  { id: 'baga', nome: 'Sitrus Berry', icon: '🍊', cost: 50, consumable: true, desc: 'Recupera 120 de vida em 5 s (teclas 1-6).' },
  // básicos
  { id: 'faixa', nome: 'Muscle Band', icon: '🎗', cost: 350, stats: { ad: 10 } },
  { id: 'orbe', nome: 'Wise Glasses', icon: '👓', cost: 435, stats: { ap: 20 } },
  { id: 'cinto', nome: 'Black Sludge', icon: '🖤', cost: 400, stats: { hp: 150, hp5: 3 } },
  { id: 'casca', nome: 'Protective Pads', icon: '🧤', cost: 300, stats: { armor: 15 } },
  { id: 'capa', nome: 'Safety Goggles', icon: '🥽', cost: 400, stats: { mr: 25 } },
  { id: 'pena', nome: 'Loaded Dice', icon: '🎲', cost: 300, stats: { as: 0.15 } },
  { id: 'garra', nome: 'Razor Claw', icon: '🪝', cost: 600, stats: { crit: 0.15 } },
  { id: 'sino', nome: 'Soothe Bell', icon: '🛎', cost: 250, stats: { mp5: 6 } },
  { id: 'botas', nome: 'Heavy-Duty Boots', icon: '👢', cost: 300, stats: { ms: 25 }, boots: true },
  // botas avançadas (Heavy-Duty Boots + 800)
  { id: 'botasvel', nome: 'Choice Scarf', icon: '🧣', cost: 1100, stats: { ms: 45, as: 0.25 }, boots: true, from: ['botas'] },
  { id: 'botasmago', nome: 'Air Balloon', icon: '🎈', cost: 1100, stats: { ms: 45, magicPen: 12 }, boots: true, from: ['botas'] },
  { id: 'botasaco', nome: 'Covert Cloak', icon: '🦹', cost: 1100, stats: { ms: 45, armor: 20 }, boots: true, from: ['botas'] },
  { id: 'botasmerc', nome: 'Clear Amulet', icon: '📿', cost: 1100, stats: { ms: 45, mr: 25, tenacity: 0.3 }, boots: true, from: ['botas'] },
  // completos (físico)
  { id: 'faixaescolhida', nome: 'Choice Band', icon: '🥋', cost: 3200, stats: { ad: 60, ah: 20, hp: 300 }, from: ['faixa', 'faixa', 'cinto'] },
  { id: 'lentefoco', nome: 'Scope Lens', icon: '🔍', cost: 3400, stats: { ad: 65, crit: 0.25 }, desc: 'Críticos causam 215% em vez de 175%.', critMult: 0.4, from: ['faixa', 'faixa', 'garra'] },
  { id: 'garrarapida', nome: 'Quick Claw', icon: '🦅', cost: 2600, stats: { as: 0.45, crit: 0.25, msPct: 0.07 }, from: ['pena', 'garra'] },
  { id: 'dentepiercing', nome: "King's Rock", icon: '👑', cost: 3000, stats: { ad: 55, lethality: 18, ah: 15 }, from: ['faixa', 'faixa'] },
  { id: 'garracortante', nome: 'Punching Glove', icon: '🥊', cost: 3000, stats: { ad: 35, armorPenPct: 0.3, crit: 0.25 }, from: ['faixa', 'garra'] },
  { id: 'conchasino', nome: 'Shell Bell', icon: '🔔', cost: 3000, stats: { ad: 50, lifesteal: 0.15, as: 0.2 }, from: ['faixa', 'pena', 'cinto'] },
  // completos (mágico)
  { id: 'oculosescolhidos', nome: 'Choice Specs', icon: '🕶', cost: 3000, stats: { ap: 90, ah: 15, mp: 300, mp5: 8 }, from: ['orbe', 'orbe', 'sino'] },
  { id: 'orbevida', nome: 'Life Orb', icon: '🟠', cost: 3600, stats: { ap: 120 }, desc: '+35% de poder de habilidade.', apMult: 0.35, from: ['orbe', 'orbe', 'orbe'] },
  { id: 'lentesabia', nome: 'Expert Belt', icon: '🎽', cost: 3000, stats: { ap: 80, magicPenPct: 0.4 }, from: ['orbe', 'capa'] },
  { id: 'pocaosombria', nome: 'Big Root', icon: '🌱', cost: 3000, stats: { ap: 75, omnivamp: 0.1, hp: 250, mp5: 6 }, from: ['orbe', 'cinto', 'sino'] },
  // completos (defesa)
  { id: 'coleteassalto', nome: 'Assault Vest', icon: '🦺', cost: 2700, stats: { hp: 350, mr: 70, ah: 10 }, from: ['cinto', 'capa'] },
  { id: 'capacete', nome: 'Rocky Helmet', icon: '⛑', cost: 2700, stats: { hp: 350, armor: 70 }, desc: 'Quem te acerta com ataque básico leva 25 de dano mágico.', thorns: 25, from: ['cinto', 'casca'] },
  { id: 'restos', nome: 'Leftovers', icon: '🍎', cost: 2600, stats: { hp: 800, hp5: 40, ah: 10 }, from: ['cinto', 'cinto'] },
  { id: 'eviolito', nome: 'Eviolite', icon: '💎', cost: 2700, stats: { armor: 45, mr: 45, hp: 300, ah: 10 }, from: ['casca', 'capa'] },
];
export const ITEM_BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));
// sprite do item no repositório de sprites da PokeAPI (o nome em inglês vira o arquivo: "King's Rock" -> kings-rock.png)
for (const it of ITEMS) it.sprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${it.nome.toLowerCase().replace(/'/g, '').replace(/ /g, '-')}.png`;
export const MAX_ITEMS = 6;
// básicos -> itens em que são usados
export const BUILDS_INTO = {};
for (const it of ITEMS) for (const c of new Set(it.from || [])) (BUILDS_INTO[c] = BUILDS_INTO[c] || []).push(it.id);

// preço para quem já tem itens: cada básico da receita que está no inventário é usado e abatido do preço.
// devolve { cost, use: índices do inventário consumidos, slots: espaços ocupados depois da compra }
// (o inventário tem 6 espaços fixos; espaço vazio = null)
export function recipe(inv, id) {
  const it = ITEM_BY_ID[id], use = [];
  let cost = it.cost;
  for (const c of it.from || []) {
    const i = inv.findIndex((x, k) => x === c && !use.includes(k));
    if (i >= 0) { use.push(i); cost -= ITEM_BY_ID[c].cost; }
  }
  return { cost, use, slots: inv.filter(Boolean).length - use.length + 1 };
}

// próximo passo de uma build (lista de itens completos, botas incluídas): o primeiro item que falta; se você ainda
// não tem ouro para ele inteiro, a próxima peça da receita que você não tem. Devolve { target, step } ou null.
export function nextBuildStep(build, inv, gold) {
  const have = inv.filter(Boolean);
  for (const id of build) {
    if (have.includes(id)) continue;
    const it = ITEM_BY_ID[id];
    if (gold >= recipe(inv, id).cost || !it.from) return { target: it, step: it };
    // peças que faltam (contando repetidas: Life Orb = 3 Wise Glasses)
    const spare = [...have];
    for (const c of it.from) {
      const k = spare.indexOf(c);
      if (k >= 0) { spare.splice(k, 1); continue; }
      return { target: it, step: ITEM_BY_ID[c] };
    }
    return { target: it, step: it };
  }
  return null;
}
