'use strict';
/**
 * Save-data layer. Everything persistent (level progress, stars, fragments, roster,
 * team, summon pity) goes through window.GameStorage; nothing else touches localStorage.
 *
 * Same design as the microbe game, so a remote backend can replace localStorage later:
 *   - A backend adapter owns I/O: { load(): Promise<object|null>, save(data): Promise }.
 *   - GameStorage.init() loads once (async) into an in-memory cache.
 *   - Reads are synchronous from the cache; every write updates the cache, then
 *     persists via the adapter (fire-and-forget, errors are logged, never thrown).
 *   - To swap backends: GameStorage.useBackend(myAdapter) before init().
 */
(() => {
  const KEY = 'blockknights.save.v1';
  const START_FRAGMENTS = 50; // enough for one summon so the screen is never a dead end

  function defaultData() {
    const roster = {};
    for (const id of window.DATA.STARTERS) roster[id] = { awaken: 0 };
    return {
      version: 1,
      fragments: START_FRAGMENTS,
      levels: {},             // { [levelId]: { stars, cleared, plays, bestTurns } }
      unlocked: 1,            // highest unlocked level id
      roster,                 // { [charId]: { awaken } }
      team: window.DATA.STARTERS.slice(),
      gacha: { pulls: 0, sinceLegendary: 0 },
      settings: { sound: true },
    };
  }

  /** Default backend: one JSON blob in localStorage. */
  const localBackend = {
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        return Promise.resolve(raw ? JSON.parse(raw) : null);
      } catch (_) {
        return Promise.resolve(null); // private mode / corrupt JSON
      }
    },
    save(data) {
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (_) { /* quota / private mode */ }
      return Promise.resolve();
    },
  };

  let backend = localBackend;
  let data = null;
  let ready = null;

  const int = (v, min = 0) => Math.max(min, Math.floor(Number(v) || 0));

  /** Merge loaded data over defaults so older/partial saves stay valid. */
  function normalize(raw) {
    const d = defaultData();
    if (!raw || typeof raw !== 'object') return d;
    if (raw.fragments != null) d.fragments = int(raw.fragments);
    if (raw.levels && typeof raw.levels === 'object') d.levels = raw.levels;
    d.unlocked = int(raw.unlocked, 1);
    if (raw.roster && typeof raw.roster === 'object') {
      for (const [id, v] of Object.entries(raw.roster)) {
        if (window.DATA.CHARACTERS[id]) d.roster[id] = { awaken: int(v && v.awaken) };
      }
    }
    if (Array.isArray(raw.team)) {
      const team = raw.team.filter(id => d.roster[id]).slice(0, 3);
      if (team.length >= 2) d.team = team;
    }
    if (raw.gacha && typeof raw.gacha === 'object') {
      d.gacha = { pulls: int(raw.gacha.pulls), sinceLegendary: int(raw.gacha.sinceLegendary) };
    }
    if (raw.settings && typeof raw.settings === 'object') d.settings.sound = raw.settings.sound !== false;
    return d;
  }

  function persist() {
    const snapshot = JSON.parse(JSON.stringify(data));
    Promise.resolve(backend.save(snapshot)).catch(err => console.warn('[GameStorage] save failed', err));
  }

  const copy = o => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const emptyResult = () => ({ stars: 0, cleared: false, plays: 0, bestTurns: 0 });

  const GameStorage = {
    KEY,

    useBackend(adapter) { backend = adapter; ready = null; },

    /** Load save data once. Safe to call repeatedly. */
    init() {
      if (!ready) {
        data = defaultData();
        ready = Promise.resolve(backend.load())
          .catch(() => null)
          .then(raw => { data = normalize(raw); });
      }
      return ready;
    },

    // ---- progress
    getProgress() { return { unlocked: data.unlocked, levels: copy(data.levels) }; },
    getLevelResult(id) { return copy(data.levels[id]) || emptyResult(); },
    isUnlocked(id) { return id <= data.unlocked; },
    getUnlocked() { return data.unlocked; },
    totalStars() { return Object.values(data.levels).reduce((s, l) => s + (l.stars || 0), 0); },
    /**
     * Record a finished run. Winning unlocks the next level.
     * @returns {{firstClear:boolean, newStars:number, unlockedNext:boolean}}
     */
    saveLevelResult(id, { stars, won, turns }) {
      const prev = data.levels[id] || emptyResult();
      const firstClear = !!won && !prev.cleared;
      const newStars = won ? Math.max(0, stars - prev.stars) : 0;
      data.levels[id] = {
        stars: won ? Math.max(prev.stars, stars) : prev.stars,
        cleared: prev.cleared || !!won,
        plays: (prev.plays || 0) + 1,
        bestTurns: won ? (prev.bestTurns ? Math.min(prev.bestTurns, turns) : turns) : prev.bestTurns,
      };
      let unlockedNext = false;
      if (won && data.unlocked < id + 1) { data.unlocked = id + 1; unlockedNext = true; }
      persist();
      return { firstClear, newStars, unlockedNext };
    },

    // ---- fragments
    getFragments() { return data.fragments; },
    addFragments(n) {
      data.fragments += int(n);
      persist();
      return data.fragments;
    },
    spendFragments(n) {
      n = int(n);
      if (data.fragments < n) return false;
      data.fragments -= n;
      persist();
      return true;
    },

    // ---- roster / team
    getRoster() { return copy(data.roster); },
    owns(id) { return !!data.roster[id]; },
    getAwaken(id) { return data.roster[id] ? data.roster[id].awaken : 0; },
    /** Grant a hero; duplicates awaken it. @returns {{isNew, awaken, refund}} */
    addCharacter(id, awakenMax, maxedRefund) {
      const cur = data.roster[id];
      let res;
      if (!cur) {
        data.roster[id] = { awaken: 0 };
        res = { isNew: true, awaken: 0, refund: 0 };
      } else if (cur.awaken < awakenMax) {
        cur.awaken += 1;
        res = { isNew: false, awaken: cur.awaken, refund: 0 };
      } else {
        data.fragments += maxedRefund;
        res = { isNew: false, awaken: cur.awaken, refund: maxedRefund };
      }
      persist();
      return res;
    },
    getTeam() { return data.team.slice(); },
    setTeam(ids) {
      const team = ids.filter(id => data.roster[id]).slice(0, 3);
      if (team.length < 2) return false;
      data.team = team;
      persist();
      return true;
    },

    // ---- summon state
    getGacha() { return copy(data.gacha); },
    /** Atomically pay and record a summon's pity bookkeeping. */
    recordPull(cost, rarity) {
      if (data.fragments < cost) return false;
      data.fragments -= cost;
      data.gacha.pulls += 1;
      data.gacha.sinceLegendary = rarity === 'legendary' ? 0 : data.gacha.sinceLegendary + 1;
      persist();
      return true;
    },

    // ---- settings
    getSettings() { return copy(data.settings); },
    setSetting(k, v) { data.settings[k] = v; persist(); },

    /** Wipe everything (debug). */
    reset() { data = defaultData(); persist(); },
  };

  window.GameStorage = GameStorage;
})();
