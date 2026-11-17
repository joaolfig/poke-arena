// Entrada do jogo: menu, sala (lobby) e a partida. Sozinho e "Criar sala" rodam a simulação aqui
// (este navegador é o host); "Entrar" só envia comandos e desenha os snapshots que chegam.

import { CHAMPIONS, formAt } from './data/champions.js';
import { TICK, SNAP_RATE, TEAM_NAME, SIGHT, GAME, MAPS } from './config.js';
import { Game } from './sim/game.js';
import { setMap } from './sim/map.js';
import { newVision, computeVision } from './sim/vision.js';
import { hostRoom, joinRoom } from './net/peer.js';
import { View } from './client/view.js';
import { Renderer } from './client/render.js';
import { Fx } from './client/fx.js';
import { Hud } from './client/hud.js';
import { Input } from './client/input.js';
import { portrait, preloadSprites } from './client/sprites.js';
import { MINION_SETS } from './data/minionSets.js';
import { sfx, musicTick, cycleSound, soundModeName, fxSound, announce, ARENA_TRACKS } from './client/audio.js';

const $ = id => document.getElementById(id);
const show = (id, v = true) => $(id).classList.toggle('hidden', !v);

// música do menu e da sala até a partida começar (o navegador só libera áudio depois do primeiro clique)
let menuMusic = true;
(function menuLoop(last) {
  const now = performance.now();
  if (menuMusic) { musicTick('menu', (now - last) / 1000); requestAnimationFrame(() => menuLoop(now)); }
})(performance.now());
document.addEventListener('click', ev => { if (ev.target.closest && ev.target.closest('button')) sfx('ui'); }, true);

// tela cheia: liga no primeiro botão do menu (o navegador só deixa depois de um clique). Com o Keyboard Lock
// (Chrome/Edge), o Esc precisa ficar pressionado ~2 s para sair; um toque no Esc só cancela a mira no jogo,
// e atalhos do navegador que batem com Ctrl+Q/W/E/R (subir habilidade) não tiram o teclado do jogo.
async function goFullscreen() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    // trava todas as teclas: Esc vira "segurar para sair" e atalhos do navegador (Ctrl+E/R/W) ficam com o jogo
    if (navigator.keyboard && navigator.keyboard.lock) await navigator.keyboard.lock();
  } catch { /* navegador sem suporte ou o jogador recusou */ }
}
for (const id of ['btn-solo', 'btn-host', 'btn-join', 'btn-full']) $(id).addEventListener('click', goFullscreen);
document.addEventListener('fullscreenchange', () => show('btn-full', !document.fullscreenElement));
const NAME_KEY = 'pokearena_name';

// retratos do lobby começam a baixar assim que a página abre
preloadSprites(CHAMPIONS.map(c => formAt(c, 1).pid));

// o botão direito é o comando principal: o menu do navegador nunca abre (nem sobre o HUD)
document.addEventListener('contextmenu', e => { if (e.target.tagName !== 'INPUT') e.preventDefault(); });

// durante a partida, atalhos do navegador não atrapalham: Ctrl/Alt + qualquer tecla, F1-F10, Backspace,
// zoom (Ctrl+roda), botões voltar/avançar do mouse. Só F11/F12 continuam. Ctrl+W/T/N o navegador só deixa
// bloquear em tela cheia com o Keyboard Lock; fora dela, fechar a aba pede confirmação.
window.addEventListener('keydown', e => {
  if (!started || e.target.tagName === 'INPUT') return;
  if (e.code === 'F11' || e.code === 'F12') return;
  if (e.ctrlKey || e.altKey || e.metaKey || /^F([1-9]|10)$/.test(e.code) || e.code === 'Backspace') e.preventDefault();
}, true);
window.addEventListener('wheel', e => { if (started && e.ctrlKey) e.preventDefault(); }, { passive: false });
for (const ev of ['mousedown', 'mouseup', 'auxclick']) window.addEventListener(ev, e => { if (started && (e.button === 3 || e.button === 4)) e.preventDefault(); }, true);
window.addEventListener('beforeunload', e => { if (started) { e.preventDefault(); e.returnValue = ''; } });

// ---------- estado da sala ----------
const lobby = { size: 3, map: 'rift', players: [], code: '' };   // players: { pid, name, team, champ }; map: chave de MAPS
let mode = 'solo', net = null, myPid = 'host', started = false, paused = false;

function savedName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } }
function saveName(n) { try { localStorage.setItem(NAME_KEY, n); } catch { /* ignora */ } }

function freeChamp() {
  const used = new Set(lobby.players.map(p => p.champ));
  const free = CHAMPIONS.filter(c => !used.has(c.id));
  return (free.length ? free : CHAMPIONS)[Math.floor(Math.random() * (free.length || CHAMPIONS.length))].id;
}
function smallerTeam() {
  const n = t => lobby.players.filter(p => p.team === t).length;
  return n(0) <= n(1) ? 0 : 1;
}

// ---------- menu ----------
$('name').value = savedName();
const myName = () => { const n = ($('name').value.trim() || 'Treinador').slice(0, 16); saveName(n); return n; };
const menuError = e => { $('menu-err').textContent = e ? (e.message || String(e)) : ''; };

$('btn-solo').onclick = () => {
  mode = 'solo'; myPid = 'host';
  lobby.players = [{ pid: 'host', name: myName(), team: 0, champ: CHAMPIONS[0].id }];
  openLobby();
};
$('btn-host').onclick = async () => {
  menuError(); $('btn-host').disabled = true;
  try {
    net = await hostRoom({ onJoin: hostJoin, onData: hostData, onLeave: hostLeave });
    mode = 'host'; myPid = 'host'; lobby.code = net.code;
    lobby.players = [{ pid: 'host', name: myName(), team: 0, champ: CHAMPIONS[0].id }];
    openLobby();
  } catch (e) { menuError(e); }
  $('btn-host').disabled = false;
};
$('btn-join').onclick = async () => {
  menuError(); $('btn-join').disabled = true;
  try {
    net = await joinRoom($('code').value, { onData: clientData, onLost: () => { if (!ended) { show('lost'); } } });
    mode = 'client'; myPid = net.id;
    net.send({ t: 'hello', name: myName() });
    openLobby();
  } catch (e) { menuError(e); }
  $('btn-join').disabled = false;
};

// ---------- lobby ----------
function openLobby() {
  show('menu', false); show('lobby');
  $('lobby-code').textContent = mode === 'host' ? `Código da sala: ${lobby.code}` : mode === 'client' ? 'Na sala de outro jogador' : 'Partida contra bots';
  show('lobby-size-l', mode !== 'client'); show('btn-start', mode !== 'client');
  $('lobby-map').disabled = mode === 'client';   // quem entra vê o mapa, mas só o anfitrião escolhe
  $('lobby-wait').textContent = mode === 'client' ? 'Esperando o anfitrião começar...' : '';
  $('champ-grid').innerHTML = '';
  for (const c of CHAMPIONS) {
    const b = document.createElement('button');
    b.className = 'champ-card'; b.dataset.id = c.id;
    b.append(portrait(formAt(c, 1).pid, 64));
    b.insertAdjacentHTML('beforeend', `<b>${formAt(c, 1).nome}</b><small>${c.funcao}</small>`);
    b.onclick = () => pickChamp(c.id);
    $('champ-grid').append(b);
  }
  paintLobby();
}

function pickChamp(id) {
  if (mode === 'client') { net.send({ t: 'pick', champ: id }); return; }
  lobby.players.find(p => p.pid === myPid).champ = id;
  lobbyChanged();
}
$('btn-team').onclick = () => {
  if (mode === 'client') { net.send({ t: 'team' }); return; }
  const me = lobby.players.find(p => p.pid === myPid);
  me.team = 1 - me.team;
  lobbyChanged();
};
$('lobby-size').onchange = () => { lobby.size = +$('lobby-size').value; lobbyChanged(); };
$('lobby-map').onchange = () => { lobby.map = $('lobby-map').value; lobbyChanged(); };
$('btn-start').onclick = () => startHost();
$('btn-back').onclick = () => location.reload();

function lobbyChanged() { paintLobby(); if (mode === 'host') net.broadcast({ t: 'lobby', lobby }); }

function paintLobby() {
  $('lobby-size').value = lobby.size;
  $('lobby-map').value = lobby.map;
  $('lobby-map').title = MAPS[lobby.map].desc;
  const me = lobby.players.find(p => p.pid === myPid);
  for (const t of [0, 1]) {
    const list = lobby.players.filter(p => p.team === t);
    const rows = list.map(p => `<li class="${p.pid === myPid ? 'me' : ''}">${p.name} — <b>${formAt(CHAMPIONS.find(c => c.id === p.champ), 1).nome}</b></li>`);
    for (let i = list.length; i < lobby.size; i++) rows.push('<li class="bot">🤖 bot</li>');
    $(`team-${t}`).innerHTML = `<h3 class="t${t}">Time ${TEAM_NAME[t]}</h3><ul>${rows.join('')}</ul>`;
  }
  document.querySelectorAll('.champ-card').forEach(b => {
    b.classList.toggle('sel', !!me && b.dataset.id === me.champ);
    b.classList.toggle('taken', lobby.players.some(p => p !== me && p.champ === b.dataset.id && me && p.team === me.team));
  });
  const over = [0, 1].some(t => lobby.players.filter(p => p.team === t).length > lobby.size);
  $('btn-start').disabled = over;
  $('lobby-err').textContent = over ? 'Tem mais jogadores num time do que o tamanho escolhido.' : '';
}

// host: mensagens dos clientes
function hostJoin(id) {
  if (started) { net.send(id, { t: 'full' }); return; }
  lobby.players.push({ pid: id, name: 'Jogador', team: smallerTeam(), champ: freeChamp() });
  lobbyChanged();
}
function hostLeave(id) {
  lobby.players = lobby.players.filter(p => p.pid !== id);
  if (started && game) { const u = game.byPlayer.get(id); if (u) { u.bot = true; u.name += ' (bot)'; } }
  else lobbyChanged();
}
function hostData(id, m) {
  if (!m || typeof m !== 'object') return;
  const p = lobby.players.find(q => q.pid === id);
  if (m.t === 'cmd' && game) { game.command(id, m.m || {}); return; }
  if (!p || started) return;
  if (m.t === 'hello') p.name = String(m.name || 'Jogador').slice(0, 16);
  else if (m.t === 'pick' && CHAMPIONS.some(c => c.id === m.champ)) p.champ = m.champ;
  else if (m.t === 'team') p.team = 1 - p.team;
  lobbyChanged();
}

// cliente: mensagens do host
function clientData(m) {
  if (m.t === 'lobby') { Object.assign(lobby, m.lobby); paintLobby(); }
  else if (m.t === 'full') { $('lobby-wait').textContent = 'A partida já começou nessa sala.'; }
  else if (m.t === 'start') { setMap(m.map || lobby.map); startSession(m.team, m.champ); }
  else if (m.t === 's' && view) view.receive(m);
}

// ---------- partida ----------
let game = null, view = null, ended = false;

function startHost() {
  if (started) return;
  started = true;
  // completa os times com bots, sem repetir campeão no mesmo time
  const players = lobby.players.map(p => ({ ...p, bot: false }));
  for (const t of [0, 1]) {
    const used = new Set(players.filter(p => p.team === t).map(p => p.champ));
    let n = players.filter(p => p.team === t).length, i = 0;
    const pool = CHAMPIONS.filter(c => !used.has(c.id)).sort(() => Math.random() - 0.5);
    while (n < lobby.size) { players.push({ pid: null, name: 'Bot', team: t, champ: pool[i % pool.length].id, bot: true }); i++; n++; }
  }
  setMap(lobby.map);
  game = new Game(players);
  for (const p of lobby.players) if (p.pid !== 'host') net.send(p.pid, { t: 'start', team: p.team, champ: p.champ, map: lobby.map });
  const me = lobby.players.find(p => p.pid === 'host');
  startSession(me.team, me.champ);
  hostLoop();
}

// laço do host: tick fixo de 30 Hz e snapshots a 20 Hz. Um Worker marca o tempo para a partida seguir
// mesmo com a aba em segundo plano (o navegador freia o setInterval das abas escondidas).
function hostLoop() {
  let acc = 0, last = performance.now(), snapAcc = 0, snapN = 0;
  const pump = () => {
    const now = performance.now();
    if (paused) { last = now; return; }   // pausa (só contra bots): o tempo da partida para
    acc += Math.min(0.25, (now - last) / 1000); last = now;
    while (acc >= TICK) {
      game.step(); acc -= TICK; snapAcc += TICK;
      if (snapAcc >= 1 / SNAP_RATE) {
        snapAcc = 0; snapN++;
        const withScore = snapN % 10 === 1;
        for (const p of lobby.players) {
          const s = game.snapshot(p.team, p.pid, withScore);
          if (p.pid === 'host') view.receive(s); else net.send(p.pid, s);
        }
        game.flushEvents();
      }
    }
  };
  const w = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 15)'], { type: 'text/javascript' })));
  w.onmessage = pump;
}

// pausa: só no modo contra bots (ou sala sem outros jogadores), para não parar a partida de ninguém
const canPause = () => mode !== 'client' && lobby.players.length <= 1;
function setPaused(v) {
  paused = v;
  show('pause', v);
  if (v) sfx('ui');
}
$('pause').addEventListener('click', () => setPaused(false));

function startSession(team, champ) {
  started = true;
  menuMusic = false;
  const track = ARENA_TRACKS[Math.floor(Math.random() * ARENA_TRACKS.length)];
  const multi = new Map();   // abates recentes de cada campeão (abate duplo, triplo...)
  let firstBlood = false, saidSpawn30 = false, saidSpawn = false, saidWelcome = false;
  show('lobby', false);
  view = new View();
  const ui = { team, meId: 0, names: new Map(), marker: null, indicator: null, hoverId: 0 };
  const renderer = new Renderer($('game'), $('minimap'));
  const fx = new Fx();
  const send = m => (mode === 'client' ? net.send({ t: 'cmd', m }) : game.command('host', m));
  const hud = new Hud({ send, team, champ, ui });
  const def = CHAMPIONS.find(c => c.id === champ);
  let frame = null;
  window.arena = { get game() { return game; }, view }; // para depurar pelo console do navegador
  const input = new Input({
    canvas: $('game'), mini: $('minimap'), renderer, send, ui,
    getFrame: () => frame, getMe: () => view.me, getChamp: () => def,
    // aviso em cima do seu Pokémon (sem mana, em recarga...), no máximo um a cada 0,6 s
    notify: (() => { let last = 0; return msg => {
      const now = performance.now(), me = frame && frame.units.find(u => u.id === ui.meId);
      if (now - last < 600 || !me) return;
      last = now; fx.text(me.x, me.y - 260, msg, msg === 'Sem mana!' ? '#60a5fa' : '#e5e7eb', 20, 1.1); sfx('ui');
    }; })(),
    onKey: e => {
      // Esc: fecha a loja; se não estiver mirando nada, pausa (só quando ninguém mais está na partida)
      if (e.code === 'Escape' && !e.repeat) {
        if (!$('shop').classList.contains('hidden')) { hud.toggleShop(); return true; }
        if (input.held === null && !input.aMode && canPause()) { setPaused(!paused); return true; }
      }
      if (paused) return true;   // pausado: nenhuma tecla vale até voltar
      if (e.code === 'KeyP') { hud.toggleShop(); return true; }
      if (e.code === 'KeyN') { hud.pushFeed(cycleSound()); return true; }
      if (e.code === 'Tab') { hud.toggleScore(true); return true; }
      return false;
    },
  });
  // o placar fica aberto enquanto segura Tab
  window.addEventListener('keyup', e => { if (e.code === 'Tab') hud.toggleScore(false); });
  window.addEventListener('resize', () => renderer.resize());

  const vis = newVision();
  let lastShot;
  let visT = 0, lastT = performance.now() / 1000;
  const sightOf = u => u.kind === 'champ' ? SIGHT.champion : u.kind === 'tower' ? SIGHT.tower : u.kind === 'nexus' ? 1000 : SIGHT.minion;
  // no placar de abates aparece a forma atual do Pokémon (e o jogador, se não for bot)
  // sons e narrador de cada evento
  const playEvent = (e, u) => {
    const v = u ? (u.id === ui.meId ? 1 : (() => { const d = Math.hypot(u.x - renderer.cam.x, u.y - renderer.cam.y); return d > 2200 ? 0 : Math.max(0.15, 1 - d / 2200); })()) : 1;
    switch (e.k) {
      case 'dmg':
        if (e.id === ui.meId && e.t !== 'd') sfx('hurt', 0.7);
        else if (e.s === ui.meId && e.t !== 'd') sfx(e.c ? 'crit' : 'hit', 0.8);
        break;
      case 'gold': if (e.id === ui.meId) sfx('coin'); break;
      case 'heal': if (e.id === ui.meId) sfx('pot', 0.6); break;
      case 'lvl': if (e.id === ui.meId) sfx('lvl'); break;
      case 'evo': if (v) sfx('evo', v); break;
      case 'cast': if (v) sfx('cast', v * (e.id === ui.meId ? 1 : 0.6)); break;
      case 'burst': { const z = e.z, d = Math.hypot(z[2] - renderer.cam.x, z[3] - renderer.cam.y); if (d < 2200) sfx(fxSound(z[8]), Math.max(0.15, 1 - d / 2200)); break; }
      case 'recall': if (v) sfx('recall', v); break;
      case 'blink': case 'dig': case 'fly': case 'land': if (v) sfx('open', v); break;
      case 'freeze': if (v) sfx('el_ice', v); break;
      case 'kill': {
        const victim = view.sb.find(r => r[0] === e.v), ally = victim && victim[2] === team;
        if (e.v === ui.meId) { sfx('die'); }
        else sfx('kill', 0.8);
        // abates em sequência do mesmo campeão (10 s entre um e outro)
        let streak = 1;
        if (e.by) { const m = multi.get(e.by); streak = m && view.serverTime - m.t < 10 ? m.n + 1 : 1; multi.set(e.by, { n: streak, t: view.serverTime }); }
        const killerAlly = e.bt === team;
        if (!firstBlood && e.by) { firstBlood = true; announce('Primeiro abate!', true); }
        else if (streak >= 3) announce(streak >= 5 ? 'Aniquilação!' : streak === 4 ? 'Abate quádruplo!' : 'Abate triplo!', true);
        else if (streak === 2) announce(killerAlly ? 'Abate duplo!' : 'Abate duplo inimigo!', true);
        else if (e.v === ui.meId) announce('Você foi abatido.');
        else if (e.by === ui.meId) announce('Você abateu um inimigo!');
        else announce(ally ? 'Um aliado foi abatido.' : 'Um inimigo foi abatido.');
        // time inteiro derrotado: "Aniquilação" de time (como o Ace do LoL)
        const foes = view.sb.filter(r => r[2] !== (ally ? team : 1 - team));
        if (victim && view.sb.length > 2 && foes.length && view.sb.filter(r => r[2] === victim[2]).every(r => r[10] > 0 || r[0] === e.v)) announce(ally ? 'Seu time foi derrotado!' : 'Time inimigo derrotado!', true);
        break;
      }
      case 'boss': sfx('lvl'); announce(e.team === team ? `Seu time derrotou ${e.nm}!` : `O time inimigo derrotou ${e.nm}!`); break;
      case 'tower': sfx('boom', v || 0.4); announce(e.team === team ? 'Sua torre foi destruída.' : 'Destruímos uma torre inimiga!'); break;
      case 'end': sfx(e.w === team ? 'win' : 'lose'); announce(e.w === team ? 'Vitória!' : 'Derrota!', true); break;
    }
  };
  const unitName = id => {
    const r = view.sb.find(q => q[0] === id);
    if (!r) return '?';
    const form = formAt(CHAMPIONS[r[1]], r[8]).nome;
    return r[3] === 'Bot' ? form : `${form} (${r[3]})`;
  };

  const loop = () => {
    const now = performance.now() / 1000, dt = Math.min(0.05, now - lastT);
    lastT = now;
    frame = view.frame();
    if (view.me) { ui.meId = view.me.id; ui.myAd = view.me.st.ad; ui.myRange = view.me.st.range + 65; }
    if (view.minionSets && !ui.minionSets) {
      ui.minionSets = view.minionSets; hud.minionSets(view.minionSets);
      // minions dos dois times (os inimigos ainda estão na névoa) e todas as formas dos campeões da partida
      preloadSprites(view.minionSets.flatMap(i => [MINION_SETS[i].melee, MINION_SETS[i].ranged, MINION_SETS[i].siege]));
    }
    if (view.sb.length && !ui.evosLoaded) {
      ui.evosLoaded = true;
      preloadSprites(view.sb.flatMap(r => { const d = CHAMPIONS[r[1]]; return [...d.evo.map(f => f[1]), ...(d.mega ? [d.mega[1]] : [])]; }));
    }
    for (const r of view.sb) ui.names.set(r[0], r[3]);
    const byId = new Map(frame ? frame.units.map(u => [u.id, u]) : []);
    const meUnit = byId.get(ui.meId);
    musicTick(view.winner >= 0 ? 'menu' : track, dt);
    // narrador: boas-vindas e minions (como no LoL)
    const st = view.serverTime;
    if (!saidWelcome && st > 1) { saidWelcome = true; announce('Bem-vindo à Arena Pokémon!'); }
    if (!saidSpawn30 && st > GAME.firstWave - 30 && st < GAME.firstWave) { saidSpawn30 = true; announce('Trinta segundos até os minions aparecerem.'); }
    if (!saidSpawn && st > GAME.firstWave) { saidSpawn = true; announce('Os minions apareceram!'); }
    // eventos da simulação viram efeitos, sons e avisos
    for (const e of view.events) {
      const u = byId.get(e.id);
      playEvent(e, u);
      // impacto do ataque básico no corpo do alvo, vindo da direção de quem bateu
      if (e.k === 'dmg' && e.a && u) {
        const s = byId.get(e.s), hy = u.y - (u.kind === 'champ' ? 85 : u.kind === 'tower' || u.kind === 'nexus' ? 160 : 45);
        fx.impact(u.x, hy, e.a, e.c, s ? Math.atan2(hy - (s.y - 60), u.x - s.x) : Math.PI / 2);
      }
      if (e.k === 'dmg' && u && (e.s === ui.meId || e.id === ui.meId || (u.kind === 'champ' && e.v >= 30))) {
        const col = e.id === ui.meId ? '#f87171' : e.t === 'p' ? '#fb923c' : e.t === 'm' ? '#c4b5fd' : '#ffffff';
        fx.text(u.x + (Math.random() - 0.5) * 60, u.y - 190, e.c ? `${e.v}!` : `${e.v}`, col, e.c ? 30 : e.s === ui.meId ? 22 : 17);
      } else if (e.k === 'heal' && u && u.team === team) fx.text(u.x, u.y - 200, `+${e.v}`, '#4ade80', 18);
      else if (e.k === 'gold' && e.id === ui.meId && u) fx.text(u.x, u.y - 230, `+${e.v} 💰`, '#fde047', 18);
      else if (e.k === 'burst') fx.burst(e.z);
      else if (e.k === 'lvl' && e.id === ui.meId && u) { fx.text(u.x, u.y - 260, `Nível ${e.l}!`, '#fde68a', 26, 1.5); fx.ring(u.x, u.y, 140, '#fde68a', 0.6); }
      else if (e.k === 'evo' && u) {
        fx.ring(u.x, u.y, 180, e.mega ? '#f0abfc' : '#ffffff', 0.9, true); fx.burstColor(u.x, u.y - 80, e.mega ? '#f0abfc' : '#ffffff', 40);
        if (u.team === team) fx.text(u.x, u.y - 300, e.mega ? `🧬 ${e.nm}!` : `Evoluiu para ${e.nm}!`, e.mega ? '#f0abfc' : '#fde68a', e.id === ui.meId ? 28 : 18, 2);
      }
      else if (e.k === 'cast' && u && u.kind === 'champ' && e.nm) fx.text(u.x, u.y - 280, e.nm, u.team === team ? '#93c5fd' : '#fca5a5', 15, 1.1);
      else if (e.k === 'chain') { fx.chain(e.pts); }
      else if (e.k === 'freeze' && u) { fx.text(u.x, u.y - 220, 'Congelado!', '#7dd3fc', 20); fx.burstColor(u.x, u.y - 60, '#e0f2fe', 20); }
      else if (e.k === 'passive' && u) { fx.text(u.x, u.y - 250, e.nm, '#fde68a', 20, 1.4); fx.ring(u.x, u.y, 150, '#fde68a', 0.5); }
      else if (e.k === 'proc' && u) fx.ring(u.x, u.y - 60, 70, '#fef08a', 0.3);
      else if ((e.k === 'dig' || e.k === 'land') && u) { fx.burstColor(u.x, u.y, '#a16207', 26); fx.ring(u.x, u.y, 160, '#d6d3d1', 0.4); }
      else if (e.k === 'fly' && u) { fx.burstColor(u.x, u.y - 40, '#f1f5f9', 26); }
      else if (e.k === 'blink') { fx.burstColor(e.x0, e.y0 - 60, '#e9d5ff', 16); if (u) fx.burstColor(u.x, u.y - 60, '#e9d5ff', 16); }
      else if (e.k === 'buff' && u) fx.ring(u.x, u.y, 110, e.b === 'shield' ? '#e5e7eb' : '#4ade80', 0.5);
      else if (e.k === 'kill' || e.k === 'tower' || e.k === 'boss') {
        hud.event(e, unitName);
        if (e.k === 'kill' && e.v === ui.meId) fx.text(meUnit ? meUnit.x : 0, meUnit ? meUnit.y - 200 : 0, 'Você foi derrotado', '#f87171', 28, 2);
      } else if (e.k === 'end') { ended = true; hud.end(e.w); }
    }
    view.events.length = 0;
    if (view.winner >= 0 && !ended) { ended = true; hud.end(view.winner); }

    if (meUnit) { if (lastShot !== undefined && meUnit.shotN !== lastShot) sfx('shoot', 0.5); lastShot = meUnit.shotN; }
    input.update(dt, now, meUnit);
    // névoa: calculada aqui com as posições dos aliados (mesmo código do host)
    if (frame && now - visT > 0.15) {
      visT = now;
      computeVision(frame.units.filter(u => u.team === team).map(u => ({ x: u.x, y: u.y, sight: sightOf(u) })), vis);
      renderer.paintFog(vis);
    }
    fx.update(dt);
    renderer.draw(frame, ui, fx, now);
    if (view.me) hud.update(view.me, meUnit, view, view.serverTime);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

$('btn-again').onclick = () => location.reload();
