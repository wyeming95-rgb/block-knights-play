'use strict';
/**
 * Story scene player: a speech box over whatever is on screen (map or battle), with
 * letter-by-letter typing, short pauses at punctuation, a soft blip per letter pair,
 * and the speaker's portrait card (bounces when they start a line). Two portrait slots,
 * so a conversation keeps the last listener visible but dimmed.
 *
 * Dialogue.play(scenes, onDone) queues one or more STORY scenes. Tap: finish the line,
 * tap again: next line. Skip ends the whole queue. Every scene that started (or was
 * skipped) is marked seen in GameStorage.
 */
(() => {
  const $ = id => document.getElementById(id);
  const CPS_DELAY = 26;                       // ms per letter
  const PAUSE = { '.': 230, '!': 230, '?': 230, ',': 110, ';': 140, ':': 140, '—': 160 };

  let root, titleEl, boxEl, nameEl, typedEl, restEl, slots;
  let queue = [], onDone = null, scene = null, lineIx = 0;
  let typing = false, shown = 0, timer = 0, titleTimer = 0, active = false;

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  // head-and-shoulders shape for characters without portrait art
  const silhouette = color =>
    `<svg class="sil" viewBox="0 0 120 180" aria-hidden="true"><defs><radialGradient id="g${color.slice(1)}" cx="50%" cy="38%" r="70%">` +
    `<stop offset="0" stop-color="${color}" stop-opacity="0.9"/><stop offset="1" stop-color="#0b0812" stop-opacity="1"/></radialGradient></defs>` +
    `<rect width="120" height="180" fill="url(#g${color.slice(1)})"/>` +
    '<path d="M60 34c16 0 26 13 26 31 0 14-7 26-16 31v12c24 4 42 22 44 52v20H6v-20c2-30 20-48 44-52v-12c-9-5-16-17-16-31 0-18 10-31 26-31z" fill="#07050c" opacity="0.92"/></svg>';

  function build() {
    root = el('div', 'story');
    root.id = 'story';
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Story');
    titleEl = el('div', 'story-title');
    const skip = el('button', 'story-skip', 'Skip <span aria-hidden="true">›</span>');
    skip.type = 'button';
    skip.id = 'story-skip';
    skip.addEventListener('pointerdown', e => e.stopPropagation());
    skip.addEventListener('click', e => { e.stopPropagation(); finishAll(); });
    const cast = el('div', 'story-cast');
    slots = ['left', 'right'].map(side => {
      const a = el('div', 'story-actor ' + side);
      a.hidden = true;
      cast.appendChild(a);
      return { el: a, who: null };
    });
    boxEl = el('div', 'story-box');
    nameEl = el('div', 'story-name');
    const p = el('p', 'story-text');
    typedEl = el('span', 'typed');
    restEl = el('span', 'rest');
    p.append(typedEl, restEl);
    boxEl.append(nameEl, p, el('span', 'story-next', '▾'));
    root.append(el('div', 'story-shade'), titleEl, cast, boxEl, skip);
    root.addEventListener('pointerdown', e => { e.preventDefault(); advance(); });
    $('ui').appendChild(root);
    document.addEventListener('keydown', e => {
      if (!active) return;
      if (e.key === 'Escape') { e.preventDefault(); finishAll(); }
      else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); advance(); }
    });
  }

  // ---------------------------------------------------------------- portraits
  function fillActor(slot, who) {
    const sp = STORY.SPEAKERS[who];
    slot.who = who;
    slot.el.innerHTML = '';
    const card = el('div', 'card-frame');
    if (sp.portrait) {
      const img = el('img', 'portrait');
      img.src = sp.portrait;
      img.alt = sp.name;
      img.draggable = false;
      card.appendChild(img);
    } else {
      card.classList.add('silhouette');
      card.innerHTML = silhouette(sp.silhouette || '#333');
    }
    slot.el.appendChild(card);
    slot.el.hidden = false;
  }

  /** Put `who` on stage (keeping their slot if already there), dim everyone else. Returns their slot. */
  function stage(who) {
    const sp = who && STORY.SPEAKERS[who];
    const hasArt = sp && (sp.portrait || sp.silhouette);
    let slot = null;
    if (hasArt) {
      slot = slots.find(s => s.who === who);
      if (!slot) {
        // Calder always stands left; others take the right if free, else replace whoever didn't just speak
        const prev = slots.find(s => s.el.classList.contains('speaking'));
        if (who === 'calder') slot = slots[0];
        else if (!slots[1].who) slot = slots[1];
        else if (!slots[0].who) slot = slots[0];
        else slot = slots.find(s => s !== prev);
        fillActor(slot, who);
      }
    }
    for (const s of slots) {
      const on = s === slot;
      s.el.classList.toggle('speaking', on);
      s.el.classList.remove('bounce');
      if (on) { void s.el.offsetWidth; s.el.classList.add('bounce'); }
    }
    return slot;
  }

  function clearStage() {
    for (const s of slots) { s.who = null; s.el.hidden = true; s.el.classList.remove('speaking', 'bounce'); s.el.innerHTML = ''; }
  }

  // ---------------------------------------------------------------- typing
  function showLine() {
    const line = scene.lines[lineIx];
    const sp = line.speaker && STORY.SPEAKERS[line.speaker];
    boxEl.classList.toggle('narration', !sp);
    boxEl.classList.remove('done');
    nameEl.textContent = sp ? sp.name : '';
    nameEl.hidden = !sp;
    const slot = stage(sp ? line.speaker : null);
    boxEl.classList.toggle('right', slot === slots[1]);   // name plate on the speaker's side
    typedEl.textContent = '';
    restEl.textContent = line.text;   // invisible remainder keeps the wrap stable while typing
    shown = 0;
    typing = true;
    tick();
  }

  function tick() {
    clearTimeout(timer);
    const line = scene.lines[lineIx], text = line.text;
    if (shown >= text.length) { endTyping(); return; }
    const ch = text[shown++];
    typedEl.textContent = text.slice(0, shown);
    restEl.textContent = text.slice(shown);
    if (/[\w]/.test(ch) && shown % 2 === 1) {
      const sp = line.speaker && STORY.SPEAKERS[line.speaker];
      SFX.play('blip', sp ? sp.voice : 240);
    }
    // pause at punctuation, but not inside "..." or before a closing quote
    const next = text[shown];
    let wait = CPS_DELAY;
    if (PAUSE[ch] && next !== ch && next !== '"' && next !== '\'') wait = PAUSE[ch];
    timer = setTimeout(tick, wait);
  }

  function endTyping() {
    clearTimeout(timer);
    typing = false;
    const text = scene.lines[lineIx].text;
    typedEl.textContent = text;
    restEl.textContent = '';
    boxEl.classList.add('done');
  }

  // ---------------------------------------------------------------- flow
  function startScene(s) {
    scene = s;
    lineIx = 0;
    GameStorage.markSceneSeen(s.id);
    clearStage();
    titleEl.textContent = s.title;
    titleEl.classList.remove('show');
    void titleEl.offsetWidth;
    titleEl.classList.add('show');
    clearTimeout(titleTimer);
    titleTimer = setTimeout(() => titleEl.classList.remove('show'), 2600);
    showLine();
  }

  function advance() {
    if (!active) return;
    if (typing) { endTyping(); return; }
    if (lineIx + 1 < scene.lines.length) { lineIx++; SFX.play('pick'); showLine(); return; }
    if (queue.length) { startScene(queue.shift()); return; }
    end(true);
  }

  function finishAll() {
    if (!active) return;
    for (const s of queue) GameStorage.markSceneSeen(s.id);
    queue = [];
    end(true);
  }

  function end(callBack) {
    clearTimeout(timer);
    clearTimeout(titleTimer);
    active = false;
    typing = false;
    scene = null;
    root.hidden = true;
    root.classList.remove('open');
    const cb = onDone;
    onDone = null;
    if (callBack && cb) cb();
  }

  window.Dialogue = {
    init() { if (!root) build(); },
    get active() { return active; },
    /** Play scenes in order, then call onDone (also called right away if there are none). */
    play(scenes, done) {
      if (!root) build();
      if (active) end(false);
      scenes = (scenes || []).filter(Boolean);
      if (!scenes.length) { if (done) done(); return; }
      queue = scenes.slice(1);
      onDone = done || null;
      active = true;
      root.hidden = false;
      void root.offsetWidth;
      root.classList.add('open');
      startScene(scenes[0]);
    },
    /** Close without running the callback (navigation elsewhere took over). */
    close() { if (active) end(false); },
    advance,
    skip: finishAll,
    state() {
      return active ? { active, scene: scene.id, line: lineIx, lines: scene.lines.length, typing, queued: queue.map(s => s.id) } : { active: false };
    },
  };
})();
