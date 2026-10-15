'use strict';
/**
 * Everything drawn on the canvas during play: HUD, battle scene, hero cards, board,
 * tray, the dragged piece. Also turns Session events into juice (lunges, flashes,
 * numbers, shake) on its own clock, so the logic can resolve instantly.
 */
(() => {
  const W = 390, H = 844;
  const BOARD = { x: 27, y: 380, cell: 42, n: 8 };
  BOARD.size = BOARD.cell * BOARD.n;
  const TRAY = { y: 724, cy: 784, cell: 20, xs: [65, 195, 325], w: 126 };
  const CARDS = { y: 296, h: 72 };
  const SIGNAL = '#ffd34d'; // the one "tap this" colour
  const PARTY_POS = [{ x: 66, y: 250 }, { x: 116, y: 238 }, { x: 166, y: 256 }];
  const PARTY_POS2 = [{ x: 82, y: 246 }, { x: 146, y: 254 }];
  const ENEMY_POS = { x: 296, y: 254 };

  // ---------------------------------------------------------------- colour helpers
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = v => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
    const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }
  const shadeCache = {};
  function shades(hex) {
    if (!shadeCache[hex]) shadeCache[hex] = { hi: shade(hex, 0.35), lo: shade(hex, -0.35), shine: shade(hex, 0.7) };
    return shadeCache[hex];
  }

  function block(ctx, x, y, s, color, alpha = 1) {
    const sh = shades(color), b = Math.max(2, Math.round(s * 0.12));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = sh.lo; ctx.fillRect(x, y, s, s);
    ctx.fillStyle = color; ctx.fillRect(x, y, s - b, s - b);
    ctx.fillStyle = sh.hi; ctx.fillRect(x, y, s - b, b); ctx.fillRect(x, y, b, s - b);
    ctx.fillStyle = sh.shine; ctx.fillRect(x + b, y + b, b, b);
    ctx.globalAlpha = 1;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function text(ctx, str, x, y, { size = 14, color = '#fff', align = 'left', weight = 700, stroke = true } = {}) {
    ctx.font = `${weight} ${size}px ${FX.FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    if (stroke) { ctx.lineWidth = 3; ctx.strokeStyle = '#1a1020'; ctx.strokeText(str, x, y); }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  // ---------------------------------------------------------------- view state
  const bar = () => ({ shown: 0, ghost: 0, target: 0, max: 1, ghostWait: 0, flash: 0, kick: 0 });

  const View = {
    W, H, BOARD, TRAY, CARDS, SIGNAL,
    session: null,
    enemy: null,          // { art, name, element, boss, lunge, flash, kick, spawn, pop, dead }
    enemyBar: bar(),
    partyBar: bar(),
    members: [],
    cellFx: new Map(),
    busyUntil: 0,
    dealT: -10,
    drag: null,           // { index, x, y, t0, r, c, valid, clears }
    hover: null,          // { r, c } while targeting
    punch: null,          // { t, amp } board squash after a clear
    holdT: -10,           // last change to Neris' holds (pip pulse)
    idleTeam: [],

    // ---------------------------------------------------------- layout
    partyPos(i, n) { return (n === 2 ? PARTY_POS2 : PARTY_POS)[i]; },
    cardRect(i, n) {
      const gap = 6, w = (W - 16 - gap * (n - 1)) / n;
      return { x: 8 + i * (w + gap), y: CARDS.y, w, h: CARDS.h };
    },
    pauseRect() { return { x: 6, y: 6, w: 44, h: 34 }; },
    /** Pixel position of the dragged piece's top-left. */
    dragOrigin(d) {
      const sh = DATA.SHAPE[this.session.hand[d.index].shape];
      return { x: d.x - (sh.w * BOARD.cell) / 2, y: d.y - sh.h * BOARD.cell - 56, sh };
    },
    cellAt(x, y) {
      const c = Math.floor((x - BOARD.x) / BOARD.cell), r = Math.floor((y - BOARD.y) / BOARD.cell);
      return r >= 0 && c >= 0 && r < BOARD.n && c < BOARD.n ? { r, c } : null;
    },
    cellCenter(r, c) { return { x: BOARD.x + c * BOARD.cell + BOARD.cell / 2, y: BOARD.y + r * BOARD.cell + BOARD.cell / 2 }; },

    // ---------------------------------------------------------- lifecycle
    attach(session) {
      this.session = session;
      this.cellFx.clear();
      this.busyUntil = FX.t;
      this.dealT = FX.t;
      this.drag = null;
      this.hover = null;
      this.punch = null;
      this.holdT = -10;
      this.members = session.members.map(() => ({ lunge: -10, flash: 0, ready: 0 }));
      const pb = this.partyBar;
      Object.assign(pb, bar(), { shown: session.party.hp, ghost: session.party.hp, target: session.party.hp, max: session.party.maxHp });
      if (session.enemy) this.setEnemy(session.enemy, false);
      else this.enemy = { art: 'seal', name: 'Rune Seal', lunge: -10, flash: 0, kick: -10, spawn: FX.t, pop: 0, dead: false };
    },
    detach() { this.session = null; this.drag = null; },

    setEnemy(e, animate) {
      this.enemy = {
        art: e.def.art, name: e.name, element: e.element, boss: !!e.def.boss,
        lunge: -10, flash: 0, kick: -10, spawn: animate ? FX.t : -10, pop: 0, dead: false,
      };
      Object.assign(this.enemyBar, bar(), { shown: e.maxHp, ghost: e.maxHp, target: e.maxHp, max: e.maxHp });
    },

    /** Reserve `dur` seconds on the animation timeline; returns the delay until our slot. */
    slot(dur) {
      // capped so very fast play overlaps animations instead of lagging behind the logic
      const start = U.clamp(this.busyUntil - FX.t, 0, 0.8);
      this.busyUntil = FX.t + start + dur;
      return start;
    },

    hitBar(b, value) {
      b.target = value;
      b.flash = FX.t + 0.07;
      b.kick = FX.t;
      b.ghostWait = FX.t + 0.4;
    },

    enemyCenter() {
      const e = this.enemy;
      const s = Sprites.enemy(e.art), k = Sprites.enemyScale(e.art);
      return { x: ENEMY_POS.x, y: ENEMY_POS.y - (s.h * k) / 2 };
    },
    partyCenter(i) {
      const n = this.members.length;
      if (i == null) return { x: 116, y: 210 };
      const p = this.partyPos(i, n);
      return { x: p.x, y: p.y - 36 };
    },

    // ---------------------------------------------------------- session events -> juice
    onEvent(type, d, s) {
      if (s !== this.session) return;
      const now = FX.t;
      switch (type) {
        case 'place': {
          for (const [r, c] of d.cells) {
            this.cellFx.set(r * 8 + c, { kind: 'place', t: now });
            const p = this.cellCenter(r, c);
            FX.burst(p.x, p.y + 14, '#cfc6e0', 2, { speed: 60, size: 3, life: 0.3, grav: 200 });
          }
          FX.fadeBanners();
          SFX.play('place');
          break;
        }
        case 'clear': {
          const color = DATA.PIECE_COLORS;
          const heat = Math.min(4, d.combo - 1); // more of everything as the combo climbs
          let sx = 0, sy = 0;
          for (const cell of d.cells) {
            this.cellFx.set(cell.r * 8 + cell.c, { kind: 'clear', t: now, color: color[cell.color] });
            const p = this.cellCenter(cell.r, cell.c);
            sx += p.x; sy += p.y;
            FX.burst(p.x, p.y, color[cell.color], 3 + heat, { speed: 200 + 30 * heat, size: 5, life: 0.7 });
            FX.burst(p.x, p.y, '#ffffff', 2, { speed: 140, size: 3, life: 0.4 });
          }
          for (const cell of d.purified) {
            this.cellFx.set(cell.r * 8 + cell.c, { kind: 'purify', t: now });
            const p = this.cellCenter(cell.r, cell.c);
            FX.burst(p.x, p.y, '#e8d0ff', 6, { speed: 140, size: 3, life: 0.8, grav: -60 });
          }
          for (const r of d.rows) FX.streak(BOARD.x + BOARD.size / 2, this.cellCenter(r, 0).y, BOARD.size, BOARD.cell, '#ffffff');
          for (const c of d.cols) FX.streak(this.cellCenter(0, c).x, BOARD.y + BOARD.size / 2, BOARD.cell, BOARD.size, '#ffffff');
          if (d.cells.length) {
            const n = d.cells.length;
            FX.ring(sx / n, sy / n, d.combo >= 2 ? '#ff9a3d' : '#ffffff', { r1: 60 + 30 * d.lines + 12 * heat, width: 4 + d.lines });
          }
          // board squash: amplitude grows with lines and combo, settles in ~0.4s
          this.punch = { t: now, amp: Math.min(0.07, 0.022 + 0.01 * d.lines + 0.006 * heat) };
          FX.addShake(Math.min(10, 2 + 1.5 * d.lines + heat));
          FX.stop(0.035 + 0.015 * d.lines);
          SFX.play('clear', d.lines, d.combo);
          const mid = BOARD.y + BOARD.size / 2;
          if (d.lines >= 2) {
            const words = ['', '', 'DOUBLE!', 'TRIPLE!', 'RUNE STORM!'];
            FX.banner(words[Math.min(4, d.lines)], { color: '#7fe6ff', size: 36, y: mid / H, life: 0.9 });
          }
          if (d.combo >= 2) {
            FX.text(W / 2, mid + (d.lines >= 2 ? 40 : 0), `COMBO x${d.combo}!`,
              { color: d.combo >= 4 ? '#ff5a3d' : '#ff9a3d', size: 24 + Math.min(16, d.combo * 3), rise: 46, vx: 0, life: 1.1, bounce: 4 });
          }
          break;
        }
        case 'attack': {
          const per = 0.13;
          const start = this.slot(0.12 + d.hits.length * per + (d.killed ? 0.5 : 0.1));
          d.hits.forEach((h, k) => {
            const t0 = start + 0.08 + k * per;
            FX.after(t0, () => { if (this.members[h.member]) this.members[h.member].lunge = FX.t; });
            FX.after(t0 + 0.09, () => this.impact(h));
          });
          if (d.killed) {
            FX.after(start + 0.12 + d.hits.length * per + 0.2, () => {
              const e = this.enemy;
              if (!e) return;
              e.dead = true; e.pop = FX.t;
              const c = this.enemyCenter();
              const el = e.element ? DATA.ELEMENTS[e.element].color : '#ffffff';
              FX.burst(c.x, c.y, el, 30, { speed: 280, size: 6, life: 0.9 });
              FX.burst(c.x, c.y, '#ffffff', 14, { speed: 200, size: 4, life: 0.5 });
              FX.addShake(12);
              FX.stop(0.08);
              SFX.play('pop');
            });
          }
          break;
        }
        case 'wave': {
          if (d.index === 0) { this.setEnemy(d.enemy, true); break; }
          const enemy = d.enemy;
          const start = this.slot(0.9);
          FX.after(start + 0.3, () => {
            this.setEnemy(enemy, true);
            FX.banner(`WAVE ${d.index + 1}/${d.total}`, { color: '#ffffff', size: 30, y: 0.2, life: 1.1 });
          });
          break;
        }
        case 'enemyAttack': {
          const start = this.slot(0.55);
          FX.after(start, () => { if (this.enemy) this.enemy.lunge = FX.t; });
          FX.after(start + 0.14, () => {
            const pc = this.partyCenter();
            if (d.blocked) {
              const col = d.brace ? '#fff1a8' : '#7fc8ff';
              FX.text(pc.x, pc.y - 20, d.brace ? 'BRACED' : 'BLOCKED', { color: col, size: 24 });
              FX.burst(pc.x + 40, pc.y, col, 18, { speed: 220, dir: Math.PI, spread: 1.6, size: 5 });
              FX.addShake(4);
              SFX.play('block');
              return;
            }
            this.hitBar(this.partyBar, d.hp);
            this.members.forEach(m => { m.flash = FX.t + 0.1; });
            FX.text(pc.x, pc.y - 20, `-${d.dmg}`, { color: '#ff5a5a', size: 26 + Math.min(14, d.dmg / 2) });
            FX.burst(pc.x + 30, pc.y, '#ff5a5a', 14, { speed: 220, dir: Math.PI, spread: 1.4, size: 5 });
            FX.addShake(10);
            FX.stop(0.07);
            SFX.play('hurt');
          });
          break;
        }
        case 'heal': {
          const start = this.slot(0);
          FX.after(start, () => {
            this.partyBar.target = d.hp;
            const pc = this.partyCenter();
            FX.text(pc.x, pc.y - 30, `+${d.amount}`, { color: '#7dff8a', size: 20 });
            FX.burst(pc.x, pc.y, '#7dff8a', 10, { speed: 90, size: 3, grav: -120 });
          });
          break;
        }
        case 'corrupt': {
          const start = U.clamp(this.busyUntil - FX.t, 0, 0.8);
          for (const cell of d.cells) {
            this.cellFx.set(cell.r * 8 + cell.c, { kind: 'corrupt', t: now + start });
            const p = this.cellCenter(cell.r, cell.c);
            FX.after(start, () => FX.burst(p.x, p.y, '#b04aff', 8, { speed: 100, size: 4, grav: -50 }));
          }
          FX.after(start, () => SFX.play('corrupt'));
          break;
        }
        case 'purify':
          for (const cell of d.cells) {
            this.cellFx.set(cell.r * 8 + cell.c, { kind: 'purify', t: now });
            const p = this.cellCenter(cell.r, cell.c);
            FX.burst(p.x, p.y, '#e8d0ff', 8, { speed: 140, size: 3, grav: -60 });
          }
          break;
        case 'enrage':
          FX.after(this.slot(0.6), () => {
            FX.banner('ENRAGED!', { color: '#d07cff', size: 34, y: 0.2, sub: 'Corruption spreads faster' });
            FX.addShake(8);
          });
          break;
        case 'ready':
          if (this.members[d.member]) this.members[d.member].ready = now;
          SFX.play('ready');
          break;
        case 'holds':
          this.holdT = now;
          break;
        case 'stuck':
          FX.banner('NO MOVES!', { color: '#ff7a7a', size: 34, y: (BOARD.y + BOARD.size / 2) / H, life: 2.2, sub: 'Tap a glowing hero to use a skill' });
          break;
        case 'skill': {
          const m = this.members[d.member];
          if (m) m.lunge = now;
          const pc = this.partyCenter(d.member);
          FX.banner(d.name, { color: SIGNAL, size: 26, y: 0.13, life: 1 });
          FX.burst(pc.x, pc.y, DATA.elem(s.members[d.member].element).color, 16, { speed: 160, size: 4, grav: -40 });
          SFX.play('skill');
          break;
        }
        case 'shield': {
          const pc = this.partyCenter();
          FX.burst(pc.x, pc.y, '#7fc8ff', 20, { speed: 140, size: 4, grav: -40 });
          break;
        }
        case 'burst':
          for (const cell of d.cells.concat(d.purified)) {
            this.cellFx.set(cell.r * 8 + cell.c, { kind: 'clear', t: now, color: cell.color ? DATA.PIECE_COLORS[cell.color] : '#b04aff' });
            const p = this.cellCenter(cell.r, cell.c);
            FX.burst(p.x, p.y, '#ff7a3d', 5, { speed: 220, size: 5 });
          }
          FX.addShake(8);
          FX.stop(0.05);
          SFX.play('hit');
          break;
        case 'deal':
          this.dealT = now;
          break;
        case 'end':
          FX.after(this.slot(0.4), () => {
            if (d.won) {
              FX.banner('VICTORY!', { color: SIGNAL, size: 46, y: 0.42, life: 1.8 });
              SFX.play('win');
            } else {
              const sub = { defeated: 'The party fell', nomoves: 'No piece fits', turns: 'Out of turns' }[d.reason] || '';
              FX.banner('DEFEAT', { color: '#ff7a7a', size: 46, y: 0.42, life: 1.8, sub });
              SFX.play('lose');
            }
          });
          break;
        default: break;
      }
    },

    impact(h) {
      const e = this.enemy;
      if (!e || e.dead) return;
      e.flash = FX.t + 0.08;
      e.kick = FX.t;
      this.hitBar(this.enemyBar, Math.max(0, this.enemyBar.target - h.dmg));
      const c = this.enemyCenter();
      const color = h.crit ? '#ff9a3d' : h.eff > 1 ? '#ffe9a0' : h.eff < 1 ? '#b8b0c8' : '#ffffff';
      FX.text(c.x - 10, c.y - 20, (h.tag ? h.tag + ' ' : '') + h.dmg, { color, size: Math.min(40, 16 + h.dmg / 4) + (h.crit ? 4 : 0) });
      const el = DATA.elem(this.session.members[h.member].element).color;
      FX.burst(c.x - 20, c.y, el, h.crit ? 16 : 9, { speed: 240, dir: 0, spread: 1.4, size: 5 });
      FX.addShake(h.crit ? 7 : 3);
      FX.stop(h.crit ? 0.06 : 0.025);
      SFX.play(h.crit ? 'crit' : 'hit');
    },

    // ---------------------------------------------------------- per-frame
    update(dt) {
      for (const b of [this.enemyBar, this.partyBar]) {
        // damage snaps the bar down almost at once; the light "ghost" chunk of recent
        // damage lingers ~0.4s (ghostWait), then drains smoothly. Heals fill gently.
        b.shown = U.approach(b.shown, b.target, b.target < b.shown ? 30 : 7, dt);
        if (FX.t >= b.ghostWait) b.ghost = U.approach(b.ghost, b.shown, 5, dt);
        if (b.ghost < b.shown) b.ghost = b.shown;
      }
    },

    draw(ctx) {
      const s = this.session;
      const [sx, sy] = FX.shakeOffset();
      ctx.save();
      ctx.translate(sx, sy);
      this.drawScene(ctx, s);
      this.drawCards(ctx, s);
      // squash-and-settle around the board centre (visual only; input uses the unscaled grid)
      const pt = this.punch ? FX.t - this.punch.t : 1;
      const sq = pt >= 0 && pt < 0.5 ? this.punch.amp * U.spring(pt) : 0;
      if (sq) {
        const cx = BOARD.x + BOARD.size / 2, cy = BOARD.y + BOARD.size / 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1 + sq, 1 - sq);
        ctx.translate(-cx, -cy);
      }
      this.drawBoard(ctx, s);
      if (sq) ctx.restore();
      this.drawTray(ctx, s);
      ctx.restore();
      this.drawHUD(ctx, s);
      FX.drawParticles(ctx);
      this.drawDrag(ctx, s);
      FX.drawText(ctx);
      FX.drawBanners(ctx, W, H);
    },

    // ---------------------------------------------------------- scene
    drawBackdrop(ctx, h, boss) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      if (boss) { g.addColorStop(0, '#12061c'); g.addColorStop(1, '#4a1f52'); }
      else { g.addColorStop(0, '#1e1430'); g.addColorStop(0.7, '#6a3a4a'); g.addColorStop(1, '#b0603a'); }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, h);
      // pixel moon + far ridges
      ctx.fillStyle = boss ? '#a0ff60' : '#f0d8b0';
      ctx.globalAlpha = 0.6;
      ctx.fillRect(28, 16, 18, 18);
      ctx.globalAlpha = 1;
      const ridge = (base, amp, step, color, seed) => {
        ctx.fillStyle = color;
        for (let x = 0; x < W; x += step) {
          const y = base - Math.abs(Math.sin((x + seed) * 0.013) * amp + Math.sin((x + seed) * 0.041) * amp * 0.4);
          ctx.fillRect(x, Math.round(y), step, h - y);
        }
      };
      ridge(h * 0.72, 40, 6, boss ? '#2a1238' : '#3a2440', 0);
      ridge(h * 0.82, 26, 6, boss ? '#1e0c28' : '#2a1a2e', 90);
    },

    drawScene(ctx, s) {
      const top = 44, groundY = 236, bottom = 290;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, top, W, bottom - top); ctx.clip();
      ctx.translate(0, top);
      this.drawBackdrop(ctx, groundY - top, this.enemy && this.enemy.boss);
      ctx.translate(0, -top);
      ctx.fillStyle = '#3a2a2a'; ctx.fillRect(0, groundY, W, bottom - groundY);
      ctx.fillStyle = '#5a4030'; ctx.fillRect(0, groundY, W, 4);
      ctx.fillStyle = '#2a1e22';
      for (let x = 6; x < W; x += 23) ctx.fillRect(x, groundY + 10 + (x * 7) % 30, 6, 3);

      const t = FX.t, n = s.members.length;
      // party (back row first)
      const order = s.members.map((m, i) => i).sort((a, b) => this.partyPos(a, n).y - this.partyPos(b, n).y);
      for (const i of order) {
        const p = this.partyPos(i, n), mv = this.members[i];
        const lt = (t - mv.lunge) / 0.26;
        const lunge = lt >= 0 && lt < 1 ? Math.sin(Math.PI * lt) * 34 : 0;
        const bob = Math.round(Math.sin(t * 3 + i * 1.7) * 1.5);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(p.x - 18 + lunge, p.y - 3, 36, 5);
        Sprites.draw(ctx, Sprites.hero(s.members[i].id), p.x + lunge, p.y + bob, 3, { flash: t < mv.flash });
      }
      if (s.shield) {
        ctx.strokeStyle = 'rgba(127,200,255,' + (0.5 + 0.3 * Math.sin(t * 6)) + ')';
        ctx.lineWidth = 3;
        roundRect(ctx, 28, 150, 172, 112, 30);
        ctx.stroke();
      }

      // enemy / seal
      const e = this.enemy;
      if (e) {
        const spr = Sprites.enemy(e.art), k = Sprites.enemyScale(e.art);
        const lt = (t - e.lunge) / 0.3;
        const lunge = lt >= 0 && lt < 1 ? -Math.sin(Math.PI * lt) * 60 : 0;
        const kt = (t - e.kick) / 0.2;
        const kick = kt >= 0 && kt < 1 ? (1 - kt) * 14 : 0;
        const st = (t - e.spawn) / 0.4;
        const spawn = st >= 0 && st < 1 ? U.easeOutBack(st) : 1;
        let alpha = 1, sxk = 1, syk = 1;
        if (e.dead) {
          const pt = (t - e.pop) / 0.18;
          if (pt >= 1) alpha = 0; else { sxk = syk = 1 + pt * 0.5; alpha = 1 - pt; }
        } else {
          syk = (1 + Math.sin(t * 4) * 0.03) * spawn;
          sxk = (1 - Math.sin(t * 4) * 0.03) * spawn;
        }
        if (alpha > 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(ENEMY_POS.x - 30 + lunge + kick, ENEMY_POS.y - 3, 60, 5);
          const hover = e.art === 'bat' || e.art === 'wisp' ? -20 + Math.sin(t * 5) * 4 : 0;
          Sprites.draw(ctx, spr, ENEMY_POS.x + lunge + kick, ENEMY_POS.y + hover, k,
            { flash: t < e.flash, alpha, sx: sxk, sy: syk });
          if (s.freeze > 0 && !e.dead) {
            ctx.fillStyle = 'rgba(160,220,255,0.25)';
            ctx.fillRect(ENEMY_POS.x - 50, ENEMY_POS.y - spr.h * k, 100, spr.h * k);
          }
        }
      }

      if (s.isBattle) this.drawEnemyHud(ctx, s);
      else this.drawGoalHud(ctx, s);

      // party HP bar
      this.drawBar(ctx, this.partyBar, 14, 270, 180, 10);
      text(ctx, `HP ${Math.round(this.partyBar.shown)}/${s.party.maxHp}`, 16, 284, { size: 11 });
      if (s.shield) text(ctx, 'SHIELD', 192, 284, { size: 11, color: '#7fc8ff', align: 'right' });

      if (s.combo >= 2) {
        const pulse = 1 + Math.sin(t * 10) * 0.06;
        ctx.save();
        ctx.translate(232, 128);
        ctx.scale(pulse, pulse);
        text(ctx, `COMBO x${s.combo}`, 0, 0, { size: 18, color: '#ff9a3d', align: 'center', weight: 900 });
        text(ctx, `${s.comboMult().toFixed(2)}x dmg`, 0, 16, { size: 10, align: 'center' });
        ctx.restore();
      }
      ctx.restore();
    },

    drawBar(ctx, b, x, y, w, h) {
      const kt = (FX.t - b.kick) / 0.12;
      const kick = kt >= 0 && kt < 1 ? Math.round((1 - kt) * 9) * (kt < 0.5 ? 1 : -1) : 0;
      x += kick;
      const r = b.max ? U.clamp(b.shown / b.max, 0, 1) : 0;
      const gr = b.max ? U.clamp(b.ghost / b.max, 0, 1) : 0;
      ctx.fillStyle = '#1a1020'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
      ctx.fillStyle = '#3a2a40'; ctx.fillRect(x, y, w, h);
      // recent-damage chunk: bright while it lingers, warmer once it starts draining
      ctx.fillStyle = FX.t < b.ghostWait ? '#fff4dc' : '#f0c890';
      ctx.fillRect(x, y, Math.round(w * gr), h);
      ctx.fillStyle = FX.t < b.flash ? '#ffffff' : r > 0.5 ? '#5cd060' : r > 0.25 ? '#f0a830' : '#e84a4a';
      ctx.fillRect(x, y, Math.round(w * r), h);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x, y, Math.round(w * r), 2);
    },

    drawEnemyHud(ctx, s) {
      const e = s.enemy;
      if (!e || !this.enemy) return;
      const el = this.enemy.element ? DATA.ELEMENTS[this.enemy.element] : null;
      text(ctx, this.enemy.name, 216, 56, { size: 13 });
      if (el) {
        ctx.fillStyle = el.color; ctx.fillRect(366, 51, 10, 10);
      }
      this.drawBar(ctx, this.enemyBar, 216, 66, 160, 10);
      text(ctx, `${Math.round(this.enemyBar.shown)}/${this.enemyBar.max}`, 376, 88, { size: 10, align: 'right' });
      if (this.session.level.waves.length > 1) text(ctx, `Wave ${s.waveIndex + 1}/${s.level.waves.length}`, 216, 88, { size: 10 });
      // attack countdown badge
      if (!this.enemy.dead && e.hp > 0) {
        const danger = e.countdown <= 1;
        const pulse = danger ? 1 + Math.sin(FX.t * 12) * 0.1 : 1;
        ctx.save();
        ctx.translate(190, 72);
        ctx.scale(pulse, pulse);
        ctx.fillStyle = '#1a1020'; ctx.fillRect(-16, -16, 32, 32);
        ctx.fillStyle = danger ? '#c03030' : '#4a3a5a'; ctx.fillRect(-14, -14, 28, 28);
        text(ctx, String(e.countdown), 0, 1, { size: 18, align: 'center', weight: 900 });
        ctx.restore();
        text(ctx, 'ATK IN', 190, 98, { size: 9, align: 'center' });
      }
    },

    drawGoalHud(ctx, s) {
      const g = s.goal;
      const label = g.kind === 'lines' ? `CLEAR ${g.target} LINES` : 'PURIFY ALL CORRUPTION';
      text(ctx, label, 216, 56, { size: 13 });
      const prog = s.goalProgress();
      Object.assign(this.enemyBar, { max: g.target, target: prog });
      const b = this.enemyBar;
      const r = g.target ? U.clamp(b.shown / g.target, 0, 1) : 0;
      ctx.fillStyle = '#1a1020'; ctx.fillRect(214, 64, 164, 14);
      ctx.fillStyle = '#3a2a40'; ctx.fillRect(216, 66, 160, 10);
      ctx.fillStyle = '#7fe6ff'; ctx.fillRect(216, 66, Math.round(160 * r), 10);
      text(ctx, `${prog}/${g.target}`, 376, 88, { size: 11, align: 'right' });
    },

    // ---------------------------------------------------------- hero cards
    drawCards(ctx, s) {
      const n = s.members.length, t = FX.t;
      s.members.forEach((m, i) => {
        const r = this.cardRect(i, n);
        const ready = s.skillUsable(m) && !s.over;
        const gated = !ready && m.charge >= m.cost && !s.over; // charged, waiting on a combo
        const targeting = s.targeting && s.targeting.member === i;
        ctx.fillStyle = '#1a1020';
        roundRect(ctx, r.x, r.y, r.w, r.h, 8); ctx.fill();
        ctx.fillStyle = targeting ? '#24405a' : '#2a2140';
        roundRect(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 7); ctx.fill();
        if (ready || targeting) {
          ctx.strokeStyle = targeting ? '#7fe6ff' : SIGNAL;
          ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 7);
          ctx.lineWidth = 3;
          roundRect(ctx, r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3, 8); ctx.stroke();
          ctx.globalAlpha = 1;
        }
        const el = DATA.elem(m.element);
        ctx.fillStyle = '#16101f'; ctx.fillRect(r.x + 7, r.y + 7, 40, 40);
        Sprites.portrait(ctx, m.id, r.x + 7, r.y + 7, 40);
        ctx.fillStyle = el.color; ctx.fillRect(r.x + 7, r.y + 49, 40, 3);
        const tx = r.x + 53;
        text(ctx, m.name.split(' ')[0], tx, r.y + 15, { size: 12 });
        if (m.def.passive.id === 'twohandlift') {
          // Neris' holds: two pips, top-right; they pulse when they change
          const pulse = 1 + 0.5 * Math.max(0, 1 - (t - this.holdT) / 0.3);
          for (let k = 0; k < 2; k++) {
            const px = r.x + r.w - 14 - k * 11, py = r.y + 14, h = 4 * (k < s.holds ? pulse : 1);
            ctx.fillStyle = '#1a1020'; ctx.fillRect(px - 5, py - 5, 10, 10);
            ctx.fillStyle = k < s.holds ? '#fff1a8' : '#3a2f4a';
            ctx.fillRect(px - h, py - h, h * 2, h * 2);
          }
        }
        text(ctx, m.def.skill.name, tx, r.y + 30, { size: 9, color: '#b8acd0', stroke: false });
        // charge meter: one segment per line needed
        const bw = r.x + r.w - 8 - tx, seg = bw / m.cost;
        for (let k = 0; k < m.cost; k++) {
          ctx.fillStyle = k < m.charge ? (ready ? SIGNAL : el.color) : '#3a2f4a';
          ctx.fillRect(Math.round(tx + k * seg), r.y + 42, Math.max(2, Math.round(seg) - 2), 8);
        }
        // a charged skill that needs a combo says so instead of glowing
        const label = targeting ? 'PICK A CELL' : ready ? 'TAP!' : gated ? `COMBO x${m.def.skill.combo}+` : `${m.charge}/${m.cost}`;
        text(ctx, label, tx, r.y + 61, {
          size: ready || targeting ? 12 : gated ? 9 : 10,
          color: targeting ? '#7fe6ff' : ready ? SIGNAL : gated ? '#ff9a3d' : '#8a80a0', weight: 900,
        });
        const rt = (t - this.members[i].ready) / 0.4;
        if (rt >= 0 && rt < 1) {
          ctx.fillStyle = `rgba(255,211,77,${0.5 * (1 - rt)})`;
          roundRect(ctx, r.x, r.y, r.w, r.h, 8); ctx.fill();
        }
      });
    },

    // ---------------------------------------------------------- board
    drawBoard(ctx, s) {
      const b = s.board, C = BOARD.cell, t = FX.t;
      ctx.fillStyle = '#1a1020';
      ctx.fillRect(BOARD.x - 6, BOARD.y - 6, BOARD.size + 12, BOARD.size + 12);
      ctx.fillStyle = '#3a2f4a';
      ctx.fillRect(BOARD.x - 3, BOARD.y - 3, BOARD.size + 6, BOARD.size + 6);

      // ghost + lines-to-clear highlight
      let ghost = null, hl = null;
      const d = this.drag;
      if (d && d.valid) {
        const piece = s.hand[d.index];
        ghost = { cells: new Set(DATA.SHAPE[piece.shape].cells.map(([dr, dc]) => (d.r + dr) * 8 + d.c + dc)), color: DATA.PIECE_COLORS[piece.color] };
        hl = { rows: new Set(d.clears.rows), cols: new Set(d.clears.cols) };
      }

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const i = r * 8 + c, x = BOARD.x + c * C, y = BOARD.y + r * C;
          const fx = this.cellFx.get(i);
          const lit = hl && (hl.rows.has(r) || hl.cols.has(c));
          if (b.corrupt[i]) {
            this.drawCorrupt(ctx, x, y, C, t, i, fx);
          } else if (b.cells[i]) {
            let color = DATA.PIECE_COLORS[b.cells[i]];
            if (lit) color = ghost.color;
            let sc = 1;
            if (fx && fx.kind === 'place') {
              const k = (t - fx.t) / 0.16;
              if (k < 1) sc = 1 + 0.14 * Math.sin(Math.PI * k);
            }
            const sz = Math.round(C * sc), o = Math.round((C - sz) / 2);
            block(ctx, x + o, y + o, sz, color);
          } else {
            ctx.fillStyle = (r + c) % 2 ? '#241a33' : '#271d37';
            ctx.fillRect(x, y, C, C);
            ctx.fillStyle = '#1e162b';
            ctx.fillRect(x, y + C - 2, C, 2); ctx.fillRect(x + C - 2, y, 2, C);
            if (ghost && ghost.cells.has(i)) block(ctx, x + 2, y + 2, C - 4, ghost.color, 0.45);
          }
          if (lit) {
            ctx.fillStyle = `rgba(255,255,255,${0.12 + 0.08 * Math.sin(t * 12)})`;
            ctx.fillRect(x, y, C, C);
          }
          if (fx && (fx.kind === 'clear' || fx.kind === 'purify')) {
            const k = (t - fx.t) / 0.34;
            if (k < 1) {
              // pop up to 1.22x, then shrink away
              const sc = k < 0.2 ? 1 + 0.22 * U.easeOutCubic(k / 0.2) : 1.22 * (1 - U.easeOutCubic((k - 0.2) / 0.8));
              const sz = Math.round(C * sc), o = Math.round((C - sz) / 2);
              ctx.fillStyle = k < 0.3 ? '#ffffff' : (fx.color || '#e8d0ff');
              ctx.globalAlpha = 1 - k;
              ctx.fillRect(x + o, y + o, sz, sz);
              ctx.globalAlpha = 1;
            }
          }
          if (fx && t - fx.t > 1) this.cellFx.delete(i);
        }
      }

      // Rune Burst targeting overlay
      if (s.phase === 'target') {
        ctx.fillStyle = 'rgba(10,30,50,0.35)';
        ctx.fillRect(BOARD.x, BOARD.y, BOARD.size, BOARD.size);
        const h = this.hover;
        if (h) {
          const x0 = BOARD.x + Math.max(0, h.c - 1) * C, y0 = BOARD.y + Math.max(0, h.r - 1) * C;
          const x1 = BOARD.x + Math.min(8, h.c + 2) * C, y1 = BOARD.y + Math.min(8, h.r + 2) * C;
          ctx.fillStyle = `rgba(255,122,61,${0.35 + 0.15 * Math.sin(t * 10)})`;
          ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
          ctx.strokeStyle = '#ff7a3d'; ctx.lineWidth = 3; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
        }
        const tm = s.targeting && s.members[s.targeting.member];
        text(ctx, `Tap a cell to cast ${tm ? tm.def.skill.name : 'the skill'}`, W / 2, BOARD.y + BOARD.size + 14, { size: 13, align: 'center', color: '#7fe6ff' });
      }
    },

    drawCorrupt(ctx, x, y, C, t, i, fx) {
      let a = 1;
      if (fx && fx.kind === 'corrupt') a = U.clamp((t - fx.t) / 0.35, 0, 1);
      if (a <= 0) return;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#2a1438'; ctx.fillRect(x, y, C, C);
      ctx.fillStyle = '#4a1e60'; ctx.fillRect(x + 3, y + 3, C - 6, C - 6);
      const p = 0.5 + 0.5 * Math.sin(t * 3 + i);
      ctx.fillStyle = `rgba(176,74,255,${0.4 + 0.5 * p})`;
      const u = C / 7;
      // jagged rune glyph
      ctx.fillRect(x + u * 3, y + u, u, u * 5);
      ctx.fillRect(x + u, y + u * 3, u * 5, u);
      ctx.fillRect(x + u * 2, y + u * 2, u, u); ctx.fillRect(x + u * 4, y + u * 4, u, u);
      ctx.fillStyle = '#a0ff60';
      ctx.fillRect(x + u * 3, y + u * 3, u, u);
      ctx.globalAlpha = 1;
    },

    // ---------------------------------------------------------- tray + drag
    drawPieceAt(ctx, piece, ox, oy, cell, alpha = 1) {
      const sh = DATA.SHAPE[piece.shape];
      for (const [dr, dc] of sh.cells) block(ctx, Math.round(ox + dc * cell), Math.round(oy + dr * cell), cell, DATA.PIECE_COLORS[piece.color], alpha);
    },

    drawTray(ctx, s) {
      ctx.fillStyle = '#1e1529';
      ctx.fillRect(0, TRAY.y, W, H - TRAY.y);
      ctx.fillStyle = '#2a2140';
      ctx.fillRect(0, TRAY.y, W, 3);
      s.hand.forEach((p, i) => {
        if (p.used || (this.drag && this.drag.index === i)) return;
        const sh = DATA.SHAPE[p.shape], cell = TRAY.cell;
        const k = U.clamp((FX.t - this.dealT - i * 0.06) / 0.3, 0, 1);
        const dy = (1 - U.easeOutBack(k)) * 70;
        const fits = s.board.fits(sh);
        this.drawPieceAt(ctx, p, TRAY.xs[i] - (sh.w * cell) / 2, TRAY.cy - (sh.h * cell) / 2 + dy, cell, fits ? 1 : 0.3);
      });
    },

    drawDrag(ctx, s) {
      const d = this.drag;
      if (!d || !s) return;
      const piece = s.hand[d.index];
      if (!piece || piece.used) return;
      const o = this.dragOrigin(d);
      const k = U.clamp((FX.t - d.t0) / 0.1, 0, 1);
      const cell = U.lerp(TRAY.cell, BOARD.cell - 2, U.easeOutCubic(k));
      const cx = o.x + (o.sh.w * BOARD.cell) / 2, by = o.y + o.sh.h * BOARD.cell;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (const [dr, dc] of o.sh.cells) ctx.fillRect(cx - (o.sh.w * cell) / 2 + dc * cell + 6, by - o.sh.h * cell + dr * cell + 8, cell, cell);
      this.drawPieceAt(ctx, piece, cx - (o.sh.w * cell) / 2, by - o.sh.h * cell, cell);
    },

    // ---------------------------------------------------------- HUD
    drawHUD(ctx, s) {
      ctx.fillStyle = '#120d1c';
      ctx.fillRect(0, 0, W, 44);
      const p = this.pauseRect();
      ctx.fillStyle = '#2a2140';
      roundRect(ctx, p.x, p.y, p.w, p.h, 6); ctx.fill();
      ctx.fillStyle = '#d8d0e8';
      ctx.fillRect(p.x + 16, p.y + 10, 4, 14); ctx.fillRect(p.x + 24, p.y + 10, 4, 14);
      text(ctx, `${s.level.id} · ${s.level.name}`, W / 2, 22, { size: 16, align: 'center', weight: 900 });
      if (s.goal) {
        const left = s.turnsLeft();
        text(ctx, `${left} turns`, W - 10, 22, { size: 13, align: 'right', color: left <= 3 ? '#ff7a7a' : '#ffffff' });
      } else {
        text(ctx, `Turn ${s.turn}`, W - 10, 22, { size: 13, align: 'right' });
      }
    },

    // ---------------------------------------------------------- menus backdrop
    drawIdle(ctx, team) {
      const gy = Math.round(H * 0.7);
      this.drawBackdrop(ctx, gy, false);
      ctx.fillStyle = '#3a2a2a'; ctx.fillRect(0, gy, W, H);
      ctx.fillStyle = '#5a4030'; ctx.fillRect(0, gy, W, 5);
      const t = FX.t;
      // drifting rune blocks
      for (let k = 0; k < 9; k++) {
        const x = (k * 53 + t * (10 + k * 3)) % (W + 60) - 30;
        const y = gy + 30 + ((k * 97) % 190) + Math.sin(t + k) * 6;
        block(ctx, Math.round(x), Math.round(y), 22, DATA.PIECE_COLORS[1 + (k % 6)], 0.5);
      }
      (team || []).forEach((id, i) => {
        const x = W / 2 + (i - (team.length - 1) / 2) * 70;
        Sprites.draw(ctx, Sprites.hero(id), x, gy + 2 + Math.round(Math.sin(t * 3 + i) * 2), 3);
      });
      FX.drawParticles(ctx);
    },
  };

  window.View = View;
})();
