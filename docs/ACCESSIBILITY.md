# Accessibility

What the game offers, what was checked for 1.0 and how, and what it does not do. The check is a test
(`tests/e2e/phase9i.mjs`), so the claims below are re-proved on every push.

## What you can change

| Need | What the game does | Where |
|---|---|---|
| Play without a mouse | Every action has a key; every screen can be walked with the arrow keys, Tab or the d-pad. Keys and controller buttons can be rebound | Options, Controls, “Rebind keys and buttons…” |
| Play with one hand, or a controller | A controller works as it is; one the browser cannot lay out gets a guided setup. Vibration strength and the stick dead zone are settings | Options, Controls |
| Touch | A joystick (position, size, opacity) and tappable skills | Options, Controls |
| Bigger text | Text size 90% to 140% scales all interface text; HUD size 80% to 130% scales the HUD | Options, Accessibility and Video |
| Colour blindness | Standard, Red-green safe and Blue-yellow safe palettes (the Okabe-Ito set) for how dangerous a monster is, how rare an item is, good and bad. Shapes repeat the meaning (a ▲ before the level of a strong monster, rarity letters), so colour is never the only cue | Options, Accessibility |
| Motion and flashing | Reduced motion (on at the start if the system asks for it) stops shaking, flashing, easing and pulsing; screen shake and damage flash have their own sliders down to 0; film grain and CRT filters are off by default | Options, Accessibility and Video |
| Pace | Dialogue can be set to Cards only so play never holds; the training ground lets you try a build without risk; pausing is a button, and the game pauses when the window loses focus | Options, Game and Video |
| Reading tips | Short tips appear once, can be hidden for good, and shown again | Options, Help |

The browser's own zoom works. Pinch-zoom of the page is switched off on purpose: playing with two thumbs on a
phone would zoom the page by accident. The text size setting stands in for it.

## What was checked

The audit opens **every screen of the interface** (46 of them: the title screen and its panels, all pages of the
game menu, the journal and the codex, the settings, the world map, a story scene, a boss card, the ending, the death
screen, the crash screen, the merchant, inn, healer, bounty board and the Elder's dialogue) and measures each one:

| Check | Method | Result |
|---|---|---|
| Names, roles and ARIA, landmarks, target size | [axe-core](https://github.com/dequelabs/axe-core) 4.13.0, rules for WCAG 2.2 A and AA and its best practices | No violations on any screen |
| Colour contrast | Every visible text against what is behind it, worst case over translucent panels and gradients (4.5:1; 3:1 for large text). Disabled controls, runes that do not fit, sold goods and a fallen hero are inactive and exempt | All text passes |
| Dialogs | Every panel is a dialog with a name | Yes |
| Keyboard | Opening a panel moves focus into it; Tab visits every control of a modal panel and wraps (the HUD behind it cannot be reached); the focused control has a visible ring | Yes, on 16 panels |
| Text at 140% | On a phone held sideways (844 × 390) and a desktop (1280 × 720): nothing is cut off, nothing is covered by something else, nothing sits off screen | Yes |
| The page | Language, title, one main landmark, one heading, a label on the canvas | Yes |

**What the audit found and what was done about it**

- an icon-only button without a name (the world seed's confirm button); rank pips with a label but no role
- no landmark or heading on the page: the canvas and the interface now sit in a `main` with a hidden heading, and
  the canvas says it is a drawing and that menus are text
- twelve panels that were plain boxes: they are dialogs now, each with its name
- Tab went from a menu to the HUD buttons behind it, and lost the focus on the Spells page: a modal panel now keeps Tab
  inside it (on the Spells page Tab shows the next hero, as its hint says; the arrow keys move between controls)
- six greys that were below 4.5:1 (empty-list notes, key hints on upgrade cards and heroes, dimmed stat cards, the
  skill key letters on an empty slot, undiscovered codex entries)
- at 140% text: the health, mana and experience bars and the level badge were too short for their text; the
  “What's new” card was taller than a phone; the death screen could not scroll; the upgrade card's key hint was
  pushed out; the sticky hint bar covered the last spells. Line heights and bar heights now grow with the text size
- hard-coded key names in the loadout's help and in two messages: they now follow the player's own bindings

## What it does not do

- **The world cannot be played with a screen reader.** It is drawn on a canvas. The canvas is labelled, and every menu,
  panel, dialogue and banner that is made of text can be read, but moving, fighting and aiming are visual.
- **The title menu is drawn on the canvas** (Continue, New Game, Load Game, Options, Credits). It works with the
  keyboard, mouse, touch and a controller, but a screen reader does not see its choices.
- **Prompts in the world** (“[E] Open treasure”) and monster names, health bars and damage numbers are drawn on the
  canvas for the same reason.
- **Sound is not audited.** The game does not need sound to be played, but no one has gone through each cue to make sure
  that none carries information that is missing on screen.
- **Flashing has not been measured** against a photosensitivity standard. The flash is a setting down to zero and is
  off with reduced motion, and the defaults are mild, but there is no test.
- **Text over the world** (damage numbers, names) has an outline instead of a panel; its contrast depends on what is
  behind it and is not measured.
- **Only Chromium has been tested** (see `RELEASE.md` for the other browsers).

## Keeping it so

`node tests/e2e/phase9i.mjs` runs the audit (about three minutes; `ONLY=names,contrast,dialogs,focus,text140,page`
picks parts). A new screen is added to the list in `tests/e2e/screens.mjs` with a way to open it, and the audit
covers it from then on. `tests/contrast.test.ts` checks the colour tokens themselves.
