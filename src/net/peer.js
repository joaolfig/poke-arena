// Rede com PeerJS (WebRTC), como no Poké Realm: topologia estrela, o host é o servidor.
// Diferença importante: agora o host é autoritativo. Os clientes só mandam comandos ("andar até X",
// "lançar Q em Y") e recebem snapshots; ninguém calcula o próprio acerto.

const ROOM_PREFIX = 'pokearena-v1-';
// STUN para atravessar roteadores e um TURN público de reserva para redes mais fechadas
const PEER_OPTS = {
  config: {
    iceServers: [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
      { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
    ],
  },
};

function randCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}

const needPeer = () => { if (typeof Peer === 'undefined') throw new Error('PeerJS não carregou (verifique a internet).'); };

// host: cria a sala. handlers: { onJoin(id), onData(id, msg), onLeave(id) }
export function hostRoom(handlers) {
  return new Promise((res, rej) => {
    try { needPeer(); } catch (e) { rej(e); return; }
    const code = randCode();
    const peer = new Peer(ROOM_PREFIX + code, PEER_OPTS);
    const conns = new Map();
    let opened = false;
    const fail = e => { if (opened) return; try { peer.destroy(); } catch { /* ignora */ } rej(e); };
    peer.on('open', () => {
      opened = true;
      res({
        code, conns,
        send(id, m) { const c = conns.get(id); if (c && c.open) c.send(m); },
        broadcast(m) { for (const c of conns.values()) if (c.open) c.send(m); },
        close() { try { peer.destroy(); } catch { /* ignora */ } },
      });
    });
    peer.on('connection', c => {
      c.on('open', () => { conns.set(c.peer, c); handlers.onJoin(c.peer); });
      c.on('data', m => handlers.onData(c.peer, m));
      const drop = () => { if (conns.delete(c.peer)) handlers.onLeave(c.peer); };
      c.on('close', drop); c.on('error', drop);
    });
    peer.on('error', e => { if (!opened) fail(e); else console.warn('PeerJS:', e); });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch { /* ignora */ } });
    setTimeout(() => fail(new Error('Tempo esgotado ao contatar o servidor do PeerJS. Tente de novo.')), 20000);
  });
}

// cliente: entra numa sala. handlers: { onData(msg), onLost() }
export function joinRoom(code, handlers) {
  return new Promise((res, rej) => {
    try { needPeer(); } catch (e) { rej(e); return; }
    code = code.trim().toUpperCase();
    if (!code) { rej(new Error('Digite o código da sala.')); return; }
    const peer = new Peer(PEER_OPTS);
    let done = false;
    const fail = e => { if (done) return; done = true; try { peer.destroy(); } catch { /* ignora */ } rej(e); };
    peer.on('open', id => {
      const c = peer.connect(ROOM_PREFIX + code, { reliable: true });
      c.on('open', () => {
        if (done) return;
        done = true;
        res({ id, send: m => c.open && c.send(m), close() { try { peer.destroy(); } catch { /* ignora */ } } });
      });
      c.on('data', m => handlers.onData(m));
      c.on('close', () => handlers.onLost());
      c.on('error', () => handlers.onLost());
    });
    peer.on('error', e => fail(e.type === 'peer-unavailable' ? new Error('Sala não encontrada. Confira o código.') : e));
    setTimeout(() => fail(new Error('Não foi possível conectar à sala (tempo esgotado).')), 30000);
  });
}
