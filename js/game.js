'use strict';
/**
 * Main controller: scaling, the frame loop, pointer input (drag & drop pieces,
 * tap heroes, Field Seal targeting), level start/finish and rewards.
 * Exposes the debug/test hook window.BK.
 */
(() => {
  const canvas = document.getElementById('game');
  const stage = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const W = View.W, H = View.H, B = View.BOARD;

  let scale = 1, dpr = 1, last = 0;

  const Game = {
    state: { screen: 'title', levelId: null, session: null, lastResult: null },

    async init() {
      await GameStorage.init();
      SFX.setEnabled(GameStorage.getSettings().sound);
      resize();
      window.addEventListener('resize', resize);
      bindInput();
      Menu.init();
      Menu.show('title');
      requestAnimationFrame(loop);
    },

    setScreen(name) { this.state.screen = name; },

    /** Start level n (debug/tests may start locked levels). opts.seed makes the run reproducible. */
    startLevel(n, opts = {}) {
      const level = DATA.level(Number(n));
      if (!level) return false;
      const team = GameStorage.getTeam().map(id => ({ id, awaken: GameStorage.getAwaken(id) }));
      const seed = opts.seed != null ? opts.seed : (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
      FX.reset();
      const session = new Session({ level, team, seed, onEvent: (t, d, s) => this.onEvent(t, d, s) });
      this.state.session = session;
      this.state.levelId = level.id;
      this.state.lastResult = null;
      View.attach(session);
      FX.banner(level.boss ? 'BOSS' : level.type === 'puzzle' ? 'PUZZLE' : 'BATTLE', {
        color: level.boss ? '#d07cff' : '#ffffff', size: 30, y: (B.y + B.size / 2) / H - 0.03, life: 2.4, sub: level.tip || level.name,
      });
      Menu.show('play');
      return true;
    },

    onEvent(type, d, s) {
      View.onEvent(type, d, s);
      if (type === 'end') this.finishLevel(s, d);
    },

    finishLevel(s, res) {
      const level = s.level;
      const saved = GameStorage.saveLevelResult(level.id, { stars: res.stars, won: res.won, turns: res.turns });
      let fragments = 0;
      if (res.won) {
        fragments = (saved.firstClear ? 15 + 3 * level.id + (level.boss ? 40 : 0) : 5) + 10 * saved.newStars;
        GameStorage.addFragments(fragments);
      }
      this.state.lastResult = { levelId: level.id, ...res, ...saved, fragments };
      const delay = Math.max(0, View.busyUntil - FX.t) + 1.7;
      FX.after(delay, () => {
        if (this.state.session === s && this.state.screen === 'play') Menu.showResults(this.state.lastResult);
      });
    },

    quitLevel() {
      this.state.session = null;
      View.detach();
      FX.reset();
    },

    snapshot() {
      const st = this.state, s = st.session;
      const base = {
        screen: st.screen, levelId: st.levelId,
        fragments: GameStorage.getFragments(), unlocked: GameStorage.getUnlocked(),
        team: GameStorage.getTeam(), lastResult: st.lastResult,
      };
      if (!s) return base;
      return Object.assign(base, {
        phase: s.phase, turn: s.turn, combo: s.combo, stuck: s.stuck, seed: s.seed,
        hand: s.hand.map(p => {
          const sh = DATA.SHAPE[p.shape];
          return { shape: p.shape, cells: sh.cells.map(c => c.slice()), w: sh.w, h: sh.h, used: p.used, fits: !p.used && s.board.fits(sh) };
        }),
        board: s.board.toArray(),
        party: { hp: s.party.hp, maxHp: s.party.maxHp, shield: s.shield },
        members: s.members.map(m => ({ id: m.id, charge: m.charge, cost: m.cost, ready: s.skillUsable(m) })),
        holds: s.holds,
        enemy: s.enemy ? { name: s.enemy.name, hp: s.enemy.hp, maxHp: s.enemy.maxHp, countdown: s.enemy.countdown, wave: s.waveIndex + 1, waves: s.level.waves.length } : null,
        goal: s.goal ? { kind: s.goal.kind, target: s.goal.target, progress: s.goalProgress(), turnsLeft: s.turnsLeft() } : null,
        result: s.result,
        stats: Object.assign({}, s.stats),
      });
    },
  };

  // ---------------------------------------------------------------- sizing
  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    scale = Math.min(vw / W, vh / H);
    dpr = Math.min(3, window.devicePixelRatio || 1);
    stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
    canvas.width = Math.round(W * scale * dpr);
    canvas.height = Math.round(H * scale * dpr);
  }

  // ---------------------------------------------------------------- loop
  function loop(ts) {
    const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0);
    last = ts;
    const scr = Game.state.screen;
    if (scr !== 'pause') {
      FX.update(dt);
      View.update(dt);
    }
    const k = scale * dpr;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#120d1c';
    ctx.fillRect(0, 0, W, H);
    const s = Game.state.session;
    if (s && (scr === 'play' || scr === 'pause' || scr === 'results')) View.draw(ctx);
    else View.drawIdle(ctx, scr === 'title' ? [] : GameStorage.getTeam()); // title shows portraits instead
    requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------- input
  const inside = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

  function local(e) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }

  function updateDrag(d) {
    const s = Game.state.session;
    const o = View.dragOrigin(d);
    d.c = Math.round((o.x - B.x) / B.cell);
    d.r = Math.round((o.y - B.y) / B.cell);
    d.valid = s.board.canPlace(o.sh, d.r, d.c);
    d.clears = d.valid ? s.board.wouldClear(o.sh, d.r, d.c) : null;
  }

  function bindInput() {
    canvas.addEventListener('pointerdown', e => {
      SFX.unlock();
      const s = Game.state.session;
      if (Game.state.screen !== 'play' || !s) return;
      e.preventDefault();
      const p = local(e);

      if (inside(p, View.pauseRect())) { Menu.show('pause'); return; }
      if (s.over) return;

      for (let i = 0; i < s.members.length; i++) {
        if (!inside(p, View.cardRect(i, s.members.length))) continue;
        const res = s.activateSkill(i);
        if (!res.ok && res.reason === 'not-ready') {
          const m = s.members[i], r = View.cardRect(i, s.members.length);
          FX.text(r.x + r.w / 2, r.y + 10, `Needs ${m.cost - m.charge} more line${m.cost - m.charge > 1 ? 's' : ''}`, { size: 12, color: '#b8acd0', rise: 24, vx: 0 });
        } else if (!res.ok && res.reason === 'needs-combo') {
          const r = View.cardRect(i, s.members.length);
          FX.text(r.x + r.w / 2, r.y + 10, `Needs combo x${res.combo} (now x${s.combo})`, { size: 12, color: '#ff9a3d', rise: 24, vx: 0 });
          SFX.play('bad');
        }
        return;
      }

      if (s.phase === 'target') {
        const cell = View.cellAt(p.x, p.y);
        if (cell) s.targetCell(cell.r, cell.c);
        else View.hover = null;
        return;
      }

      if (p.y >= View.TRAY.y - 16) {
        for (let i = 0; i < 3; i++) {
          if (Math.abs(p.x - View.TRAY.xs[i]) > View.TRAY.w / 2) continue;
          const piece = s.hand[i];
          if (!piece || piece.used) return;
          View.drag = { index: i, x: p.x, y: p.y, t0: FX.t, id: e.pointerId };
          updateDrag(View.drag);
          try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* synthetic events */ }
          SFX.play('pick');
          return;
        }
      }
    });

    canvas.addEventListener('pointermove', e => {
      const s = Game.state.session;
      if (!s || Game.state.screen !== 'play') return;
      const p = local(e);
      const d = View.drag;
      if (d && d.id === e.pointerId) {
        d.x = p.x; d.y = p.y;
        updateDrag(d);
      } else if (s.phase === 'target') {
        View.hover = View.cellAt(p.x, p.y);
      }
    });

    const end = e => {
      const d = View.drag;
      if (!d || d.id !== e.pointerId) return;
      View.drag = null;
      const s = Game.state.session;
      if (!s || e.type === 'pointercancel') return;
      d.x = local(e).x; d.y = local(e).y;
      updateDrag(d);
      if (d.valid) s.place(d.index, d.r, d.c);
      else if (View.cellAt(d.x, d.y - 60)) SFX.play('bad');
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  window.Game = Game;

  // ---------------------------------------------------------------- debug / test hook
  window.BK = {
    get state() { return Game.snapshot(); },
    get session() { return Game.state.session; },
    /** Place hand piece `pieceIndex` with its top-left cell at (row, col). */
    placePiece(pieceIndex, row, col) {
      const s = Game.state.session;
      if (!s || Game.state.screen !== 'play') return { ok: false, reason: 'not-playing' };
      return s.place(pieceIndex, row, col);
    },
    startLevel(n, opts) { return Game.startLevel(n, opts); },
    useSkill(i) {
      const s = Game.state.session;
      return s ? s.activateSkill(i) : { ok: false, reason: 'not-playing' };
    },
    targetCell(r, c) {
      const s = Game.state.session;
      return s ? s.targetCell(r, c) : { ok: false, reason: 'not-playing' };
    },
    show(screen) { Menu.show(screen); },
    storage: window.GameStorage,
    data: window.DATA,
  };

  document.addEventListener('DOMContentLoaded', () => {
    Game.init().catch(err => console.error('[BlockKnights] init failed', err));
  });
})();
