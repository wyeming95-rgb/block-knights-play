'use strict';
/**
 * HTML menu screens over the canvas: title, world map (level select), results, summon
 * (gacha), team select and pause. Only one screen is visible at a time; 'play' shows none.
 * Also decides when story scenes play: unseen 'before' scenes when a level is entered from
 * the map or Next, unseen 'after' scenes on a win before the results card.
 */
(() => {
  const $ = id => document.getElementById(id);
  const SCREENS = ['title', 'levels', 'results', 'gacha', 'team', 'pause'];
  let backTarget = 'title';

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function refreshFragments() {
    const f = GameStorage.getFragments();
    document.querySelectorAll('.frag-val').forEach(n => { n.textContent = f; });
  }

  // ---------------------------------------------------------------- title
  function renderTitle() {
    const stars = GameStorage.totalStars();
    const next = Math.min(DATA.LEVELS.length, GameStorage.getUnlocked());
    $('play-sub').textContent = `Chapter 1 · Level ${next} · ${stars}/${DATA.LEVELS.length * 3}★`;
    $('btn-sound').textContent = 'Sound: ' + (SFX.enabled ? 'on' : 'off');
    // the four story leads, current team members outlined
    const box = $('title-heroes');
    if (!box.childElementCount) {
      for (const id of DATA.STARTERS) {
        const fig = el('figure', 'title-hero');
        fig.dataset.id = id;
        fig.appendChild(Sprites.heroArt(id, 3));
        fig.appendChild(el('figcaption', '', DATA.CHARACTERS[id].name.split(' ')[0]));
        box.appendChild(fig);
      }
    }
    const team = GameStorage.getTeam();
    box.querySelectorAll('.title-hero').forEach(f => f.classList.toggle('in-team', team.includes(f.dataset.id)));
  }

  // ---------------------------------------------------------------- story
  const unseen = scenes => scenes.filter(sc => !GameStorage.sceneSeen(sc.id));

  /** Enter a level, playing its unseen 'before' scenes first. */
  function playLevel(id) {
    SFX.unlock();
    Dialogue.play(unseen(STORY.forLevel(id, 'before')), () => Game.startLevel(id));
  }

  /** Called when a finished level's results are due: unseen 'after' scenes on a win, then results. */
  function afterLevel(r) {
    const scenes = r.won ? unseen(STORY.forLevel(r.levelId, 'after')) : [];
    Dialogue.play(scenes, () => showResults(r));
  }

  /** Map story icon: replay what this node has unlocked so far. */
  function replayStory(id) {
    SFX.unlock();
    Dialogue.play(WorldMap.replayable(id), () => WorldMap.render(true));
  }

  // ---------------------------------------------------------------- results
  function starRules(level) {
    const s = level.stars;
    if (level.type === 'puzzle') return ['Complete the seal', `Finish within ${s.t2} turns`, `Finish within ${s.t3} turns`];
    return ['Win the battle', `End with ${Math.round(s.hp * 100)}%+ HP`, `Win within ${s.turns} turns`];
  }

  function showResults(r) {
    const level = DATA.level(r.levelId);
    show('results');
    $('res-level').textContent = `Level ${level.id} · ${level.name}`;
    $('res-title').textContent = r.won ? 'Victory' : 'Defeat';
    $('res-title').className = r.won ? 'win' : 'lose';
    $('res-reason').textContent = r.won ? '' : ({ defeated: 'Your party fell.', nomoves: 'No piece could fit.', turns: 'Out of turns.' }[r.reason] || '');
    const starsEl = $('res-stars');
    starsEl.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const sp = el('span', 'star' + (i < r.stars ? ' on' : ''), i < r.stars ? '★' : '☆');
      sp.style.animationDelay = (0.15 + i * 0.25) + 's';
      starsEl.appendChild(sp);
    }
    // which star rules were met (rule 1 = win; others recomputed from the run)
    const s = level.stars, rules = starRules(level);
    const met = r.won ? (level.type === 'puzzle'
      ? [true, r.turns <= s.t2, r.turns <= s.t3]
      : [true, r.hpRatio >= s.hp, r.turns <= s.turns]) : [false, false, false];
    $('res-star-rules').innerHTML = rules.map((t, i) => `<li class="${met[i] ? 'met' : ''}">${met[i] ? '★' : '☆'} ${t}</li>`).join('');
    const rows = [['Turns', r.turns], ['Lines', r.lines], ['Best combo', 'x' + r.maxCombo]];
    if (level.type === 'battle') rows.push(['Damage', r.damage]);
    if (r.purified) rows.push(['Purified', r.purified]);
    $('res-rows').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    $('res-frag').textContent = r.fragments;
    const unlock = $('res-unlock');
    unlock.hidden = !(r.unlockedNext && DATA.level(level.id + 1));
    if (!unlock.hidden) unlock.textContent = `Level ${level.id + 1} unlocked!`;
    if (r.won && level.id === DATA.LEVELS.length && r.firstClear) {
      unlock.hidden = false;
      unlock.textContent = 'Chapter 1 complete. The Wyrm is down; the Fields are quieter.';
    }
    const next = $('btn-next'), retry = $('btn-retry');
    const hasNext = r.won && DATA.level(level.id + 1);
    next.hidden = !hasNext;
    retry.className = 'btn' + (hasNext ? '' : ' primary');
    refreshFragments();
  }

  // ---------------------------------------------------------------- gacha
  function renderOdds() {
    const G = DATA.GACHA;
    const tiers = G.tiers.filter(t => t.chars.length);
    const total = tiers.reduce((a, t) => a + t.rate, 0);
    // headline rates beside the button, straight from DATA.GACHA (normalised the same way rollSummon is)
    $('rate-line').innerHTML = tiers.map(t => {
      const rr = DATA.RARITY[t.rarity];
      return `<span style="color:${rr.color}">${rr.name} ${+(100 * t.rate / total).toFixed(2)}%</span>`;
    }).join(' · ');
    let html = '<tr><th>Rarity</th><th>Hero</th><th>Chance</th></tr>';
    for (const t of tiers) {
      const rr = DATA.RARITY[t.rarity];
      t.chars.forEach((id, i) => {
        html += `<tr>${i === 0 ? `<td rowspan="${t.chars.length}" style="color:${rr.color}">${rr.name}<br><small>${+(100 * t.rate / total).toFixed(2)}% total</small></td>` : ''}` +
          `<td>${DATA.CHARACTERS[id].name}</td><td>${(100 * t.rate / total / t.chars.length).toFixed(2)}%</td></tr>`;
      });
    }
    $('odds-table').innerHTML = html;
    $('pity-rule').textContent = `Pity: if none of your last ${G.pity - 1} summons was Legendary, the next one is guaranteed Legendary.`;
  }

  function renderGacha() {
    const G = DATA.GACHA, g = GameStorage.getGacha();
    $('pull-cost').textContent = `${G.cost} fragments`;
    $('btn-pull').disabled = GameStorage.getFragments() < G.cost;
    $('pity-line').textContent = `Legendary guaranteed within ${G.pity - g.sinceLegendary} summon${G.pity - g.sinceLegendary === 1 ? '' : 's'} · ${g.pulls} total`;
    refreshFragments();
  }

  /** Rarity first (or pity), then a hero within the tier at equal odds. */
  function rollSummon() {
    const G = DATA.GACHA, g = GameStorage.getGacha();
    const tiers = G.tiers.filter(t => t.chars.length);
    let tier;
    if (g.sinceLegendary + 1 >= G.pity) tier = tiers.find(t => t.rarity === 'legendary');
    if (!tier) {
      let roll = Math.random() * tiers.reduce((a, t) => a + t.rate, 0);
      tier = tiers.find(t => (roll -= t.rate) < 0) || tiers[tiers.length - 1];
    }
    return { rarity: tier.rarity, id: tier.chars[Math.floor(Math.random() * tier.chars.length)] };
  }

  function pull() {
    const G = DATA.GACHA;
    const roll = rollSummon();
    if (!GameStorage.recordPull(G.cost, roll.rarity)) { renderGacha(); return; }
    const res = GameStorage.addCharacter(roll.id, G.awakenMax, G.maxedRefund);
    const def = DATA.CHARACTERS[roll.id], rr = DATA.RARITY[roll.rarity];
    const box = $('gacha-result');
    box.innerHTML = '';
    const card = el('div', 'reveal ' + roll.rarity);
    card.style.setProperty('--rc', rr.color);
    card.appendChild(Sprites.heroArt(roll.id, 4, 'reveal-art'));
    const status = res.isNew ? 'NEW HERO!' : res.refund ? `Fully awakened · +${res.refund} fragments` : `Awakened ${res.awaken}/${G.awakenMax} (+10% HP & ATK)`;
    const E = DATA.elem(def.element);
    card.appendChild(el('div', 'reveal-text',
      `<div class="rarity" style="color:${rr.color}">${rr.name}</div><div class="name">${def.name}</div>` +
      `<div class="elem" style="color:${E.color}">${E.name}</div>` +
      `<div class="status">${status}</div>`));
    box.appendChild(card);
    SFX.play('summon');
    renderGacha();
  }

  // ---------------------------------------------------------------- team
  let teamMsgTimer = 0;
  function teamMsg(t) {
    const m = $('team-msg');
    m.textContent = t;
    m.classList.add('show');
    clearTimeout(teamMsgTimer);
    teamMsgTimer = setTimeout(() => m.classList.remove('show'), 1600);
  }

  function renderTeam() {
    const team = GameStorage.getTeam();
    $('team-count').textContent = `${team.length}/3`;
    const slots = $('team-slots');
    slots.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const s = el('div', 'slot');
      if (team[i]) { s.appendChild(Sprites.heroArt(team[i], 2, 'slot-art')); s.appendChild(el('span', '', DATA.CHARACTERS[team[i]].name)); }
      else s.appendChild(el('span', 'muted', 'empty'));
      slots.appendChild(s);
    }
    const list = $('roster-list');
    list.innerHTML = '';
    for (const def of Object.values(DATA.CHARACTERS)) {
      const owned = GameStorage.owns(def.id);
      const inTeam = team.includes(def.id);
      const aw = GameStorage.getAwaken(def.id), k = 1 + 0.1 * aw;
      const rr = DATA.RARITY[def.rarity], E = DATA.elem(def.element);
      const card = el('button', 'hero-card' + (inTeam ? ' in-team' : '') + (owned ? '' : ' unowned'));
      card.type = 'button';
      card.appendChild(Sprites.heroArt(def.id, 2, 'card-art'));
      card.appendChild(el('div', 'hero-info',
        `<div class="hero-head"><strong>${def.name}</strong> <span style="color:${rr.color}">${rr.name}</span>` +
        ` <span style="color:${E.color}">${E.name}</span>${aw ? ` <span class="aw">+${aw}</span>` : ''}</div>` +
        (owned ? `<div class="stats">HP ${Math.round(def.hp * k)} · ATK ${Math.round(def.atk * k)}</div>` : '<div class="stats">Not owned · find it in Summon</div>') +
        `<div class="pas"><b>${def.passive.name}:</b> ${def.passive.desc}</div>` +
        `<div class="sk"><b>${def.skill.name}</b> (${def.skill.cost} lines${def.skill.combo ? `, combo x${def.skill.combo}+` : ''}): ${def.skill.desc}</div>`));
      if (inTeam) card.appendChild(el('span', 'badge', 'IN TEAM'));
      card.addEventListener('click', () => {
        if (!owned) { teamMsg('Summon this hero first.'); return; }
        const cur = GameStorage.getTeam();
        if (cur.includes(def.id)) {
          if (cur.length <= 2) { teamMsg('A team needs at least 2 heroes.'); return; }
          GameStorage.setTeam(cur.filter(id => id !== def.id));
        } else {
          if (cur.length >= 3) { teamMsg('Team is full. Tap a member to remove them.'); return; }
          GameStorage.setTeam(cur.concat(def.id));
        }
        renderTeam();
      });
      list.appendChild(card);
    }
  }

  // ---------------------------------------------------------------- navigation
  function show(name) {
    const prev = Game.state.screen;
    Dialogue.close();
    if ((name === 'gacha' || name === 'team') && prev !== 'gacha' && prev !== 'team') backTarget = prev === 'results' ? 'levels' : prev;
    for (const s of SCREENS) $('screen-' + s).hidden = s !== name;
    Game.setScreen(name);
    refreshFragments();
    if (name === 'title') renderTitle();
    if (name === 'levels') WorldMap.render();
    if (name === 'gacha') renderGacha();
    if (name === 'team') renderTeam();
    if (name === 'levels' || name === 'title') { if (Game.state.session) Game.quitLevel(); }
  }

  function init() {
    document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
      const go = b.dataset.go;
      show(go === 'back' ? (backTarget === 'play' || backTarget === 'pause' ? 'levels' : backTarget) : go);
    }));
    $('btn-play').addEventListener('click', () => { SFX.unlock(); show('levels'); });
    $('btn-team').addEventListener('click', () => show('team'));
    $('btn-gacha').addEventListener('click', () => show('gacha'));
    $('btn-sound').addEventListener('click', () => {
      SFX.setEnabled(!SFX.enabled);
      GameStorage.setSetting('sound', SFX.enabled);
      renderTitle();
    });
    $('btn-retry').addEventListener('click', () => Game.startLevel(Game.state.lastResult.levelId));
    $('btn-next').addEventListener('click', () => playLevel(Game.state.lastResult.levelId + 1));
    $('btn-pull').addEventListener('click', pull);
    $('btn-resume').addEventListener('click', () => show('play'));
    $('btn-restart').addEventListener('click', () => Game.startLevel(Game.state.levelId));
    $('btn-quit').addEventListener('click', () => show('levels'));
    renderOdds();
    Dialogue.init();
  }

  window.Menu = {
    init,
    show(name) {
      if (name === 'play') {
        Dialogue.close();
        for (const s of SCREENS) $('screen-' + s).hidden = true;
        Game.setScreen('play');
        return;
      }
      show(name);
    },
    showResults,
    afterLevel,
    playLevel,
    replayStory,
  };
})();
