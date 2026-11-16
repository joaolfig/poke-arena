# Poké Arena

MOBA de 3 lanes (como o Summoner's Rift) com Pokémon. A matemática e os controles seguem o LoL. Os golpes, os avisos no chão e o PeerJS vêm do Poké Realm, e os sprites animados do PMDCollab.

**Jogar:** rode `jogar.bat` (ou `node server.js`) e abra http://localhost:8081. Sem build e sem dependências. Os módulos ES precisam do servidor, não abrem direto do arquivo.

## Jogar online

Abra **https://joaolfig.github.io/poke-arena/**, crie uma sala e passe o código para os amigos (eles abrem o mesmo link e entram com o código). Não precisa instalar nada.

## Controles

O seu campeão só ataca quando você manda (botão direito no alvo ou A + clique), como o LoL com o "ataque automático" desligado: parado, ele não bate sozinho, o que deixa você escolher a hora do último golpe.

O jogo abre em tela cheia ao clicar em jogar. No Chrome e no Edge, para sair segure **Esc** por ~2 s (um toque no Esc só cancela a mira); o botão ⛶ no canto volta para a tela cheia.


| Tecla | Ação | Tecla | Ação |
|---|---|---|---|
| Botão direito | andar / atacar o alvo clicado (segurar continua andando) | A + clique | ataque-mover |
| Q W E R | segure para mirar, solte para lançar | Ctrl + Q/W/E/R ou clique no botão | subir habilidade |
| Mouse sobre o botão da habilidade | mostra a área dela no mapa | | |
| D | Teleporte (Flash) | F | Curar |
| B | voltar à base (8 s) | S | parar |
| 1 a 6 | usar o item do espaço (Sitrus Berry) | Clique no item | usa; na base, vende |
| Arrastar um item | troca de espaço (escolhe a tecla 1-6), no HUD ou na loja | | |
| N | som: tudo / só efeitos / mudo | C (segurar) | mostra o alcance do ataque básico |
| P | loja (na base ou morto) | Tab | placar |
| Y | travar/destravar a câmera (travada, ela se inclina para o lado do mouse) | Espaço | centralizar a câmera |
| Arrastar com o botão esquerdo (ou do meio) | mover o mapa (destrava a câmera) | | |
| Roda do mouse | zoom | Minimapa | esquerdo move a câmera, direito manda andar |

## Evolução

Cada campeão começa no primeiro estágio da linha (ou no bebê, como o Pichu) e evolui ao subir de nível: nos níveis 6 e 11 nas linhas de três estágios, e no 9 nas de dois (Onix, Riolu). No nível 18 vira Mega quando o PMDCollab tem o sprite (Charizard X, Gengar, Alakazam, Steelix, Lucario, Gardevoir). A evolução muda a aparência e o tamanho; os atributos já crescem por nível. As linhas ficam em `EVOS` no fim de `src/data/champions.js`.

## Campeões

18 Pokémon, cada um inspirado num campeão do LoL de mecânica parecida, de onde vêm os atributos base (vida, dano, armadura, velocidade, alcance):

| Pokémon | LoL | Destaques |
|---|---|---|
| Charizard | Brand | queima com as habilidades, Labareda |
| Blastoise | Malphite | Escudo de Impacto, Pulso Original |
| Venusaur | Cassiopeia | Frasco de Veneno, Pó do Sono |
| Raichu | Zeri | Cetro Relampejante (raio que salta), Estática |
| Gengar | Evelynn | Hipnose, Manto Sombrio, Camuflagem |
| Alakazam | Syndra | Prisma Ilusório, Golpe Psíquico |
| Machamp | Sett | Berserk, Punhos de Ferro |
| Steelix | Rammus | Defesa de Ferro com provocação, Robustez |
| Lucario | Fiora | Detectar (apara controle), Hino de Batalha |
| Garchomp | Rek'Sai | Escavar por baixo da terra |
| Dragonite | Pantheon | Voar e cair em qualquer ponto, Multiescala |
| Gardevoir | Soraka | Tomo Sagrado, Santuário |
| Decidueye | Caitlyn | Armadilha da Caçadora, Aljava Pesada |
| Snorlax | Cho'Gath | Bocejo, Descansar, Dynamax |
| Tyranitar | Mordekaiser | Tempestade de Areia, Areia Movediça |
| Gyarados | Olaf | Dança do Dragão (imparável), Intimidação |
| Froslass | Lissandra | gela e congela |
| Zoroark | Shaco | Ilusão: vira um minion do inimigo |

As habilidades misturam os golpes de chefe do Poké Realm, os especiais das classes do herói (Cetro, Manto, Berserk, Armadilha...) e mecânicas únicas (Escavar, Voar, Dynamax, Ilusão). Nenhum golpe se repete entre campeões.

**Status** (como efeitos do LoL): queimadura e veneno (dano por segundo), paralisia (lentidão forte), gelado (3 vezes = congela), sono (acorda ao levar dano) e sonolento (dorme logo depois). Cada campeão tem uma **passiva** inspirada na habilidade do Pokémon (Chama, Estática, Robustez, Multiescala, Intimidação...).

**Avisos como no LoL:** áreas com atraso aparecem para todos; projéteis, avanços e a mira só para quem lança.

## Loja

Itens segurados de Pokémon (nomes em inglês), na escala de preços do LoL. Como no LoL, os completos são feitos de básicos: Choice Band = 2× Muscle Band + Black Sludge, Life Orb = 3× Wise Glasses, Heavy-Duty Boots + 800 = Choice Scarf etc. Ao comprar, os básicos que você tem entram na conta e você paga só a diferença. A loja mostra o preço para você, do que cada item é feito e em quais itens cada básico vira. A Sitrus Berry ocupa um espaço e é usada com as teclas 1-6.

## Builds recomendadas

Botas primeiro, depois os itens na ordem. Na loja (P), a faixa **⭐ Recomendado** mostra o próximo passo (o item ou, se ainda faltar ouro, a próxima peça dele) e compra com um clique. Os bots seguem as mesmas builds.

| Pokémon | Foco | Build (em ordem) |
|---|---|---|
| Charizard | mago de dano: AP e penetração | Air Balloon → Life Orb → Choice Specs → Expert Belt → Big Root → Assault Vest |
| Blastoise | tanque: golpes escalam com vida e armadura | Covert Cloak → Leftovers → Rocky Helmet → Assault Vest → Eviolite → Choice Band |
| Venusaur | dano contínuo: AP, mana e roubo de vida | Air Balloon → Choice Specs → Big Root → Life Orb → Expert Belt → Assault Vest |
| Raichu | atirador: vel. de ataque e crítico | Choice Scarf → Quick Claw → Scope Lens → Punching Glove → Shell Bell → Rocky Helmet |
| Gengar | assassino mágico: AP alto para o combo | Air Balloon → Life Orb → Expert Belt → Choice Specs → Big Root → Eviolite |
| Alakazam | mago de controle: AP e aceleração | Air Balloon → Choice Specs → Life Orb → Expert Belt → Big Root → Assault Vest |
| Machamp | lutador: AD bônus, roubo de vida e defesa | Covert Cloak → Choice Band → Shell Bell → King's Rock → Assault Vest → Eviolite |
| Steelix | tanque: a Rolagem escala com armadura | Covert Cloak → Rocky Helmet → Eviolite → Leftovers → Assault Vest → Choice Band |
| Lucario | duelista: AD bônus e crítico | Choice Scarf → Choice Band → Shell Bell → Punching Glove → Scope Lens → Assault Vest |
| Garchomp | assassino físico: letalidade e AD bônus | Covert Cloak → King's Rock → Choice Band → Punching Glove → Shell Bell → Eviolite |
| Dragonite | lutador: AD bônus | Covert Cloak → Choice Band → King's Rock → Shell Bell → Assault Vest → Eviolite |
| Gardevoir | suporte: AP para cura e escudo, mana e resistência | Clear Amulet → Choice Specs → Big Root → Eviolite → Assault Vest → Life Orb |
| Decidueye | atirador de crítico | Choice Scarf → Scope Lens → Quick Claw → Punching Glove → Shell Bell → Rocky Helmet |
| Snorlax | tanque: golpes escalam com vida | Covert Cloak → Leftovers → Assault Vest → Rocky Helmet → Eviolite → Choice Band |
| Tyranitar | lutador resistente | Covert Cloak → Choice Band → Shell Bell → Leftovers → Assault Vest → Rocky Helmet |
| Gyarados | lutador de vel. de ataque | Choice Scarf → Shell Bell → Choice Band → King's Rock → Assault Vest → Eviolite |
| Froslass | maga: AP e penetração | Air Balloon → Choice Specs → Life Orb → Expert Belt → Big Root → Eviolite |
| Zoroark | assassino: letalidade e crítico | Choice Scarf → King's Rock → Punching Glove → Scope Lens → Choice Band → Assault Vest |

## Mapa

- **3 lanes** (cima, meio e baixo), cada uma com torre externa e interna por time. A interna só leva dano depois que a externa cai, e o nexus só depois que alguma interna cai.
- **Rio** na diagonal, cruzando a lane do meio.
- **Selva** entre as lanes, com paredes, moitas e 12 acampamentos de Pokémon selvagens (Ursaring, Heracross e Murkrow). Abater um monstro dá ouro e XP e recupera 15% da vida. Eles voltam após 2 min e ficam mais fortes com o tempo.
- **Chefes do rio:** Kyogre (perto da lane de cima) e Groudon (perto da de baixo) aparecem aos 5:00 e voltam 5 min depois de derrotados. Quem derrotar ganha 300 de ouro; o resto do time ganha 150, e todo o time recebe +25 de dano de ataque e +40 de poder de habilidade por 2 min.
- **Economia como no Summoner's Rift:** 20,4 de ouro a cada 10 s a partir de 1:05 e nenhum XP passivo (o XP vem de minions, monstros e abates).

## Bots

Cada bot recebe uma função conforme o tamanho do time: 3v3 = cima, meio e baixo; 4v4 ganha um da selva; 5v5 põe dois embaixo. Quem joga fica com o meio, mas pode ir para onde quiser.

Árvore de prioridades, como os bots do LoL: recuar > lutar > comprar > suporte > estruturas > último golpe > esperar na linha de frente. Avaliam o perigo pelo burst disponível (habilidades fora de recarga), ficam atrás da própria onda, só entram na torre inimiga com minions aliados tankando, dão o último golpe pela vida prevista do minion e empurram a lane com mais vontade conforme o tempo passa.

**Teste de balanceamento:** `node tools/balance.js 20 1 > r.jsonl` roda 20 partidas 3x3 de bots com times sorteados; `node tools/balance-report.js r.jsonl` mostra vitórias, abates, CS e dano por minuto de cada campeão.

## Regras (como no LoL)

- **Dano:** físico (AD contra armadura) e mágico (AP contra resistência mágica), com mitigação `100/(100+R)`. A penetração vem em % e depois fixa (letalidade). O crítico causa 175% e usa PRD.
- **Tipos de Pokémon:** só visuais (cor, ícone, efeitos). Não mudam o dano, para não bagunçar o balanceamento.
- **Ataque básico:** tem windup, e andar durante o windup cancela o ataque. Isso permite kiting.
- **Atributos por nível:** fórmula do LoL. Aceleração de habilidade, mana, tenacidade e soft caps de velocidade também.
- **Habilidades:** Q/W/E até rank 5 e R nos níveis 6, 11 e 16. Cada alvo leva o golpe uma vez por lançamento.
- **Torres:** focam quem agride um campeão aliado, e o dano sobe a cada tiro seguido. A interna só toma dano depois que a externa cai, e o nexus depois de uma interna.
- **Minions:** ondas a cada 30 s, com um minion de cerco a cada 3 ondas. Eles também respondem a "chamar ajuda". Cada time sorteia um conjunto temático (nunca o mesmo do outro time); veja `src/data/minionSets.js`.
- **Névoa de guerra:** paredes bloqueiam a visão e as moitas escondem quem está dentro. O host só envia o que o seu time vê.

Os números ficam em `src/config.js`, e as fórmulas explicadas estão em `../matematica-moba.md`.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/config.js` | balanceamento e fórmulas |
| `src/data/` | campeões e habilidades, itens, golpes (copiados de `sigs.js`), tabela de tipos |
| `src/sim/` | simulação autoritativa, roda só no host e não toca no DOM: mapa e grid, A*, visão, atributos, dano e CC, habilidades, unidades, IA de minions/torres, bots, partida |
| `src/net/peer.js` | salas PeerJS (o host simula, os clientes só mandam comandos) |
| `src/client/` | interpolação de snapshots, desenho, sprites do PMDCollab, efeitos, HUD e controles |
| `tools/simtest.js` | partida só de bots sem tela: `node tools/simtest.js 20 5` (minutos, tamanho do time) |

## Rede

O host roda o tick fixo de 30 Hz e manda snapshots a 20 Hz, filtrados pela visão de cada time. O cliente desenha 100 ms no passado, interpolando entre dois snapshots. Se um jogador sai no meio da partida, um bot assume o campeão dele.

Projeto de fã, sem fins comerciais. Pokémon © Nintendo/Game Freak. Sprites animados do [PMDCollab](https://github.com/PMDCollab/SpriteCollab).
