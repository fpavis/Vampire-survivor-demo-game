import { describe, expect, it } from 'vitest';
import { allText, looksLikeText, textIn } from '../scripts/text-dump.mjs';

// The words the player reads follow docs/GLOSSARY.md. These are the rules a machine can check; the rest (tone, the
// right term for a thing) is in the glossary and in the proofreading pass.

/** The text with its `${...}` expressions taken out, so code inside a template is not read as prose. */
function prose(text) {
  let s = text;
  for (let before = ''; before !== s;) { before = s; s = s.replace(/\$\{[^{}]*\}/g, '#'); }
  return s.replace(/\$\{[^}]*$/, '#');           // an expression that runs past the end of the match
}

const RULES = [
  ['an ellipsis is one character: …, not three dots', /\.\.\./],
  ['an apostrophe is ’, not \'', /[A-Za-z]'[A-Za-z]|[a-z]s' /],
  ['speech uses “ ” , not "', /"/],
  ['no space before a comma, semicolon, exclamation or question mark', /[a-z] [,;!?]/],
  ['a word is not repeated', /\b([A-Za-z]{3,}) \1\b/i],
  ['spell it the British way', /\b(?:colors?|colored|armor|gray|centers?|centered|favorites?|honor|neighbors?|travelers?|defense|behavior|(?:realiz|recogniz|synthesiz|customiz|organiz)\w*|fiber|theater|labor)\b/i],
  ['"health", not "HP"', /\bHP\b/],
  ['the Expedition Mine is not a tower you climb', /climbing tower|climb the tower|tower you climb/i]
];

// font stacks and similar are not words for the player
const NOT_TEXT = [/^src[\\/]ui[\\/](?:fonts|style)\.ts$/];

describe('player-facing text', () => {
  it('finds text and leaves code and comments alone', () => {
    expect(looksLikeText('Thin them out.')).toBe(true);
    expect(looksLikeText('Brann')).toBe(true);
    expect(looksLikeText('vs-btn big')).toBe(false);
    expect(looksLikeText('./icons/sword.svg')).toBe(false);
    const found = textIn('x.tsx', "// 'A comment in quotes'\nconst a = 'Real words here'; /* 'More words here' */\nconst b = <b>Shown text</b>;\n");
    expect(found.map((f) => f.text)).toEqual(['Real words here', 'Shown text']);
  });

  it('has the rules catch what they should', () => {
    const bad = { ellipsis: 'Wait...', apostrophe: "the Elder's book", quote: 'He said "no"', space: 'Run , now', twice: 'the the end', us: 'Armor and color', hp: '12 HP left', mine: 'the climbing tower' };
    const hit = (s) => RULES.filter(([, re]) => re.test(prose(s))).length;
    for (const [name, s] of Object.entries(bad)) expect(hit(s), name).toBeGreaterThan(0);
    expect(hit('The Elder’s book: “wait… a moment”, she said.')).toBe(0);
    expect(hit('${a ? "x" : "y"} guardians left')).toBe(0);
  });

  for (const [what, re] of RULES) {
    it(`follows the glossary: ${what}`, () => {
      const hits = [];
      for (const g of allText()) {
        if (NOT_TEXT.some((n) => n.test(g.file))) continue;
        for (const t of g.items) if (re.test(prose(t.text))) hits.push(`${g.file}:${t.line}  ${t.text.slice(0, 90)}`);
      }
      expect(hits).toEqual([]);
    });
  }
});
