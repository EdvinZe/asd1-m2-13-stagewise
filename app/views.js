(function (root) {
  'use strict';
  const A = root.StageAlgorithms;
  const escape = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
    );
  const time = (seconds) =>
    `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  const signed = (number) => `${number > 0 ? '+' : number < 0 ? '−' : ''}${Math.abs(number)} s`;
  const delta = (number) =>
    `<span class="chip ${number === 0 ? 'ok' : ''}">${signed(number)}${number === 0 ? ' · zgodnie' : number > 0 ? ' · za długo' : ' · za krótko'}</span>`;
  const stat = (label, value, note, symbol = '◷', accent = false) =>
    `<div class="stat"><span class="stat-label">${label}</span><span class="stat-icon" aria-hidden="true">${symbol}</span><div class="stat-value ${accent ? 'accent' : ''}">${value}</div><div class="stat-note">${note}</div></div>`;
  const empty = (title, message, action = '') =>
    `<div class="panel empty"><img src="assets/mark.svg" width="42" height="42" alt="" style="margin-bottom:15px"><h2>${title}</h2><p>${message}</p>${action}</div>`;
  const panelHead = (title, subtitle, link = '') =>
    `<div class="panel-head"><div><h2>${title}</h2>${subtitle ? `<p class="muted">${subtitle}</p>` : ''}</div>${link}</div>`;

  function analysisTable(analysis) {
    return `<div class="table-scroll"><table><thead><tr><th>Część</th><th class="numeric">Plan</th><th class="numeric">Wykonanie</th><th class="numeric">Odchylenie</th><th class="numeric">|odchylenie|</th></tr></thead><tbody>${analysis.rows.map((row) => `<tr><td>${escape(row.name)}</td><td class="numeric">${row.planned} s</td><td class="numeric">${row.actual} s</td><td class="numeric">${signed(row.deviation)}</td><td class="numeric">${Math.abs(row.deviation)} s</td></tr>`).join('')}<tr class="table-total"><td>Razem</td><td class="numeric">${analysis.plannedTotal} s</td><td class="numeric">${analysis.actualTotal} s</td><td class="numeric">${signed(analysis.totalDeviation)}</td><td class="numeric">${analysis.absoluteDeviation} s</td></tr></tbody></table></div>`;
  }

  function overview(ctx) {
    const { speech, parts, trials } = ctx;
    if (!speech)
      return empty(
        'Twoja scena czeka.',
        'Utwórz wystąpienie i dodaj jego części albo otwórz gotowy przykład.',
        '<button class="button primary" data-action="new-speech">+ Utwórz wystąpienie</button>',
      );
    const latest = trials[trials.length - 1];
    const analysis = latest && parts.length ? A.analyzeTrial(parts, latest) : null;
    const previous = trials.length > 1 ? A.summarizeTrial(parts, trials[trials.length - 2]) : null;
    const total = parts.reduce((sum, part) => sum + part.plannedSeconds, 0);
    const improvement =
      previous && analysis ? previous.absoluteDeviation - analysis.absoluteDeviation : null;
    const hero = `<div class="hero"><div><p class="eyebrow">KAŻDA PRÓBA MA ZNACZENIE</p><h2>Nie musisz mówić idealnie.<br>Wystarczy, że robisz postęp.</h2><p class="muted">Przejrzysty plan, spokojna próba i konkretna wskazówka na następny raz. Wszystko w jednym miejscu.</p><button class="button primary" data-view="practice">▶ Przećwicz wystąpienie</button> <button class="text-button" data-view="plan" style="margin-left:12px">Edytuj plan ↗</button></div><div class="hero-art" aria-hidden="true"><div class="orbit"><img src="assets/mark.svg" alt=""></div><span class="orbit-label">● Twój rytm. Twój postęp.</span></div></div>`;
    const stats = `<div class="stats">${stat('Plan wystąpienia', time(total), `${parts.length} części · min:sek`, '◷')}${stat('Zapisane próby', trials.length.toString().padStart(2, '0'), 'Kompletne, gotowe do porównania', '◉')}${stat('Ostatnia zgodność', analysis ? `${analysis.absoluteDeviation} <small>s</small>` : '—', 'Suma |odchyleń| · mniej = lepiej', '≋', true)}${stat('Zmiana po ostatniej próbie', improvement === null ? '—' : `${improvement > 0 ? '−' : improvement < 0 ? '+' : ''}${Math.abs(improvement)} <small>s</small>`, improvement === null ? 'Zapisz co najmniej dwie próby' : improvement > 0 ? 'Mniej odchyleń niż poprzednio' : improvement < 0 ? 'Więcej odchyleń niż poprzednio' : 'Remis względem poprzedniej próby', '↗')}</div>`;
    const plan = `<div class="panel">${panelHead('Twój plan, krok po kroku', 'Daj każdej części odpowiednio dużo miejsca.', '<button class="text-button" data-view="plan">Edytuj ↗</button>')}${parts.length ? parts.map((part, index) => `<div class="section-item"><span class="number">${String(index + 1).padStart(2, '0')}</span><div class="section-info"><div class="section-name">${escape(part.name)}</div><div class="section-caption">${Math.round((part.plannedSeconds / total) * 100)}% wystąpienia</div><div class="bar-track"><div class="bar-fill" style="width:${(part.plannedSeconds / total) * 100}%"></div></div></div><span class="time-label">${time(part.plannedSeconds)}</span></div>`).join('') : '<p class="muted">Brak części. Otwórz edycję planu i dodaj pierwszą.</p>'}<p class="legend">Czas w formacie min:sek. Łącznie ${total} sekund.</p></div>`;
    const worst = analysis?.ranking.sorted[0];
    const insight = `<div class="panel">${panelHead('Na czym się skupić?', analysis ? `Ostatnia próba #${latest.number} · ${escape(latest.id)}` : 'Wskazówki po pierwszej próbie')}${
      analysis
        ? `<div class="insight"><p class="eyebrow">${analysis.absoluteDeviation ? 'TWÓJ NASTĘPNY KROK' : 'DOBRA ROBOTA'}</p><p>${analysis.absoluteDeviation ? `<strong>${escape(worst.name)}</strong> — ${worst.deviation > 0 ? 'skróć' : 'wydłuż'} tę część o ${Math.abs(worst.deviation)} s. To największa rozbieżność z planem.` : 'Każda część dokładnie zgodna z planem. Utrzymaj ten rytm.'}</p></div>${analysis.ranking.sorted
            .slice(0, 5)
            .map(
              (row, index) =>
                `<div class="rank-row"><span class="rank-index">${index + 1}.</span><span class="rank-label">${escape(row.name)}</span>${delta(row.deviation)}</div>`,
            )
            .join(
              '',
            )}<p class="legend">Ranking: |odchylenie| malejąco, potem kolejność w planie.${parts.length > 5 ? ' Pokazano 5 największych rozbieżności.' : ''}</p>`
        : '<p class="muted">Zapisz kompletną próbę, aby zobaczyć ranking rozbieżności.</p>'
    }</div>`;
    const recent = `<div class="panel">${panelHead('Ostatnie próby', 'Małe kroki, które widać.', '<button class="text-button" data-view="history">Wszystkie ↗</button>')}${
      trials
        .slice(-3)
        .reverse()
        .map((trial) => {
          const a = A.summarizeTrial(parts, trial);
          return `<div class="trial-mini"><span class="number">${String(trial.number).padStart(2, '0')}</span><div class="trial-desc"><strong>Próba #${trial.number}</strong><small>${time(a.actualTotal)} łącznie · ID: ${escape(trial.id)}</small></div><span class="chip neutral">Σ|Δ| ${a.absoluteDeviation} s</span><button class="text-button" data-action="detail" data-id="${escape(trial.id)}" aria-label="Otwórz próbę ${escape(trial.id)}">↗</button></div>`;
        })
        .join('') || '<p class="muted">Jeszcze bez prób. Zacznij od jednej.</p>'
    }</div>`;
    const recentAnalyses = trials
      .slice(-12)
      .map((trial) => ({
        number: trial.number,
        value: A.summarizeTrial(parts, trial).absoluteDeviation,
      }));
    const max = Math.max(1, ...recentAnalyses.map((item) => item.value));
    const progress = `<div class="panel">${panelHead('Twój rytm postępu', 'Suma |odchyleń| w sekundach · niżej = bliżej planu')}${recentAnalyses.length ? `<div class="mini-chart" role="img" aria-label="${recentAnalyses.map((item) => `Próba ${item.number}: ${item.value} sekund`).join('; ')}">${recentAnalyses.map((item) => `<div class="chart-column"><b>${item.value} s</b><i style="height:${Math.max(2, (item.value / max) * 48)}px"></i><span>#${item.number}</span></div>`).join('')}</div><p class="legend">Ostatnie ${recentAnalyses.length} prób. Równy czas całkowity nie oznacza równego rozłożenia czasu.</p>` : '<p class="muted">Wykres pojawi się po zapisaniu próby.</p>'}</div>`;
    return (
      hero +
      stats +
      `<div class="grid-main">${plan}${insight}</div><div class="bottom-grid">${recent}${progress}</div>`
    );
  }

  function plan(ctx) {
    if (!ctx.speech) return overview(ctx);
    return `<div class="panel">${panelHead('Zbuduj plan, w którym czujesz się pewnie.', 'Ułóż części, nadaj im nazwy i zaplanuj czas.')}<form id="plan-form"><div class="form-field"><label for="speech-title">Tytuł wystąpienia</label><input id="speech-title" name="title" maxlength="160" required value="${escape(ctx.speech.title)}"></div><div id="plan-rows">${ctx.parts.map(planRow).join('')}</div><button type="button" class="button ghost small" data-action="add-part">+ Dodaj część</button><div class="note-box">Plan: 1–3600 całkowitych sekund na część. Zapisane próby są związane z tym planem. Zmiana części wymaga potwierdzonego usunięcia tych prób; możesz zamiast tego utworzyć nowe wystąpienie.</div><div class="actions"><button class="button primary" type="submit">Zapisz plan</button><button class="button ghost" type="button" data-view="overview">Wróć do pulpitu</button><span id="plan-total" class="help"></span></div></form></div>`;
  }
  function planRow(part, index) {
    return `<div class="plan-row" data-part-id="${escape(part.id)}"><span class="number">${index + 1}</span><label>Nazwa części<input name="partName" aria-label="Nazwa części ${index + 1}" required maxlength="100" value="${escape(part.name)}"></label><label>Plan (s)<input name="planned" aria-label="Plan części ${index + 1} w sekundach" type="number" min="1" max="3600" step="1" required value="${part.plannedSeconds}"></label><div class="row-controls"><button type="button" class="icon-button" data-action="move-up" aria-label="Przesuń część w górę">↑</button><button type="button" class="icon-button" data-action="move-down" aria-label="Przesuń część w dół">↓</button><button type="button" class="icon-button" data-action="remove-part" aria-label="Usuń część">×</button></div></div>`;
  }
  function practice(ctx) {
    if (!ctx.speech || !ctx.parts.length)
      return empty(
        'Najpierw plan. Potem scena.',
        'Dodaj co najmniej jedną część, aby rozpocząć próbę.',
        '<button class="button primary" data-view="plan">Ułóż plan</button>',
      );
    const { draft, parts } = ctx;
    return `<div class="practice-layout"><div class="panel timer-card"><p class="eyebrow">JEDNA CZĘŚĆ NA RAZ</p><h2>Skup się na tym, co mówisz.</h2><p class="help">Wybierz część. Start → Stop i zapisz czas.</p><label for="timer-part" class="sr-only">Część mierzona stoperem</label><select id="timer-part">${parts.map((part) => `<option value="${escape(part.id)}" ${part.id === ctx.timerPart ? 'selected' : ''}>${part.order}. ${escape(part.name)} · plan ${time(part.plannedSeconds)}</option>`).join('')}</select><div class="timer-face"><span class="timer-caption" id="timer-status">GOTOWY DO STARTU</span><span id="timer-display">${time(ctx.timer.seconds())}</span><span class="timer-caption">minuty : sekundy</span></div><div class="actions"><button class="button primary" id="timer-start" data-action="timer-start">▶ Start / wznów</button><button class="button ghost" data-action="timer-stop">■ Stop i wpisz czas</button><button class="text-button" data-action="timer-reset">Wyzeruj stoper</button></div><p class="help">Stop wpisuje wynik po prawej. Możesz go zmienić ręcznie.<br>Stoper nie zapisuje całej próby. Limit: 7200 s na część.</p></div><div class="panel">${panelHead(draft.id ? `Edytujesz próbę ${escape(draft.id)}` : 'Zapisz swoją próbę', 'Mierz stoperem lub wpisz czas ręcznie. Zero jest poprawną wartością.')}<form id="trial-form">${parts.map((part) => `<div class="practice-row"><label for="actual-${escape(part.id)}">${escape(part.name)}<small>Plan: ${part.plannedSeconds} s · ${time(part.plannedSeconds)}</small></label><input id="actual-${escape(part.id)}" name="${escape(part.id)}" data-actual="${escape(part.id)}" type="number" min="0" max="7200" step="1" required placeholder="—" value="${escape(draft.values[part.id] ?? '')}" aria-label="Wykonanie: ${escape(part.name)}, sekundy"></div>`).join('')}<p id="trial-completeness" class="complete-label"></p><div class="form-field" style="margin-top:20px"><label for="trial-note">Notatka po próbie <span class="muted">(opcjonalnie)</span></label><textarea id="trial-note" maxlength="4000" placeholder="Co poszło dobrze? Co chcesz poprawić?">${escape(draft.note)}</textarea></div><div class="actions"><button type="submit" class="button primary" id="save-trial">Zapisz kompletną próbę</button><button type="button" class="button ghost" data-action="reset-draft">Wyczyść formularz</button></div><p class="help">Niekompletna próba nie trafia do historii ani porównań. Robocze czasy nie są zapisywane po zamknięciu strony.</p></form></div></div>`;
  }

  function history(ctx) {
    if (!ctx.trials.length)
      return empty(
        'Pierwsza próba jeszcze przed Tobą.',
        'W historii pojawią się tylko kompletne, zapisane próby.',
        '<button class="button primary" data-view="practice">Rozpocznij próbę</button>',
      );
    const selected = ctx.detailId ? A.findTrialById(ctx.trials, ctx.detailId).record : null;
    return `<div class="panel">${panelHead('Każda próba opowiada historię.', `${ctx.trials.length} kompletnych prób · wybierz kartę, aby zobaczyć szczegóły.`)}<form class="search-form" id="history-search"><label for="history-id">Znajdź próbę po ID<input id="history-id" placeholder="np. B" maxlength="80"></label><button class="button ghost" type="submit">Szukaj</button></form><div id="history-search-result" class="search-result" role="status"></div>${ctx.trials
      .slice()
      .reverse()
      .map((trial) => {
        const analysis = A.summarizeTrial(ctx.parts, trial);
        return `<article class="trial-card"><span class="number">${trial.number}</span><div class="trial-card-info"><strong>Próba #${trial.number} <small>· ID ${escape(trial.id)}</small></strong><p>${escape(trial.note || 'Bez notatki.')}</p><p>Czas: ${time(analysis.actualTotal)} · odchylenie łączne: ${signed(analysis.totalDeviation)} · Σ|Δ|: ${analysis.absoluteDeviation} s</p></div><div class="actions"><button class="button ghost small" data-action="detail" data-id="${escape(trial.id)}">Szczegóły</button><button class="text-button" data-action="edit-trial" data-id="${escape(trial.id)}">Edytuj</button></div></article>`;
      })
      .join(
        '',
      )}</div>${selected ? `<div class="panel" id="trial-detail">${panelHead(`Pełna karta próby ${escape(selected.id)}`, `Numer: ${selected.number} · wystąpienie: ${escape(ctx.speech.id)}`)}${analysisTable(A.analyzeTrial(ctx.parts, selected))}<p class="note-box" style="white-space:pre-wrap">${escape(selected.note || 'Brak notatki.')}</p></div>` : ''}`;
  }

  function compare(ctx) {
    if (ctx.trials.length < 2)
      return empty(
        'Dwie próby. Jeden konkretny wniosek.',
        'Zapisz co najmniej dwie kompletne próby tego samego wystąpienia.',
        '<button class="button primary" data-view="practice">Dodaj próbę</button>',
      );
    const first = A.findTrialById(ctx.trials, ctx.compareA).record || ctx.trials[0];
    const second =
      A.findTrialById(ctx.trials, ctx.compareB).record || ctx.trials[ctx.trials.length - 1];
    const result = A.compareTrials(ctx.parts, first, second);
    const options = (selected) =>
      ctx.trials
        .map(
          (trial) =>
            `<option value="${escape(trial.id)}" ${trial.id === selected.id ? 'selected' : ''}>Próba #${trial.number} · ${escape(trial.id)}</option>`,
        )
        .join('');
    return `<div class="panel">${panelHead('Co zmieniło się między próbami?', 'Miarą zgodności jest suma wartości bezwzględnych odchyleń — mniejsza wygrywa.')}<div class="comparison-selectors"><label>Próba A<select id="compare-a">${options(first)}</select></label><label>Próba B<select id="compare-b">${options(second)}</select></label></div><div class="insight" id="comparison-verdict"><p class="eyebrow">WNIOSEK Z PORÓWNANIA</p><p>${result.winnerId === null ? 'Remis. Obie próby mają taką samą sumę |odchyleń|. Nie wybieramy zwycięzcy.' : `Próba <strong>${escape(result.winnerId)}</strong> jest bliższa planowi o <strong>${result.improvement} s</strong> według sumy |odchyleń|.`}${first.id === second.id ? ' Porównujesz tę samą próbę.' : ''}</p></div><div class="stats">${stat('A · czas całkowity', `${result.a.actualTotal} <small>s</small>`, `Odchylenie łączne ${signed(result.a.totalDeviation)}`)}${stat('A · suma |odchyleń|', `${result.a.absoluteDeviation} <small>s</small>`, 'Mniej = lepiej', '≋', true)}${stat('B · czas całkowity', `${result.b.actualTotal} <small>s</small>`, `Odchylenie łączne ${signed(result.b.totalDeviation)}`)}${stat('B · suma |odchyleń|', `${result.b.absoluteDeviation} <small>s</small>`, 'Mniej = lepiej', '≋', true)}</div><div class="table-scroll"><table id="comparison-table"><thead><tr><th>Część</th><th class="numeric">Plan</th><th class="numeric">A</th><th class="numeric">Δ A</th><th class="numeric">B</th><th class="numeric">Δ B</th></tr></thead><tbody>${result.a.rows.map((row, index) => `<tr><td>${escape(row.name)}</td><td class="numeric">${row.planned} s</td><td class="numeric">${row.actual} s</td><td class="numeric">${signed(row.deviation)}</td><td class="numeric">${result.b.rows[index].actual} s</td><td class="numeric">${signed(result.b.rows[index].deviation)}</td></tr>`).join('')}</tbody></table></div><div class="note-box">Dlaczego +20 s i −20 s się nie ukrywają? Czas całkowity może być idealny, chociaż jedna część jest za długa, a druga za krótka. |+20| + |−20| = 40 s — ta miara ujawnia problem.</div></div>`;
  }

  function lab(ctx) {
    const selected = A.findTrialById(ctx.trials, ctx.labId).record || ctx.trials[0];
    const analysis = selected ? A.analyzeTrial(ctx.parts, selected, ctx.parts.length <= 12) : null;
    return `<div class="panel"><div class="title-with-logo"><img src="assets/mark.svg" alt="" width="38" height="38"><div><h2>Pod maską: proste algorytmy, jasne decyzje.</h2><p class="help">Własna implementacja. Rzeczywiste liczniki. Żadnej magii.</p></div></div></div><div class="lab-grid"><div class="panel">${panelHead('01 / Wyszukiwanie liniowe', 'Pierwsze dopasowanie ID, nie wszystkie dopasowania.')}<form class="search-form" id="lab-search"><label>ID próby<input id="search-id" placeholder="np. B" maxlength="80" required></label><button type="submit" class="button primary">Znajdź</button></form><p id="search-result" class="search-result" role="status">Sprawdzone rekordy: 0. Wpisz ID, aby uruchomić pętlę.</p><pre>sprawdzone = 0
  dla próby w liście:
    sprawdzone += 1
    jeżeli próba.id == szukaneID:
      zwróć próbę, sprawdzone
  zwróć brak, sprawdzone</pre><p class="help">Początek: 1; koniec: n; brak: n. Czas O(n), pamięć dodatkowa O(1). Kolejność zgodna z listą zapisu.</p></div><div class="panel">${panelHead('02 / Sortowanie przez wstawianie', 'Klucz: |odchylenie| malejąco, potem kolejność rosnąco.')}<label>Analizowana próba<select id="lab-trial" class="full-width" ${selected ? '' : 'disabled'}>${ctx.trials.map((trial) => `<option value="${escape(trial.id)}" ${trial.id === selected?.id ? 'selected' : ''}>Próba #${trial.number} · ${escape(trial.id)}</option>`).join('')}</select></label><pre>dla i od 1 do n−1:
  klucz = lista[i]; j = i−1
  dopóki j ≥ 0:
    porównania += 1
    jeżeli lista[j] jest przed kluczem: przerwij
    lista[j+1] = lista[j]; j -= 1
  lista[j+1] = klucz</pre><p class="help">Czas O(n) dla danych uporządkowanych, O(n²) w najgorszym przypadku. Kopia listy: O(n). Ślad edukacyjny jest dodatkowym narzutem.</p>${
    analysis
      ? `<p class="note-box">Porównania kluczy: <strong>${analysis.ranking.comparisons}</strong> · Σ|Δ| = <strong>${analysis.absoluteDeviation} s</strong><br>Ranking: ${analysis.ranking.sorted
          .slice(0, 12)
          .map((row) => escape(row.name))
          .join(' → ')}${ctx.parts.length > 12 ? ' …' : ''}</p>`
      : '<p class="help">Zapisz próbę, aby pokazać rzeczywisty ślad.</p>'
  }</div></div>${analysis ? `<div class="panel">${panelHead('Przed → decyzja → po', 'Ślad pochodzi z rzeczywistego wykonania sortowania, nie z ręcznie wpisanego przykładu.')}${ctx.parts.length > 12 ? '<p class="muted">Pełny ranking policzony. Dla czytelności ślad tabelaryczny jest dostępny do 12 części; użyj przykładu kontrolnego.</p>' : `<div class="table-scroll"><table class="trace-table"><thead><tr><th>Przed</th><th>Decyzja</th><th>Po</th></tr></thead><tbody>${analysis.ranking.steps.map((step) => `<tr><td>${escape(step.before.join(' · '))}</td><td>${escape(step.decision)}</td><td>${escape(step.after.join(' · '))}</td></tr>`).join('')}</tbody></table></div><p class="help">Klucz jest przechowywany osobno; podczas przesunięć ID może chwilowo wystąpić dwa razy w roboczej tablicy.</p>`}${analysisTable(analysis)}</div>` : ''}<div class="panel">${panelHead('Dane demonstracyjne', 'Wczytanie zastępuje cały zestaw dopiero po potwierdzeniu.')}<div class="scenario-actions"><button class="button ghost" data-action="scenario" data-kind="control">Przykład kontrolny A / B</button><button class="button ghost" data-action="scenario" data-kind="boundary">Granice: 0, 1, 3600, 7200</button><button class="button ghost" data-action="scenario" data-kind="large">Duży: 1000 części + 1000 prób</button></div><p class="help">Duży zestaw może potrzebować kilku sekund. Eksport JSON jest podstawowym sposobem przenoszenia pracy; localStorage to tylko dodatek.</p><p class="help">Powtarzalne pomiary sortowania 10 / 100 / 1000: <a class="document-link" href="results/benchmark.json">wyniki JSON</a> · <a class="document-link" href="docs/documentation.pdf">interpretacja w PDF</a>.</p></div>`;
  }
  function measurements() {
    const report = root.StageBenchmarks;
    if (!report) return '';
    return `<div class="panel">${panelHead('Wyniki doświadczeń 10 / 100 / 1000', 'Rzeczywiste liczniki porównań kluczy. Każdy wynik sprawdzony niezależnym Array.sort w narzędziu testowym.')}<div class="table-scroll"><table><thead><tr><th>Rekordy</th><th>Dane</th><th class="numeric">Porównania</th><th>Zgodność ze wzorcem</th></tr></thead><tbody>${report.results.map((row) => `<tr><td>${row.size}</td><td>${row.kind}</td><td class="numeric">${row.comparisons}</td><td>${row.matchesReference ? 'TAK' : 'NIE'}</td></tr>`).join('')}</tbody></table></div><p class="note-box">Uporządkowane: n−1 porównań. Odwrócone: n(n−1)/2, ponieważ każdy nowy element przechodzi przez cały posortowany prefiks. Licznik zwiększamy tylko przy rzeczywistym wywołaniu porównania kluczy, nie przy sprawdzeniu indeksu.</p><div class="table-scroll"><table><thead><tr><th>Próby</th><th>Początek</th><th>Koniec</th><th>Brak wyniku</th></tr></thead><tbody>${report.search.map((row) => `<tr><td>${row.size}</td><td>${row.first}</td><td>${row.last}</td><td>${row.missing}</td></tr>`).join('')}</tbody></table></div><p class="help">Generator LCG, ziarno ${report.seed}. Pomiary: ${escape(report.executedAt)}. Odtwórz: <code>npm run benchmark</code>. Koszt obliczenia różnic i sum wynosi O(p), gdzie p to liczba części; sortowanie dotyczy p rekordów, a wyszukiwanie t prób.</p></div>`;
  }
  root.StageViews = {
    escape,
    time,
    signed,
    overview,
    plan,
    planRow,
    practice,
    history,
    compare,
    lab: (ctx) => lab(ctx) + measurements(),
  };
})(globalThis);
