'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { PDFDocument } = require(process.env.PDF_LIB_MODULE || 'pdf-lib');
const root = path.resolve(__dirname, '..');
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  await page.route(/^https?:/, (route) => route.abort());
  const report = { executedAt: new Date().toISOString(), documents: [] };
  for (const [directory, basename, selector] of [
    ['docs', 'documentation', '.page'],
    ['presentation', 'presentation', '.slide'],
  ]) {
    await page.goto(pathToFileURL(path.join(root, directory, basename + '.html')).href);
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => Promise.all([...document.images].map((img) => img.decode())));
    const layout = await page.locator(selector).evaluateAll((elements) =>
      elements.map((element, index) => {
        const footer = element.querySelector('footer').getBoundingClientRect();
        const bounds = element.getBoundingClientRect();
        const content = element.querySelector('.page-content');
        const contentBounds = content.getBoundingClientRect();
        const descendants = [...content.querySelectorAll('*')].filter(
          (el) => !['SCRIPT', 'STYLE'].includes(el.tagName),
        );
        const bottom = Math.max(
          contentBounds.bottom,
          ...descendants.map((el) => el.getBoundingClientRect().bottom),
        );
        const horizontal = descendants.every((el) => {
          const box = el.getBoundingClientRect();
          return box.right <= bounds.right + 1 && box.left >= bounds.left - 1;
        });
        return {
          page: index + 1,
          fits: bottom <= footer.top - 8,
          contentBottom: Math.round(bottom - bounds.top),
          footerTop: Math.round(footer.top - bounds.top),
          scrollFits:
            element.scrollHeight <= element.clientHeight + 1 &&
            element.scrollWidth <= element.clientWidth + 1,
          horizontal,
        };
      }),
    );
    const invalid = layout.filter((row) => !row.fits || !row.scrollFits || !row.horizontal);
    if (layout.length !== 10 || invalid.length)
      throw new Error(`${basename}: invalid layout ${JSON.stringify(invalid)}`);
    const pdfPath = path.join(root, directory, basename + '.pdf');
    await page.pdf({ path: pdfPath, printBackground: true, preferCSSPageSize: true, tagged: true });
    const pdf = await PDFDocument.load(fs.readFileSync(pdfPath));
    assert.equal(pdf.getPageCount(), 10);
    report.documents.push({
      file: `${directory}/${basename}.pdf`,
      pages: pdf.getPageCount(),
      bytes: fs.statSync(pdfPath).size,
      layout,
    });
    for (const index of [0, 3, 6, 7, 8, 9])
      await page
        .locator(selector)
        .nth(index)
        .screenshot({ path: path.join(root, 'results', `${basename}-${index + 1}.png`) });
  }
  await page.emulateMedia({ media: 'screen' });
  await page.goto(pathToFileURL(path.join(root, 'presentation/presentation.html')).href);
  await page.keyboard.press('End');
  assert.equal(await page.locator('#counter').innerText(), '10 / 10');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.locator('#counter').innerText(), '9 / 10');
  await page.keyboard.press('Home');
  assert.equal(await page.locator('#counter').innerText(), '1 / 10');
  await page.locator('#next').click();
  assert.equal(await page.locator('#counter').innerText(), '2 / 10');
  for (const width of [390, 768, 1512]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      inner: innerWidth,
    }));
    assert.ok(dimensions.scroll <= dimensions.inner + 1, `Presentation overflow at ${width}`);
    await page.keyboard.press('End');
    assert.equal(await page.locator('#counter').innerText(), '10 / 10');
    await page.keyboard.press('Home');
  }
  report.presentationNavigation = 'PASS';
  report.narrowViewport = 'PASS';
  fs.writeFileSync(path.join(root, 'results/documents.json'), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      report.documents.map(({ file, pages, bytes }) => ({ file, pages, bytes })),
      null,
      2,
    ),
  );
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
