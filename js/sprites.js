'use strict';
/**
 * Placeholder pixel art, built from rectangles on a tiny grid and cached to
 * offscreen canvases (plus a white silhouette for hit flashes). Every part gets a
 * 1px dark outline pass first, so overlapping parts read as one sprite.
 * Drawn later with image smoothing off, so they scale up as crisp pixels.
 */
(() => {
  const INK = '#1a1020';
  const METAL = '#dfe8f0', WOOD = '#7a5a3a';
  const cache = {};

  /** parts: [x, y, w, h, color, noOutline?] */
  function build(w, h, parts) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = INK;
    for (const p of parts) if (!p[5]) g.fillRect(p[0] - 1, p[1] - 1, p[2] + 2, p[3] + 2);
    for (const p of parts) { g.fillStyle = p[4]; g.fillRect(p[0], p[1], p[2], p[3]); }
    const f = document.createElement('canvas');
    f.width = w; f.height = h;
    const fg = f.getContext('2d');
    fg.drawImage(c, 0, 0);
    fg.globalCompositeOperation = 'source-in';
    fg.fillStyle = '#ffffff';
    fg.fillRect(0, 0, w, h);
    return { img: c, flash: f, w, h };
  }

  /** Humanoid facing right on a 22x24 grid. look: { hat, weapon, shield, body, trim, skin, hair } */
  function humanoid(look, elemColor) {
    const L = look, P = [];
    const add = (...a) => P.push(a);
    // things behind the body
    if (L.weapon === 'spear') { add(16, 1, 1, 21, WOOD); add(15, 1, 3, 2, METAL); }
    if (L.frame) { // Calder's portable 8x8 strapped to his back
      add(0, 3, 7, 10, '#4a4440'); add(1, 4, 5, 8, '#2a2622', 1);
      add(3, 4, 1, 8, '#4a4440', 1); add(1, 7, 5, 1, '#4a4440', 1);
    }
    if (L.shield === 'panel') { add(2, 10, 5, 9, L.trim); add(3, 11, 3, 7, '#6a4a30'); add(3, 13, 3, 1, '#4a3420', 1); }
    else if (L.shield) { add(3, 11, 4, 7, L.trim); add(4, 13, 2, 2, L.body); }
    add(6, 12, 1, 5, L.body);                            // back arm
    add(8, 17, 2, 5, '#3a3040'); add(11, 17, 2, 5, '#3a3040'); // legs
    add(8, 21, 2, 1, INK, 1); add(11, 21, 2, 1, INK, 1);       // boots
    add(7, 11, 7, 7, L.body);                            // torso
    add(7, 15, 7, 1, L.trim); add(10, 11, 1, 4, L.trim);
    add(8, 5, 6, 6, L.skin);                             // head
    add(12, 7, 1, 1, INK, 1);                            // eye
    switch (L.hat) {
      case 'helm':
        add(7, 4, 8, 7, L.hair); add(11, 7, 4, 1, INK, 1); add(9, 1, 3, 3, '#c03030'); break;
      case 'wizard':
        add(6, 5, 10, 1, L.body); add(8, 2, 6, 3, L.body); add(10, 1, 3, 1, L.body); add(8, 4, 6, 1, L.trim); break;
      case 'hood':
        add(7, 4, 8, 3, L.hair); add(7, 7, 2, 4, L.hair); add(10, 9, 4, 1, INK, 1); break;
      case 'halo':
        add(8, 4, 6, 2, L.hair); add(8, 6, 1, 3, L.hair); add(8, 1, 6, 1, '#fff1a8'); break;
      case 'cap':
        add(8, 4, 7, 2, L.body); add(13, 5, 3, 1, L.body); add(7, 2, 1, 3, '#e8e8e8'); add(8, 6, 1, 2, L.hair); break;
      case 'witch':
        add(5, 5, 12, 1, '#2a4a70'); add(8, 2, 6, 3, '#2a4a70'); add(7, 1, 2, 1, '#2a4a70'); add(8, 6, 1, 4, L.hair); break;
      case 'horns':
        add(7, 4, 8, 4, L.body); add(6, 1, 1, 4, L.trim); add(15, 1, 1, 4, L.trim); add(11, 7, 3, 1, INK, 1); break;
      case 'goggles':
        add(8, 3, 6, 3, L.hair); add(8, 6, 1, 4, L.hair); add(9, 4, 5, 1, '#6a4a30', 1); add(12, 3, 2, 2, '#ffd080', 1); break;
      case 'pinned':
        add(8, 4, 6, 2, L.hair); add(7, 5, 2, 3, L.hair); add(9, 10, 4, 1, L.trim, 1); break;
      case 'knot':
        add(8, 4, 6, 2, L.hair); add(8, 6, 1, 2, L.hair); add(6, 4, 2, 2, L.hair); break;
      default:
        add(8, 4, 6, 2, L.hair); break;
    }
    add(14, 12, 2, 3, L.body); add(14, 15, 2, 1, L.skin); // front arm + hand
    switch (L.weapon) {
      case 'sword': add(16, 4, 1, 10, METAL); add(15, 13, 3, 1, L.trim); add(16, 14, 1, 2, WOOD); break;
      case 'staff': add(16, 4, 1, 16, WOOD); add(15, 1, 3, 3, elemColor || L.trim); break;
      case 'dagger': add(16, 10, 1, 5, METAL); add(15, 14, 3, 1, WOOD); break;
      case 'mace': add(16, 9, 1, 8, WOOD); add(15, 6, 3, 3, '#d0d0d8'); break;
      case 'bow': add(17, 6, 1, 12, '#8a5a2a'); add(16, 5, 1, 1, '#8a5a2a'); add(16, 18, 1, 1, '#8a5a2a'); add(18, 7, 1, 10, '#e8e8e8', 1); break;
      case 'rule': add(16, 7, 2, 9, '#6a7480'); add(16, 9, 2, 1, L.trim, 1); break;
      default: break;
    }
    return build(22, 24, P);
  }

  /** Flip a built sprite horizontally (enemies face left). */
  function flipped(s) {
    const out = { w: s.w, h: s.h };
    for (const k of ['img', 'flash']) {
      const c = document.createElement('canvas');
      c.width = s.w; c.height = s.h;
      const g = c.getContext('2d');
      g.translate(s.w, 0); g.scale(-1, 1); g.drawImage(s[k], 0, 0);
      out[k] = c;
    }
    return out;
  }

  // enemies are drawn facing left directly
  const ENEMY_ART = {
    slime: () => build(18, 14, [
      [5, 2, 8, 2, '#6cc04a'], [3, 4, 12, 3, '#6cc04a'], [2, 7, 14, 6, '#6cc04a'],
      [5, 4, 3, 2, '#b0f080', 1], [5, 7, 2, 2, INK, 1], [10, 7, 2, 2, INK, 1], [7, 10, 3, 1, INK, 1],
    ]),
    bat: () => build(24, 14, [
      [1, 3, 8, 3, '#5a3a7a'], [2, 6, 6, 2, '#5a3a7a'], [15, 3, 8, 3, '#5a3a7a'], [16, 6, 6, 2, '#5a3a7a'],
      [9, 4, 6, 7, '#3a2a50'], [9, 2, 1, 2, '#3a2a50'], [14, 2, 1, 2, '#3a2a50'],
      [10, 6, 1, 1, '#ff4040', 1], [13, 6, 1, 1, '#ff4040', 1], [11, 9, 2, 1, METAL, 1],
    ]),
    wisp: () => build(16, 20, [
      [7, 1, 2, 2, '#ff7a3d'], [5, 3, 6, 3, '#ff7a3d'], [3, 6, 10, 12, '#ff7a3d'],
      [5, 8, 6, 9, '#ffd080', 1], [7, 12, 2, 3, '#ffffff', 1], [5, 10, 1, 2, INK, 1], [10, 10, 1, 2, INK, 1],
    ]),
    wolf: () => build(26, 17, [
      [21, 4, 4, 2, '#3a3050'], [7, 6, 14, 6, '#4a4060'], [2, 4, 7, 6, '#4a4060'], [0, 7, 3, 3, '#4a4060'],
      [3, 2, 2, 2, '#4a4060'], [6, 2, 2, 2, '#4a4060'],
      [8, 12, 2, 4, '#3a3050'], [11, 12, 2, 4, '#3a3050'], [16, 12, 2, 4, '#3a3050'], [19, 12, 2, 4, '#3a3050'],
      [4, 6, 1, 1, '#ff4040', 1], [8, 6, 12, 1, '#6a5a80', 1], [1, 9, 2, 1, METAL, 1],
    ]),
    golem: () => build(24, 23, [
      [1, 7, 4, 10, '#4a6878'], [19, 7, 4, 10, '#4a6878'], [6, 17, 4, 5, '#4a6878'], [14, 17, 4, 5, '#4a6878'],
      [5, 6, 14, 11, '#5a7a8a'], [8, 1, 8, 6, '#5a7a8a'], [5, 6, 14, 2, '#4a8a4a', 1], [1, 7, 4, 1, '#4a8a4a', 1],
      [9, 3, 2, 1, '#80e0ff', 1], [13, 3, 2, 1, '#80e0ff', 1], [11, 10, 2, 4, '#80e0ff', 1], [10, 11, 4, 1, '#80e0ff', 1],
    ]),
    wyrm: () => build(34, 28, [
      [14, 2, 15, 10, '#6a3a7a'], [16, 4, 11, 6, '#4a2a5a', 1],                   // wing
      [28, 19, 5, 3, '#4a2a5a'], [10, 15, 19, 9, '#4a2a5a'], [12, 20, 15, 2, '#8a6a9a', 1], // coil + belly
      [7, 7, 6, 11, '#4a2a5a'], [1, 4, 11, 6, '#4a2a5a'], [1, 9, 8, 2, '#2a1a3a'], // neck, head, jaw
      [8, 1, 2, 3, '#c0b0d0'], [11, 2, 2, 2, '#c0b0d0'],                           // horns
      [3, 6, 2, 1, '#c0ff40', 1], [1, 10, 1, 1, METAL, 1], [4, 10, 1, 1, METAL, 1],
      [15, 16, 2, 2, '#a0ff60', 1], [21, 17, 2, 2, '#a0ff60', 1], [25, 15, 2, 2, '#a0ff60', 1],
      [14, 14, 2, 1, '#2a1a3a', 1], [19, 14, 2, 1, '#2a1a3a', 1], [24, 14, 2, 1, '#2a1a3a', 1],
    ]),
    seal: () => build(22, 26, [
      [5, 2, 12, 3, '#5a5a6a'], [3, 5, 16, 19, '#5a5a6a'], [3, 22, 16, 2, '#3a3a48', 1],
      [10, 8, 2, 11, '#80e0ff', 1], [7, 11, 8, 2, '#80e0ff', 1], [7, 16, 8, 1, '#80e0ff', 1],
    ]),
    goblin: () => flipped(humanoid({ hat: 'none', weapon: 'mace', body: '#7a5a3a', trim: '#a08040', skin: '#6cb04a', hair: '#3a5a2a' })),
    revenant: () => flipped(humanoid({ hat: 'helm', weapon: 'sword', shield: true, body: '#3a3048', trim: '#7a6a8a', skin: '#b0a0c0', hair: '#5a5068' })),
  };
  // display scale per enemy art (pixels per grid unit)
  const ENEMY_SCALE = { slime: 5, bat: 4, wisp: 5, wolf: 4, golem: 5, wyrm: 4.5, seal: 4, goblin: 4, revenant: 5 };

  const Sprites = {
    INK,
    hero(id) {
      const k = 'hero:' + id;
      if (!cache[k]) {
        const def = DATA.CHARACTERS[id];
        cache[k] = humanoid(def.look, DATA.elem(def.element).color);
      }
      return cache[k];
    },
    enemy(art) {
      const k = 'enemy:' + art;
      if (!cache[k]) cache[k] = ENEMY_ART[art]();
      return cache[k];
    },
    enemyScale(art) { return ENEMY_SCALE[art] || 4; },

    /** Draw anchored at bottom-centre (x, y). */
    draw(ctx, s, x, y, scale, { flash = false, alpha = 1, sx = 1, sy = 1 } = {}) {
      const w = s.w * scale * sx, h = s.h * scale * sy;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha *= alpha;
      ctx.drawImage(flash ? s.flash : s.img, Math.round(x - w / 2), Math.round(y - h), Math.round(w), Math.round(h));
      ctx.restore();
    },

    /** Head-and-shoulders crop into a box (for portrait cards). */
    portrait(ctx, id, x, y, size) {
      const s = this.hero(id);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(s.img, 4, 0, 14, 14, x, y, size, size);
      ctx.restore();
    },

    /**
     * Menu art for a hero: the full portrait as an <img> when the hero has one (plain
     * <img> loads fine from file://), else the pixel sprite canvas. A portrait that
     * fails to load swaps itself for the sprite.
     */
    heroArt(id, scale = 3, cls = '') {
      const def = DATA.CHARACTERS[id];
      if (!def.portrait) {
        const c = this.heroCanvas(id, scale);
        if (cls) c.classList.add(cls);
        return c;
      }
      const img = document.createElement('img');
      img.className = 'portrait' + (cls ? ' ' + cls : '');
      img.alt = def.name;
      img.decoding = 'async';
      img.draggable = false;
      img.onerror = () => {
        const c = this.heroCanvas(id, scale);
        if (cls) c.classList.add(cls);
        img.replaceWith(c);
      };
      img.src = def.portrait;
      return img;
    },

    /** A standalone canvas element (for HTML menus). */
    heroCanvas(id, scale = 3) {
      const s = this.hero(id);
      const c = document.createElement('canvas');
      c.width = s.w * scale; c.height = s.h * scale;
      c.className = 'sprite';
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.drawImage(s.img, 0, 0, c.width, c.height);
      return c;
    },
  };

  window.Sprites = Sprites;
})();
