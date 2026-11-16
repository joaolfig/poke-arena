// Sprites animados do PMDCollab (github.com/PMDCollab/SpriteCollab), adaptado do js/pmd.js do Poké Realm.
// Folhas: linhas = 8 direções, colunas = quadros, durações em 1/60 s (AnimData.xml).

// formas Mega (id da PokeAPI -> pasta da forma no PMDCollab), as que já têm sprite lá
const FORMS = { 10034: '0006/0001', 10037: '0065/0001', 10038: '0094/0001', 10051: '0282/0001', 10059: '0448/0001', 10072: '0208/0001', 10049: '0248/0001' };
const URL = (id, arq) => `https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite/${FORMS[id] || String(id).padStart(4, '0')}/${arq}`;
// papel -> animações do PMDCollab, em ordem de preferência
const ROLE = { idle: ['Idle', 'Walk'], walk: ['Walk'], shoot: ['Shoot', 'Charge', 'Attack'], attack: ['Attack', 'Strike', 'Shoot'], hurt: ['Hurt'] };

const data = new Map();   // pid -> dados carregados (ou null se falhou)
const loading = new Map();   // pid -> promessa do carregamento

async function load(pid) {
  const xml = new DOMParser().parseFromString(await (await fetch(URL(pid, 'AnimData.xml'))).text(), 'text/xml');
  const defs = {};
  for (const an of xml.querySelectorAll('Anim')) {
    const t = q => (an.querySelector(q) || {}).textContent;
    defs[t('Name')] = { copia: t('CopyOf'), w: +t('FrameWidth'), h: +t('FrameHeight'), dur: [...an.querySelectorAll('Duration')].map(d => +d.textContent / 60) };
  }
  const real = n => (defs[n] && defs[n].copia) || n;
  const sheets = {}, anims = {}, pick = {};
  for (const [role, names] of Object.entries(ROLE)) {
    const name = names.map(real).find(n => defs[n] && !defs[n].copia && defs[n].dur.length);
    if (!name) continue;
    pick[role] = name;
    // todas as folhas baixam ao mesmo tempo (antes era uma depois da outra)
    sheets[name] = sheets[name] || new Promise((res, rej) => {
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => res(im); im.onerror = rej;
      im.src = URL(pid, name + '-Anim.png');
    });
  }
  for (const [role, name] of Object.entries(pick)) {
    const im = await sheets[name], d = defs[name];
    const cols = Math.max(1, Math.round(im.width / d.w)), rows = Math.max(1, Math.round(im.height / d.h));
    // altura média do corpo de frente (linha 0): é a referência de tamanho
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const px = x.getImageData(0, 0, c.width, c.height).data;
    let sumH = 0, n = 0, bottom = 0;
    for (let cc = 0; cc < cols; cc++) {
      let b0 = 1e9, b1 = -1e9;
      for (let ly = 0; ly < d.h; ly++) for (let lx = 0; lx < d.w; lx++) {
        if (px[(ly * c.width + cc * d.w + lx) * 4 + 3] < 128) continue;
        if (ly < b0) b0 = ly; if (ly > b1) b1 = ly;
      }
      if (b1 >= b0) { sumH += b1 - b0 + 1; bottom += b1; n++; }
    }
    anims[role] = { im, w: d.w, h: d.h, dur: d.dur, total: d.dur.reduce((a, b) => a + b, 0), cols, rows,
      bodyH: n ? sumH / n : d.h / 2, feet: n ? bottom / n + 1 : d.h * 0.75 };
  }
  if (!anims.walk) throw new Error('sem Walk');
  anims.idle = anims.idle || anims.walk;
  anims.attack = anims.attack || anims.shoot;
  anims.shoot = anims.shoot || anims.attack;
  data.set(pid, { anims, refH: anims.idle.bodyH });
}

// começa a carregar (se ainda não carregou) e devolve a promessa de quando estiver pronto
export function ensureSprite(pid) {
  if (!pid || data.has(pid)) return Promise.resolve();
  if (!loading.has(pid)) loading.set(pid, load(pid).catch(e => { console.warn('sprite PMDCollab não carregou:', pid, e); data.set(pid, null); }).finally(() => loading.delete(pid)));
  return loading.get(pid);
}
// carrega antes de precisar: retratos do lobby, minions dos dois times e as evoluções de quem está na partida
export function preloadSprites(pids) { for (const p of new Set(pids)) ensureSprite(p); }
export const spriteReady = pid => !!data.get(pid);

// estado de animação por unidade: { role, t0, until, lastShot, lastHurt }
// ev: { moving, shotN, hurtN, face, melee }
export function spriteFrame(pid, st, ev, now) {
  const D = data.get(pid);
  if (!D) { ensureSprite(pid); return null; }
  if (st.lastShot === undefined) { st.lastShot = ev.shotN; st.lastHurt = ev.hurtN; st.role = 'idle'; st.t0 = now; st.until = 0; }
  if (ev.hurtN !== st.lastHurt) {
    st.lastHurt = ev.hurtN;
    if (D.anims.hurt && st.role !== 'shoot' && st.role !== 'attack' && now - (st.hurtAt || -9) > 1) { st.role = 'hurt'; st.t0 = now; st.until = now + Math.min(0.35, D.anims.hurt.total); st.hurtAt = now; }
  }
  if (ev.shotN !== st.lastShot) {
    st.lastShot = ev.shotN;
    const r = ev.melee ? 'attack' : 'shoot';
    st.role = r; st.t0 = now; st.until = now + Math.min(0.5, D.anims[r].total);
  }
  let role = ev.moving ? 'walk' : 'idle', once = false;
  if (now < st.until) { role = st.role; once = true; }
  else if (role !== st.role) { st.role = role; st.t0 = now; }
  const a = D.anims[role] || D.anims.idle;
  let tt = now - st.t0;
  tt = once ? Math.min(tt * (a.total / Math.max(0.05, st.until - st.t0)), a.total - 1e-3) : tt % a.total;
  let q = 0;
  while (q < a.dur.length - 1 && tt >= a.dur[q]) { tt -= a.dur[q]; q++; }
  // linha da folha: 0 baixo, 1 baixo-dir, 2 dir, 3 cima-dir, 4 cima, 5 cima-esq, 6 esq, 7 baixo-esq
  const ang = ev.face * 180 / Math.PI;
  let row = ((Math.round((90 - ang) / 45) % 8) + 8) % 8;
  if (row >= a.rows) row = 0;
  return { a, q, row, refH: D.refH };
}

// desenha com os pés em (x, y); h = altura do corpo na tela
export function drawSprite(ctx, f, x, y, h, alpha = 1, tint = null) {
  const a = f.a, k = h / f.refH;
  const sw = a.w * k, sh = a.h * k;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tint ? tinted(a.im, tint) : a.im, f.q * a.w, f.row * a.h, a.w, a.h, x - sw / 2, y - a.feet * k, sw, sh);
  ctx.restore();
}

// cópia da folha pintada de uma cor (lampejo branco ao levar dano, silhueta branca na evolução)
function tinted(im, cor) {
  const k = '_t' + cor;
  if (!im[k]) {
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    // cor terminada em '!' pinta por inteiro (silhueta da evolução); sem '!', é o lampejo de dano
    x.globalCompositeOperation = 'source-atop'; x.globalAlpha = cor.endsWith('!') ? 1 : 0.7; x.fillStyle = cor.replace('!', ''); x.fillRect(0, 0, c.width, c.height);
    im[k] = c;
  }
  return im[k];
}

// retrato (primeiro quadro parado de frente) num canvas pequeno, para o HUD e o lobby
export function portrait(pid, size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const paint = () => {
    const D = data.get(pid);
    if (D === undefined) { ensureSprite(pid).then(paint); return; }
    const x = c.getContext('2d');
    x.clearRect(0, 0, size, size);
    if (!D) { x.fillStyle = '#555'; x.beginPath(); x.arc(size / 2, size / 2, size / 3, 0, 7); x.fill(); return; }
    const a = D.anims.idle, k = size * 0.8 / Math.max(a.bodyH, 1);
    x.imageSmoothingEnabled = false;
    x.drawImage(a.im, 0, 0, a.w, a.h, size / 2 - a.w * k / 2, size * 0.92 - a.feet * k, a.w * k, a.h * k);
  };
  paint();
  return c;
}
