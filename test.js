// node test.js : 40 all-CPU matches at 60 Hz. Checks: no NaN, moths stay in the arena, sparks get grabbed,
// bumps and burns happen, every match ends with one champion within a sane number of rounds.
const S = require('./sim.js');
let fail = 0; const agg = { grab: 0, bump: 0, burn: 0, rounds: 0, winsBy: [0, 0, 0, 0], ties: 0 };
for (let seed = 1; seed <= 40; seed++) {
  const g = S.newGame({ seed, cpuSkill: 0.4 + (seed % 5) * 0.12 });
  let guard = 0;
  while (g.state !== 'matchover' && guard++ < 20) {
    S.startRound(g);
    for (let f = 0; f < 60 * 60 && g.state !== 'roundover' && g.state !== 'matchover'; f++) {
      S.step(g, 1 / 60, [0, 0, 0, 0]);
      for (const m of g.moths) {
        if (!isFinite(m.x + m.y + m.vx + m.vy + m.a)) { console.log('NaN seed', seed); fail++; break; }
        if (Math.hypot(m.x, m.y) > 1.001) { console.log('escaped', seed); fail++; }
      }
      for (const e of g.events) { if (agg[e.type] != null) agg[e.type]++; if (e.type === 'roundover' && e.winners.length > 1) agg.ties++; }
      g.events.length = 0;
    }
    agg.rounds++;
  }
  if (g.state !== 'matchover') { console.log('no champion', seed, g.wins); fail++; } else agg.winsBy[g.matchWinner]++;
}
console.log(JSON.stringify(agg));
const perRound = agg.grab / agg.rounds;
if (perRound < 15) { console.log('too few grabs per round', perRound); fail++; }
if (agg.bump / agg.rounds < 2) { console.log('too few bumps per round'); fail++; }
if (agg.burn / agg.rounds < 0.5) { console.log('too few burns per round'); fail++; }
if (Math.max(...agg.winsBy) > 25) { console.log('seat bias', agg.winsBy); fail++; }
console.log(fail ? 'FAIL ' + fail : 'ALL PASS', 'grabs/round', perRound.toFixed(1), 'bumps/round', (agg.bump / agg.rounds).toFixed(1), 'burns/round', (agg.burn / agg.rounds).toFixed(1), 'rounds/match', (agg.rounds / 40).toFixed(1));
