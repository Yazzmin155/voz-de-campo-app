import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:5173';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));

await page.goto(`${BASE}/entrar`);
await page.waitForTimeout(2200);
const skip = page.getByRole('button', { name: /^Saltar$/ });
if (await skip.count()) await skip.first().click();
await page.getByRole('button', { name: /Probar con datos de ejemplo/i }).first().click();
await page.waitForURL('**/inicio');
await page.getByRole('dialog').waitFor();

const ctaSeq = [
  'Siguiente',
  'Ver cómo se dicta',
  'Ver lo que entendió',
  'Pasar a la revisión',
  'Ver el pasaporte',
  'Último paso',
  'Empezar'
];
for (const label of ctaSeq) {
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.waitForTimeout(500);
}

for (const delay of [0, 500, 1500]) {
  await page.waitForTimeout(delay);
  const info = await page.evaluate(() => {
    const main = document.querySelector('main');
    const pageEl = main?.firstElementChild;
    return {
      url: location.pathname,
      dialog: Boolean(document.querySelector('[role="dialog"]')),
      mainChildren: main?.children.length,
      mainText: (main?.innerText || '').slice(0, 120),
      pageOpacity: pageEl ? getComputedStyle(pageEl).opacity : null,
      pageTransform: pageEl ? getComputedStyle(pageEl).transform : null,
      pageDisplay: pageEl ? getComputedStyle(pageEl).display : null,
      scrollTop: main?.scrollTop
    };
  });
  console.log(delay, JSON.stringify(info, null, 2));
}
await page.screenshot({ path: 'qa-shots/debug-dashboard.png' });
await browser.close();
