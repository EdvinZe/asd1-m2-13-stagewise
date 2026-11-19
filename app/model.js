(function (root) {
  'use strict';
  const FORMAT = 'stagewise';
  const VERSION = 1;
  const LIMIT = 1000;
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const emptyDataset = () => ({
    format: FORMAT,
    version: VERSION,
    speeches: [],
    parts: [],
    trials: [],
  });
  const requireRule = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const validText = (value, max) =>
    typeof value === 'string' && value.trim().length > 0 && value.length <= max;

  function validateDataset(data) {
    requireRule(
      isObject(data) && data.format === FORMAT && data.version === VERSION,
      'Nieobsługiwany format lub wersja pliku. Wymagany stagewise, wersja 1.',
    );
    const ids = new Set();
    for (const kind of ['speeches', 'parts', 'trials']) {
      requireRule(
        Array.isArray(data[kind]) && data[kind].length <= LIMIT,
        `Lista ${kind}: maksymalnie 1000 rekordów.`,
      );
      for (const record of data[kind]) {
        requireRule(
          isObject(record) && typeof record.id === 'string' && /^[A-Z0-9-]{1,80}$/.test(record.id),
          'ID musi zawierać 1–80 znaków A–Z, cyfr lub łączników.',
        );
        requireRule(!ids.has(record.id), `Powtórzone ID: ${record.id}.`);
        ids.add(record.id);
      }
    }
    const speeches = new Map();
    for (const speech of data.speeches) {
      requireRule(validText(speech.title, 160), 'Tytuł musi mieć 1–160 znaków.');
      speeches.set(speech.id, speech);
    }
    const partsBySpeech = new Map();
    for (const part of data.parts) {
      requireRule(speeches.has(part.speechId), `Część ${part.id}: nieznane wystąpienie.`);
      requireRule(validText(part.name, 100), 'Nazwa części musi mieć 1–100 znaków.');
      requireRule(
        Number.isInteger(part.plannedSeconds) &&
          part.plannedSeconds >= 1 &&
          part.plannedSeconds <= 3600,
        'Plan części: całkowite sekundy od 1 do 3600.',
      );
      requireRule(
        Number.isInteger(part.order) && part.order >= 1,
        'Kolejność części musi być dodatnią liczbą całkowitą.',
      );
      if (!partsBySpeech.has(part.speechId)) partsBySpeech.set(part.speechId, []);
      partsBySpeech.get(part.speechId).push(part);
    }
    for (const parts of partsBySpeech.values()) {
      const orders = new Set(parts.map((part) => part.order));
      requireRule(
        orders.size === parts.length && parts.every((part) => part.order <= parts.length),
        'Kolejność części musi tworzyć ciąg 1…n bez powtórzeń.',
      );
    }
    const trialNumbers = new Map();
    for (const trial of data.trials) {
      requireRule(speeches.has(trial.speechId), `Próba ${trial.id}: nieznane wystąpienie.`);
      requireRule(
        Number.isInteger(trial.number) && trial.number >= 1,
        'Numer próby musi być dodatnią liczbą całkowitą.',
      );
      const numberKey = `${trial.speechId}:${trial.number}`;
      requireRule(
        !trialNumbers.has(numberKey),
        'Numery prób w jednym wystąpieniu nie mogą się powtarzać.',
      );
      trialNumbers.set(numberKey, true);
      requireRule(
        typeof trial.note === 'string' && trial.note.length <= 4000,
        'Notatka: maksymalnie 4000 znaków.',
      );
      const parts = partsBySpeech.get(trial.speechId) || [];
      requireRule(
        parts.length > 0 && isObject(trial.actualSeconds),
        'Próba musi mieć plan i czas każdej części.',
      );
      requireRule(
        Object.keys(trial.actualSeconds).length === parts.length,
        'Próba musi zawierać dokładnie jeden czas dla każdej części.',
      );
      for (const part of parts) {
        const value = trial.actualSeconds[part.id];
        requireRule(
          Object.hasOwn(trial.actualSeconds, part.id) &&
            Number.isInteger(value) &&
            value >= 0 &&
            value <= 7200,
          `Część ${part.name}: wykonanie od 0 do 7200 całkowitych sekund. Uzupełnij wszystkie czasy.`,
        );
      }
    }
    return copy(data);
  }

  function orderedParts(data, speechId) {
    const records = data.parts.filter((part) => part.speechId === speechId);
    const ordered = new Array(records.length);
    for (const part of records) ordered[part.order - 1] = part;
    return ordered;
  }

  function transaction(data, change) {
    const next = copy(data);
    change(next);
    return validateDataset(next);
  }

  function replacePlan(data, speechId, title, parts, removeTrials = false) {
    return transaction(data, (next) => {
      const speech = next.speeches.find((record) => record.id === speechId);
      requireRule(Boolean(speech), 'Nie znaleziono wystąpienia.');
      const old = orderedParts(data, speechId);
      const changed = JSON.stringify(old) !== JSON.stringify(parts);
      const hasTrials = next.trials.some((trial) => trial.speechId === speechId);
      requireRule(
        !changed || !hasTrials || removeTrials,
        'Zmiana planu wymaga nowego wystąpienia lub potwierdzonego usunięcia prób.',
      );
      speech.title = title;
      if (changed) {
        next.parts = next.parts.filter((part) => part.speechId !== speechId).concat(parts);
        if (removeTrials) next.trials = next.trials.filter((trial) => trial.speechId !== speechId);
      }
    });
  }

  function saveTrial(data, record) {
    return transaction(data, (next) => {
      const index = next.trials.findIndex((trial) => trial.id === record.id);
      if (index === -1) next.trials.push(copy(record));
      else {
        const old = next.trials[index];
        requireRule(
          old.speechId === record.speechId && old.number === record.number,
          'ID, wystąpienie i numer zapisanej próby są niezmienne.',
        );
        next.trials[index] = copy(record);
      }
    });
  }

  function importJSON(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Niepoprawny JSON. Bieżące dane nie zostały zmienione.');
    }
    return validateDataset(data);
  }

  function exportJSON(data) {
    return JSON.stringify(validateDataset(data), null, 2);
  }
  const api = {
    emptyDataset,
    validateDataset,
    orderedParts,
    transaction,
    replacePlan,
    saveTrial,
    importJSON,
    exportJSON,
    LIMIT,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.StageModel = api;
})(typeof globalThis === 'undefined' ? this : globalThis);
