import { expect, test } from '@playwright/test';

const TUTORIAL_CTAS = [
  'Siguiente',
  'Ver cómo se dicta',
  'Ver lo que entendió',
  'Pasar a la revisión',
  'Ver el pasaporte',
  'Último paso',
  'Empezar'
];

test.describe('Voz de Campo · flujo real de campo', () => {
  test('demo, tutorial bloqueante, verificador y perfil', async ({ page }) => {
    await page.goto('/entrar');

    // El splash avanza solo; el onboarding se puede saltar.
    await page.waitForTimeout(2200);
    const skipOnboarding = page.getByRole('button', { name: /^Saltar$/ });
    if (await skipOnboarding.isVisible().catch(() => false)) {
      await skipOnboarding.click();
    }

    await page
      .getByRole('button', { name: /Probar con datos de ejemplo/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/inicio/);
    await expect(page.getByText('Ruta de hoy · En campo')).toBeVisible();

    // El recorrido es bloqueante: es un diálogo modal.
    const tour = page.getByRole('dialog');
    await expect(tour).toBeVisible();
    await expect(tour).toHaveAttribute('aria-modal', 'true');

    for (const label of TUTORIAL_CTAS) {
      await page.getByRole('button', { name: label, exact: true }).click();
      await page.waitForTimeout(400);
    }
    await expect(tour).toBeHidden();

    // Verificador: sin autocarga, con pasaporte guardado y prueba anti-fraude.
    await page.goto('/verificar');
    await expect(page.getByText('Pasaporte íntegro')).toHaveCount(0);

    await page.getByRole('button', { name: /Las Juntas Norte/ }).first().click();
    await expect(page.getByText('Pasaporte íntegro')).toBeVisible();

    await page.getByRole('button', { name: /Demostrar qué pasa/i }).click();
    await expect(page.getByText('Los datos no coinciden')).toBeVisible();

    await page.getByRole('button', { name: /Restaurar el certificado legítimo/i }).click();
    await expect(page.getByText('Pasaporte íntegro')).toBeVisible();

    // Perfil con identidad, estadísticas y acceso a evaluación.
    await page.goto('/ajustes');
    await expect(page.getByText('Ing. Danny Cárdenas').first()).toBeVisible();
    await expect(page.getByText('Cédula CIP-84920')).toBeVisible();
    await expect(page.getByText('Modo evaluación')).toBeVisible();
  });

  test('el verificador explica un enlace inválido sin romperse', async ({ page }) => {
    await page.goto('/verificar');
    await page.getByPlaceholder(/verificar\?d=/).fill('esto-no-es-un-pasaporte');
    await page.getByRole('button', { name: /Verificar sello/i }).click();
    await expect(page.getByRole('alert')).toContainText(/no es un pasaporte/i);
  });
});
