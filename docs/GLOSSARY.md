# Glossary and style

The words the player reads, and how they are written. `tests/text.test.mjs` checks the rules a machine can check
(marked **checked**); the rest is for whoever writes the next line of text. To read all the text in one go, run
`node scripts/text-dump.mjs` (every player-facing string with its file and line).

## Style

| Rule | Example |
|---|---|
| **British spelling** (checked) | colour, grey, armour, centre, favourite, travellers, defence, synthesised |
| **One ellipsis character**, not three dots (checked) | “The tide… turns…” |
| **Apostrophes are ’**, speech is in “ ” (checked) | the Elder’s book, “Travellers, at last.” |
| **Health, not HP** (checked); mana is mana | “120 / 150 health” |
| Sentence case for buttons, labels and sentences | “Reset to defaults”, “Rest the night” |
| Title Case for names: places, people, spells, runes, towers, quests | Whispering Woods, Frost Nova, A Light in the Dark |
| Shouting capitals only for banners that must be seen from the corner of the eye | “ZONE CLAIMED”, “THE SEAL BREAKS” |
| A dash for a pause is an em dash with spaces; a range is an en dash | “Thin them — a dozen should do”, “1–3” |
| A middle dot separates facts on one line | “Costs 12 mana · 1.5s cooldown” |
| Key hints are in brackets and come from the player’s own bindings, never typed in by hand | “[E]  Open treasure” |
| The player is “you”; the heroes are “the party” or by name | “Your boat glides back to the dock” |
| Numbers: digits for amounts the player compares, words in speech | “Lasts 8 seconds”, “twenty-five of wood” |
| Structures are lower case in running text and Title Case as a name or label | “Build a dock”; the build menu says “Dock” |
| Monster names are plural by English rules (`pluralName` in `core/quest/text.ts`) | Wolves, Mummies, Thorn Witches |

## Terms

| Say | Meaning | Not |
|---|---|---|
| **hero** | one of the three playable characters: Aria, Brann and Cyra | character, unit |
| **party** | the three heroes together; “the active hero” is the one you steer, the others are **resting** (on the bench) | team, squad |
| **health**, **mana** | a hero’s two bars | HP, MP |
| **monster** | anything that attacks the party (“enemy” is a word for code only) | mob |
| **spell** | something a hero casts; **auto-cast** spells fire by themselves, **active skills** are cast with a key and cost mana (Space, Q and R by default) | ability, power |
| **rune** | an item socketed into a spell to change it | gem, mod |
| **loadout** | the spells a hero has equipped; each hero has three **sets** | build |
| **Assist** | a resting hero lends one auto-cast spell at 60% power | support |
| **Resonance** | the rune whose kills cast the next auto spell | |
| **salvage** | turn a spell or rune into gold | sell, destroy |
| **gold** | the money; **wood**, **stone** and **iron** are materials | coins (only for the pickups on the ground) |
| **upgrade** | a card picked at a level-up | perk, talent |
| **tower** | any structure the party builds outdoors: Arcane Spire, Warding Obelisk, Beacon, Waypoint, Bridge Tower, Dock, Expedition Mine | |
| **Expedition Mine** | the structure that opens a mountain’s plateau (the old “climbing tower”) | tower you climb |
| **Skyvault** | the dungeon on the plateau, where the Sovereign waits | |
| **waypoint**, **teleporter** | a waypoint is built; a teleporter stands in every town; both are stops on the travel network | portal (a portal is the exit from a dungeon floor) |
| **zone** | a patch of ground a party can claim; **claimed ground** makes building a quarter cheaper | territory |
| **camp**, **lair**, **warband**, **swarm**, **siege** | a resident group of monsters; a warlord’s den; and three world events | |
| **dungeon** | a lord’s stronghold with floors, **guardians**, **vaults** and a boss; **cave** and **ruins** are small places | |
| **vault** | a locked room on a dungeon floor, opened by a key, levers or plates | secret room |
| **bounty** | a job from a town’s board; **jobs** come from townsfolk, **rumours** from the innkeeper | mission |
| **standing** | what a town thinks of the party: Stranger, Known, Trusted, Hero | reputation (code only) |
| **the Elder** | the story giver in every town; **the Demon Host** is the five lords and the Sovereign | |
| **blight**, **corrupted lands** | the violet, drained ground past 150 tiles | |
| **fog** | the unexplored part of the map | |

## Names

- **Regions:** Verdant Fields, Whispering Woods, Scorched Dunes, Salt Shore, Stonecrest Mountains. “The Verdant
  Fields” takes an article; the regions the world names for itself (Hearthvale, the start region, and generated names like Eldvales) do not.
- **Lords:** Morwen the Hollow Queen, Thornax the Rootbound, Khazreth the Sand Tyrant, Nerezza the Tide Witch,
  Gorvak the Stone Warlord; above them Azrathul the Demon Sovereign.
- **Schools of magic:** Arcane, Frost, Fire, Storm, Force, Life.
- **Rarities:** Common, Uncommon, Rare, Epic, Legendary.
- **Difficulty tiers** (shown on monsters that outclass the party): Blighted, Ashen, Abyssal, Doomed, Cataclysmic.
- **Controls:** the key or button is written as the player has it bound (`glyph()` in `ui/hints.ts`); the pad is
  named by its own labels (A, B, X, Y, LB, RB, LT, RT) and by PlayStation shapes where the controller is one.

## Adding text

1. Put it where it belongs: story and quests in `core/story` and `core/quest`, spells and runes in
   `core/spells`, hints in `core/onboarding/tips.ts`, screens in `ui/*.tsx`.
2. Use the terms above. A term that is missing is added here in the same change.
3. Run `npm test`: `tests/text.test.mjs` fails on a straight apostrophe, three dots, “HP”, an American spelling and
   the other checked rules, and names the file and line.
