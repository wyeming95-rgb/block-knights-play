'use strict';
/**
 * Chapter 1 story scenes ("The Quiet Seats", Ashen Fields). Pure data, exposed as
 * window.STORY; js/dialogue.js plays them, js/menu.js decides when.
 *
 * Scene: { id, title, levelIndex, when, lines }
 *   levelIndex  0-based index into DATA.LEVELS
 *   when        'before' (plays before the level starts) | 'after' (after a win, before results)
 *   lines       [{ speaker, text }]; speaker is a SPEAKERS key, or null for narration
 * Several scenes may share a level + when; they play in array order.
 *
 * Canon notes: the company's bonds stay on the story-draft clock (Ione arrives at the
 * end of the forest, Hesla opposes until the refused clear). Scenes never mention who
 * is on the battle team. Twist A (the blocks are people) is held back until the Wyrm.
 */
(() => {
  // portrait: art shown in the speech UI. Without one: silhouette (named characters) or name only.
  // voice: base pitch (Hz) of the typing blip.
  const SPEAKERS = {
    calder:   { name: 'Calder', portrait: 'art/calder.webp', voice: 150 },
    neris:    { name: 'Neris', portrait: 'art/neris.webp', voice: 250 },
    ione:     { name: 'Ione', portrait: 'art/ione.webp', voice: 320 },
    hesla:    { name: 'Hesla', portrait: 'art/hesla.webp', voice: 215 },
    bram:     { name: 'Bram', silhouette: '#3a5a6a', voice: 165 },
    solenne:  { name: 'Solenne Vey', silhouette: '#6a1a2a', voice: 190 },
    ferryman: { name: 'Ferryman', voice: 180 },
    scrapper: { name: 'Masked scrapper', voice: 200 },
    revenant: { name: 'Ashen Revenant', voice: 120 },
    wyrmA:    { name: 'A pale mouth', voice: 280 },
    wyrmB:    { name: 'A dull mouth', voice: 110 },
  };

  const L = (speaker, text) => ({ speaker, text });
  const N = text => ({ speaker: null, text });

  const SCENES = [
    // ---------------------------------------------------------------- forest (levels 1–3)
    { id: 'season-book', title: 'The Season Book', levelIndex: 0, when: 'before', lines: [
      N('Far above the Fields, in a room that never gets cold, a pen scratches.'),
      L('solenne', 'Thirty winters. The same line at the foot of every page.'),
      L('solenne', 'The ward is standing. The fever has not come back. The Fields are pulling loose, as I knew they would.'),
      L('solenne', 'There is a salvage cutter on the Ashen road. Let him cut. A guilty man keeps the work tidy.'),
      L('solenne', 'Ivo seated. Replace him this season.'),
    ] },
    { id: 'ashen-road', title: 'The Ashen Road', levelIndex: 0, when: 'before', lines: [
      L('neris', 'Your frame sits high on the left. Sorry. Fix it, or I fix it while you walk.'),
      L('calder', 'It sits how it sits.'),
      L('neris', 'Then it sits wrong. The works did not send me out here to watch you limp to a porch.'),
      L('calder', 'They sent you so I am not alone at one. I read the wording.'),
      L('neris', 'Good. Slimes in the furrow. Animals in a bad grid, nothing more. Clear lines, do not chase them.'),
      L('calder', 'Cold stock only. If a brick is warm, we wait.'),
    ] },
    { id: 'soot', title: 'Soot', levelIndex: 0, when: 'after', lines: [
      N('The cleared line goes to ash. For a breath, the ash says a name. "Orrin."'),
      L('calder', 'Who is Orrin?'),
      L('bram', 'Nobody on my roll. Soot in the cracks. The Fields have been muttering since the burn.'),
      L('neris', 'You are the militia medic. Holt.'),
      L('bram', 'And you are the brace they sent with the cutter. We have both read the posting. How nice for us.'),
      L('calder', 'Sorry. I put weight on you.'),
      L('bram', 'He apologizes to bricks. Someone write that down. Not me. I am out of paper.'),
    ] },
    { id: 'toll', title: 'Goblin Ford', levelIndex: 2, when: 'before', lines: [
      L('scrapper', 'Toll. The sack eats if you don\'t.'),
      L('neris', 'The masks are cloth, Calder. Those are people.'),
      L('calder', 'Then we break the line, not them. Drive them off the ford.'),
    ] },
    { id: 'flour', title: 'Flour, Not a Hoard', levelIndex: 2, when: 'after', lines: [
      N('The scrappers scatter into the reeds. One runner gets clear with nothing in his hands. The sack they dropped is heavy.'),
      L('neris', 'It is flour. They were feeding a camp.'),
      L('bram', 'Toll paid in full, then. I will take my change in bread.'),
      L('calder', 'Leave half on the stone. They will come back for it.'),
    ] },
    { id: 'auditor', title: 'The Auditor', levelIndex: 2, when: 'after', lines: [
      N('Where the trees thin, a woman in guild gloves is waiting on the road with a satchel of forms.'),
      L('ione', 'Calder Voss? Ione Pell, licensed spark-mason. The guild sent me to audit your frame.'),
      L('calder', 'Audit it for what.'),
      L('ione', 'Irregularities. Unlogged cuts. A malpractice name on file. Step one, I watch. Step two, I write it down.'),
      L('ione', 'Step three, please do not watch me write. I lose numbers when I am perceived.'),
      L('bram', 'An auditor. And I thought this road was short on paperwork.'),
    ] },

    // ---------------------------------------------------------------- ruins (levels 4–6)
    { id: 'cure-time', title: 'Cure Time', levelIndex: 3, when: 'before', lines: [
      N('Past the trees the road runs over old masonry. Frost on every stone but one course, which is warm.'),
      L('calder', 'That course is warm. We do not spend it. We seal it.'),
      L('ione', 'A quiet-seal. No strike. The turns are cure-time. Step one, count them. Step two, I am not lighting anything.'),
      L('neris', 'And if the turns run out, the course shears. I would rather not find out what is under it.'),
    ] },
    { id: 'shifting-weight', title: 'Glass, or Weight', levelIndex: 3, when: 'after', lines: [
      L('ione', 'It held. Did you hear the sound it made, right at the end?'),
      L('calder', 'Settling.'),
      L('ione', 'Glass settles with a tick. That was slower. Like someone shifting their weight.'),
      L('neris', 'Stone does not carry weight. It is the weight.'),
      L('ione', 'Yes. I am going to write "settling." Then I am going to underline it twice and not know why.'),
    ] },
    { id: 'wayhouse', title: 'The Wayhouse', levelIndex: 5, when: 'before', lines: [
      L('bram', 'Three inside. A carter, his sister, an old man. Pinned under the east beam. Wolves denning in the cellar, because of course they are.'),
      L('calder', 'I clear the footing. You pull them out.'),
      L('neris', 'Test the bricks first. All of them.'),
      L('calder', 'There is no time to test all of them.'),
      L('neris', '...Then test the ones you can.'),
    ] },
    { id: 'three', title: 'Three', levelIndex: 5, when: 'after', lines: [
      N('The line clears. The beam drops an inch, then all the way. One brick in the footing had been warm. Nobody tested it.'),
      L('neris', 'Three. I counted three on that porch. I am still counting three.'),
      L('calder', 'I rushed it.'),
      L('bram', 'You did. I let you.'),
      L('bram', 'Pass the lamp. I am writing their names, and nobody talks while I do it.'),
      N('Nobody does.'),
    ] },

    // ---------------------------------------------------------------- snow (levels 7–9)
    { id: 'hospital-rule', title: 'A Rule, Unthanked', levelIndex: 6, when: 'before', lines: [
      N('Snow at the foot of the climb. A woman in a dark coat stands at the ferry rope as if she owns it.'),
      L('hesla', 'You are the cutter from the Wayhouse.'),
      L('calder', 'Yes.'),
      L('hesla', 'Hesla Venn. I am not here to help you. I am here to give you the rule nobody taught you, because it is cheaper than the next three.'),
      L('hesla', 'If the stone is warm, you do not clear it. You will drop a hospital.'),
      L('neris', 'There is no hospital in the Fields.'),
      L('hesla', 'No. Not in the Fields. Turn back at the ferry. If you climb, I will stop you myself.'),
    ] },
    { id: 'double-fare', title: 'Double Fare', levelIndex: 6, when: 'after', lines: [
      L('ferryman', 'Double fare for the tall one. Boat sits low with you in it, friend. You eat like two men.'),
      L('calder', 'I eat what everyone eats.'),
      L('bram', 'He does. I have watched. It was not inspiring.'),
      N('That night Bram writes in his book by the fire. Slow pulse. Heavy step. Too slow for the blood on him.'),
      L('neris', 'Is that about him?'),
      L('bram', 'It is a chart. Charts don\'t get promotions. Go to sleep.'),
    ] },
    { id: 'memorial', title: 'The Memorial Stone', levelIndex: 7, when: 'before', lines: [
      N('A burn memorial at the switchback. Old names in old chisel. At the bottom, newer and sharper: CALDER VOSS, VOSS WARD WORKS.'),
      L('neris', 'That is you.'),
      L('calder', 'A cousin. The name is common in the ward.'),
      L('neris', 'It is not. I have chalked every porch in that ward.'),
      L('calder', 'The stain on the next course is spreading. Can we seal it. Please.'),
      L('ione', 'Corruption stains its neighbours. Clear a line through it or beside it. I will count.'),
    ] },
    { id: 'oath', title: 'One Back Under the Beam', levelIndex: 7, when: 'after', lines: [
      N('Under the frost, a gate stone worn soft by hands: ONE BACK UNDER THE BEAM, THEN WE ALL STAND. QUILL.'),
      L('ione', 'The old mason-oath. It is on the recruiting posters. Block Knights.'),
      L('neris', 'The posters stop after the first half. I never saw the rest.'),
      L('calder', '"Then we all stand." Someone cut that part off.'),
      N('Beside it in the snow, a charity token, half melted. STAYS FEVER WARD. The date is thirty years old.'),
    ] },
    { id: 'apology', title: 'Sorry, I Was Holding', levelIndex: 8, when: 'before', lines: [
      L('revenant', 'Sorry. I was holding.'),
      L('neris', 'It apologized. Calder, it apologized.'),
      L('calder', 'So do I. It never stops the wall coming down. Cut it clean.'),
    ] },
    { id: 'refused-clear', title: 'The Refused Clear', levelIndex: 8, when: 'after', lines: [
      N('Below the summit a full course lies across the path. One clear would open the way. The stone is warm, and it is murmuring.'),
      L('ione', 'One line and we are through. Step one... I do not have a step one for this.'),
      L('calder', 'That brick is warm. We wait.'),
      L('hesla', 'You will wait until the Wyrm comes down the slope and spends you all.'),
      L('calder', 'Then show us the other way. You know one. You have watched us not know it for three days.'),
      N('Hesla looks at the frame for a long time. Then she puts her hands on it.'),
      L('hesla', 'Quiet-seal. Hold the cure, do not spend it. Watch my hands, not my face. Teaching it does not make me your friend.'),
    ] },

    // ---------------------------------------------------------------- summit (level 10)
    { id: 'braid', title: 'The Braid', levelIndex: 9, when: 'before', lines: [
      N('At the summit the blight is not a beast. It is a braid of cinders as long as the frame, and every part of it has a mouth.'),
      L('bram', 'That is the beast? I have filed bigger complaints.'),
      L('hesla', 'Spare the warm segments if you can. You will not always be able to. Choose anyway.'),
      L('neris', 'Two hands on the panel. Whatever it throws, I have the hit.'),
      L('calder', 'Cold lines first. Then whatever is left.'),
    ] },
    { id: 'two-voices', title: 'Two Voices', levelIndex: 9, when: 'after', lines: [
      N('The braid comes apart. Two of its mouths speak as it goes, in two different voices.'),
      L('wyrmA', 'Thank you.'),
      L('wyrmB', 'You dropped us.'),
      L('neris', 'That was two people. Calder. That was two people.'),
      L('hesla', 'It always was. Seats, not stone. A person, folded under load until they hold weight. The Masonry is made of them.'),
      L('ione', 'I certified courses as relic stone. "Remembers pressure." I signed that. Dozens of times.'),
      L('calder', 'Every line I have cleared.'),
      L('hesla', 'Cinders are already gone. An echo, a name, then ash. Warm stone is not gone yet. That is the whole rule. That is why it exists.'),
    ] },
    { id: 'load-arrows', title: 'Load Arrows', levelIndex: 9, when: 'after', lines: [
      N('In the militia hut below the summit, a chalk map: load arrows drawn out of the Fields, every one pointing toward the Spires.'),
      L('bram', 'Dated six years back. The year of the burn.'),
      N('Bram does not make a joke. Nobody asks him to.'),
      L('hesla', 'That tick in the corner is an Archwright\'s mark. I learned to make it from her. Solenne Vey.'),
      L('calder', 'She drained the Fields to hold something up.'),
      L('hesla', 'Someone.'),
      L('neris', 'Have you eaten? It is a long way to the Spires. Hunger is a different weight, and I will not lift you wrong.'),
    ] },
  ];

  const byLevel = (levelIndex, when) => SCENES.filter(s => s.levelIndex === levelIndex && s.when === when);

  window.STORY = {
    SPEAKERS, SCENES,
    scene: id => SCENES.find(s => s.id === id) || null,
    /** Scenes for a level id (1-based), optionally filtered by 'before' | 'after'. */
    forLevel(levelId, when) {
      const i = window.DATA.LEVELS.findIndex(l => l.id === levelId);
      return when ? byLevel(i, when) : byLevel(i, 'before').concat(byLevel(i, 'after'));
    },
  };
})();
