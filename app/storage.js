(function (root) {
  'use strict';
  const KEY = 'stagewise-v1';
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return { data: raw ? root.StageModel.importJSON(raw) : null, warning: null };
    } catch {
      return {
        data: null,
        warning:
          'Nie udało się odczytać zapisu lokalnego. Otworzono przykład; zapis nie został nadpisany. Używaj eksportu JSON.',
      };
    }
  }
  function save(data) {
    try {
      localStorage.setItem(KEY, root.StageModel.exportJSON(data));
      return null;
    } catch {
      return 'Dane są w pamięci, ale zapis lokalny jest niedostępny lub pełny. Wyeksportuj JSON przed zamknięciem.';
    }
  }
  function download(data, filename) {
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  root.StageStorage = { load, save, download };
})(globalThis);
