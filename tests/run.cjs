'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../app/algorithms.js');
const M = require('../app/model.js');
const S = require('../app/scenarios.js');
const { RehearsalTimer } = require('../app/timer.js');
const results = [];
function test(name, input, expected, action) {
  try {
    action();
    results.push({ name, input, expected, status: 'PASS' });
  } catch (error) {
    results.push({ name, input, expected, status: 'FAIL', error: error.message });
  }
}
const data = S.control();
const parts = M.orderedParts(data, 'S-KONTROLA');
const [a, b] = data.trials;
const mutated = (change) => {
  const next = structuredClone(data);
  change(next);
  return next;
};
test(
  'Przykład kontrolny A',
  '[60,180,60] → [70,200,50]',
  '300, 320, [+10,+20,−10], 40; treść,wstęp,zakończenie',
  () => {
    const value = A.analyzeTrial(parts, a, true);
    assert.equal(value.plannedTotal, 300);
    assert.equal(value.actualTotal, 320);
    assert.equal(value.totalDeviation, 20);
    assert.deepEqual(
      value.rows.map((row) => row.deviation),
      [10, 20, -10],
    );
    assert.equal(value.absoluteDeviation, 40);
    assert.deepEqual(
      value.ranking.sorted.map((row) => row.id),
      ['P-TRESC', 'P-WSTEP', 'P-KONIEC'],
    );
  },
);
test('Przykład kontrolny B i zwycięzca', '[60,185,55]', '300, [0,+5,−5], 10; B lepsza o 30', () => {
  const value = A.compareTrials(parts, a, b);
  assert.equal(value.b.actualTotal, 300);
  assert.equal(value.b.absoluteDeviation, 10);
  assert.deepEqual(
    value.b.rows.map((row) => row.deviation),
    [0, 5, -5],
  );
  assert.equal(value.winnerId, 'B');
  assert.equal(value.improvement, 30);
});
test('Odrzucenie niekompletnej próby', 'brak P-KONIEC', 'wyjątek, stan niezmieniony', () => {
  const snapshot = JSON.stringify(data);
  const broken = structuredClone(a);
  delete broken.actualSeconds['P-KONIEC'];
  assert.throws(() => M.saveTrial(data, broken));
  assert.throws(() => A.analyzeTrial(parts, broken));
  assert.equal(JSON.stringify(data), snapshot);
});
test('Dokładna zgodność', '[60,180,60]', 'Σ|Δ|=0, Δtotal=0', () => {
  const value = A.analyzeTrial(parts, {
    actualSeconds: { 'P-WSTEP': 60, 'P-TRESC': 180, 'P-KONIEC': 60 },
  });
  assert.equal(value.absoluteDeviation, 0);
  assert.equal(value.totalDeviation, 0);
});
test('Przeciwne odchylenia', '[80,160,60]', 'Δtotal=0, Σ|Δ|=40', () => {
  const value = A.analyzeTrial(parts, {
    actualSeconds: { 'P-WSTEP': 80, 'P-TRESC': 160, 'P-KONIEC': 60 },
  });
  assert.equal(value.totalDeviation, 0);
  assert.equal(value.absoluteDeviation, 40);
});
test('Remis części rozstrzyga kolejność', 'moduły 10,20,10', '[2,1,3]', () => {
  assert.deepEqual(
    A.analyzeTrial(parts, a).ranking.sorted.map((row) => row.order),
    [2, 1, 3],
  );
});
test('Remis prób nie ma zwycięzcy', 'A vs kopia A o innym ID', 'winnerId=null, różnica=0', () => {
  const value = A.compareTrials(parts, a, { ...a, id: 'C' });
  assert.equal(value.winnerId, null);
  assert.equal(value.improvement, 0);
});
test('Pusty zestaw', '[]', 'poprawny zbiór, sortowanie [], wyszukiwanie 0', () => {
  assert.deepEqual(M.validateDataset(M.emptyDataset()), M.emptyDataset());
  assert.deepEqual(A.insertionSort([]), { sorted: [], comparisons: 0, steps: [] });
  assert.deepEqual(A.findTrialById([], 'A'), { record: null, checked: 0 });
  assert.throws(() => A.analyzeTrial([], a));
});
test('Eksport/import odtwarza dane', 'scenariusz kontrolny', 'identyczne dane, Σ|Δ|=40', () => {
  const value = M.importJSON(M.exportJSON(data));
  assert.deepEqual(value, data);
  assert.equal(
    A.analyzeTrial(M.orderedParts(value, 'S-KONTROLA'), value.trials[0]).absoluteDeviation,
    40,
  );
});
test('Błędny JSON nie nadpisuje stanu', '"{broken"', 'wyjątek i identyczny zapis', () => {
  const snapshot = JSON.stringify(data);
  assert.throws(() => M.importJSON('{broken'));
  assert.equal(JSON.stringify(data), snapshot);
});
test('Błędna wersja pliku', 'version=2', 'odrzucenie', () =>
  assert.throws(() => M.importJSON(JSON.stringify({ ...data, version: 2 }))),
);
test('Granice czasów poprawne', 'plan:1,3600; wykonanie:0,7200', 'akceptacja', () =>
  assert.equal(M.validateDataset(S.boundary()).trials.length, 2),
);
for (const invalid of [0, 3601, 1.5, '60', null])
  test(`Niepoprawny plan ${JSON.stringify(invalid)}`, invalid, 'odrzucenie', () =>
    assert.throws(() =>
      M.validateDataset(
        mutated((d) => {
          d.parts[0].plannedSeconds = invalid;
        }),
      ),
    ),
  );
for (const invalid of [-1, 7201, 1.5, '70', null])
  test(`Niepoprawne wykonanie ${JSON.stringify(invalid)}`, invalid, 'odrzucenie', () =>
    assert.throws(() =>
      M.validateDataset(
        mutated((d) => {
          d.trials[0].actualSeconds['P-WSTEP'] = invalid;
        }),
      ),
    ),
  );
test('Powtórzone i puste ID', 'A,A / pusty identyfikator', 'odrzucenie', () => {
  assert.throws(() =>
    M.validateDataset(
      mutated((d) => {
        d.trials[1].id = 'A';
      }),
    ),
  );
  assert.throws(() =>
    M.validateDataset(
      mutated((d) => {
        d.parts[0].id = '';
      }),
    ),
  );
});
test('Niepoprawna relacja i kolejność', 'brak wystąpienia / powtórzone order', 'odrzucenie', () => {
  assert.throws(() =>
    M.validateDataset(
      mutated((d) => {
        d.parts[0].speechId = 'BRAK';
      }),
    ),
  );
  assert.throws(() =>
    M.validateDataset(
      mutated((d) => {
        d.parts[0].order = 2;
      }),
    ),
  );
});
test('Dodatkowy czas nieznanej części', 'extra:1', 'odrzucenie', () =>
  assert.throws(() =>
    M.validateDataset(
      mutated((d) => {
        d.trials[0].actualSeconds.EXTRA = 1;
      }),
    ),
  ),
);
test('ID i numer istniejącej próby niezmienne', 'edycja numeru A z 1 na 5', 'odrzucenie', () =>
  assert.throws(() => M.saveTrial(data, { ...a, number: 5 })),
);
test('Zmiana planu chroni próby', 'zmiana 60 na 65 bez zgody', 'odrzucenie bez zmian', () => {
  const updated = parts.map((part, index) =>
    index === 0 ? { ...part, plannedSeconds: 65 } : part,
  );
  assert.throws(() => M.replacePlan(data, 'S-KONTROLA', 'Nowy', updated));
  assert.equal(data.trials.length, 2);
  assert.equal(data.parts[0].plannedSeconds, 60);
  const next = M.replacePlan(data, 'S-KONTROLA', 'Nowy', updated, true);
  assert.equal(next.trials.length, 0);
  assert.equal(next.parts[0].plannedSeconds, 65);
});
test(
  'Niepoprawna transakcja jest atomowa',
  'zmiana tytułu i niepoprawny plan',
  'oryginalny tytuł, plan i próby zachowane',
  () => {
    const snapshot = JSON.stringify(data);
    assert.throws(() =>
      M.replacePlan(data, 'S-KONTROLA', 'Nowy tytuł', [{ ...parts[0], plannedSeconds: -1 }], true),
    );
    assert.equal(JSON.stringify(data), snapshot);
  },
);
test('Edycja próby aktualizuje wynik', 'B: wstęp 60→90', 'Σ|Δ|=40, zachowane ID i numer', () => {
  const next = M.saveTrial(data, { ...b, actualSeconds: { ...b.actualSeconds, 'P-WSTEP': 90 } });
  assert.equal(A.analyzeTrial(parts, next.trials[1]).absoluteDeviation, 40);
  assert.equal(next.trials[1].id, 'B');
  assert.equal(next.trials[1].number, 2);
});
test('Wyszukiwanie: początek, koniec, brak', '[A,B], szukane A/B/X', 'liczniki 1/2/2', () => {
  assert.equal(A.findTrialById(data.trials, 'A').checked, 1);
  assert.equal(A.findTrialById(data.trials, 'B').checked, 2);
  assert.deepEqual(A.findTrialById(data.trials, 'X'), { record: null, checked: 2 });
  assert.equal(
    A.findTrialById(
      [
        { id: 'X', number: 1 },
        { id: 'X', number: 2 },
      ],
      'X',
    ).record.number,
    1,
  );
});
test(
  'Sortowanie: uporządkowane, odwrotne, remisy',
  '3 zbiory, niezależny Array.sort',
  'ten sam wynik, brak mutacji wejścia',
  () => {
    for (const values of [
      [30, 20, 10],
      [10, 20, 30],
      [10, -10, 10],
    ]) {
      const records = values.map((deviation, index) => ({
        id: String(index),
        deviation,
        order: index + 1,
      }));
      const snapshot = JSON.stringify(records);
      const reference = records
        .slice()
        .sort((x, y) => Math.abs(y.deviation) - Math.abs(x.deviation) || x.order - y.order);
      assert.deepEqual(A.insertionSort(records).sorted, reference);
      assert.equal(JSON.stringify(records), snapshot);
    }
  },
);
test('Dokładne liczniki sortowania', 'n=10: uporządkowane i odwrócone', '9 / 45', () => {
  const records = Array.from({ length: 10 }, (_, i) => ({
    id: `P-${i}`,
    deviation: 10 - i,
    order: i + 1,
  }));
  assert.equal(A.insertionSort(records).comparisons, 9);
  assert.equal(A.insertionSort(records.slice().reverse()).comparisons, 45);
});
test(
  'Rzeczywisty stan pośredni',
  'ranking próby A',
  'pierwszy krok: przesunięcie WSTĘP, 2 porównania',
  () => {
    const value = A.analyzeTrial(parts, a, true);
    assert.deepEqual(value.ranking.steps[0].before, ['P-WSTEP', 'P-TRESC', 'P-KONIEC']);
    assert.deepEqual(value.ranking.steps[0].after, ['P-WSTEP', 'P-WSTEP', 'P-KONIEC']);
    assert.equal(value.ranking.steps[0].decision, 'P-WSTEP vs P-TRESC: przesuń w prawo');
    assert.equal(value.ranking.comparisons, 2);
  },
);
test(
  'Stoper: start, pauza, wznowienie, limit',
  'zegar deterministyczny',
  '2s; pauza 2s; wznowienie 3s; limit 7200',
  () => {
    let now = 0;
    const timer = new RehearsalTimer(() => now);
    timer.start();
    now = 2500;
    assert.equal(timer.pause(), 2);
    now = 10000;
    assert.equal(timer.seconds(), 2);
    timer.start();
    now = 10500;
    assert.equal(timer.pause(), 3);
    timer.reset(7199);
    timer.start();
    now = 20000;
    assert.equal(timer.seconds(), 7200);
    timer.reset();
    assert.equal(timer.seconds(), 0);
    assert.equal(timer.running, false);
  },
);
test(
  'Tekst HTML pozostaje danymi',
  '<img src=x onerror=alert(1)>',
  'zachowany tekst, bez ewaluacji',
  () => {
    const text = '<img src=x onerror=alert(1)>';
    const value = M.validateDataset(
      mutated((d) => {
        d.speeches[0].title = text;
        d.trials[0].note = text;
      }),
    );
    assert.equal(value.speeches[0].title, text);
  },
);
test(
  'Duży scenariusz i limit rekordów',
  '1000 części i 1000 prób, następnie 1001',
  '1000 akceptowane; 1001 odrzucone',
  () => {
    const large = M.validateDataset(S.large());
    assert.equal(large.parts.length, 1000);
    assert.equal(large.trials.length, 1000);
    assert.equal(A.findTrialById(large.trials, 'T-1000').checked, 1000);
    assert.equal(A.findTrialById(large.trials, 'BRAK').checked, 1000);
    large.parts.push({ ...large.parts[0], id: 'P-1001', order: 1001 });
    assert.throws(() => M.validateDataset(large));
  },
);
const output = {
  executedAt: new Date().toISOString(),
  total: results.length,
  passed: results.filter((result) => result.status === 'PASS').length,
  results,
};
fs.mkdirSync(path.join(__dirname, '../results'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '../results/tests.json'), JSON.stringify(output, null, 2));
for (const result of results)
  console.log(`${result.status} ${result.name}${result.error ? ': ' + result.error : ''}`);
console.log(`${output.passed}/${output.total} PASS`);
if (output.passed !== output.total) process.exitCode = 1;
