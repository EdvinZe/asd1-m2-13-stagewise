(function () {
  'use strict';
  const M = StageModel;
  const A = StageAlgorithms;
  const V = StageViews;
  const $ = (selector) => document.querySelector(selector);
  const stored = StageStorage.load();
  let data = stored.data || StageScenarios.control();
  let speechId = data.speeches[0]?.id || null;
  let view = 'overview';
  let draft = { id: null, values: {}, note: '' };
  let detailId = null;
  let compareA = null;
  let compareB = null;
  let labId = null;
  let timerPart = null;
  let dirtyPlan = false;
  let importBusy = false;
  let confirmPending = false;
  const timer = new StageTimer();
  const titles = {
    overview: [
      'Pulpit',
      'Twoja kolej na dobry występ.',
      'Zaplanuj. Przećwicz. Zobacz, co poprawić.',
    ],
    plan: [
      'Plan wystąpienia',
      'Dobry występ zaczyna się od planu.',
      'Rozłóż akcenty. Zadbaj o proporcje.',
    ],
    practice: [
      'Nowa próba',
      'Teraz Twój głos ma pierwszeństwo.',
      'Spokojnie. To tylko próba — i kolejny krok do przodu.',
    ],
    history: [
      'Historia prób',
      'Zobacz, jak daleko już jesteś.',
      'Twoje próby, notatki i konkretne wyniki.',
    ],
    compare: [
      'Porównanie',
      'Postęp widać w szczegółach.',
      'Porównaj dwie próby i znajdź najlepsze proporcje.',
    ],
    lab: [
      'Laboratorium ASD',
      'Zrozum, skąd bierze się wynik.',
      'Wyszukiwanie liniowe. Sortowanie przez wstawianie. Pełna przejrzystość.',
    ],
  };

  function uid(prefix) {
    return `${prefix}-${crypto.randomUUID().toUpperCase()}`;
  }
  function context() {
    const parts = M.orderedParts(data, speechId);
    if (!parts.some((part) => part.id === timerPart)) timerPart = parts[0]?.id || null;
    return {
      speech: data.speeches.find((speech) => speech.id === speechId),
      parts,
      trials: data.trials.filter((trial) => trial.speechId === speechId),
      draft,
      detailId,
      compareA,
      compareB,
      labId,
      timerPart,
      timer,
    };
  }
  function notify(message, error = false) {
    const feedback = $('#feedback');
    feedback.textContent = message;
    feedback.className = error ? 'error' : '';
    feedback.hidden = false;
  }
  function clearNotice() {
    $('#feedback').hidden = true;
  }
  function commit(next) {
    data = next;
    return StageStorage.save(data);
  }
  function resetDraft() {
    draft = { id: null, values: {}, note: '' };
    timer.reset();
  }
  function hasDraft() {
    return (
      timer.running ||
      timer.seconds() > 0 ||
      draft.note !== '' ||
      Object.values(draft.values).some((value) => value !== '')
    );
  }

  function confirmChange(title, message) {
    if (confirmPending) return Promise.resolve(false);
    confirmPending = true;
    const dialog = $('#confirm-dialog');
    $('#dialog-title').textContent = title;
    $('#dialog-message').textContent = message;
    dialog.returnValue = 'cancel';
    dialog.showModal();
    return new Promise((resolve) =>
      dialog.addEventListener(
        'close',
        () => {
          confirmPending = false;
          resolve(dialog.returnValue === 'confirm');
        },
        { once: true },
      ),
    );
  }
  async function leavePlan() {
    if (!dirtyPlan) return true;
    const discard = await confirmChange(
      'Odrzucić niezapisany plan?',
      'Zmiany w formularzu planu nie zostały zapisane. Zapisany plan pozostanie bez zmian.',
    );
    if (discard) dirtyPlan = false;
    return discard;
  }
  function render() {
    const ctx = context();
    const [name, heading, subheading] = titles[view];
    $('#page-name').textContent = name;
    $('#heading').textContent = heading;
    $('#subheading').textContent = subheading;
    $('#speech-select').innerHTML = data.speeches.length
      ? data.speeches
          .map(
            (speech) =>
              `<option value="${V.escape(speech.id)}" ${speech.id === speechId ? 'selected' : ''}>${V.escape(speech.title)}</option>`,
          )
          .join('')
      : '<option value="">Brak wystąpień</option>';
    document.querySelectorAll('.nav').forEach((button) => {
      const active = button.dataset.view === view;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    $('#content').innerHTML = V[view](ctx);
    if (view === 'practice') {
      updateCompleteness();
      updateTimer();
    }
    if (view === 'plan') updatePlanTotal();
  }
  async function navigate(nextView) {
    if (!titles[nextView]) return;
    if (view === nextView) return;
    if (!(await leavePlan())) return;
    view = nextView;
    clearNotice();
    render();
    $('#main').focus({ preventScroll: true });
  }
  function updateCompleteness() {
    const parts = context().parts;
    const count = parts.filter(
      (part) => draft.values[part.id] !== undefined && draft.values[part.id] !== '',
    ).length;
    const label = $('#trial-completeness');
    if (label)
      label.textContent = `Uzupełniono ${count} z ${parts.length} części${count === parts.length ? ' · gotowe do zapisu ✓' : ' · uzupełnij wszystkie, aby zapisać'}`;
  }
  function updateTimer() {
    if (!$('#timer-display')) return;
    $('#timer-display').textContent = V.time(timer.seconds());
    $('#timer-status').textContent = timer.running
      ? '● TRWA POMIAR'
      : timer.seconds()
        ? 'ZATRZYMANY'
        : 'GOTOWY DO STARTU';
    $('#timer-start').disabled = timer.running || timer.seconds() >= 7200;
    $('#timer-part').disabled = timer.running;
    if (timer.running && timer.seconds() >= 7200) {
      stopTimer();
      notify('Osiągnięto limit 7200 s. Pomiar został zatrzymany, a czas wpisany do formularza.');
    }
  }
  function stopTimer() {
    const seconds = timer.pause();
    if (timerPart) {
      draft.values[timerPart] = String(seconds);
      const input = document.getElementById(`actual-${timerPart}`);
      if (input) input.value = String(seconds);
    }
    updateCompleteness();
    updateTimer();
  }
  function updatePlanTotal() {
    const total = [...document.querySelectorAll('[name=planned]')].reduce(
      (sum, input) => sum + (Number(input.value) || 0),
      0,
    );
    if ($('#plan-total'))
      $('#plan-total').textContent =
        `Plan razem: ${total} s · ${V.time(Math.max(0, Math.floor(total)))}`;
  }
  function renumberRows() {
    document.querySelectorAll('.plan-row').forEach((row, index) => {
      row.querySelector('.number').textContent = index + 1;
      row.querySelector('[name=partName]').setAttribute('aria-label', `Nazwa części ${index + 1}`);
      row
        .querySelector('[name=planned]')
        .setAttribute('aria-label', `Plan części ${index + 1} w sekundach`);
    });
    dirtyPlan = true;
    updatePlanTotal();
  }
  async function savePlan(event) {
    event.preventDefault();
    const parts = [...document.querySelectorAll('.plan-row')].map((row, index) => ({
      id: row.dataset.partId,
      speechId,
      order: index + 1,
      name: row.querySelector('[name=partName]').value.trim(),
      plannedSeconds: Number(row.querySelector('[name=planned]').value),
    }));
    const title = $('#speech-title').value.trim();
    // Validate a complete candidate before opening any destructive confirmation.
    const candidate = M.replacePlan(data, speechId, title, parts, true);
    const changed = JSON.stringify(context().parts) !== JSON.stringify(parts);
    if (changed && context().trials.length) {
      if (
        !(await confirmChange(
          'Zmienić plan i usunąć jego próby?',
          `Ten plan ma ${context().trials.length} zapisanych prób. Zostaną usunięte, ponieważ czasy odnoszą się do poprzedniego planu. Anuluj, aby zachować historię; utwórz nowe wystąpienie dla innej wersji.`,
        ))
      )
        return;
    }
    const warning = commit(candidate);
    if (changed) resetDraft();
    dirtyPlan = false;
    render();
    notify(
      warning || 'Plan zapisany. Wszystkie wyniki odnoszą się do aktualnego planu.',
      Boolean(warning),
    );
  }
  function submitTrial(event) {
    event.preventDefault();
    if (timer.running) throw new Error('Zatrzymaj stoper przed zapisaniem próby.');
    const ctx = context();
    const actualSeconds = {};
    for (const part of ctx.parts) {
      const raw = draft.values[part.id];
      if (raw === undefined || raw === '')
        throw new Error('Uzupełnij czas każdej części. Niekompletna próba nie została zapisana.');
      actualSeconds[part.id] = Number(raw);
    }
    const old = draft.id ? A.findTrialById(ctx.trials, draft.id).record : null;
    const number = old
      ? old.number
      : ctx.trials.reduce((max, trial) => Math.max(max, trial.number), 0) + 1;
    const record = {
      id: old ? old.id : uid('T'),
      speechId,
      number,
      actualSeconds,
      note: draft.note,
    };
    const next = M.saveTrial(data, record);
    const warning = commit(next);
    detailId = record.id;
    resetDraft();
    view = 'history';
    render();
    notify(
      warning || `Próba #${number} zapisana. Wszystkie obliczenia są aktualne.`,
      Boolean(warning),
    );
  }
  async function loadScenario(kind) {
    const builders = {
      control: StageScenarios.control,
      boundary: StageScenarios.boundary,
      large: StageScenarios.large,
    };
    if (!builders[kind]) return;
    if (
      !(await confirmChange(
        'Wczytać zestaw demonstracyjny?',
        'Cały bieżący zestaw i roboczy formularz zostaną zastąpione. Jeśli chcesz zachować pracę, najpierw anuluj i wyeksportuj JSON.',
      ))
    )
      return;
    notify('Przygotowuję i sprawdzam cały zestaw…');
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const next = M.validateDataset(builders[kind]());
    const warning = commit(next);
    speechId = data.speeches[0].id;
    detailId = compareA = compareB = labId = timerPart = null;
    dirtyPlan = false;
    resetDraft();
    view = 'overview';
    render();
    notify(
      warning || 'Scenariusz wczytany. Możesz zmieniać dane i otrzymywać nowe wyniki.',
      Boolean(warning),
    );
  }
  async function importFile(file) {
    if (!file || importBusy) return;
    importBusy = true;
    try {
      if (file.size > 32 * 1024 * 1024)
        throw new Error('Plik przekracza 32 MB. Nie zmieniono danych.');
      const next = M.importJSON(await file.text());
      if (
        !(await confirmChange(
          'Zastąpić cały zestaw danych?',
          `Plik poprawny: ${next.speeches.length} wystąpień, ${next.parts.length} części, ${next.trials.length} kompletnych prób. Dopiero potwierdzenie zastąpi bieżącą pracę.`,
        ))
      )
        return;
      const warning = commit(next);
      speechId = data.speeches[0]?.id || null;
      detailId = compareA = compareB = labId = timerPart = null;
      dirtyPlan = false;
      resetDraft();
      view = 'overview';
      render();
      notify(
        warning || 'Import zakończony. Cały plik sprawdzono przed zmianą stanu.',
        Boolean(warning),
      );
    } finally {
      importBusy = false;
    }
  }
  function runSearch(id, target) {
    const result = A.findTrialById(context().trials, id);
    $(target).textContent =
      `${result.record ? `Znaleziono próbę #${result.record.number} (ID ${result.record.id}).` : 'Nie znaleziono próby o tym ID.'} Sprawdzone rekordy: ${result.checked}. Szukamy pierwszego dopasowania.`;
    return result;
  }

  async function action(button) {
    const name = button.dataset.action;
    if (name === 'export') {
      StageStorage.download(M.exportJSON(data), 'stagewise-dane-v1.json');
      notify(
        'Wyeksportowano zapisany zestaw JSON. Niezapisane formularze nie są częścią eksportu.',
      );
    } else if (name === 'import') $('#import-file').click();
    else if (name === 'new-speech') {
      if (!(await leavePlan())) return;
      if (
        hasDraft() &&
        !(await confirmChange(
          'Odrzucić roboczą próbę?',
          'Nowe wystąpienie wyczyści niezapisany formularz i zatrzyma stoper.',
        ))
      )
        return;
      const id = uid('S');
      const next = M.transaction(data, (value) =>
        value.speeches.push({ id, title: 'Nowe wystąpienie' }),
      );
      const warning = commit(next);
      speechId = id;
      resetDraft();
      view = 'plan';
      render();
      if (warning) notify(warning, true);
      else clearNotice();
      $('#speech-title').focus();
      $('#speech-title').select();
    } else if (name === 'scenario') await loadScenario(button.dataset.kind);
    else if (name === 'add-part') {
      if (
        document.querySelectorAll('.plan-row').length +
          data.parts.filter((part) => part.speechId !== speechId).length >=
        1000
      )
        throw new Error('Limit 1000 części w zestawie.');
      $('#plan-rows').insertAdjacentHTML(
        'beforeend',
        V.planRow(
          { id: uid('P'), name: '', plannedSeconds: 60 },
          document.querySelectorAll('.plan-row').length,
        ),
      );
      renumberRows();
      $('#plan-rows').lastElementChild.querySelector('input').focus();
    } else if (['remove-part', 'move-up', 'move-down'].includes(name)) {
      const row = button.closest('.plan-row');
      if (name === 'remove-part') row.remove();
      if (name === 'move-up' && row.previousElementSibling) row.previousElementSibling.before(row);
      if (name === 'move-down' && row.nextElementSibling) row.nextElementSibling.after(row);
      renumberRows();
    } else if (name === 'timer-start') {
      timer.start();
      updateTimer();
    } else if (name === 'timer-stop') stopTimer();
    else if (name === 'timer-reset') {
      timer.reset();
      updateTimer();
    } else if (name === 'reset-draft') {
      if (
        !hasDraft() ||
        (await confirmChange(
          'Wyczyścić roboczą próbę?',
          'Niezapisane czasy i notatka zostaną usunięte. Historia pozostanie bez zmian.',
        ))
      ) {
        resetDraft();
        render();
      }
    } else if (name === 'detail') {
      if (!(await leavePlan())) return;
      detailId = button.dataset.id;
      view = 'history';
      render();
      $('#trial-detail')?.scrollIntoView({ block: 'start' });
    } else if (name === 'edit-trial') {
      if (
        hasDraft() &&
        !(await confirmChange(
          'Otworzyć zapisaną próbę?',
          'Niezapisany formularz zostanie zastąpiony wybraną próbą.',
        ))
      )
        return;
      const found = A.findTrialById(context().trials, button.dataset.id).record;
      if (!found) throw new Error('Nie znaleziono próby.');
      timer.reset();
      draft = {
        id: found.id,
        values: Object.fromEntries(
          Object.entries(found.actualSeconds).map(([id, value]) => [id, String(value)]),
        ),
        note: found.note,
      };
      view = 'practice';
      render();
    }
  }
  function safely(fn) {
    return async (event) => {
      try {
        await fn(event);
      } catch (error) {
        notify(error.message, true);
      }
    };
  }
  document.addEventListener(
    'click',
    safely(async (event) => {
      const button = event.target.closest('[data-view], [data-action]');
      if (!button) return;
      event.preventDefault();
      if (button.dataset.view) await navigate(button.dataset.view);
      else await action(button);
    }),
  );
  document.addEventListener('input', (event) => {
    if (event.target.dataset.actual) {
      draft.values[event.target.dataset.actual] = event.target.value;
      updateCompleteness();
    }
    if (event.target.id === 'trial-note') draft.note = event.target.value;
    if (event.target.closest('#plan-form')) {
      dirtyPlan = true;
      updatePlanTotal();
    }
  });
  document.addEventListener(
    'change',
    safely(async (event) => {
      const target = event.target;
      if (target.id === 'speech-select') {
        const nextId = target.value;
        const accepted =
          (await leavePlan()) &&
          (!hasDraft() ||
            (await confirmChange(
              'Zmienić wystąpienie?',
              'Niezapisana próba zostanie wyczyszczona, a stoper zatrzymany.',
            )));
        if (!accepted) {
          target.value = speechId;
          return;
        }
        speechId = nextId;
        detailId = compareA = compareB = labId = null;
        resetDraft();
        render();
      } else if (target.id === 'timer-part') {
        timerPart = target.value;
        timer.reset();
        updateTimer();
      } else if (target.id === 'compare-a') {
        compareA = target.value;
        render();
      } else if (target.id === 'compare-b') {
        compareB = target.value;
        render();
      } else if (target.id === 'lab-trial') {
        labId = target.value;
        render();
      } else if (target.id === 'import-file') {
        const file = target.files[0];
        target.value = '';
        await importFile(file);
      }
    }),
  );
  document.addEventListener(
    'submit',
    safely(async (event) => {
      if (event.target.id === 'plan-form') await savePlan(event);
      else if (event.target.id === 'trial-form') submitTrial(event);
      else if (event.target.id === 'lab-search') {
        event.preventDefault();
        runSearch($('#search-id').value.trim(), '#search-result');
      } else if (event.target.id === 'history-search') {
        event.preventDefault();
        const result = runSearch($('#history-id').value.trim(), '#history-search-result');
        if (result.record) {
          detailId = result.record.id;
          const message = $('#history-search-result').textContent;
          render();
          $('#history-search-result').textContent = message;
        }
      }
    }),
  );
  window.addEventListener('beforeunload', (event) => {
    if (dirtyPlan || hasDraft()) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  setInterval(updateTimer, 200);
  render();
  if (stored.warning) notify(stored.warning, true);
})();
