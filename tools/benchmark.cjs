'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const A = require('../app/algorithms.js');
const root = path.resolve(__dirname, '..');
const results = [];
for (const size of [10, 100, 1000]) {
  let seed = 13013;
  const ordered = Array.from({ length: size }, (_, index) => ({
    id: `P-${index + 1}`,
    deviation: size - index,
    order: index + 1,
  }));
  const random = Array.from({ length: size }, (_, index) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return { id: `R-${index + 1}`, deviation: (seed % 7201) - 3600, order: index + 1 };
  });
  for (const [kind, records] of [
    ['uporządkowane', ordered],
    ['odwrócone', ordered.slice().reverse()],
    ['pseudolosowe', random],
  ]) {
    const result = A.insertionSort(records);
    const reference = records
      .slice()
      .sort(
        (left, right) =>
          Math.abs(right.deviation) - Math.abs(left.deviation) || left.order - right.order,
      );
    assert.deepEqual(result.sorted, reference);
    if (kind === 'uporządkowane') assert.equal(result.comparisons, size - 1);
    if (kind === 'odwrócone') assert.equal(result.comparisons, (size * (size - 1)) / 2);
    results.push({ size, kind, comparisons: result.comparisons, matchesReference: true });
  }
}
const search = [10, 100, 1000].map((size) => {
  const records = Array.from({ length: size }, (_, index) => ({ id: `T-${index + 1}` }));
  const value = {
    size,
    first: A.findTrialById(records, 'T-1').checked,
    last: A.findTrialById(records, `T-${size}`).checked,
    missing: A.findTrialById(records, 'BRAK').checked,
  };
  assert.deepEqual(value, { size, first: 1, last: size, missing: size });
  return value;
});
const report = {
  executedAt: new Date().toISOString(),
  seed: 13013,
  generator: 'LCG 1664525*x + 1013904223 modulo 2^32',
  results,
  search,
};
fs.mkdirSync(path.join(root, 'results'), { recursive: true });
fs.writeFileSync(path.join(root, 'results/benchmark.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(
  path.join(root, 'app/benchmarks.js'),
  `'use strict';\nglobalThis.StageBenchmarks = ${JSON.stringify(report, null, 2)};\n`,
);
console.table(results);
console.table(search);
