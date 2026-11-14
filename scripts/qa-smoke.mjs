import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:5173';
const OUT = 'qa-shots';
fs.mkdirSync(OUT, { recursive: true });

const problems = [];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 2,
  locale: 'es-MX',
  timezoneId: 'America/Mexico_City'
});
const page = await context.newPage();

page.on('console', (msg) => {
  if (msg.type() === 'error') problems.push(`console: ${msg.text()}`);
});
page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
}

try {
  await page.goto(`${BASE}/entrar`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2200);

  // Onboarding inicial -> auth
  const skip = page.getByRole('button', { name: /^Saltar$/ });
  if (await skip.count()) {
    await skip.first().click();
  }

  await page.getByRole('button', { name: /Probar con datos de ejemplo/i }).first().click();
  await page.waitForURL('**/inicio');
  await page.waitForTimeout(700);

  // Tutorial bloqueante: recorrer 7 pasos
  await page.getByRole('dialog').waitFor({ timeout: 5000 });
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
    await page.waitForTimeout(450);
  }
  await page.waitForTimeout(500);
  if (await page.getByRole('dialog').count()) {
    problems.push('El tutorial sigue abierto después del último paso');
  }
  await shot('01-dashboard');

  // Verificador: sin autocarga, con pasaporte guardado y anti-fraude
  await page.goto(`${BASE}/verificar`, { waitUntil: 'networkidle' });
  const integrityBefore = await page.getByText('Pasaporte íntegro').count();
  if (integrityBefore > 0) {
    problems.push('El verificador autocargó un pasaporte al abrir sin enlace');
  }

  await page.getByRole('button', { name: /Las Juntas Norte/ }).first().click();
  await page.getByText('Pasaporte íntegro').waitFor({ timeout: 5000 });
  await shot('02-verificar-integro');

  await page.getByRole('button', { name: /Demostrar qué pasa/i }).click();
  await page.getByText('Los datos no coinciden').waitFor({ timeout: 5000 });
  await shot('03-verificar-alterado');

  await page.getByRole('button', { name: /Restaurar el certificado legítimo/i }).click();
  await page.getByText('Pasaporte íntegro').waitFor({ timeout: 5000 });

  // Perfil
  await page.goto(`${BASE}/ajustes`, { waitUntil: 'networkidle' });
  await page.getByText('Ing. Danny Cárdenas').first().waitFor({ timeout: 5000 });
  const stats = await page.getByText('Pasaportes', { exact: true }).count();
  if (!stats) problems.push('No se ven las estadísticas del perfil');
  await shot('04-perfil');

  // Editar perfil: validación y guardado
  await page.getByRole('button', { name: /Editar perfil/i }).click();
  const emailInput = page.locator('input[type="email"]');
  await emailInput.fill('correo-invalido');
  await page.getByRole('button', { name: /Guardar cambios/i }).click();
  await page.getByText(/no parece válido/i).waitFor({ timeout: 3000 });
  await emailInput.fill('danny@vozdecampo.mx');
  await page.getByRole('button', { name: /Guardar cambios/i }).click();
  await page.getByText(/Perfil actualizado/i).waitFor({ timeout: 3000 });

  // Detalle de pasaporte: integridad y presentación
  await page.goto(`${BASE}/pasaportes`, { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: /Abrir certificado QR/i }).first().click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: /Sello SHA-256 y prueba de integridad/i }).click();
  await page.waitForTimeout(500);
  await shot('05-pasaporte-detalle');
  const bodyText = await page.locator('body').innerText();
  if (!/Coincide/i.test(bodyText)) {
    problems.push('El detalle del pasaporte no muestra la verificación de integridad');
  }

  // Evaluación
  await page.goto(`${BASE}/evaluacion`, { waitUntil: 'networkidle' });
  await page.getByText('Modo evaluación').first().waitFor({ timeout: 5000 });
  await shot('06-evaluacion');

  // Redirección antigua /ibm
  await page.goto(`${BASE}/ibm`, { waitUntil: 'networkidle' });
  if (!page.url().endsWith('/evaluacion')) {
    problems.push(`/ibm no redirige a /evaluacion (quedó en ${page.url()})`);
  }

  // Rotación / vista móvil
  await page.setViewportSize({ width: 915, height: 412 });
  await page.goto(`${BASE}/inicio`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await shot('07-horizontal');
} catch (error) {
  problems.push(`flujo: ${error.message}`);
  await shot('99-error');
} finally {
  console.log(JSON.stringify({ problems }, null, 2));
  await browser.close();
}
