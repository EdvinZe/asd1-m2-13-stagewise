'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { PDFDocument } = require(process.env.PDF_LIB_MODULE || 'pdf-lib');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
(async () => {
  const required = [
    'index.html',
    'README.md',
    'DEFENSE.md',
    'SUBMISSION.md',
    'assets/uwb-vilnius.png',
    'assets/uwb-seal.png',
    'data/control.json',
    'data/boundary.json',
    'data/large.json',
    'tests/run.cjs',
    'results/tests.json',
    'results/browser.json',
    'results/benchmark.json',
    'results/documents.json',
    'docs/documentation.html',
    'docs/documentation.pdf',
    'presentation/presentation.html',
    'presentation/presentation.pdf',
  ];
  required.forEach((file) => assert.ok(fs.existsSync(path.join(root, file)), `Missing ${file}`));
  const pages = {};
  for (const file of ['docs/documentation.pdf', 'presentation/presentation.pdf']) {
    const document = await PDFDocument.load(fs.readFileSync(path.join(root, file)));
    pages[file] = document.getPageCount();
    assert.equal(pages[file], 10);
  }
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  const requests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route(/^https?:/, (route) => {
    requests.push(route.request().url());
    return route.abort();
  });
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
  await page.locator('.hero').waitFor();
  assert.equal(await page.locator('.section-item').count(), 3);
  assert.equal(
    await page.evaluate(() =>
      [...document.images].every((img) => img.complete && img.naturalWidth > 0),
    ),
    true,
  );
  await page.locator('.nav[data-view=compare]').click();
  await page.locator('#comparison-verdict').waitFor();
  assert.match(await page.locator('#comparison-verdict').innerText(), /30 s/);
  await page.goto(pathToFileURL(path.join(root, 'presentation/presentation.html')).href);
  await page.keyboard.press('End');
  assert.equal(await page.locator('#counter').innerText(), '10 / 10');
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  await browser.close();
  console.log(
    JSON.stringify(
      {
        root,
        requiredFiles: required.length,
        pdfPages: pages,
        localApp: 'PASS',
        logos: 'PASS',
        comparison: 'PASS',
        slideNavigation: 'PASS',
        errors,
        networkRequests: requests,
      },
      null,
      2,
    ),
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
