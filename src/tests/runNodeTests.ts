import { executeUnitTests } from './driftEngine.test';

console.log('\n======================================================');
console.log('  ModelWatch ML Drift Engine — Automated Test Suite  ');
console.log('======================================================\n');

const results = executeUnitTests();
let passedCount = 0;
let failedCount = 0;

results.forEach((test, idx) => {
  const symbol = test.passed ? '✓ PASS' : '✗ FAIL';
  const color = test.passed ? '\x1b[32m' : '\x1b[31m';
  const reset = '\x1b[0m';

  console.log(`${idx + 1}. [${test.id}] ${test.name}`);
  console.log(`   Status: ${color}${symbol}${reset}`);
  console.log(`   Details: ${test.details}`);
  if (test.logs.length > 0) {
    console.log(`   Logs: ${test.logs.join(' | ')}`);
  }
  console.log('');

  if (test.passed) passedCount++;
  else failedCount++;
});

console.log('------------------------------------------------------');
console.log(`Summary: Total ${results.length} | Passed: ${passedCount} | Failed: ${failedCount}`);
console.log('======================================================\n');

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
