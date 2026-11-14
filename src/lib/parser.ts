import { AGROCHEMICAL_CATALOG } from '@/data/rules';
import { ActivityType, CropType } from '@/types/domain';
import { z } from 'zod';

export interface ParsedFieldNote {
  activity: ActivityType;
  crop: CropType | null;
  parcelCodeHint: string | null;
  agrochemicalProduct: string | null;
  activeIngredient: string | null;
  dosePerHa: number | null;
  doseUnit: 'L/ha' | 'kg/ha' | 'mL/ha' | 'g/ha' | null;
  treatedAreaHa: number | null;
  waterVolumeM3: number | null;
  daysBeforeHarvest: number | null;
  requiredPhiDays: number | null;
  pestOrTarget: string | null;
  confidence: number;
  missingFields: string[];
  summary: string;
}

export const GraniteExtractionSchema = z.object({
  activity: z
    .enum(['aplicacion_fitosanitaria', 'riego', 'cosecha', 'monitoreo', 'fertilizacion'])
    .optional(),
  crop: z.string().nullable().optional(),
  product: z.string().nullable().optional(),
  activeIngredient: z.string().nullable().optional(),
  dose: z.number().nullable().optional(),
  doseUnit: z.enum(['L/ha', 'kg/ha', 'mL/ha', 'g/ha']).nullable().optional(),
  areaHa: z.number().nullable().optional(),
  waterVolumeM3: z.number().nullable().optional(),
  plannedHarvestDays: z.number().nullable().optional(),
  pestOrTarget: z.string().nullable().optional(),
  summary: z.string().optional()
});

export function parseAgronomicNoteLocally(
  rawText: string,
  defaultCrop: CropType = 'Maíz Blanco',
  defaultAreaHa = 3.5
): ParsedFieldNote {
  const text = rawText.trim();
  const lower = text.toLowerCase();

  // 1. Detectar lote mencionado
  const loteMatch = text.match(/lote[\s-]*([0-9]+[a-z]?)/i);
  const parcelCodeHint = loteMatch ? `LOTE-${loteMatch[1].toUpperCase()}` : null;

  // 2. Detectar cultivo
  let crop: CropType | null = defaultCrop;
  if (lower.includes('limón') || lower.includes('limon') || lower.includes('cítrico')) {
    crop = 'Limón Persa';
  } else if (lower.includes('maíz') || lower.includes('maiz')) {
    crop = 'Maíz Blanco';
  } else if (lower.includes('agave') || lower.includes('piña') || lower.includes('jima')) {
    crop = 'Agave Azul';
  } else if (lower.includes('hortaliza') || lower.includes('lechuga') || lower.includes('brócoli')) {
    crop = 'Hortaliza Mixta';
  }

  // 3. Detectar producto del catálogo
  let matchedRule = AGROCHEMICAL_CATALOG.find((item) =>
    item.aliases.some((alias) => lower.includes(alias.toLowerCase()))
  );

  // 4. Detectar actividad
  let activity: ActivityType = 'monitoreo';
  if (matchedRule || lower.includes('apliqué') || lower.includes('aplicación') || lower.includes('fumig')) {
    activity = 'aplicacion_fitosanitaria';
  } else if (lower.includes('fertiliz') || lower.includes('composta') || lower.includes('nitrógeno')) {
    activity = 'fertilizacion';
  } else if (lower.includes('regué') || lower.includes('riego') || lower.includes('goteo')) {
    activity = 'riego';
  } else if (lower.includes('cosech') || lower.includes('corte') || lower.includes('jima')) {
    activity = 'cosecha';
  }

  // 5. Detectar dosis por hectárea
  let dosePerHa: number | null = null;
  let doseUnit: 'L/ha' | 'kg/ha' | 'mL/ha' | 'g/ha' | null = matchedRule?.doseUnit ?? 'L/ha';

  const doseMatch = lower.match(
    /(\d+(?:[.,]\d+)?)\s*(litros?|l|kilos?|kilogramos?|kg|mililitros?|ml|gramos?|g)\s*(?:por\s*hect[áa]rea|\/ha)?/i
  );
  if (doseMatch) {
    dosePerHa = parseFloat(doseMatch[1].replace(',', '.'));
    const unitRaw = doseMatch[2].toLowerCase();
    if (unitRaw.startsWith('k')) doseUnit = 'kg/ha';
    else if (unitRaw.startsWith('m')) doseUnit = 'mL/ha';
    else if (unitRaw.startsWith('g')) doseUnit = 'g/ha';
    else doseUnit = 'L/ha';
  }

  // 6. Detectar superficie en hectáreas
  let treatedAreaHa: number | null = defaultAreaHa;
  const areaMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:hect[áa]reas?|ha\b)/i);
  if (areaMatch) {
    treatedAreaHa = parseFloat(areaMatch[1].replace(',', '.'));
  }

  // 7. Detectar volumen de agua en m³
  let waterVolumeM3: number | null = null;
  const waterMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:metros?\s*c[úu]bicos?|m3|m³)/i);
  if (waterMatch) {
    waterVolumeM3 = parseFloat(waterMatch[1].replace(',', '.'));
  }

  // 8. Detectar días para cosecha / corte / jima
  let daysBeforeHarvest: number | null = null;
  const harvestMatch = lower.match(
    /(?:cosecha\w*|cort\w*|jima\w*|recolecci[óo]n)(?:\s+\w+){0,3}\s+en\s+(\d+)\s*d[íi]as?/i
  ) || lower.match(/en\s+(\d+)\s*d[íi]as?\s+(?:para\s+)?(?:cosecha|corte|jima)/i);

  if (harvestMatch) {
    daysBeforeHarvest = parseInt(harvestMatch[1], 10);
  } else {
    const genericDays = lower.match(/(\d+)\s*d[íi]as?/i);
    if (genericDays) {
      daysBeforeHarvest = parseInt(genericDays[1], 10);
    }
  }

  // 9. Detectar plaga u objetivo
  let pestOrTarget: string | null = null;
  if (lower.includes('ácaro') || lower.includes('acaro')) {
    pestOrTarget = 'Ácaro blanco (Polyphagotarsonemus latus)';
  } else if (lower.includes('cogollero') || lower.includes('gusano')) {
    pestOrTarget = 'Gusano cogollero (Spodoptera frugiperda)';
  } else if (lower.includes('bacteriosis') || lower.includes('hongo')) {
    pestOrTarget = 'Prevención fúngica / bacteriosis';
  } else if (lower.includes('plaga de suelo')) {
    pestOrTarget = 'Complejo de plagas de suelo';
  }

  const requiredPhiDays = matchedRule
    ? (crop && matchedRule.phiDaysByCrop[crop]) ?? matchedRule.defaultPhiDays
    : 0;

  const missingFields: string[] = [];
  if (activity === 'aplicacion_fitosanitaria' && !matchedRule) {
    missingFields.push('Nombre comercial o ingrediente activo');
  }
  if (activity === 'aplicacion_fitosanitaria' && dosePerHa === null) {
    missingFields.push('Dosis por hectárea');
  }
  if (daysBeforeHarvest === null) {
    missingFields.push('Días estimados para cosecha');
  }

  let foundCount = 2;
  if (matchedRule) foundCount += 2;
  if (dosePerHa !== null) foundCount += 1;
  if (waterVolumeM3 !== null) foundCount += 1;
  if (daysBeforeHarvest !== null) foundCount += 1;
  const confidence = Math.min(0.98, Math.max(0.62, Number((foundCount / 7).toFixed(2))));

  return {
    activity,
    crop,
    parcelCodeHint,
    agrochemicalProduct: matchedRule?.productName ?? null,
    activeIngredient: matchedRule?.activeIngredient ?? null,
    dosePerHa,
    doseUnit,
    treatedAreaHa,
    waterVolumeM3,
    daysBeforeHarvest: daysBeforeHarvest ?? 14,
    requiredPhiDays,
    pestOrTarget,
    confidence,
    missingFields,
    summary: text.slice(0, 180)
  };
}
