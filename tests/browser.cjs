'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const S = require('../app/scenarios.js');
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1512, height: 1150 } });
  const errors = [];
  const requests = [];
  const results = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route(/^https?:/, (route) => {
    requests.push(route.request().url());
    return route.abort();
  });
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
  const nav = async (name) => {
    await page.locator(`.nav[data-view="${name}"]`).click();
    await page.waitForFunction(
      (expected) => document.querySelector('#page-name').textContent === expected,
      {
        overview: 'Pulpit',
        plan: 'Plan wystąpienia',
        practice: 'Nowa próba',
        history: 'Historia prób',
        compare: 'Porównanie',
        lab: 'Laboratorium ASD',
      }[name],
    );
  };
  const confirm = async (yes) => {
    await page.locator('#confirm-dialog[open]').waitFor();
    await page.locator(`#confirm-dialog button[value="${yes ? 'confirm' : 'cancel'}"]`).click();
    await page.locator('#confirm-dialog').waitFor({ state: 'hidden' });
  };
  const importObject = async (object) => {
    await page
      .locator('#import-file')
      .setInputFiles({
        name: 'test.json',
        mimeType: 'application/json',
        buffer: Buffer.from(typeof object === 'string' ? object : JSON.stringify(object)),
      });
  };
  async function check(name, action) {
    await action();
    results.push({ name, status: 'PASS' });
    console.log('PASS ' + name);
  }
  await check('file://, brak sieci, kontrolny pulpit', async () => {
    await page.locator('.hero').waitFor();
    assert.match(await page.locator('.stats').innerText(), /10/);
    assert.equal(await page.locator('.section-item').count(), 3);
    await page.screenshot({ path: path.join(root, 'docs/overview.png'), fullPage: true });
  });
  await check('Kontrolne porównanie A/B', async () => {
    await nav('compare');
    assert.match(await page.locator('#comparison-verdict').innerText(), /30 s/);
    assert.match(await page.locator('#comparison-verdict').innerText(), /B/);
    await page.screenshot({ path: path.join(root, 'docs/compare.png'), fullPage: true });
  });
  await check('Remis: ta sama próba', async () => {
    await page.selectOption('#compare-b', 'A');
    assert.match(await page.locator('#comparison-verdict').innerText(), /Remis/);
  });
  await check('Wyszukiwanie i rzeczywisty ślad', async () => {
    await nav('lab');
    await page.fill('#search-id', 'B');
    await page.locator('#lab-search button').click();
    assert.match(await page.locator('#search-result').innerText(), /rekordy: 2/);
    assert.match(await page.locator('.trace-table').innerText(), /przesuń w prawo/);
    await page.fill('#search-id', 'BRAK');
    await page.locator('#lab-search button').click();
    assert.match(await page.locator('#search-result').innerText(), /Nie znaleziono.*rekordy: 2/);
    await page.screenshot({ path: path.join(root, 'docs/lab.png'), fullPage: true });
  });
  await check('Niekompletny formularz blokuje zapis', async () => {
    await nav('practice');
    await page.locator('#save-trial').click();
    assert.equal(await page.locator('#page-name').innerText(), 'Nowa próba');
    assert.match(await page.locator('#trial-completeness').innerText(), /0 z 3/);
  });
  await check('Rzeczywisty stoper: start, stop, wznowienie, reset', async () => {
    await page.click('#timer-start');
    assert.equal(await page.locator('#timer-part').isDisabled(), true);
    await page.waitForTimeout(1150);
    await page.locator('[data-action=timer-stop]').click();
    assert.equal(await page.locator('[data-actual=P-WSTEP]').inputValue(), '1');
    await page.click('#timer-start');
    await page.waitForTimeout(1100);
    await page.locator('[data-action=timer-stop]').click();
    assert.equal(await page.locator('[data-actual=P-WSTEP]').inputValue(), '2');
    await page.locator('[data-action=timer-reset]').click();
    assert.equal(await page.locator('#timer-display').innerText(), '00:00');
  });
  await check('Ręczny zapis kompletnej próby i notatki', async () => {
    for (const [id, value] of [
      ['P-WSTEP', '60'],
      ['P-TRESC', '180'],
      ['P-KONIEC', '60'],
    ])
      await page.locator(`[data-actual=${id}]`).fill(value);
    await page.fill('#trial-note', 'Próba testowa: idealne proporcje.');
    await page.screenshot({ path: path.join(root, 'docs/practice.png'), fullPage: true });
    await page.click('#save-trial');
    await page.locator('#trial-detail').waitFor();
    assert.match(await page.locator('#trial-detail').innerText(), /300 s/);
    assert.match(await page.locator('#trial-detail').innerText(), /Próba testowa/);
    assert.equal(await page.locator('.trial-card').count(), 3);
  });
  await check('Edycja przelicza aktualne wyniki', async () => {
    await page.locator('[data-action=edit-trial][data-id=B]').click();
    await page.locator('[data-actual=P-WSTEP]').fill('90');
    await page.click('#save-trial');
    assert.match(await page.locator('#trial-detail').innerText(), /40 s/);
    await nav('compare');
    await page.selectOption('#compare-b', 'B');
    assert.match(await page.locator('#comparison-verdict').innerText(), /Remis/);
  });
  await check('Niepoprawny import zachowuje zapis', async () => {
    const snapshot = await page.evaluate(() => localStorage.getItem('stagewise-v1'));
    await importObject('{broken');
    await page.waitForFunction(() =>
      document.querySelector('#feedback').textContent.includes('Niepoprawny JSON'),
    );
    assert.equal(await page.evaluate(() => localStorage.getItem('stagewise-v1')), snapshot);
    assert.equal(await page.locator('#confirm-dialog').isVisible(), false);
    const broken = S.control();
    delete broken.trials[1].actualSeconds['P-KONIEC'];
    await importObject(broken);
    await page.waitForFunction(() =>
      document.querySelector('#feedback').textContent.includes('dokładnie jeden czas'),
    );
    assert.equal(await page.evaluate(() => localStorage.getItem('stagewise-v1')), snapshot);
  });
  await check('Poprawny import anulowany nie zmienia danych', async () => {
    const snapshot = await page.evaluate(() => localStorage.getItem('stagewise-v1'));
    await importObject(S.control());
    await confirm(false);
    assert.equal(await page.evaluate(() => localStorage.getItem('stagewise-v1')), snapshot);
  });
  await check('Poprawny import po potwierdzeniu', async () => {
    await importObject(S.control());
    await confirm(true);
    await page.locator('.hero').waitFor();
    await nav('history');
    assert.equal(await page.locator('.trial-card').count(), 2);
  });
  await check('Eksport JSON: poprawna wersja i dane', async () => {
    const pending = page.waitForEvent('download');
    await page.locator('[data-action=export]').click();
    const download = await pending;
    const file = await download.path();
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(value.format, 'stagewise');
    assert.equal(value.version, 1);
    assert.equal(value.trials.length, 2);
  });
  await check('Zmiana planu: anulowanie zachowuje historię', async () => {
    await nav('plan');
    await page.locator('[name=planned]').first().fill('65');
    await page.locator('#plan-form button[type=submit]').click();
    await confirm(false);
    assert.equal(
      (await page.evaluate(() => JSON.parse(localStorage.getItem('stagewise-v1')))).trials.length,
      2,
    );
  });
  await check('Zmiana planu: potwierdzenie czyści stare próby', async () => {
    await page.locator('#plan-form button[type=submit]').click();
    await confirm(true);
    await page.waitForFunction(
      () => JSON.parse(localStorage.getItem('stagewise-v1')).trials.length === 0,
    );
    const value = await page.evaluate(() => JSON.parse(localStorage.getItem('stagewise-v1')));
    assert.equal(value.trials.length, 0);
    assert.equal(value.parts[0].plannedSeconds, 65);
    await nav('history');
    assert.match(await page.locator('#content').innerText(), /Pierwsza próba/);
  });
  await check('Nowy plan, klawiatura, dodanie, kolejność, usunięcie', async () => {
    await page.locator('[data-action=new-speech]').click();
    await page.fill('#speech-title', 'Seminarium');
    await page.locator('[data-action=add-part]').click();
    await page.locator('[name=partName]').fill('Początek');
    await page.locator('[name=planned]').fill('30');
    await page.locator('[data-action=add-part]').click();
    await page.locator('[name=partName]').nth(1).fill('Koniec');
    await page.locator('[data-action=move-up]').nth(1).click();
    assert.equal(await page.locator('[name=partName]').first().inputValue(), 'Koniec');
    await page.locator('[data-action=move-down]').first().click();
    assert.equal(await page.locator('[name=partName]').first().inputValue(), 'Początek');
    await page.locator('[data-action=remove-part]').nth(1).click();
    await page.locator('[name=planned]').focus();
    await page.keyboard.press('Enter');
    assert.match(await page.locator('#feedback').innerText(), /Plan zapisany/);
    assert.equal(
      (await page.evaluate(() => JSON.parse(localStorage.getItem('stagewise-v1')))).speeches.length,
      2,
    );
  });
  await check('Anulowana zmiana wystąpienia zachowuje roboczy plan', async () => {
    await page.fill('#speech-title', 'Seminarium — niezapisane');
    await page.selectOption('#speech-select', 'S-KONTROLA');
    await confirm(false);
    assert.equal(await page.locator('#speech-title').inputValue(), 'Seminarium — niezapisane');
    await page.selectOption('#speech-select', 'S-KONTROLA');
    await confirm(true);
    await page.waitForFunction(
      () => document.querySelector('#speech-title').value === 'Moje pierwsze wystąpienie',
    );
  });
  await check('HTML użytkownika nie jest wykonywany', async () => {
    const value = S.control();
    value.speeches[0].title = '<img src=x onerror="window.hacked=1">';
    value.parts[0].name = '<script>window.hacked=1</script>';
    value.trials[0].note = '<b>tekst, nie HTML</b>';
    await importObject(value);
    await confirm(true);
    await page.locator('.hero').waitFor();
    assert.equal(await page.evaluate(() => window.hacked), undefined);
    assert.equal(await page.locator('#speech-select img, #content script').count(), 0);
    assert.match(await page.locator('.section-item').first().innerText(), /<script>/);
  });
  await check('Pusta lista: czytelne widoki bez błędów', async () => {
    await importObject({ format: 'stagewise', version: 1, speeches: [], parts: [], trials: [] });
    await confirm(true);
    for (const name of ['overview', 'practice', 'history', 'compare', 'lab', 'plan']) {
      await nav(name);
      assert.equal(
        await page
          .locator('#content')
          .innerText()
          .then((text) => /NaN|Infinity/.test(text)),
        false,
      );
    }
  });
  await check('Ponowne otwarcie odtwarza dane lokalne', async () => {
    await importObject(S.control());
    await confirm(true);
    await page.reload();
    await page.locator('.hero').waitFor();
    assert.equal(await page.locator('.section-item').count(), 3);
  });
  await check('Responsywność 390 i 768 px we wszystkich widokach', async () => {
    for (const width of [390, 768]) {
      await page.setViewportSize({ width, height: 900 });
      for (const name of ['overview', 'plan', 'practice', 'history', 'compare', 'lab']) {
        await nav(name);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        assert.ok(overflow <= 1, `${name} overflow ${overflow} at ${width}`);
      }
    }
    await nav('overview');
    await page.setViewportSize({ width: 390, height: 900 });
    await page.screenshot({ path: path.join(root, 'docs/mobile.png'), fullPage: true });
  });
  await check('Scenariusz kontrolny przyciskiem i anulowanie', async () => {
    await nav('lab');
    await page.locator('#content [data-kind=boundary]').click();
    await confirm(false);
    assert.equal(await page.locator('#page-name').innerText(), 'Laboratorium ASD');
    await page.locator('#content [data-kind=control]').click();
    await confirm(true);
    await page.locator('.hero').waitFor();
  });
  await check('Duży zestaw: 1000 części i 1000 prób w UI', async () => {
    await page.setViewportSize({ width: 1512, height: 1150 });
    await nav('lab');
    await page.locator('#content [data-kind=large]').click();
    await confirm(true);
    await page.waitForFunction(
      () => document.querySelectorAll('.section-item').length === 1000,
      null,
      { timeout: 30000 },
    );
    assert.equal(await page.locator('.section-item').count(), 1000);
    await nav('history');
    assert.equal(await page.locator('.trial-card').count(), 1000);
    await nav('lab');
    await page.fill('#search-id', 'T-1000');
    await page.locator('#lab-search button').click();
    assert.match(await page.locator('#search-result').innerText(), /rekordy: 1000/);
  });
  await check('Brak błędów JavaScript i żądań sieciowych', async () => {
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, []);
  });
  fs.writeFileSync(
    path.join(root, 'results/browser.json'),
    JSON.stringify(
      {
        executedAt: new Date().toISOString(),
        total: results.length,
        passed: results.length,
        errors,
        networkRequests: requests,
        results,
      },
      null,
      2,
    ),
  );
  console.log(`${results.length}/${results.length} PASS`);
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
