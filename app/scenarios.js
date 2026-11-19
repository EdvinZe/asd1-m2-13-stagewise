(function (root) {
  'use strict';
  const Model =
    typeof module !== 'undefined' && module.exports ? require('./model.js') : root.StageModel;
  function control() {
    return {
      format: 'stagewise',
      version: 1,
      speeches: [{ id: 'S-KONTROLA', title: 'Moje pierwsze wystąpienie' }],
      parts: [
        { id: 'P-WSTEP', speechId: 'S-KONTROLA', order: 1, name: 'Wstęp', plannedSeconds: 60 },
        { id: 'P-TRESC', speechId: 'S-KONTROLA', order: 2, name: 'Treść', plannedSeconds: 180 },
        {
          id: 'P-KONIEC',
          speechId: 'S-KONTROLA',
          order: 3,
          name: 'Zakończenie',
          plannedSeconds: 60,
        },
      ],
      trials: [
        {
          id: 'A',
          speechId: 'S-KONTROLA',
          number: 1,
          actualSeconds: { 'P-WSTEP': 70, 'P-TRESC': 200, 'P-KONIEC': 50 },
          note: 'Za dużo szczegółów w rozwinięciu. Zakończenie zbyt szybkie.',
        },
        {
          id: 'B',
          speechId: 'S-KONTROLA',
          number: 2,
          actualSeconds: { 'P-WSTEP': 60, 'P-TRESC': 185, 'P-KONIEC': 55 },
          note: 'Lepsze tempo. Zostawić 5 sekund więcej na podsumowanie.',
        },
      ],
    };
  }
  function boundary() {
    const data = control();
    data.speeches[0].title = 'Granice: minimum, maksimum i zero';
    [1, 3600, 60].forEach((value, index) => {
      data.parts[index].plannedSeconds = value;
    });
    data.trials[0].actualSeconds = { 'P-WSTEP': 0, 'P-TRESC': 7200, 'P-KONIEC': 60 };
    data.trials[1].actualSeconds = { 'P-WSTEP': 1, 'P-TRESC': 3600, 'P-KONIEC': 60 };
    data.trials[0].note = 'Poprawne wartości graniczne: 0 i 7200 sekund.';
    data.trials[1].note = 'Próba idealna: suma odchyleń bezwzględnych = 0.';
    return data;
  }
  function large() {
    const data = Model.emptyDataset();
    data.speeches.push({ id: 'S-DUZE', title: 'Duży zestaw: 1000 części i 1000 prób' });
    for (let index = 0; index < 1000; index += 1)
      data.parts.push({
        id: `P-${index + 1}`,
        speechId: 'S-DUZE',
        order: index + 1,
        name: `Część ${index + 1}`,
        plannedSeconds: 1 + ((index * 37) % 300),
      });
    for (let index = 0; index < 1000; index += 1) {
      const actualSeconds = {};
      for (const part of data.parts)
        actualSeconds[part.id] = Math.max(
          0,
          part.plannedSeconds + ((index * 17 + part.order * 13) % 61) - 30,
        );
      data.trials.push({
        id: `T-${index + 1}`,
        speechId: 'S-DUZE',
        number: index + 1,
        actualSeconds,
        note: `Powtarzalny zestaw demonstracyjny, próba ${index + 1}.`,
      });
    }
    return data;
  }
  const api = { control, boundary, large };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.StageScenarios = api;
})(typeof globalThis === 'undefined' ? this : globalThis);
