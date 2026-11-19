(function (root) {
  'use strict';

  function findTrialById(trials, id) {
    let checked = 0;
    for (const trial of trials) {
      checked += 1;
      if (trial.id === id) return { record: trial, checked };
    }
    return { record: null, checked };
  }

  function compareParts(left, right) {
    const difference = Math.abs(right.deviation) - Math.abs(left.deviation);
    return difference || left.order - right.order;
  }

  function insertionSort(records, compare = compareParts, captureTrace = false) {
    const sorted = records.slice();
    const steps = [];
    let comparisons = 0;
    for (let index = 1; index < sorted.length; index += 1) {
      const key = sorted[index];
      let position = index - 1;
      while (position >= 0) {
        comparisons += 1;
        const before = captureTrace ? sorted.map((record) => record.id) : null;
        const move = compare(sorted[position], key) > 0;
        if (move) sorted[position + 1] = sorted[position];
        if (captureTrace)
          steps.push({
            before,
            decision: `${sorted[position].id} vs ${key.id}: ${move ? 'przesuń w prawo' : 'zatrzymaj'}`,
            after: sorted.map((record) => record.id),
          });
        if (!move) break;
        position -= 1;
      }
      const before = captureTrace ? sorted.map((record) => record.id) : null;
      sorted[position + 1] = key;
      if (captureTrace)
        steps.push({
          before,
          decision: `Wstaw ${key.id} na pozycję ${position + 1}`,
          after: sorted.map((record) => record.id),
        });
    }
    return { sorted, comparisons, steps };
  }

  function summarizeTrial(parts, trial) {
    if (!parts.length) throw new Error('Dodaj co najmniej jedną część planu.');
    let plannedTotal = 0;
    let actualTotal = 0;
    let absoluteDeviation = 0;
    const rows = parts.map((part) => {
      const actual = trial.actualSeconds[part.id];
      if (!Number.isInteger(actual) || actual < 0 || actual > 7200)
        throw new Error('Próba jest niekompletna lub zawiera niepoprawny czas.');
      const deviation = actual - part.plannedSeconds;
      plannedTotal += part.plannedSeconds;
      actualTotal += actual;
      absoluteDeviation += Math.abs(deviation);
      return {
        id: part.id,
        name: part.name,
        order: part.order,
        planned: part.plannedSeconds,
        actual,
        deviation,
      };
    });
    return {
      rows,
      plannedTotal,
      actualTotal,
      totalDeviation: actualTotal - plannedTotal,
      absoluteDeviation,
    };
  }

  function analyzeTrial(parts, trial, captureTrace = false) {
    const summary = summarizeTrial(parts, trial);
    return { ...summary, ranking: insertionSort(summary.rows, compareParts, captureTrace) };
  }

  function compareTrials(parts, first, second) {
    const a = summarizeTrial(parts, first);
    const b = summarizeTrial(parts, second);
    const difference = a.absoluteDeviation - b.absoluteDeviation;
    return {
      a,
      b,
      improvement: Math.abs(difference),
      winnerId: difference === 0 ? null : difference > 0 ? second.id : first.id,
    };
  }

  const api = {
    findTrialById,
    compareParts,
    insertionSort,
    summarizeTrial,
    analyzeTrial,
    compareTrials,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.StageAlgorithms = api;
})(typeof globalThis === 'undefined' ? this : globalThis);
