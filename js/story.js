'use strict';
/**
 * Chapter 1 story scenes (Ashen Fields, the road to Wyrm Summit). Pure data, exposed as
 * window.STORY; js/dialogue.js plays them, js/menu.js decides when.
 *
 * Scene: { id, title, levelIndex, when, lines }
 *   levelIndex  0-based index into DATA.LEVELS
 *   when        'before' (plays before the level starts) | 'after' (after a win, before results)
 *   lines       [{ speaker, text }]; speaker is a SPEAKERS key, or null for narration
 * Several scenes may share a level + when; they play in array order.
 *
 * Canon notes: Ione meets the group after Goblin Ford. Hesla opposes them until Calder
 * refuses to break a warm stone. Scenes never mention who is on the battle team.
 * Rune stones are people sealed by Solenne Vey. That stays a hint (Orrin's name, warm
 * stones, a voice in a wall) until the Wyrm falls.
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
    mara:     { name: 'Mara', voice: 235 },
    revenant: { name: 'Ashen Revenant', voice: 120 },
    wyrmA:    { name: 'A soft voice', voice: 280 },
    wyrmB:    { name: 'A bitter voice', voice: 110 },
  };

  const L = (speaker, text) => ({ speaker, text });
  const N = text => ({ speaker: null, text });

  const SCENES = [
    // ---------------------------------------------------------------- forest (levels 1–3)
    { id: 'season-book', title: 'The Ashen Fields', levelIndex: 0, when: 'before', lines: [
      N('The Ashen Fields run on rune stones: magic blocks, stacked into walls, bridges, and seals.'),
      N('Calder Voss is a stonecutter. He fits the stones, and he breaks away any row that turns black with rot.'),
      N('This year the rot is faster than he is. Monsters crawl from the cracks, and people vanish in the night.'),
      N('The elder sends Calder north, to find where the rot begins. Neris Cade, the healer, will not let him go alone.'),
      N('Above the clouds, Solenne Vey writes in her tower. She built the great seals. This rot is her doing.'),
      L('solenne', 'A stonecutter and a healer, walking north to save the Fields. Let them. I am not finished.'),
      L('solenne', 'The miller\'s boy, Orrin, from Hollow Mill. He should already be on the road to me.'),
    ] },
    { id: 'ashen-road', title: 'Setting Out', levelIndex: 0, when: 'before', lines: [
      L('neris', 'Calder. You were going to leave before dawn and not say a word.'),
      L('calder', 'The north road is full of monsters. I didn\'t want you hurt.'),
      L('neris', 'I\'m the village healer, and I carry a shield so I can stand in front of people. That includes you.'),
      L('calder', 'The elder wants the source of the rot. The signs lead to Wyrm Summit.'),
      L('neris', 'Then we walk it together. Someone has to bring you home.'),
      L('calder', 'Slimes are spilling out of the broken gate. We clear them, then take the forest road.'),
    ] },
    { id: 'soot', title: 'A Name in the Ash', levelIndex: 0, when: 'after', lines: [
      N('The last slime crumbles to ash. For a breath, the ash whispers a name: "Orrin."'),
      L('calder', 'Did you hear that? The dust just spoke.'),
      N('An older man comes through the gate. Bram, a retired soldier, is Calder\'s oldest friend.'),
      L('bram', 'I heard it. Orrin is the miller\'s boy at Hollow Mill. He has been missing three nights.'),
      L('neris', 'Stones don\'t talk, Bram. Wind does, and wind likes a scare.'),
      L('bram', 'Maybe. Dusk Thicket is next. Bats in the dead trees. I\'ll get you through.'),
    ] },
    { id: 'toll', title: 'The Ford', levelIndex: 2, when: 'before', lines: [
      N('Past the thicket, the only ford is in goblin hands. They rob everyone who tries to cross.'),
      L('bram', 'Goblins stay in the hills. The rot pushed them down. Look at them. Half starved.'),
      L('neris', 'Then we drive them off the crossing, and no further. They\'re hungry. This isn\'t a war.'),
      L('calder', 'We break their line, we cross, and we keep north. That\'s the job.'),
    ] },
    { id: 'flour', title: 'The Warm Stone', levelIndex: 2, when: 'after', lines: [
      N('The goblins scatter and drop a sack of rune stones, pried out of someone\'s wall.'),
      L('neris', 'Why would goblins steal stones?'),
      L('calder', 'Hold on. This one is warm. Finished rune stones are cold, Neris. Always.'),
      L('neris', 'It feels like a living hand. I want to put it down, and I don\'t.'),
      L('bram', 'Then put it down. We don\'t break a warm stone. Not until we understand it.'),
      L('bram', 'The fortress ruins are next. If the stones there are warm, we go in careful.'),
    ] },
    { id: 'auditor', title: 'The Fire Mage', levelIndex: 2, when: 'after', lines: [
      N('On the far bank, a woman in a red coat waits, a small flame turning over her palm.'),
      L('ione', 'Finally. You\'re the stonecutter? I\'ve been here since breakfast, and I hate mornings.'),
      L('calder', 'Calder Voss. And you are?'),
      L('ione', 'Ione Pell. Fire mage, Mages\' Guild. They sent me to learn why the stones fail. Lucky me.'),
      L('ione', 'The ruins ahead hold an old seal, and it\'s cracking. Fire won\'t fit a new stone. You will.'),
      L('neris', 'So you need us.'),
      L('ione', 'I need a stonecutter. The rest of you may come. Try to be a pleasant surprise.'),
    ] },

    // ---------------------------------------------------------------- ruins (levels 4–6)
    { id: 'cure-time', title: 'The Cracking Seal', levelIndex: 3, when: 'before', lines: [
      N('The fortress is a ruin. In the court stands a seal: a wall of rune stones. One row is warm.'),
      L('ione', 'Rot is packed under this court. If the seal splits, it runs into every wall downhill.'),
      L('calder', 'Then I clear the cracked rows and fit new stone. I won\'t touch the warm row.'),
      L('neris', 'How long do we have?'),
      L('ione', 'Not long enough for a debate. Fewer questions. More stonework.'),
    ] },
    { id: 'shifting-weight', title: 'A Sleeper in the Wall', levelIndex: 3, when: 'after', lines: [
      L('ione', 'It\'s holding. Good. Tell me you heard that sound at the end.'),
      L('calder', 'The stones, settling.'),
      L('ione', 'Settling clicks. That was slower. Like someone turning over in their sleep.'),
      L('neris', 'Don\'t say that in a ruin, Ione. Some of us want to sleep later.'),
      L('ione', 'I\'m a scholar. True things, said at the worst time. It\'s a calling.'),
      L('bram', 'Out. Ember Cloister is next, full of fire-wisps. The wayhouse is past it, if it still stands.'),
    ] },
    { id: 'wayhouse', title: 'Wolves at the Door', levelIndex: 5, when: 'before', lines: [
      N('At dusk they reach the wayhouse. Wolves circle the inn, and the rune-stone wall has caved in.'),
      L('bram', 'I hear people inside, trapped under the fallen wall.'),
      L('calder', 'I\'ll cut a path through. Get them out. I\'ll keep the wolves back.'),
      L('neris', 'Test the stones first. A warm one, like the stone at the ford, stays whole.'),
      L('calder', 'There\'s no time to test every stone.'),
      L('neris', 'Then test the ones you can. Please.'),
    ] },
    { id: 'three', title: 'Tam\'s Voice', levelIndex: 5, when: 'after', lines: [
      N('The wolves run. The travelers get out. One stone Calder broke was warm, and it cried out.'),
      L('neris', 'Three people, all alive. Calder, that cry was a man.'),
      L('calder', 'I rushed. I didn\'t test it. I heard him too late.'),
      N('Mara, one of the travelers, goes white and stares at the shards.'),
      L('mara', 'That was Tam. My brother. He vanished on this road last winter. I know his voice.'),
      L('bram', 'Orrin whispered at the gate. Tam cried in the wall. I\'m writing both names.'),
      L('neris', 'The road north starts at a frozen ferry. We leave at dawn, and we test every stone.'),
    ] },

    // ---------------------------------------------------------------- snow (levels 7–9)
    { id: 'hospital-rule', title: 'The Frost Witch', levelIndex: 6, when: 'before', lines: [
      N('Snow covers the climb. A pale woman in a dark coat stands on the frozen ferry and blocks the boat.'),
      L('hesla', 'You broke a warm stone at the wayhouse. I heard it cry from across the valley.'),
      L('calder', 'Who are you?'),
      L('hesla', 'Hesla Venn. The frost witch, if you need a title. I am not here to help you.'),
      L('hesla', 'If a stone is warm, you do not break it. You felt why. Turn around and go home.'),
      L('ione', 'The rot is pouring off the summit. We are going up there to stop it.'),
      L('hesla', 'I know what sleeps on that summit. Smash your way up and you kill more than a beast.'),
      N('She lifts a hand. The river ice rises into a giant golem and steps onto the bank.'),
    ] },
    { id: 'double-fare', title: 'Across the River', levelIndex: 6, when: 'after', lines: [
      N('The golem shatters. Hesla is gone. A line of frost leads up toward the shrine.'),
      L('ferryman', 'You broke the witch\'s golem? Ha. In the boat. I\'ll cross you before she thinks again.'),
      L('neris', 'Do you know Hesla?'),
      L('ferryman', 'She came out of the north years back. Apprentice to Solenne Vey, they say, until she ran.'),
      L('bram', 'Solenne Vey. She designed the great seals. Her name is cut into stones all over the Fields.'),
      L('ferryman', 'Watch the shrine across the river. Rot has the stones. Clear it, or the pass stays shut.'),
    ] },
    { id: 'memorial', title: 'The Shrine of Names', levelIndex: 7, when: 'before', lines: [
      N('The shrine is a wall of carved names. Black rot creeps from letter to letter.'),
      L('ione', 'Leave that rot and it jumps to every stone it touches, until the shrine comes down.'),
      L('calder', 'I\'ll cut a line through it. Call out if a stone is warm. I won\'t repeat the wayhouse.'),
      L('neris', 'These names are the missing. Calder, look how many. Some were carved this month.'),
      L('bram', 'The chisel is still sharp. Someone is adding names as fast as people disappear.'),
    ] },
    { id: 'oath', title: 'Carved on the Inside', levelIndex: 7, when: 'after', lines: [
      N('The rot fades. One stone splits. Inside, where no chisel could reach, a name is carved.'),
      L('calder', 'Orrin. The name from the ash, back at Ashwood Gate.'),
      L('ione', 'These stones are cut solid. No one can carve the inside of one. It isn\'t possible.'),
      L('neris', 'Unless the name was in there before it became a stone.'),
      L('ione', 'I am going to pretend you did not say that until we are out of the snow.'),
      L('calder', 'Hesla\'s tracks go up Cinder Pass. She knows what this means. We follow.'),
    ] },
    { id: 'apology', title: 'Sorry, I Was Holding', levelIndex: 8, when: 'before', lines: [
      N('Cinder Pass is the last road to the summit. The Ashen Revenant blocks the path, a body of ash and stone.'),
      L('revenant', 'Sorry. I was holding the wall. I can\'t hold it any longer.'),
      L('neris', 'It\'s talking, Calder. That is a person, not a monster.'),
      L('calder', 'I hear it. It\'s still coming at us. Stay behind me.'),
      L('ione', 'We can be sorry later. If we die here, we don\'t get a later.'),
    ] },
    { id: 'refused-clear', title: 'The Warm Wall', levelIndex: 8, when: 'after', lines: [
      N('Above the pass, rune stones wall off the summit road. One is warm, and it murmurs.'),
      L('ione', 'One row and the road opens. I hate that I want you to refuse.'),
      L('calder', 'No. That stone is warm. I\'m not breaking another. Not after Tam.'),
      L('hesla', 'Then the wayhouse taught you. Good. Most cutters do not stop.'),
      L('neris', 'You tried to stop us at the ferry. Why help us now?'),
      L('hesla', 'Because you stopped. A warm stone can be calmed and left whole. I will show you.'),
      L('hesla', 'Do not call it friendship. The thing on the summit will not offer you a kind choice.'),
    ] },

    // ---------------------------------------------------------------- summit (level 10)
    { id: 'braid', title: 'The Blight Wyrm', levelIndex: 9, when: 'before', lines: [
      N('The Blight Wyrm coils on the summit, a serpent of black stone. Each breath pushes the rot downhill.'),
      L('bram', 'So that\'s what has been poisoning the Fields.'),
      L('hesla', 'Warm stones are set in its body. Spare them if you can. You will not always manage it.'),
      L('neris', 'My shield stays up. If it hits anyone, it hits me first.'),
      L('ione', 'Very moving. Point me at the cold parts. Those, I can burn.'),
      L('calder', 'Cold stone first. Warm stone only if we have no choice. We finish it here.'),
    ] },
    { id: 'two-voices', title: 'People, Not Stone', levelIndex: 9, when: 'after', lines: [
      N('The Wyrm breaks apart. Voices rise from the falling stones. Two of them speak clearly.'),
      L('wyrmA', 'Thank you. It\'s over. Please don\'t put me back.'),
      L('wyrmB', 'Why did you break us? We were still in here.'),
      L('neris', 'Those were people. Calder, the stones were people.'),
      L('hesla', 'They always were. Solenne Vey seals a living person inside every rune stone.'),
      L('calder', 'Orrin. Tam. The shrine. All the missing. She took them, and the land is built from them.'),
      L('ione', 'The Guild swore it was enchanted rock. I signed that. I have been burning people.'),
      L('hesla', 'Cold stone is a voice, then ash. Already gone. Warm stone is still alive. Remember that.'),
    ] },
    { id: 'load-arrows', title: 'North to the Spires', levelIndex: 9, when: 'after', lines: [
      N('In a hut below the summit, Bram finds a map. Arrows run north out of every village.'),
      L('bram', 'Every arrow ends at the Spires, the city of towers. The oldest mark is six years back.'),
      L('hesla', 'I was her apprentice in the Spires. I ran the day I learned a stone can be a person.'),
      L('hesla', 'She is there now, sealing thousands of people into the towers. She will not stop.'),
      L('calder', 'Then the Spires are next. We stop her, and we bring out everyone still alive in the stone.'),
      L('neris', 'Eat before you promise the world. It\'s a long road, and I won\'t carry you if you faint.'),
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
