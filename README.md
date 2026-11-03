# Moth Party

A one-button party game for 1-4 players on one keyboard or one phone. Chroma Awards S2, Game > Arcade & Party.

Play: https://arnavjhajharia.github.io/moth-party/

- Keys Q / P / Z / M (one per player) or hold your corner of a phone/tablet screen. Hold = fly, release = spin.
- Grab sparks, ram rivals to knock theirs loose, get out when the lamp flickers. 45 s rounds, first to 3.
- Empty seats are CPU moths, so solo play works. CPU skill: sleepy / buzzing / feral.
- `node test.js` simulates 40 all-CPU matches (no NaN, arena bounds, seat balance, event rates).
- `?demo=1` all-CPU attract match; `&record=http://localhost:PORT/x.webm&rw=1920&rh=1080` captures canvas + audio.

All code, art (canvas-drawn) and audio (WebAudio synthesis) are original. No assets downloaded.
