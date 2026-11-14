import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:5173';
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 2,
  locale: 'es-MX',
  permissions: ['geolocation'],
  geolocation: { latitude: 24.7642, longitude: -107.6948 }
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto(`${BASE}/entrar`);
await page.waitForTimeout(1900);
await page.screenshot({ path: 'qa-shots/10-onboarding.png' });

const skip = page.getByRole('button', { name: /^Saltar$/ });
if (await skip.count()) await skip.first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: 'qa-shots/11-auth.png' });

const tourToggle = page.getByText(/Mostrarme el recorrido/i);
if (await tourToggle.count()) {
  await tourToggle.first().click();
}
await page.getByRole('button', { name: /Probar con datos de ejemplo/i }).first().click();
await page.waitForURL('**/inicio');
await page.waitForTimeout(800);

await page.goto(`${BASE}/parcelas/parcel-4b`);
await page.waitForTimeout(2500);
await page.screenshot({ path: 'qa-shots/12-parcela-mapa.png' });

await page.goto(`${BASE}/visitas/nueva/parcel-4b`);
await page.waitForTimeout(900);
await page.screenshot({ path: 'qa-shots/13-nueva-visita.png' });

await page.goto(`${BASE}/inicio`);
const darkBtn = page.getByRole('button', { name: /Cambiar a modo oscuro/i });
await darkBtn.click();
await page.waitForTimeout(600);
await page.screenshot({ path: 'qa-shots/14-oscuro.png' });

console.log(JSON.stringify({ errors }, null, 2));
await browser.close();
