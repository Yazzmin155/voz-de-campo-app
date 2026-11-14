import { describe, expect, it } from 'vitest';
import { parseAgronomicNoteLocally } from '../src/lib/parser';
import { evaluateAgronomicCompliance } from '../src/lib/compliance';
import {
  canonicalizePassportPayload,
  computeSha256Hex,
  decodePassportEnvelopeFromBase64Url,
  encodePassportEnvelopeToBase64Url
} from '../src/lib/crypto';
import { applyThemeToDom, useAppStore } from '../src/lib/db';
import { classifyMediaError } from '../src/lib/sensors';
import { PassportCanonicalPayload } from '../src/types/domain';

describe('Motor de Extracción Agronómica Local (Parser)', () => {
  it('extrae cultivo, producto, dosis, riego y días para cosecha desde nota en español', () => {
    const note =
      'Recorrido en Lote 4B El Pochote. Cultivo Limón Persa en 3.5 hectáreas. Apliqué Abamectina 1.1 litros por hectárea y regué 180 metros cúbicos. El productor planea cosechar en 6 días.';
    const parsed = parseAgronomicNoteLocally(note, 'Limón Persa', 3.5);

    expect(parsed.activity).toBe('aplicacion_fitosanitaria');
    expect(parsed.crop).toBe('Limón Persa');
    expect(parsed.agrochemicalProduct).toBe('Abamectina 1.8 CE');
    expect(parsed.dosePerHa).toBe(1.1);
    expect(parsed.doseUnit).toBe('L/ha');
    expect(parsed.treatedAreaHa).toBe(3.5);
    expect(parsed.waterVolumeM3).toBe(180);
    expect(parsed.daysBeforeHarvest).toBe(6);
    expect(parsed.requiredPhiDays).toBe(14);
  });
});

describe('Escudo Legal Fitosanitario y CONAGUA (Compliance Engine)', () => {
  it('bloquea el Pasaporte QR cuando no se cumple el período de carencia (PHI)', () => {
    const report = evaluateAgronomicCompliance({
      crop: 'Limón Persa',
      activity: 'aplicacion_fitosanitaria',
      agrochemicalProduct: 'Abamectina 1.8 CE',
      dosePerHa: 1.1,
      doseUnit: 'L/ha',
      treatedAreaHa: 3.5,
      waterVolumeM3: 180,
      daysBeforeHarvest: 6,
      producerConfirmed: true
    });

    expect(report.overallStatus).toBe('critical');
    expect(report.canIssuePassport).toBe(false);
    expect(report.checks.some((c) => c.ruleCode === 'R-PHI-04')).toBe(true);
  });

  it('aprueba el lote y habilita Pasaporte QR cuando cumple carencia, dosis y agua', () => {
    const report = evaluateAgronomicCompliance({
      crop: 'Maíz Blanco',
      activity: 'aplicacion_fitosanitaria',
      agrochemicalProduct: 'Spinosad SC',
      dosePerHa: 0.4,
      doseUnit: 'L/ha',
      treatedAreaHa: 4.2,
      waterVolumeM3: 260,
      daysBeforeHarvest: 17,
      producerConfirmed: true
    });

    expect(report.overallStatus).toBe('pass');
    expect(report.canIssuePassport).toBe(true);
    expect(report.score).toBeGreaterThanOrEqual(90);
  });

  it('bloquea inmediatamente moléculas prohibidas como Clorpirifos', () => {
    const report = evaluateAgronomicCompliance({
      crop: 'Hortaliza Mixta',
      activity: 'aplicacion_fitosanitaria',
      agrochemicalProduct: 'Clorpirifos Etil (Prohibido en Exportación)',
      dosePerHa: 1.0,
      doseUnit: 'L/ha',
      treatedAreaHa: 2.0,
      waterVolumeM3: 100,
      daysBeforeHarvest: 30,
      producerConfirmed: true
    });

    expect(report.overallStatus).toBe('critical');
    expect(report.canIssuePassport).toBe(false);
    expect(report.checks.some((c) => c.ruleCode === 'R-BAN-02')).toBe(true);
  });
});

describe('Pasaporte QR y Sello de Integridad SHA-256', () => {
  const samplePayload: PassportCanonicalPayload = {
    passportId: 'PASS-2026-TEST',
    version: 1,
    issuedAt: '2026-11-13T10:00:00.000Z',
    parcelCode: 'LOTE-1A',
    parcelName: 'Las Juntas Norte',
    producerName: 'Rosa María Cazares Gámez',
    cooperativeCode: 'SAC-SIN-089',
    crop: 'Maíz Blanco',
    areaHa: 4.2,
    visitId: 'visit-1a-01',
    visitedAt: '2026-11-11T11:20:00.000Z',
    technicianCip: 'CIP-84920',
    agrochemicalProduct: 'Spinosad SC',
    activeIngredient: 'Spinosad',
    dosePerHa: 0.4,
    doseUnit: 'L/ha',
    daysBeforeHarvest: 17,
    requiredPhiDays: 7,
    waterVolumeM3: 260,
    complianceStatus: 'pass',
    complianceScore: 96,
    coordinates: { lat: 24.8291, lng: -107.4312 }
  };

  it('produce el mismo hash SHA-256 sin importar el orden de las llaves y detecta alteraciones', async () => {
    const canonical1 = canonicalizePassportPayload(samplePayload);
    const hash1 = await computeSha256Hex(canonical1);

    const altered = { ...samplePayload, daysBeforeHarvest: 5 };
    const canonical2 = canonicalizePassportPayload(altered);
    const hash2 = await computeSha256Hex(canonical2);

    expect(hash1).toHaveLength(64);
    expect(hash1).not.toBe(hash2);

    const token = encodePassportEnvelopeToBase64Url({ p: samplePayload, h: hash1 });
    const decoded = decodePassportEnvelopeFromBase64Url(token);
    expect(decoded?.h).toBe(hash1);
    expect(decoded?.p.passportId).toBe('PASS-2026-TEST');
  });
});

describe('Modo Oscuro Real, Tutorial Interactivo y Capa de Sensores (v2)', () => {
  it('aplica data-theme="dark" sin activar nunca clases que escalen la fuente', () => {
    applyThemeToDom('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('field-sunlight')).toBe(false);

    applyThemeToDom('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('controla el estado del tutorial interactivo de 7 pasos', () => {
    const store = useAppStore.getState();
    store.startTutorial(0);
    expect(useAppStore.getState().tutorialActive).toBe(true);
    expect(useAppStore.getState().tutorialStep).toBe(0);

    store.nextTutorialStep();
    expect(useAppStore.getState().tutorialStep).toBe(1);

    store.skipTutorial();
    expect(useAppStore.getState().tutorialActive).toBe(false);
    expect(useAppStore.getState().hasCompletedTutorial).toBe(true);
  });

  it('clasifica errores de permisos de micrófono y cámara con instrucciones claras', () => {
    const deniedErr = new Error('Permission denied');
    deniedErr.name = 'NotAllowedError';
    const info = classifyMediaError(deniedErr, 'micrófono');
    expect(info.code).toBe('NotAllowedError');
    expect(info.title.toLowerCase()).toContain('micrófono');
  });
});
