// Números de balanceamento num lugar só, na escala do LoL (fórmulas em ../matematica-moba.md).
// Unidades de distância também seguem o LoL: alcance corpo a corpo 125, à distância 550, MS ~335.

export const TICK = 1 / 30;            // simulação do host: 30 ticks por segundo (como o servidor do LoL)
export const SNAP_RATE = 30;           // snapshots por segundo para cada time (um por tick)
export const INTERP_DELAY = 0.07;      // atraso de interpolação no cliente (s): pouco mais de 2 snapshots

export const MAP = {
  size: 10800,                         // quadrado de 10800 × 10800: lane do meio ~11000, as dos lados ~16000
  cell: 60,                            // célula do grid de navegação
};

export const TEAM_NAME = ['Azul', 'Vermelho'];
export const TEAM_COLOR = ['#3b82f6', '#ef4444'];

export const GAME = {
  maxLevel: 18,
  startGold: 500,                      // como no LoL (o jogo tem menos itens para montar, então não precisa do ouro do ARAM)
  goldPerSec: 2.04,                    // ouro passivo (começa em 1:05): 20,4 a cada 10 s, como no Summoner's Rift
  passiveGoldAt: 65,
  xpPerSec: 0,                         // sem XP passivo (como no Summoner's Rift): o XP vem dos minions, monstros e abates
  waveEvery: 30,                       // uma onda de minions a cada 30 s
  firstWave: 15,
  xpRange: 1400,                       // XP é dividido entre campeões aliados dentro deste raio
  fountainRadius: 900,
  fountainHealPct: 0.08,               // da vida e da mana máximas por segundo
  recallTime: 8,
  campRespawn: 120,                    // acampamentos da selva (2 min, como no LoL)
  bossFirst: 300,                      // primeira aparição dos chefes (5:00)
  bossRespawn: 300,                    // chefes do rio (Kyogre e Groudon)
  shopRadius: 1100,                    // só compra perto da fonte (ou morto)
};

// XP para passar do nível n para n+1 (curva do LoL: 280, 380, 480...)
export const xpToNext = n => 180 + 100 * n;

// crescimento de atributo por nível (fórmula do LoL)
export const growth = (base, g, lvl) => base + g * (lvl - 1) * (0.7025 + 0.0175 * (lvl - 1));

// XP por abater um campeão, pelo nível da vítima (tabela do LoL); dividido entre quem matou e quem ajudou por perto
export const KILL_XP = [0, 42, 114, 144, 174, 204, 234, 308, 392, 486, 590, 640, 690, 740, 790, 840, 890, 940, 990];

// tempo de renascimento (aproximação da tabela do LoL)
export const respawnTime = lvl => [0, 6, 6, 8, 8, 10, 12, 16, 21, 26, 28.5, 30, 32.5, 35, 37.5, 40, 42.5, 45, 47.5][lvl] || 47.5;

// mitigação por armadura (dano físico) ou resistência mágica (dano mágico)
export const mitigation = R => R >= 0 ? 100 / (100 + R) : 2 - 100 / (100 - R);

// cooldown com aceleração de habilidade (ability haste)
export const hasteCd = (cd, ah) => cd * 100 / (100 + ah);

// soft caps de velocidade de movimento
export function softCapMS(ms) {
  if (ms > 490) return ms * 0.5 + 230;
  if (ms > 415) return ms * 0.8 + 83;
  if (ms < 220) return ms * 0.5 + 110;
  return ms;
}

// avisos dos golpes: os chefes do Poké Realm avisam por ~1 a 2 s; campeões precisam ser bem mais rápidos
export const warnTime = d => Math.max(0.1, 0.3 + (d - 0.95) * 0.35);

// golpes que andam: no Poké Realm iam a 150-400/s; aqui, na velocidade de skillshot do LoL (mesma distância)
export const MOVER_SPEED = { mult: 3.5, min: 1000, max: 1500 };

// áreas de acerto: os golpes do Poké Realm eram finos para chefes enormes; aqui ficam na faixa dos skillshots
// do LoL (60-140 de largura, mais o raio do alvo). O desenho no chão usa os mesmos valores.
export const HITBOX = { lineMult: 1.3, lineMin: 90, moverMult: 1.4, moverMin: 50, circleMult: 1.2, circleMin: 75 };
export function widenPiece(p) {
  if (p.s === 'l') return { ...p, w: Math.max(HITBOX.lineMin, p.w * HITBOX.lineMult) };
  if (p.s === 'm') return { ...p, r: Math.max(HITBOX.moverMin, p.r * HITBOX.moverMult) };
  if (p.s === 'c') return { ...p, r: Math.max(HITBOX.circleMin, p.r * HITBOX.circleMult) };
  return p;
}

export const CRIT_MULT = 1.75;
export const AS_CAP = 2.5;

export const TOWER = {
  range: 750, dmg: 170, dmgPerMin: 4, attackTime: 0.83,
  rampPerShot: 0.4, rampMax: 1.2,      // +40% por tiro seguido no mesmo campeão, até +120%
  hp: [5000, 3600],                    // externa, interna (a externa aguenta mais no começo)
  armor: 40, mr: 40, radius: 88,
  minionDmgPct: { melee: 0.45, ranged: 0.7, siege: 0.14 }, // fração da vida do minion por tiro de torre
  nexusHp: 5500,
};

export const MINION = {
  melee: { pid: 19, hp: 477, ad: 12, armor: 0, mr: 0, range: 110, as: 1.25, windup: 0.25, ms: 325, radius: 48, gold: 21, xp: 61, sight: 1200 },
  ranged: { pid: 81, hp: 296, ad: 23, armor: 0, mr: 0, range: 550, as: 0.667, windup: 0.3, ms: 325, radius: 48, gold: 14, xp: 30, sight: 1200, missile: 650 },
  siege: { pid: 76, hp: 912, ad: 41, armor: 15, mr: 0, range: 300, as: 1, windup: 0.3, ms: 325, radius: 65, gold: 60, xp: 93, sight: 1200, missile: 1200 },
  siegeEvery: 3,                       // um minion de cerco (Golem) a cada 3 ondas
  hpPerWave: 0.012, adPerWave: 0.02,   // minions ficam mais fortes com o tempo
  aggroRange: 700,
  callForHelp: 900,                    // atacam o campeão que agredir um campeão aliado perto
};

export const SIGHT = { champion: 1350, tower: 1350, minion: 1200, monster: 500 };

export const SUMMONERS = {
  flash: { nome: 'Teleporte (Flash)', range: 400, cd: 300 },
  heal: { nome: 'Curar', cd: 240, base: 80, perLvl: 15, ms: 0.3, msDur: 1 },
};
