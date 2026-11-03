// Moth Party — pure game simulation (no DOM). Runs in the browser and in Node (test.js).
// Units: arena radius = 1. Time in seconds. step(game, dt, buttons[4]) advances the world and pushes events.
(function (root) {
'use strict';
const C = {
  ARENA: 1, LAMP_R: 0.1, MOTH_R: 0.045, SPARK_R: 0.022,
  SPIN: 4.2,            // rad/s while the button is up
  THRUST: 2.6,          // accel while held
  MAX_V: 0.95, DRAG: 1.35, GRAVITY: 0.16, // the lamp pulls moths in
  ROUND_T: 45, WIN_ROUNDS: 3, MAX_SPARKS: 7,
  FLARE_WARN: 1.3, FLARE_T: 0.9, FLARE_R: 0.36,
  BUMP_V: 0.35,         // relative speed needed for a knock
};
const COLORS = ['#ff7ab6', '#ffd36e', '#6ee7ff', '#9dff8a'];
const NAMES = ['Rose', 'Amber', 'Frost', 'Moss'];
const START_ANG = [-Math.PI * 0.75, -Math.PI * 0.25, Math.PI * 0.75, Math.PI * 0.25];

function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

function newGame(opts = {}) {
  const g = {
    rand: rng(opts.seed || (Date.now() & 0xffffffff)), humans: opts.humans || [false, false, false, false],
    cpuSkill: opts.cpuSkill ?? 0.7, wins: [0, 0, 0, 0], round: 0, state: 'idle', t: 0, events: [], matchWinner: -1,
    moths: [], sparks: [], lamp: { phase: 'calm', t: 0, next: 7 }, countdown: 0,
  };
  for (let i = 0; i < 4; i++) g.moths.push({ i, x: 0, y: 0, vx: 0, vy: 0, a: 0, held: false, carry: 0, stun: 0, flap: 0, ai: { jitter: 0, until: 0 } });
  return g;
}

function startRound(g) {
  g.round++; g.state = 'countdown'; g.countdown = 3; g.t = 0;
  g.sparks.length = 0;
  g.lamp = { phase: 'calm', t: 0, next: 6 + g.rand() * 3 };
  g.moths.forEach((m, i) => {
    const a = START_ANG[i];
    m.x = Math.cos(a) * 0.72; m.y = Math.sin(a) * 0.72; m.vx = m.vy = 0;
    m.a = a + Math.PI; m.carry = 0; m.stun = 0; m.held = false;
  });
  for (let k = 0; k < 5; k++) spawnSpark(g);
  g.events.push({ type: 'round', round: g.round });
}

function spawnSpark(g, x, y, vx = 0, vy = 0) {
  if (x == null) {
    const a = g.rand() * Math.PI * 2, r = 0.22 + Math.sqrt(g.rand()) * 0.66;
    x = Math.cos(a) * r; y = Math.sin(a) * r;
  }
  g.sparks.push({ x, y, vx, vy, age: 0, born: g.t });
}

function cpuButton(g, m) {
  // one-button bot: pick a target; hold while facing it (within a cone), release to spin toward it
  const ai = m.ai, L = g.lamp;
  let tx = 0, ty = 0, best = 1e9;
  const danger = (L.phase === 'warn' || L.phase === 'flare') && Math.hypot(m.x, m.y) < C.FLARE_R + 0.18;
  if (danger) { const d = Math.hypot(m.x, m.y) || 1; tx = m.x / d * 0.8; ty = m.y / d * 0.8; }
  else {
    for (const s of g.sparks) {
      if (L.phase !== 'calm' && Math.hypot(s.x, s.y) < C.FLARE_R + 0.05) continue;
      const d = Math.hypot(s.x - m.x, s.y - m.y); if (d < best) { best = d; tx = s.x; ty = s.y; }
    }
    // hunt a rich rival if one is close and there are no near sparks
    for (const o of g.moths) {
      if (o === m || o.carry < 3) continue;
      const d = Math.hypot(o.x - m.x, o.y - m.y);
      if (d < 0.45 && d * 1.4 < best) { best = d; tx = o.x + o.vx * 0.25; ty = o.y + o.vy * 0.25; }
    }
    if (best === 1e9) { tx = -m.y * 0.6; ty = m.x * 0.6; } // idle orbit
  }
  if (g.t > ai.until) { ai.jitter = (g.rand() - 0.5) * (1 - g.cpuSkill) * 1.4; ai.until = g.t + 0.3 + g.rand() * 0.5; }
  const want = Math.atan2(ty - m.y, tx - m.x) + ai.jitter;
  const diff = Math.atan2(Math.sin(want - m.a), Math.cos(want - m.a));
  return Math.abs(diff) < 0.32 + (1 - g.cpuSkill) * 0.25;
}

function step(g, dt, buttons) {
  if (g.state === 'countdown') {
    const before = Math.ceil(g.countdown);
    g.countdown -= dt;
    if (Math.ceil(g.countdown) !== before && g.countdown > 0) g.events.push({ type: 'tick', n: Math.ceil(g.countdown) });
    if (g.countdown <= 0) { g.state = 'play'; g.events.push({ type: 'go' }); }
    for (const m of g.moths) m.flap += dt * 6;
    return;
  }
  if (g.state !== 'play') return;
  g.t += dt;
  const L = g.lamp;
  // lamp cycle: calm -> warn (telegraph) -> flare -> calm
  L.t += dt;
  if (L.phase === 'calm' && L.t >= L.next) { L.phase = 'warn'; L.t = 0; g.events.push({ type: 'warn' }); }
  else if (L.phase === 'warn' && L.t >= C.FLARE_WARN) { L.phase = 'flare'; L.t = 0; g.events.push({ type: 'flare' }); }
  else if (L.phase === 'flare' && L.t >= C.FLARE_T) { L.phase = 'calm'; L.t = 0; L.next = Math.max(3.5, 7.5 - g.t / 12) + g.rand() * 2.5; }

  for (const m of g.moths) {
    const held = m.stun > 0 ? false : (g.humans[m.i] ? !!buttons[m.i] : cpuButton(g, m));
    if (held && !m.held) g.events.push({ type: 'thrust', i: m.i });
    m.held = held;
    m.stun = Math.max(0, m.stun - dt);
    if (held) { m.vx += Math.cos(m.a) * C.THRUST * dt; m.vy += Math.sin(m.a) * C.THRUST * dt; m.flap += dt * 22; }
    else { m.a += C.SPIN * dt * (m.stun > 0 ? 2.2 : 1); m.flap += dt * 7; }
    const r = Math.hypot(m.x, m.y) || 1e-6;
    m.vx -= m.x / r * C.GRAVITY * dt; m.vy -= m.y / r * C.GRAVITY * dt;
    const drag = Math.exp(-C.DRAG * dt); m.vx *= drag; m.vy *= drag;
    const sp = Math.hypot(m.vx, m.vy); if (sp > C.MAX_V) { m.vx *= C.MAX_V / sp; m.vy *= C.MAX_V / sp; }
    m.x += m.vx * dt; m.y += m.vy * dt;
    // arena wall: bounce
    const rr = Math.hypot(m.x, m.y), lim = C.ARENA - C.MOTH_R;
    if (rr > lim) {
      const nx = m.x / rr, ny = m.y / rr, vn = m.vx * nx + m.vy * ny;
      m.x = nx * lim; m.y = ny * lim;
      if (vn > 0) { m.vx -= 1.7 * vn * nx; m.vy -= 1.7 * vn * ny; if (vn > 0.3) g.events.push({ type: 'wall', i: m.i, v: vn }); }
    }
    // lamp body: solid core
    const lr = Math.hypot(m.x, m.y), core = C.LAMP_R + C.MOTH_R;
    if (lr < core) {
      const nx = m.x / (lr || 1e-6), ny = m.y / (lr || 1e-6), vn = m.vx * nx + m.vy * ny;
      m.x = nx * core; m.y = ny * core; if (vn < 0) { m.vx -= 1.6 * vn * nx; m.vy -= 1.6 * vn * ny; }
    }
    // flare burn
    if (L.phase === 'flare' && lr < C.FLARE_R && m.stun <= 0) {
      const lost = Math.ceil(m.carry / 2);
      drop(g, m, lost, 0.7);
      const nx = m.x / (lr || 1e-6), ny = m.y / (lr || 1e-6);
      m.vx += nx * 1.1; m.vy += ny * 1.1; m.stun = 0.8;
      g.events.push({ type: 'burn', i: m.i, lost });
    }
  }
  // moth vs moth
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
    const A = g.moths[a], B = g.moths[b];
    const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy), min = C.MOTH_R * 2;
    if (d >= min || d === 0) continue;
    const nx = dx / d, ny = dy / d, push = (min - d) / 2;
    A.x -= nx * push; A.y -= ny * push; B.x += nx * push; B.y += ny * push;
    const va = A.vx * nx + A.vy * ny, vb = B.vx * nx + B.vy * ny, rel = va - vb;
    if (rel <= 0) continue;
    // elastic swap along the normal, a little bouncier for fun
    const k = rel * 1.15;
    A.vx -= k * nx; A.vy -= k * ny; B.vx += k * nx; B.vy += k * ny;
    if (rel > C.BUMP_V) {
      // the one moving INTO the hit (bigger normal speed) is the hitter; the other gets knocked
      const hitter = va > -vb ? A : B, victim = hitter === A ? B : A;
      const lost = victim.carry > 0 ? Math.max(1, Math.ceil(victim.carry / 3)) : 0;
      drop(g, victim, lost, 0.55);
      victim.stun = 0.45;
      g.events.push({ type: 'bump', hitter: hitter.i, victim: victim.i, lost, v: rel, x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 });
    }
  }
  // sparks
  for (let s = g.sparks.length - 1; s >= 0; s--) {
    const sp = g.sparks[s];
    sp.age += dt;
    sp.x += sp.vx * dt; sp.y += sp.vy * dt; const dr = Math.exp(-3 * dt); sp.vx *= dr; sp.vy *= dr;
    const r = Math.hypot(sp.x, sp.y);
    if (r > 0.95) { sp.x *= 0.95 / r; sp.y *= 0.95 / r; sp.vx *= -0.5; sp.vy *= -0.5; }
    if (r < C.LAMP_R + 0.03) { sp.x *= (C.LAMP_R + 0.03) / (r || 1e-6); sp.y *= (C.LAMP_R + 0.03) / (r || 1e-6); }
    if (sp.age < 0.35) continue; // freshly dropped sparks can't be re-grabbed instantly
    for (const m of g.moths) {
      if (m.stun > 0) continue;
      if (Math.hypot(sp.x - m.x, sp.y - m.y) < C.MOTH_R + C.SPARK_R + 0.012) {
        m.carry++; g.sparks.splice(s, 1);
        g.events.push({ type: 'grab', i: m.i, carry: m.carry, x: sp.x, y: sp.y });
        break;
      }
    }
  }
  const field = g.sparks.length;
  if (field < C.MAX_SPARKS && g.rand() < dt * (field < 3 ? 3 : 0.9)) spawnSpark(g);

  if (g.t >= C.ROUND_T) endRound(g);
}

function drop(g, m, n, speed) {
  n = Math.min(n, m.carry); m.carry -= n;
  for (let k = 0; k < n; k++) {
    const a = g.rand() * Math.PI * 2, v = speed * (0.5 + g.rand());
    spawnSpark(g, m.x, m.y, Math.cos(a) * v + m.vx * 0.3, Math.sin(a) * v + m.vy * 0.3);
  }
}

function leaders(g) {
  const top = Math.max(...g.moths.map(m => m.carry));
  return g.moths.filter(m => m.carry === top).map(m => m.i);
}

function endRound(g) {
  const lead = leaders(g);
  // ties: everyone tied for the lead with >0 sparks scores (party-friendly); nobody scores on an all-zero round
  const winners = g.moths[lead[0]].carry > 0 ? lead : [];
  winners.forEach(i => g.wins[i]++);
  g.state = 'roundover';
  const champ = g.wins.findIndex(w => w >= C.WIN_ROUNDS);
  const top = Math.max(...g.wins), champs = g.wins.map((w, i) => w === top ? i : -1).filter(i => i >= 0);
  if (champ >= 0 && champs.length === 1) { g.matchWinner = champ; g.state = 'matchover'; }
  g.events.push({ type: 'roundover', winners, wins: g.wins.slice(), match: g.matchWinner });
}

const MothSim = { C, COLORS, NAMES, newGame, startRound, step, leaders };
if (typeof module !== 'undefined') module.exports = MothSim; else root.MothSim = MothSim;
})(typeof window !== 'undefined' ? window : globalThis);
