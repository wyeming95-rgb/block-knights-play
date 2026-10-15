'use strict';
/**
 * One level attempt: board, hand, party, enemy waves, goals, skills.
 * Pure logic that resolves instantly; everything the player should *see* is
 * reported through onEvent(type, data) and animated by view.js on its own clock.
 *
 * A "turn" is one piece placement. Skills are free actions (no turn).
 */
(() => {
  const COMBO_STEP = 0.25, COMBO_CAP = 3;
  const BASE_GRACE = 1;  // a combo survives this many placements without a clear

  class Session {
    constructor({ level, team, seed, onEvent }) {
      this.level = level;
      this.seed = seed >>> 0;
      this.rng = U.rng(this.seed);
      this.onEvent = onEvent || null;
      this.isBattle = level.type === 'battle';

      this.board = level.board ? Board.fromPattern(level.board, this.rng) : new Board(8);
      this.dealer = new Dealer(this.rng);

      // team: [{ id, awaken }]
      this.members = team.map(({ id, awaken }) => {
        const def = DATA.CHARACTERS[id];
        const k = 1 + 0.1 * (awaken || 0);
        return {
          id, def, name: def.name, element: def.element,
          hp: Math.round(def.hp * k), atk: Math.round(def.atk * k),
          cost: def.skill.cost, charge: 0,
        };
      });
      const maxHp = this.members.reduce((a, m) => a + m.hp, 0);
      this.party = { hp: maxHp, maxHp };
      this.passives = new Set(this.members.map(m => m.def.passive.id));
      this.critBag = new U.MarbleBag([[true, 1], [false, 3]], this.rng);

      this.turn = 0;
      this.combo = 0;
      this.dry = 0;
      this.shield = false;
      this.freeze = 0;
      this.phase = 'play';       // play | target | won | lost
      this.targeting = null;     // { member } while Rune Burst waits for a cell
      this.stuck = false;
      this.result = null;
      this.stats = { lines: 0, damage: 0, purified: 0, maxCombo: 0, skills: 0 };

      this.goal = level.goal ? { ...level.goal } : null;
      if (this.goal && this.goal.kind === 'corruption') this.goal.target = this.board.corruptCount();

      this.waveIndex = 0;
      this.enemy = null;
      if (this.isBattle) this.spawnWave(0);

      this.hand = this.dealer.deal(this.board);
      this.checkStuck();
    }

    emit(type, data) { if (this.onEvent) this.onEvent(type, data || {}, this); }
    has(passive) { return this.passives.has(passive); }
    get over() { return this.phase === 'won' || this.phase === 'lost'; }

    // ---------------------------------------------------------------- waves
    spawnWave(i) {
      const def = DATA.ENEMIES[this.level.waves[i]];
      this.waveIndex = i;
      this.enemy = {
        key: this.level.waves[i], def, name: def.name, element: def.element,
        hp: def.hp, maxHp: def.hp, atk: def.atk,
        every: def.every + (this.has('chill') ? 1 : 0),
        countdown: def.every + (this.has('chill') ? 1 : 0),
        hitBy: new Set(), enraged: false,
        fresh: i > 0, // a wave that arrives mid-turn doesn't tick down on that turn
      };
      this.emit('wave', { index: i, total: this.level.waves.length, enemy: this.enemy });
    }

    // ---------------------------------------------------------------- goals
    goalProgress() {
      if (!this.goal) return 0;
      if (this.goal.kind === 'lines') return Math.min(this.goal.target, this.stats.lines);
      return this.goal.target - this.board.corruptCount();
    }
    goalMet() { return !!this.goal && this.goalProgress() >= this.goal.target; }
    turnsLeft() { return this.goal ? Math.max(0, this.goal.turns - this.turn) : Infinity; }

    // ---------------------------------------------------------------- placing
    /** Place hand[i] with its top-left at (r,c). */
    place(i, r, c) {
      if (this.phase !== 'play') return { ok: false, reason: 'phase:' + this.phase };
      const piece = this.hand[i];
      if (!piece || piece.used) return { ok: false, reason: 'no-piece' };
      const shape = DATA.SHAPE[piece.shape];
      if (!this.board.canPlace(shape, r, c)) return { ok: false, reason: 'blocked' };

      const cells = this.board.place(shape, r, c, piece.color);
      piece.used = true;
      this.turn++;
      this.emit('place', { cells, color: piece.color, index: i });

      const { rows, cols } = this.board.fullLines();
      const lines = rows.length + cols.length;
      let damage = 0;
      if (lines) {
        damage = this.resolveClear(rows, cols);
      } else {
        this.dry++;
        const grace = BASE_GRACE + (this.has('steady') ? 1 : 0);
        if (this.combo && this.dry > grace) { this.combo = 0; this.emit('comboEnd'); }
      }
      this.afterTurn();
      return { ok: true, lines, damage, phase: this.phase };
    }

    /** Clear rows/cols and run the consequences. Returns damage dealt. */
    resolveClear(rows, cols, { fromSkill = false } = {}) {
      const lines = rows.length + cols.length;
      const cleared = this.board.clearLines(rows, cols);
      this.combo++;
      this.dry = 0;
      this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
      this.stats.lines += lines;
      this.stats.purified += cleared.purified.length;
      this.emit('clear', { rows, cols, cells: cleared.cells, purified: cleared.purified, lines, combo: this.combo });

      if (!fromSkill) this.gainCharge(lines);
      if (this.has('mend')) this.heal(lines);
      return this.isBattle ? this.partyAttack(lines) : 0;
    }

    gainCharge(n) {
      this.members.forEach((m, idx) => {
        const was = m.charge >= m.cost;
        m.charge = Math.min(m.cost, m.charge + n);
        if (!was && m.charge >= m.cost) this.emit('ready', { member: idx });
      });
    }

    heal(n) {
      const before = this.party.hp;
      this.party.hp = Math.min(this.party.maxHp, this.party.hp + n);
      if (this.party.hp > before) this.emit('heal', { amount: this.party.hp - before, hp: this.party.hp });
    }

    comboMult() { return Math.min(COMBO_CAP, 1 + COMBO_STEP * Math.max(0, this.combo - 1)); }
    lineBonus(lines) {
      if (lines <= 1) return 1;
      return 1 + 0.5 * (lines - 1) + (this.has('echo') ? 0.5 : 0);
    }

    /** One hit from member m with raw power; applies element, crits and first strike. */
    hitFrom(idx, power) {
      const m = this.members[idx];
      const eff = DATA.elemMult(m.element, this.enemy.element);
      let dmg = power * eff;
      let crit = false;
      if (m.def.passive.id === 'opportunist' && this.critBag.draw()) { dmg *= 2; crit = true; }
      if (m.def.passive.id === 'firststrike' && !this.enemy.hitBy.has(idx)) { dmg *= 2; crit = true; }
      this.enemy.hitBy.add(idx);
      return { member: idx, dmg: Math.max(1, Math.round(dmg)), crit, eff };
    }

    partyAttack(lines) {
      const mult = lines * this.comboMult() * this.lineBonus(lines);
      const hits = this.members.map((m, idx) => this.hitFrom(idx, m.atk * mult));
      return this.damageEnemy(hits, { lines, combo: this.combo });
    }

    damageEnemy(hits, info = {}) {
      if (!this.enemy || this.enemy.hp <= 0) return 0;
      const total = hits.reduce((a, h) => a + h.dmg, 0);
      this.enemy.hp = Math.max(0, this.enemy.hp - total);
      this.stats.damage += total;
      const killed = this.enemy.hp <= 0;
      this.emit('attack', { hits, total, hp: this.enemy.hp, killed, ...info });
      if (this.enemy.def.spread && !this.enemy.enraged && this.enemy.hp > 0 && this.enemy.hp <= this.enemy.maxHp / 2) {
        this.enemy.enraged = true;
        this.emit('enrage', {});
      }
      if (killed) this.enemyDefeated();
      return total;
    }

    enemyDefeated() {
      this.emit('enemyDown', { index: this.waveIndex });
      if (this.waveIndex + 1 < this.level.waves.length) this.spawnWave(this.waveIndex + 1);
      else this.finish(true);
    }

    // ---------------------------------------------------------------- enemy turn
    afterTurn() {
      if (this.over) return;
      if (this.isBattle && this.enemy && this.enemy.hp > 0) {
        if (this.enemy.fresh) this.enemy.fresh = false;
        else if (--this.enemy.countdown <= 0) this.enemyAttack();
        const sp = this.enemy.def.spread;
        if (sp && this.party.hp > 0) {
          if (this.freeze > 0) this.freeze--;
          else if (this.turn % sp.every === 0) this.spreadCorruption(this.enemy.enraged ? sp.enraged : sp.count);
        }
      }
      if (this.party.hp <= 0) return this.finish(false, 'defeated');
      if (this.goal) {
        if (this.goalMet()) return this.finish(true);
        if (this.turn >= this.goal.turns) return this.finish(false, 'turns');
      }
      if (this.hand.every(p => p.used)) {
        this.hand = this.dealer.deal(this.board);
        this.emit('deal', {});
      }
      this.checkStuck();
    }

    enemyAttack() {
      const e = this.enemy;
      e.countdown = e.every;
      let dmg = e.atk;
      if (this.has('bulwark')) dmg = Math.round(dmg * 0.8);
      if (this.shield) {
        this.shield = false;
        this.emit('enemyAttack', { dmg: 0, blocked: true, hp: this.party.hp });
        return;
      }
      this.party.hp = Math.max(0, this.party.hp - dmg);
      this.emit('enemyAttack', { dmg, blocked: false, hp: this.party.hp });
    }

    spreadCorruption(n) {
      const b = this.board, near = [], any = [];
      for (let r = 0; r < b.size; r++) {
        for (let c = 0; c < b.size; c++) {
          if (!b.isFree(r, c)) continue;
          any.push([r, c]);
          const adj = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
            .some(([nr, nc]) => b.inBounds(nr, nc) && b.corrupt[b.idx(nr, nc)]);
          if (adj) near.push([r, c]);
        }
      }
      this.rng.shuffle(near);
      this.rng.shuffle(any);
      const picked = [];
      const seen = new Set();
      for (const [r, c] of near.concat(any)) {
        if (picked.length >= n) break;
        const i = b.idx(r, c);
        if (seen.has(i)) continue;
        seen.add(i);
        b.corrupt[i] = 1;
        picked.push({ r, c });
      }
      if (picked.length) this.emit('corrupt', { cells: picked });
    }

    // ---------------------------------------------------------------- stuck / end
    canUseAnySkill() { return this.members.some(m => m.charge >= m.cost); }

    checkStuck() {
      if (this.over) return;
      const anyFit = this.hand.some(p => !p.used && this.board.fits(DATA.SHAPE[p.shape]));
      const wasStuck = this.stuck;
      this.stuck = !anyFit;
      if (!this.stuck) return;
      if (this.canUseAnySkill()) { if (!wasStuck) this.emit('stuck', {}); }
      else this.finish(false, 'nomoves');
    }

    stars() {
      const s = this.level.stars;
      if (this.isBattle) {
        return 1 + (this.party.hp / this.party.maxHp >= s.hp ? 1 : 0) + (this.turn <= s.turns ? 1 : 0);
      }
      return 1 + (this.turn <= s.t2 ? 1 : 0) + (this.turn <= s.t3 ? 1 : 0);
    }

    finish(won, reason = '') {
      if (this.over) return;
      this.phase = won ? 'won' : 'lost';
      this.targeting = null;
      this.result = {
        won, reason, stars: won ? this.stars() : 0, turns: this.turn,
        hpRatio: this.party.hp / this.party.maxHp, ...this.stats,
      };
      this.emit('end', this.result);
    }

    // ---------------------------------------------------------------- skills
    /** Activate member i's skill. Tapping the targeting hero again cancels. */
    activateSkill(i) {
      if (this.phase === 'target') {
        if (this.targeting && this.targeting.member === i) {
          this.phase = 'play';
          this.targeting = null;
          this.emit('targetCancel', {});
          return { ok: true, cancelled: true };
        }
        return { ok: false, reason: 'targeting' };
      }
      if (this.phase !== 'play') return { ok: false, reason: 'phase:' + this.phase };
      const m = this.members[i];
      if (!m || m.charge < m.cost) return { ok: false, reason: 'not-ready' };
      const skill = m.def.skill;

      if (skill.target) {
        this.phase = 'target';
        this.targeting = { member: i };
        this.emit('targeting', { member: i });
        return { ok: true, needsTarget: true };
      }

      m.charge = 0;
      this.stats.skills++;
      this.emit('skill', { member: i, skill: skill.id, name: skill.name });
      const atkHit = mult => (this.isBattle && this.enemy ? this.damageEnemy([this.hitFrom(i, m.atk * mult)], { skill: skill.id }) : 0);

      switch (skill.id) {
        case 'aegis':
          this.shield = true;
          this.emit('shield', {});
          atkHit(3);
          break;
        case 'loadeddice':
          this.hand = this.dealer.reroll(this.board, this.hand);
          this.emit('deal', { reroll: true });
          break;
        case 'sanctuary': {
          this.heal(Math.round(this.party.maxHp * 0.35));
          const b = this.board, spots = [];
          for (let k = 0; k < b.corrupt.length; k++) if (b.corrupt[k]) spots.push(k);
          this.rng.shuffle(spots);
          const purified = spots.slice(0, 4).map(k => {
            b.corrupt[k] = 0;
            return { r: Math.floor(k / b.size), c: k % b.size };
          });
          this.stats.purified += purified.length;
          if (purified.length) this.emit('purify', { cells: purified });
          break;
        }
        case 'volley':
          if (this.enemy) this.enemy.countdown += 2;
          atkHit(4);
          break;
        case 'freeze':
          if (this.enemy) this.enemy.countdown += 3;
          this.freeze = 4;
          atkHit(2);
          break;
        case 'dive': {
          const b = this.board;
          let br = 0, bc = 0;
          for (let k = 1; k < b.size; k++) {
            if (b.rowCount(k) > b.rowCount(br)) br = k;
            if (b.colCount(k) > b.colCount(bc)) bc = k;
          }
          this.resolveClear([br], [bc], { fromSkill: true });
          break;
        }
      }
      this.afterSkill();
      return { ok: true };
    }

    /** Rune Burst target pick. */
    targetCell(r, c) {
      if (this.phase !== 'target' || !this.targeting) return { ok: false, reason: 'not-targeting' };
      if (!this.board.inBounds(r, c)) return { ok: false, reason: 'out-of-bounds' };
      const i = this.targeting.member;
      const m = this.members[i];
      this.phase = 'play';
      this.targeting = null;
      m.charge = 0;
      this.stats.skills++;
      const res = this.board.clearArea(r, c, 1);
      this.stats.purified += res.purified.length;
      this.emit('skill', { member: i, skill: 'runeburst', name: m.def.skill.name });
      this.emit('burst', { r, c, cells: res.cells, purified: res.purified });
      const n = res.cells.length + res.purified.length;
      if (this.isBattle && this.enemy && n) this.damageEnemy([this.hitFrom(i, m.atk * 0.6 * n)], { skill: 'runeburst' });
      this.afterSkill();
      return { ok: true, destroyed: n };
    }

    afterSkill() {
      if (this.over) return;
      if (this.goal && this.goalMet()) return this.finish(true);
      this.checkStuck();
    }
  }

  window.Session = Session;
})();
