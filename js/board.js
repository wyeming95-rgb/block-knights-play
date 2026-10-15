'use strict';
/**
 * The 8x8 rune grid. Pure logic, no drawing.
 *   cells[i]   0 = empty, 1..6 = block colour index
 *   corrupt[i] 1 = corruption: blocks placement, counts as filled for line
 *              completion, and is purified by a line clear through or beside it.
 */
(() => {
  class Board {
    constructor(size = 8) {
      this.size = size;
      this.cells = new Array(size * size).fill(0);
      this.corrupt = new Array(size * size).fill(0);
    }

    /** Build from rows of '#' (block), 'x' (corruption), '.' (empty). */
    static fromPattern(rows, rng) {
      const b = new Board(rows.length);
      rows.forEach((row, r) => [...row].forEach((ch, c) => {
        if (ch === '#') b.cells[b.idx(r, c)] = 1 + rng.int(6);
        else if (ch === 'x') b.corrupt[b.idx(r, c)] = 1;
      }));
      return b;
    }

    idx(r, c) { return r * this.size + c; }
    inBounds(r, c) { return r >= 0 && c >= 0 && r < this.size && c < this.size; }
    isFree(r, c) {
      if (!this.inBounds(r, c)) return false;
      const i = this.idx(r, c);
      return !this.cells[i] && !this.corrupt[i];
    }
    isSolid(r, c) { const i = this.idx(r, c); return !!(this.cells[i] || this.corrupt[i]); }

    canPlace(shape, r, c) {
      for (const [dr, dc] of shape.cells) if (!this.isFree(r + dr, c + dc)) return false;
      return true;
    }

    /** True if the shape fits anywhere on the board. */
    fits(shape) {
      for (let r = 0; r <= this.size - shape.h; r++) {
        for (let c = 0; c <= this.size - shape.w; c++) if (this.canPlace(shape, r, c)) return true;
      }
      return false;
    }

    place(shape, r, c, color) {
      const out = [];
      for (const [dr, dc] of shape.cells) {
        this.cells[this.idx(r + dr, c + dc)] = color;
        out.push([r + dr, c + dc]);
      }
      return out;
    }

    fullLines() {
      const rows = [], cols = [];
      for (let r = 0; r < this.size; r++) {
        let full = true;
        for (let c = 0; c < this.size && full; c++) full = this.isSolid(r, c);
        if (full) rows.push(r);
      }
      for (let c = 0; c < this.size; c++) {
        let full = true;
        for (let r = 0; r < this.size && full; r++) full = this.isSolid(r, c);
        if (full) cols.push(c);
      }
      return { rows, cols };
    }

    /** Lines that would complete if shape were placed at (r,c); board is unchanged. */
    wouldClear(shape, r, c) {
      const touched = shape.cells.map(([dr, dc]) => this.idx(r + dr, c + dc));
      touched.forEach(i => { this.cells[i] = -1; });
      const res = this.fullLines();
      touched.forEach(i => { this.cells[i] = 0; });
      return res;
    }

    /** Empty a set of cell indices, then purify corruption orthogonally next to them. */
    clearCells(indices) {
      const set = new Set(indices);
      const cells = [], purified = [];
      for (const i of set) {
        const r = Math.floor(i / this.size), c = i % this.size;
        if (this.cells[i]) cells.push({ r, c, color: this.cells[i] });
        if (this.corrupt[i]) purified.push({ r, c });
        this.cells[i] = 0;
        this.corrupt[i] = 0;
      }
      for (const i of set) {
        const r = Math.floor(i / this.size), c = i % this.size;
        for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
          if (!this.inBounds(nr, nc)) continue;
          const j = this.idx(nr, nc);
          if (this.corrupt[j]) { this.corrupt[j] = 0; purified.push({ r: nr, c: nc }); }
        }
      }
      return { cells, purified };
    }

    clearLines(rows, cols) {
      const idx = [];
      for (const r of rows) for (let c = 0; c < this.size; c++) idx.push(this.idx(r, c));
      for (const c of cols) for (let r = 0; r < this.size; r++) idx.push(this.idx(r, c));
      return this.clearCells(idx);
    }

    /** Clear the square of `radius` around (r,c). Purifies only inside the area. */
    clearArea(r, c, radius = 1) {
      const cells = [], purified = [];
      for (let rr = r - radius; rr <= r + radius; rr++) {
        for (let cc = c - radius; cc <= c + radius; cc++) {
          if (!this.inBounds(rr, cc)) continue;
          const i = this.idx(rr, cc);
          if (this.cells[i]) cells.push({ r: rr, c: cc, color: this.cells[i] });
          if (this.corrupt[i]) purified.push({ r: rr, c: cc });
          this.cells[i] = 0;
          this.corrupt[i] = 0;
        }
      }
      return { cells, purified };
    }

    rowCount(r) { let n = 0; for (let c = 0; c < this.size; c++) n += this.isSolid(r, c) ? 1 : 0; return n; }
    colCount(c) { let n = 0; for (let r = 0; r < this.size; r++) n += this.isSolid(r, c) ? 1 : 0; return n; }
    corruptCount() { return this.corrupt.reduce((a, b) => a + b, 0); }
    solidCount() { let n = 0; for (let i = 0; i < this.cells.length; i++) if (this.cells[i] || this.corrupt[i]) n++; return n; }
    fillRatio() { return this.solidCount() / this.cells.length; }

    /** Rows of numbers for debugging/tests: 0 empty, 1..6 block colour, -1 corruption. */
    toArray() {
      const out = [];
      for (let r = 0; r < this.size; r++) {
        const row = [];
        for (let c = 0; c < this.size; c++) {
          const i = this.idx(r, c);
          row.push(this.corrupt[i] ? -1 : this.cells[i]);
        }
        out.push(row);
      }
      return out;
    }
  }

  window.Board = Board;
})();
