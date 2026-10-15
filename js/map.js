'use strict';
/**
 * World map (the level select): one tall scrolling picture that climbs from the forest
 * (bottom) through the ruins to the snow, with the boss at the summit. A dotted, glowing
 * road links the level nodes; nodes with story scenes carry a small replay icon. The
 * party marker (Calder's portrait chip) walks the road to a newly unlocked node the first
 * time the map is shown after the unlock.
 */
(() => {
  const MAP_H = 1880;
  // node centres in map pixels (390 wide), bottom to top; [0] is where the road enters
  const PTS = [
    [200, 1880],
    [196, 1690], [292, 1555], [118, 1415],          // forest
    [262, 1215], [112, 1070], [270, 905],           // ruins
    [140, 720], [284, 575], [126, 425],             // snow
    [198, 215],                                     // summit
  ];
  // captions where the road enters each band (the summit is named by its boss node)
  const REGIONS = [
    { name: 'The Ashwood', y: 1782 },
    { name: 'Old Masonry', y: 1312 },
    { name: 'The Frostline', y: 800 },
  ];
  const SVGNS = 'http://www.w3.org/2000/svg';
  const $ = id => document.getElementById(id);

  let built = false, mapEl, scrollEl, partyEl, segs = [];
  let doneEls = [];  // glow + bright dots over the part of the road already travelled
  let walking = null;

  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const starStr = n => '★'.repeat(n) + '☆'.repeat(3 - n);

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function svg(tag, attrs) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  /** Catmull-Rom through PTS as cubic Béziers; segs[i] joins PTS[i] -> PTS[i+1]. */
  function buildSegments() {
    const P = PTS.map(([x, y]) => ({ x, y }));
    const at = i => P[Math.max(0, Math.min(P.length - 1, i))];
    segs = [];
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
      const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
      segs.push(`C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${p2.x} ${p2.y}`);
    }
  }
  /** Path data from node a to node b (indices into PTS). */
  const pathD = (a, b) => `M ${PTS[a][0]} ${PTS[a][1]} ` + segs.slice(a, b).join(' ');

  function build() {
    built = true;
    scrollEl = $('map-scroll');
    mapEl = $('map');
    mapEl.style.height = MAP_H + 'px';
    buildSegments();
    for (const name of ['forest', 'ruins', 'snow']) mapEl.appendChild(el('div', 'map-bg ' + name));
    mapEl.appendChild(el('div', 'map-summit'));

    const road = svg('svg', { class: 'map-road', viewBox: `0 0 390 ${MAP_H}`, width: 390, height: MAP_H, 'aria-hidden': 'true' });
    const full = pathD(0, PTS.length - 1);
    road.appendChild(svg('path', { d: full, class: 'road-bed' }));
    road.appendChild(svg('path', { d: full, class: 'road-dots' }));
    const defs = svg('defs', {});
    const blur = svg('filter', { id: 'road-glow', x: '-20%', y: '-5%', width: '140%', height: '110%' });
    blur.appendChild(svg('feGaussianBlur', { stdDeviation: 4 }));
    defs.appendChild(blur);
    road.prepend(defs);
    doneEls = [svg('path', { class: 'road-glow', filter: 'url(#road-glow)' }), svg('path', { class: 'road-done' })];
    doneEls.forEach(p => road.appendChild(p));
    mapEl.appendChild(road);

    for (const r of REGIONS) {
      const lab = el('div', 'map-region', r.name);
      lab.style.top = r.y + 'px';
      mapEl.appendChild(lab);
    }

    DATA.LEVELS.forEach((lv, i) => {
      const [x, y] = PTS[i + 1];
      const n = el('div', 'map-node' + (lv.boss ? ' boss' : '') + (lv.type === 'puzzle' ? ' puzzle' : '') + (x > 195 ? ' label-left' : ''));
      n.style.left = x + 'px';
      n.style.top = y + 'px';
      n.dataset.level = lv.id;
      const b = el('button', 'node-btn', `<span class="node-num">${lv.boss ? '☠' : lv.id}</span>`);
      b.type = 'button';
      b.dataset.level = lv.id;
      b.setAttribute('aria-label', `Level ${lv.id}, ${lv.name}`);
      b.addEventListener('click', () => { if (!walking) Menu.playLevel(lv.id); });
      n.appendChild(b);
      n.appendChild(el('div', 'node-label', `<span class="node-name">${lv.name}</span><span class="node-stars"></span>`));
      if (STORY.forLevel(lv.id).length) {
        const s = el('button', 'node-story', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v10H9l-5 4z" fill="currentColor"/></svg>');
        s.type = 'button';
        s.dataset.level = lv.id;
        s.setAttribute('aria-label', `Replay story for level ${lv.id}`);
        s.addEventListener('click', e => { e.stopPropagation(); Menu.replayStory(lv.id); });
        n.appendChild(s);
      }
      mapEl.appendChild(n);
    });

    partyEl = el('div', 'map-party', '<div class="chip-wrap"><img class="portrait" src="art/calder.webp" alt="Your party" draggable="false"></div>');
    mapEl.appendChild(partyEl);
  }

  /** Scenes the map may replay for a level: 'before' once unlocked, 'after' once cleared. */
  function replayable(id) {
    const out = [];
    if (GameStorage.isUnlocked(id)) out.push(...STORY.forLevel(id, 'before'));
    if (GameStorage.getLevelResult(id).cleared) out.push(...STORY.forLevel(id, 'after'));
    return out;
  }

  const setDone = n => doneEls.forEach(p => p.setAttribute('d', pathD(0, n)));

  function placeParty(x, y) {
    partyEl.style.transform = `translate(${x}px, ${y}px)`;
  }
  function scrollTo(y, smooth) {
    const top = Math.max(0, Math.min(MAP_H - scrollEl.clientHeight, y - scrollEl.clientHeight * 0.58));
    if (smooth) scrollEl.scrollTo({ top, behavior: 'smooth' });
    else scrollEl.scrollTop = top;
  }

  function walk(from, to) {
    const path = svg('path', { d: pathD(from, to), fill: 'none' });
    mapEl.querySelector('.map-road').appendChild(path);
    const len = path.getTotalLength();
    const dur = Math.min(2600, 700 + 650 * (to - from));
    let t0 = 0;
    partyEl.classList.add('walking');
    const me = walking = { from, to };   // a re-render replaces this token and the old loop stops
    setDone(from);
    const step = ts => {
      if (walking !== me) { path.remove(); return; }
      if (!t0) t0 = ts;
      const k = Math.min(1, (ts - t0) / dur);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const p = path.getPointAtLength(len * e);
      placeParty(p.x, p.y);
      scrollTo(p.y, false);
      if (k < 1) { requestAnimationFrame(step); return; }
      path.remove();
      finishWalk(to);
    };
    setTimeout(() => requestAnimationFrame(step), 450);
  }

  function finishWalk(to) {
    walking = null;
    partyEl.classList.remove('walking');
    setDone(to);
    GameStorage.setMapAt(to);
    const n = mapEl.querySelector(`.map-node[data-level="${to}"]`);
    if (n) { n.classList.remove('arrive'); void n.offsetWidth; n.classList.add('arrive'); }
    SFX.play('ready');
  }

  /** Locked / cleared / current classes, stars and story icons. Returns the current node id. */
  function refreshNodes() {
    const cur = Math.min(DATA.LEVELS.length, GameStorage.getUnlocked());
    for (const lv of DATA.LEVELS) {
      const n = mapEl.querySelector(`.map-node[data-level="${lv.id}"]`);
      const unlocked = GameStorage.isUnlocked(lv.id);
      const res = GameStorage.getLevelResult(lv.id);
      n.classList.toggle('locked', !unlocked);
      n.classList.toggle('cleared', !!res.cleared);
      n.classList.toggle('current', lv.id === cur && !res.cleared);
      n.querySelector('.node-btn').disabled = !unlocked;
      n.querySelector('.node-stars').textContent = unlocked ? starStr(res.stars) : 'Locked';
      const s = n.querySelector('.node-story');
      if (s) {
        const scenes = replayable(lv.id);
        s.hidden = !scenes.length;
        s.classList.toggle('new', scenes.some(sc => !GameStorage.sceneSeen(sc.id)));
      }
    }
    return cur;
  }

  /** Draw node states; unless `keepView`, also place the marker, scroll to it and walk it to a new unlock. */
  function render(keepView) {
    if (!built) build();
    if (keepView === true) { refreshNodes(); return; }
    walking = null;
    partyEl.classList.remove('walking');
    const cur = refreshNodes();
    const from = Math.min(GameStorage.getMapAt(), cur);
    const [fx, fy] = PTS[from];
    placeParty(fx, fy);
    setDone(cur);
    // the screen was just un-hidden: wait a frame so the scroller has its size
    requestAnimationFrame(() => {
      scrollTo(fy, false);
      if (from < cur && !reduceMotion()) walk(from, cur);
      else {
        placeParty(PTS[cur][0], PTS[cur][1]);
        scrollTo(PTS[cur][1], false);
        GameStorage.setMapAt(cur);
      }
    });
  }

  window.WorldMap = {
    render,
    replayable,
    get walking() { return !!walking; },
    nodePos: id => ({ x: PTS[id][0], y: PTS[id][1] }),
  };
})();
