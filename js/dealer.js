'use strict';
/**
 * Piece dealing. Shapes come out of a weighted marble bag (shuffled, drawn without
 * replacement), so long droughts of any shape cannot happen.
 *
 * Adaptive, but honest: when the board is tight, a drawn piece that fits nowhere is
 * put back and redrawn a few times, and every hand is guaranteed at least one piece
 * that fits if any shape at all can. It never deals a hand designed to kill you.
 */
(() => {
  const TIGHT_FILL = 0.4;   // fill ratio at which redraws kick in
  const REDRAWS = 3;

  class Dealer {
    constructor(rng) {
      this.rng = rng;
      this.bag = new U.MarbleBag(DATA.SHAPES.map(s => [s.id, s.weight]), rng);
    }

    fitsId(board, id) { return board.fits(DATA.SHAPE[id]); }

    /** A fitting shape: prefer the bag's own contents, else any fitting shape by weight. */
    fittingShape(board) {
      const fromBag = this.bag.takeWhere(id => this.fitsId(board, id));
      if (fromBag) return fromBag;
      const all = DATA.SHAPES.filter(s => board.fits(s));
      if (!all.length) return null;
      let roll = this.rng() * all.reduce((a, s) => a + s.weight, 0);
      for (const s of all) { roll -= s.weight; if (roll < 0) return s.id; }
      return all[all.length - 1].id;
    }

    drawOne(board, tight) {
      let id = this.bag.draw();
      if (tight) {
        for (let t = 0; t < REDRAWS && !this.fitsId(board, id); t++) {
          this.bag.putBack(id);
          id = this.bag.draw();
        }
      }
      return id;
    }

    piece(id) { return { shape: id, color: 1 + this.rng.int(6), used: false }; }

    /** Deal a fresh hand of 3. */
    deal(board) {
      const tight = board.fillRatio() >= TIGHT_FILL;
      const ids = [0, 1, 2].map(() => this.drawOne(board, tight));
      if (!ids.some(id => this.fitsId(board, id))) {
        const f = this.fittingShape(board);
        if (f) {
          const slot = this.rng.int(3);
          this.bag.putBack(ids[slot]);
          ids[slot] = f;
        }
      }
      return ids.map(id => this.piece(id));
    }

    /** Rogue's Loaded Dice: replace every unused piece with one that fits. */
    reroll(board, hand) {
      return hand.map(p => {
        if (p.used) return p;
        this.bag.putBack(p.shape);
        const id = this.fittingShape(board) || p.shape;
        return this.piece(id);
      });
    }
  }

  window.Dealer = Dealer;
})();
