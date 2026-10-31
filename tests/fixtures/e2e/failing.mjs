// A fixture: a suite with one failing check among passing ones.
import { RESULT_TAG } from '../../e2e/runner-lib.mjs';
console.log('PASS  a thing works');
console.log('FAIL  a spring heals {"hp":101}');
console.log(RESULT_TAG + JSON.stringify({ suite: 'failing', checks: 2, failed: 1, failures: ['a spring heals'], seed: 2024, ms: 5 }));
process.exit(1);
