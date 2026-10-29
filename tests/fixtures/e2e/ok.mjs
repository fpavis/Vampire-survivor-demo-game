// A fixture: a suite that passes.
import { RESULT_TAG } from '../../e2e/runner-lib.mjs';
console.log('PASS  one');
console.log('PASS  two');
console.log(RESULT_TAG + JSON.stringify({ suite: 'ok', checks: 2, failed: 0, failures: [], seed: 2024, ms: 5 }));
