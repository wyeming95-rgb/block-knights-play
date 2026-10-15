'use strict';
/**
 * Static game data: piece shapes, elements, heroes, enemies, chapter 1 levels and
 * the summon table. Pure data + a few lookups; exposed as window.DATA.
 */
(() => {
  // ---- pieces (no rotation, so every orientation is its own shape)
  // [id, bag weight, rows]  '#' = block
  const SHAPE_DEFS = [
    ['dot', 1, ['#']],
    ['h2', 3, ['##']],
    ['v2', 3, ['#', '#']],
    ['h3', 3, ['###']],
    ['v3', 3, ['#', '#', '#']],
    ['h4', 2, ['####']],
    ['v4', 2, ['#', '#', '#', '#']],
    ['h5', 1, ['#####']],
    ['v5', 1, ['#', '#', '#', '#', '#']],
    ['sq2', 3, ['##', '##']],
    ['sq3', 1, ['###', '###', '###']],
    ['r23', 1, ['###', '###']],
    ['r32', 1, ['##', '##', '##']],
    ['c3a', 2, ['##', '#.']],
    ['c3b', 2, ['##', '.#']],
    ['c3c', 2, ['#.', '##']],
    ['c3d', 2, ['.#', '##']],
    ['La', 1, ['#.', '#.', '##']],
    ['Lb', 1, ['###', '#..']],
    ['Ja', 1, ['.#', '.#', '##']],
    ['Jb', 1, ['#..', '###']],
    ['Ta', 1, ['###', '.#.']],
    ['Tb', 1, ['.#.', '###']],
    ['Tc', 1, ['#.', '##', '#.']],
    ['Td', 1, ['.#', '##', '.#']],
    ['Sa', 1, ['.##', '##.']],
    ['Za', 1, ['##.', '.##']],
    ['Sb', 1, ['#.', '##', '.#']],
    ['Zb', 1, ['.#', '##', '#.']],
    ['bigL', 1, ['#..', '#..', '###']],
    ['bigJ', 1, ['..#', '..#', '###']],
  ];

  const SHAPES = SHAPE_DEFS.map(([id, weight, rows]) => {
    const cells = [];
    rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') cells.push([r, c]); }));
    return { id, weight, cells, h: rows.length, w: Math.max(...rows.map(r => r.length)), n: cells.length };
  });
  const SHAPE = {};
  SHAPES.forEach(s => { SHAPE[s.id] = s; });

  // index 0 unused (0 = empty cell on the board)
  const PIECE_COLORS = [null, '#e2574c', '#3cc6c0', '#5cc06a', '#4a9fe8', '#9b6be0', '#e86bb0'];

  // ---- elements: attacker beating defender = x1.5, defender beating attacker = x0.75
  const ELEMENTS = {
    fire:   { name: 'Fire',   color: '#ff7a3d', beats: ['nature'] },
    water:  { name: 'Water',  color: '#4aa8ff', beats: ['fire'] },
    nature: { name: 'Nature', color: '#6cd060', beats: ['water'] },
    light:  { name: 'Light',  color: '#fff1a8', beats: ['shadow'] },
    shadow: { name: 'Shadow', color: '#b07cff', beats: ['light'] },
  };
  function elemMult(att, def) {
    if (!att || !def) return 1;
    if (ELEMENTS[att].beats.includes(def)) return 1.5;
    if (ELEMENTS[def].beats.includes(att)) return 0.75;
    return 1;
  }

  const RARITY = {
    starter:   { name: 'Starter',   color: '#a8a4b8' },
    rare:      { name: 'Rare',      color: '#4aa8ff' },
    epic:      { name: 'Epic',      color: '#c07cff' },
    legendary: { name: 'Legendary', color: '#ff9a3d' },
  };

  // ---- heroes. charge = lines needed to fill the skill meter.
  const CHARACTERS = {
    knight: {
      id: 'knight', name: 'Knight', element: 'water', rarity: 'starter', hp: 45, atk: 6,
      passive: { id: 'bulwark', name: 'Bulwark', desc: 'Enemy hits deal 20% less.' },
      skill: { id: 'aegis', name: 'Aegis Strike', cost: 4, desc: 'Shield the party from the next enemy hit and strike for 3x ATK.' },
      look: { hat: 'helm', weapon: 'sword', shield: true, body: '#4a7fd0', trim: '#c9d4e8', skin: '#f0c8a0', hair: '#8a95a8' },
    },
    mage: {
      id: 'mage', name: 'Mage', element: 'fire', rarity: 'starter', hp: 26, atk: 9,
      passive: { id: 'echo', name: 'Arcane Echo', desc: 'Multi-line clears get an extra +50% bonus.' },
      skill: { id: 'runeburst', name: 'Rune Burst', cost: 5, target: true, desc: 'Tap a cell: blast the 3x3 area around it. Damage per cell destroyed.' },
      look: { hat: 'wizard', weapon: 'staff', body: '#c0443a', trim: '#f0a060', skin: '#f0c8a0', hair: '#e8e0d0' },
    },
    rogue: {
      id: 'rogue', name: 'Rogue', element: 'shadow', rarity: 'starter', hp: 30, atk: 7,
      passive: { id: 'opportunist', name: 'Opportunist', desc: '1 in 4 Rogue hits crit for x2 (marble bag, no long droughts).' },
      skill: { id: 'loadeddice', name: 'Loaded Dice', cost: 3, desc: 'Re-deal your unused pieces; every new piece is guaranteed to fit.' },
      look: { hat: 'hood', weapon: 'dagger', body: '#3a3450', trim: '#7a6aa0', skin: '#e0b090', hair: '#2a2438' },
    },
    cleric: {
      id: 'cleric', name: 'Cleric', element: 'light', rarity: 'rare', hp: 34, atk: 6,
      passive: { id: 'mend', name: 'Mend', desc: 'Heal 1 HP per line cleared.' },
      skill: { id: 'sanctuary', name: 'Sanctuary', cost: 4, desc: 'Heal 35% HP and purify up to 4 corruption cells.' },
      look: { hat: 'halo', weapon: 'mace', body: '#e8e4d8', trim: '#d0b060', skin: '#f0c8a0', hair: '#f0d070' },
    },
    ranger: {
      id: 'ranger', name: 'Ranger', element: 'nature', rarity: 'rare', hp: 32, atk: 8,
      passive: { id: 'steady', name: 'Steady Aim', desc: 'Combos survive one extra placement without a clear.' },
      skill: { id: 'volley', name: 'Pinning Volley', cost: 4, desc: 'Strike for 4x ATK and delay the enemy attack by 2 turns.' },
      look: { hat: 'cap', weapon: 'bow', body: '#3f7a3a', trim: '#a07a40', skin: '#e0b090', hair: '#7a4a2a' },
    },
    witch: {
      id: 'witch', name: 'Frost Witch', element: 'water', rarity: 'epic', hp: 30, atk: 9,
      passive: { id: 'chill', name: 'Chill', desc: 'Enemies wait 1 extra turn between attacks.' },
      skill: { id: 'freeze', name: 'Deep Freeze', cost: 5, desc: 'Delay the enemy 3 turns, stop corruption spreading for 4 turns, 2x ATK hit.' },
      look: { hat: 'witch', weapon: 'staff', body: '#5ab0d8', trim: '#e0f4ff', skin: '#e8d8f0', hair: '#d0f0ff' },
    },
    dragoon: {
      id: 'dragoon', name: 'Dragoon', element: 'fire', rarity: 'legendary', hp: 42, atk: 11,
      passive: { id: 'firststrike', name: 'First Strike', desc: "The Dragoon's first hit on each foe deals double." },
      skill: { id: 'dive', name: 'Dragon Dive', cost: 6, desc: 'Clear the fullest row and column, counting as a 2-line attack.' },
      look: { hat: 'horns', weapon: 'spear', body: '#8a2a2a', trim: '#e0a040', skin: '#e0b090', hair: '#401010' },
    },
  };
  const STARTERS = ['knight', 'mage', 'rogue'];

  // ---- enemies. every = turns (placements) between attacks.
  const ENEMIES = {
    slime:    { name: 'Moss Slime',     element: 'nature', hp: 60,  atk: 7,  every: 4, art: 'slime' },
    bat:      { name: 'Dusk Bat',       element: 'shadow', hp: 70,  atk: 9,  every: 3, art: 'bat' },
    goblin:   { name: 'Goblin Raider',  element: 'nature', hp: 160, atk: 12, every: 3, art: 'goblin' },
    wisp:     { name: 'Ember Wisp',     element: 'fire',   hp: 140, atk: 13, every: 3, art: 'wisp' },
    wolf:     { name: 'Shade Wolf',     element: 'shadow', hp: 170, atk: 14, every: 3, art: 'wolf' },
    golem:    { name: 'Mire Golem',     element: 'water',  hp: 300, atk: 22, every: 4, art: 'golem' },
    revenant: { name: 'Ashen Revenant', element: 'shadow', hp: 320, atk: 19, every: 3, art: 'revenant' },
    wyrm: {
      name: 'Blight Wyrm', element: 'shadow', hp: 560, atk: 17, every: 3, art: 'wyrm', boss: true,
      // every `every` turns plant `count` corruption cells (more when below half HP)
      spread: { every: 2, count: 2, enraged: 3 },
    },
  };

  // ---- chapter 1. board rows: '#' block, 'x' corruption, '.' empty
  const LEVELS = [
    { id: 1, name: 'Ashen Gate', type: 'battle', waves: ['slime'], stars: { hp: 0.6, turns: 12 },
      tip: 'Drag pieces onto the board. Fill a row or column to attack!' },
    { id: 2, name: 'Dusk Road', type: 'battle', waves: ['bat', 'slime'], stars: { hp: 0.6, turns: 22 },
      tip: 'Clear on back-to-back turns to build a combo.' },
    { id: 3, name: 'Goblin Ford', type: 'battle', waves: ['goblin'], stars: { hp: 0.5, turns: 18 },
      tip: 'A full skill meter glows. Tap the hero to use it.' },
    { id: 4, name: 'Rune Seal I', type: 'puzzle', goal: { kind: 'lines', target: 8, turns: 22 }, stars: { t2: 20, t3: 16 },
      board: ['........', '........', '........', '........', '........', '##.##.##', '#.####.#', '###..###'],
      tip: 'Puzzle: clear 8 lines before you run out of turns.' },
    { id: 5, name: 'Ember Hollow', type: 'battle', waves: ['wisp', 'wisp'], stars: { hp: 0.5, turns: 26 },
      tip: 'Water beats Fire. Element matchups matter.' },
    { id: 6, name: 'Wolf Den', type: 'battle', waves: ['wolf', 'wolf'], stars: { hp: 0.4, turns: 30 } },
    { id: 7, name: 'Mire Bridge', type: 'battle', waves: ['golem'], stars: { hp: 0.5, turns: 26 },
      tip: 'Golems hit hard but slowly. Save a shield for the big swing.' },
    { id: 8, name: 'Rune Seal II', type: 'puzzle', goal: { kind: 'corruption', turns: 20 }, stars: { t2: 15, t3: 11 },
      board: ['........', '.x....x.', '...xx...', '........', '........', '..x..x..', '...xx...', '.x....x.'],
      tip: 'Puzzle: purify every corrupt cell. Clearing a line purifies corruption in it and next to it.' },
    { id: 9, name: 'Ruined Keep', type: 'battle', waves: ['bat', 'revenant'], stars: { hp: 0.5, turns: 32 },
      board: ['........', '........', '........', '..x..x..', '........', '........', '........', '........'] },
    { id: 10, name: 'Blight Heart', type: 'battle', boss: true, waves: ['wyrm'], stars: { hp: 0.4, turns: 40 },
      board: ['........', '........', '...xx...', '........', '........', '...xx...', '........', '........'],
      tip: 'BOSS: the Wyrm spreads corruption. Corrupt cells block pieces until a line clears through or beside them.' },
  ];

  // ---- summon table (rarity first, then a hero within the tier at equal odds)
  const GACHA = {
    cost: 50,
    pity: 20,            // a Legendary is guaranteed on the 20th summon without one
    awakenMax: 5,
    maxedRefund: 20,     // fragments back when a fully awakened hero is drawn again
    tiers: [
      { rarity: 'legendary', rate: 5,  chars: ['dragoon'] },
      { rarity: 'epic',      rate: 20, chars: ['witch'] },
      { rarity: 'rare',      rate: 75, chars: ['cleric', 'ranger'] },
    ],
  };

  window.DATA = {
    SHAPES, SHAPE, PIECE_COLORS, ELEMENTS, elemMult, RARITY,
    CHARACTERS, STARTERS, ENEMIES, LEVELS, GACHA,
    level: id => LEVELS.find(l => l.id === id) || null,
  };
})();
