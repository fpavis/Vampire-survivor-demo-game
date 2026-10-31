// A fixture for the runner's own test: a suite that passes, and runs after the ones that fail.
import { RESULT_TAG } from '../../e2e/runner-lib.mjs';
console.log('PASS  runs after the failures');
console.log(RESULT_TAG + JSON.stringify({ suite: 'after', checks: 1, failed: 0, failures: [], seed: 2024, ms: 5 }));
