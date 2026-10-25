// A rough damage-per-second figure for a resolved spell, for comparing loadouts and runes in the spell panel.
// It counts hits per cast from the spell's shape (projectiles, pierce, chains, areas, zones) and spreads them over
// the cooldown; it ignores movement, misses and overlapping zones, so it is a comparison, not a promise.
import type { ResolvedSpell } from './spells';

/** Damage per second against `targets` monsters standing together; 0 for spells that deal no damage. */
export function estimateDps(r: ResolvedSpell, targets = 1, critChance = 0.05): number {
  const p = r.p, n = Math.max(1, targets);
  const cd = Math.max(0.1, p.cooldown / 1000);
  const crit = 1 + Math.min(1, critChance + p.crit);         // a critical hit deals double
  let perCast: number;
  switch (r.tpl.expr) {
    case 'bolt': case 'wisp': perCast = p.count * Math.min(n, 1 + p.pierce + p.jumps); break;
    case 'glaive': perCast = p.count * 2 * Math.min(n, 1 + p.pierce); break;      // out and back
    case 'chain': perCast = p.count * Math.min(n, 1 + p.jumps); break;
    case 'nova': case 'meteor': case 'slam': perCast = p.count * n * (1 + 0.5 * p.echo); break;
    case 'orbit': perCast = p.count * Math.min(n, 2); break;
    case 'trail': case 'cloud': perCast = Math.max(1, p.duration) * Math.min(n, p.count * 3); break;   // a zone hurts each second it lasts
    default: return 0;
  }
  const burn = p.burn > 0 ? p.burn * Math.min(n, perCast) : 0;                  // burning keeps ticking on everyone hit
  return Math.round((p.damage * perCast * crit) / cd + burn);
}
