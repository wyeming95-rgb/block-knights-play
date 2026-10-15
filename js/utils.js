'use strict';
/**
 * Small shared helpers: math, easing, a seeded RNG and the marble bag.
 * Exposed as window.U.
 */
(() => {
  const U = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    easeOutCubic: t => 1 - Math.pow(1 - t, 3),
    easeOutBack: t => {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    /** Exponential approach that is frame-rate independent. */
    approach: (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt)),
  };

  /**
   * Seeded PRNG (mulberry32). Every gameplay roll goes through one of these so a
   * run can be replayed from its seed. Returns a function () => [0,1) with helpers.
   */
  U.rng = function (seed) {
    let a = (Number(seed) >>> 0) || 1;
    const next = () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.int = n => Math.floor(next() * n);
    next.pick = arr => arr[next.int(arr.length)];
    next.range = (lo, hi) => lo + next() * (hi - lo);
    next.shuffle = arr => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = next.int(i + 1);
        const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    };
    next.seed = seed;
    return next;
  };

  /**
   * Marble bag: a shuffled deck of weighted items, drawn without replacement and
   * refilled when empty, so short streaks even out (randomness with memory).
   * @param {Array<[any, number]>} weights  [item, count] pairs
   */
  class MarbleBag {
    constructor(weights, rng) {
      this.weights = weights;
      this.rng = rng;
      this.items = [];
    }
    refill() {
      this.items = [];
      for (const [item, n] of this.weights) for (let i = 0; i < n; i++) this.items.push(item);
      this.rng.shuffle(this.items);
    }
    draw() {
      if (!this.items.length) this.refill();
      return this.items.pop();
    }
    /** Return a marble somewhere below the top so the next draw is (usually) different. */
    putBack(item) {
      const idx = this.items.length ? this.rng.int(this.items.length) : 0;
      this.items.splice(idx, 0, item);
    }
    /** Remove and return the top-most marble matching pred, or undefined. */
    takeWhere(pred) {
      for (let i = this.items.length - 1; i >= 0; i--) {
        if (pred(this.items[i])) return this.items.splice(i, 1)[0];
      }
      return undefined;
    }
  }
  U.MarbleBag = MarbleBag;

  window.U = U;
})();
