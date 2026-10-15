'use strict';
/**
 * Juice: particles, rings, line streaks, floating damage numbers, banners, screen shake, hit-stop and a
 * small timer queue. Everything runs on FX.t (seconds), which pauses during hit-stop.
 */
(() => {
  /** Greedy word-wrap using the current ctx font. */
  function wrap(ctx, str, maxW) {
    const lines = [];
    let cur = '';
    for (const word of str.split(' ')) {
      const next = cur ? cur + ' ' + word : word;
      if (cur && ctx.measureText(next).width > maxW) { lines.push(cur); cur = word; }
      else cur = next;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  const FX = {
    t: 0,
    particles: [],
    shapes: [],    // rings and line streaks
    floaters: [],
    banners: [],
    timers: [],
    shake: 0,
    hitstop: 0,

    reset() {
      this.particles.length = 0;
      this.shapes.length = 0;
      this.floaters.length = 0;
      this.banners.length = 0;
      this.timers.length = 0;
      this.shake = 0;
      this.hitstop = 0;
    },

    /** Run fn after `delay` seconds of game time. */
    after(delay, fn) { this.timers.push({ at: this.t + delay, fn }); },
    addShake(a) { this.shake = Math.min(18, Math.max(this.shake, a)); },
    stop(sec) { this.hitstop = Math.max(this.hitstop, sec); },

    /** Burst of square pixel particles. dir biases the spray (radians), spread in radians. */
    burst(x, y, color, n, { speed = 160, dir = null, spread = Math.PI * 2, size = 4, life = 0.6, grav = 300 } = {}) {
      for (let i = 0; i < n; i++) {
        const a = dir == null ? Math.random() * Math.PI * 2 : dir + (Math.random() - 0.5) * spread;
        const v = speed * (0.4 + Math.random() * 0.8);
        this.particles.push({
          x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.2,
          life: life * (0.6 + Math.random() * 0.6), age: 0, color,
          size: Math.max(2, Math.round(size * (0.6 + Math.random() * 0.7))), grav,
        });
      }
    },

    /**
     * Damage-number style text: pops in with an overshoot (0 -> ~1.35 -> 1), rises,
     * then fades. Size by value. `bounce` sets how hard it overshoots.
     */
    text(x, y, str, { color = '#ffffff', size = 18, life = 0.9, vx = null, rise = 60, bounce = 3.2 } = {}) {
      this.floaters.push({
        x: x + (Math.random() - 0.5) * 16, y, str, color, size, life, age: 0,
        vx: vx == null ? (Math.random() - 0.5) * 50 : vx, rise, bounce,
      });
    },

    /** Expanding shockwave ring. */
    ring(x, y, color, { r0 = 6, r1 = 70, life = 0.35, width = 5 } = {}) {
      this.shapes.push({ kind: 'ring', x, y, color, r0, r1, life, width, age: 0 });
    },

    /** Bright bar along a cleared row/column that thins out and fades. (x,y) is its centre. */
    streak(x, y, w, h, color, { life = 0.28 } = {}) {
      this.shapes.push({ kind: 'streak', x, y, w, h, color, life, age: 0 });
    },

    /** Hurry any showing banners into their fade-out (e.g. the intro once play starts). */
    fadeBanners() {
      for (const b of this.banners) b.age = Math.max(b.age, b.life * 0.85);
    },

    banner(str, { color = '#ffffff', size = 34, life = 1.1, y = 0.5, sub = '' } = {}) {
      this.banners.push({ str, sub, color, size, life, age: 0, y });
    },

    update(dt) {
      if (this.hitstop > 0) { this.hitstop -= dt; return; }
      this.t += dt;
      this.shake = Math.max(0, this.shake - dt * 40);
      for (let i = this.timers.length - 1; i >= 0; i--) {
        const tm = this.timers[i];
        if (this.t >= tm.at) { this.timers.splice(i, 1); tm.fn(); }
      }
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.age += dt;
        if (p.age >= p.life) { this.particles.splice(i, 1); continue; }
        p.vy += p.grav * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      for (let i = this.shapes.length - 1; i >= 0; i--) {
        const s = this.shapes[i];
        s.age += dt;
        if (s.age >= s.life) this.shapes.splice(i, 1);
      }
      for (let i = this.floaters.length - 1; i >= 0; i--) {
        const f = this.floaters[i];
        f.age += dt;
        if (f.age >= f.life) this.floaters.splice(i, 1);
      }
      for (let i = this.banners.length - 1; i >= 0; i--) {
        const b = this.banners[i];
        b.age += dt;
        if (b.age >= b.life) this.banners.splice(i, 1);
      }
    },

    shakeOffset() {
      if (this.shake <= 0.1) return [0, 0];
      return [(Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake];
    },

    drawParticles(ctx) {
      for (const s of this.shapes) {
        const k = s.age / s.life;
        ctx.globalAlpha = 1 - k;
        if (s.kind === 'ring') {
          ctx.strokeStyle = s.color;
          ctx.lineWidth = Math.max(1, s.width * (1 - k));
          ctx.beginPath();
          ctx.arc(s.x, s.y, U.lerp(s.r0, s.r1, U.easeOutCubic(k)), 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // streak: full length, thickness collapses from 1.4x to 0
          const horiz = s.w >= s.h;
          const t = (1 - U.easeOutCubic(k)) * 1.4;
          const w = horiz ? s.w : s.w * t, h = horiz ? s.h * t : s.h;
          ctx.fillStyle = s.color;
          ctx.fillRect(s.x - w / 2, s.y - h / 2, w, h);
        }
      }
      for (const p of this.particles) {
        ctx.globalAlpha = 1 - p.age / p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }
      ctx.globalAlpha = 1;
    },

    drawText(ctx) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const POP = 0.22; // seconds for the overshoot pop-in
      for (const f of this.floaters) {
        const k = f.age / f.life;
        const pk = Math.min(1, f.age / POP);
        const pop = Math.max(0, U.easeOutBack(pk, f.bounce));
        const squash = 1 - pk; // a touch wider than tall while it lands
        const x = f.x + f.vx * k;
        const y = f.y - f.rise * U.easeOutCubic(k);
        ctx.globalAlpha = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(pop * (1 + 0.18 * squash), pop * (1 - 0.12 * squash));
        ctx.font = `900 ${f.size}px ${FX.FONT}`;
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#1a1020';
        ctx.strokeText(f.str, 0, 0);
        ctx.fillStyle = f.color;
        ctx.fillText(f.str, 0, 0);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },

    drawBanners(ctx, W, H) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const b of this.banners) {
        const k = b.age / b.life;
        const s = k < 0.18 ? U.easeOutBack(k / 0.18) : 1;
        ctx.globalAlpha = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
        const y = H * b.y;
        ctx.save();
        ctx.translate(W / 2, y);
        ctx.scale(s, s);
        ctx.font = `900 ${b.size}px ${FX.FONT}`;
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#1a1020';
        ctx.strokeText(b.str, 0, 0);
        ctx.fillStyle = b.color;
        ctx.fillText(b.str, 0, 0);
        if (b.sub) {
          ctx.font = `700 15px ${FX.FONT}`;
          ctx.lineWidth = 4;
          ctx.fillStyle = '#ffffff';
          wrap(ctx, b.sub, W - 32).forEach((line, i) => {
            ctx.strokeText(line, 0, b.size * 0.75 + i * 19);
            ctx.fillText(line, 0, b.size * 0.75 + i * 19);
          });
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },
  };
  FX.FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

  window.FX = FX;
})();
