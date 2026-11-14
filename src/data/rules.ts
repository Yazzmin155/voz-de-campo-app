import { CropType } from '@/types/domain';

export interface AgrochemicalRuleSpec {
  id: string;
  productName: string;
  aliases: string[];
  activeIngredient: string;
  status: 'allowed' | 'restricted' | 'banned';
  allowedCrops: CropType[];
  maxDosePerHa: number;
  doseUnit: 'L/ha' | 'kg/ha' | 'mL/ha' | 'g/ha';
  phiDaysByCrop: Partial<Record<CropType, number>>;
  defaultPhiDays: number;
  authority: 'SENASICA' | 'COFEPRIS' | 'CODEX-EXPORT';
  ruleCode: string;
  referenceDoc: string;
  updatedAt: string;
  notes: string;
}

export const AGROCHEMICAL_CATALOG: AgrochemicalRuleSpec[] = [
  {
    id: 'prod-spinosad',
    productName: 'Spinosad SC',
    aliases: ['spinosad', 'espinosad', 'tracer'],
    activeIngredient: 'Spinosad',
    status: 'allowed',
    allowedCrops: ['Maíz Blanco', 'Limón Persa', 'Agave Azul', 'Hortaliza Mixta'],
    maxDosePerHa: 0.5,
    doseUnit: 'L/ha',
    phiDaysByCrop: {
      'Maíz Blanco': 7,
      'Limón Persa': 3,
      'Agave Azul': 7,
      'Hortaliza Mixta': 3
    },
    defaultPhiDays: 7,
    authority: 'SENASICA',
    ruleCode: 'R-PHI-01',
    referenceDoc: 'Catálogo Demo Fitosanitario SENASICA-COFEPRIS · LMR 2026',
    updatedAt: '2026-09-15',
    notes: 'Bioinsecticida de bajo impacto; respetar intervalo de seguridad antes del corte.'
  },
  {
    id: 'prod-abamectina',
    productName: 'Abamectina 1.8 CE',
    aliases: ['abamectina', 'agrimec', 'vertimec'],
    activeIngredient: 'Abamectina',
    status: 'allowed',
    allowedCrops: ['Limón Persa', 'Hortaliza Mixta', 'Maíz Blanco'],
    maxDosePerHa: 1.2,
    doseUnit: 'L/ha',
    phiDaysByCrop: {
      'Limón Persa': 14,
      'Hortaliza Mixta': 7,
      'Maíz Blanco': 14
    },
    defaultPhiDays: 14,
    authority: 'SENASICA',
    ruleCode: 'R-PHI-04',
    referenceDoc: 'Lineamiento Técnico LMR Cítricos y Hortalizas · SENASICA (Demo)',
    updatedAt: '2026-10-01',
    notes: 'Acaricida/insecticida. Exige 14 días de carencia en cítricos de exportación.'
  },
  {
    id: 'prod-azoxystrobin',
    productName: 'Azoxystrobin WG',
    aliases: ['azoxystrobin', 'azoxistrobin', 'amistar'],
    activeIngredient: 'Azoxystrobin',
    status: 'allowed',
    allowedCrops: ['Maíz Blanco', 'Limón Persa', 'Agave Azul', 'Hortaliza Mixta'],
    maxDosePerHa: 0.8,
    doseUnit: 'kg/ha',
    phiDaysByCrop: {
      'Maíz Blanco': 10,
      'Limón Persa': 7,
      'Agave Azul': 14,
      'Hortaliza Mixta': 5
    },
    defaultPhiDays: 10,
    authority: 'CODEX-EXPORT',
    ruleCode: 'R-LMR-07',
    referenceDoc: 'Estándar Codex Alimentarius / Tolerancias EPA-SENASICA (Demo)',
    updatedAt: '2026-08-20',
    notes: 'Fungicida sistémico; no exceder 0.8 kg/ha por aplicación.'
  },
  {
    id: 'prod-cobre',
    productName: 'Oxicloruro de Cobre 50',
    aliases: ['oxicloruro de cobre', 'cobre', 'cupravit'],
    activeIngredient: 'Oxicloruro de cobre',
    status: 'allowed',
    allowedCrops: ['Limón Persa', 'Agave Azul', 'Hortaliza Mixta', 'Maíz Blanco'],
    maxDosePerHa: 2.5,
    doseUnit: 'kg/ha',
    phiDaysByCrop: {
      'Limón Persa': 2,
      'Agave Azul': 5,
      'Hortaliza Mixta': 3,
      'Maíz Blanco': 3
    },
    defaultPhiDays: 3,
    authority: 'SENASICA',
    ruleCode: 'R-FIT-09',
    referenceDoc: 'Manual de Buenas Prácticas Agrícolas SRRC-SENASICA (Demo)',
    updatedAt: '2026-09-02',
    notes: 'Preventivo bacteriano y fúngico con carencia corta.'
  },
  {
    id: 'prod-glifosato',
    productName: 'Glifosato 360 SL (Restringido)',
    aliases: ['glifosato', 'roundup', 'faena'],
    activeIngredient: 'Glifosato',
    status: 'restricted',
    allowedCrops: ['Maíz Blanco', 'Agave Azul'],
    maxDosePerHa: 1.5,
    doseUnit: 'L/ha',
    phiDaysByCrop: {
      'Maíz Blanco': 21,
      'Agave Azul': 21
    },
    defaultPhiDays: 21,
    authority: 'COFEPRIS',
    ruleCode: 'R-RES-12',
    referenceDoc: 'Control de Moléculas Sujetas a Restricción y Sustitución Agroecológica (Demo)',
    updatedAt: '2026-10-12',
    notes: 'Uso restringido a pre-siembra o entre callejones con justificación técnica; prohibido cerca de cosecha.'
  },
  {
    id: 'prod-clorpirifos',
    productName: 'Clorpirifos Etil (Prohibido en Exportación)',
    aliases: ['clorpirifos', 'lorsban', 'clorpirifos etil'],
    activeIngredient: 'Clorpirifos etil',
    status: 'banned',
    allowedCrops: [],
    maxDosePerHa: 0,
    doseUnit: 'L/ha',
    phiDaysByCrop: {},
    defaultPhiDays: 90,
    authority: 'COFEPRIS',
    ruleCode: 'R-BAN-02',
    referenceDoc: 'Alerta Fitosanitaria de Rechazo en Aduana · Tolerancia Cero LMR (Demo)',
    updatedAt: '2026-10-18',
    notes: 'Molécula con prohibición/revocación de tolerancias de exportación. Bloquea Pasaporte QR.'
  },
  {
    id: 'prod-paraquat',
    productName: 'Paraquat Dicloruro (Prohibido)',
    aliases: ['paraquat', 'gramoxone'],
    activeIngredient: 'Paraquat',
    status: 'banned',
    allowedCrops: [],
    maxDosePerHa: 0,
    doseUnit: 'L/ha',
    phiDaysByCrop: {},
    defaultPhiDays: 90,
    authority: 'COFEPRIS',
    ruleCode: 'R-BAN-03',
    referenceDoc: 'Lista de Plaguicidas Prohibidos y de Alta Peligrosidad (Demo)',
    updatedAt: '2026-10-18',
    notes: 'Prohibido por riesgo sanitario y ambiental. Bloquea emisión de Pasaporte QR.'
  }
];

export const WATER_CONCESSION_LIMITS_M3_PER_HA: Record<CropType, number> = {
  'Maíz Blanco': 95,
  'Limón Persa': 80,
  'Agave Azul': 35,
  'Hortaliza Mixta': 85
};

export const VOICE_DEMO_PRESETS = [
  {
    id: 'preset-carencia-alerta',
    label: 'Caso 1 · Riesgo de carencia (Lote 4B)',
    parcelId: 'parcel-4b',
    transcript:
      'Recorrido en Lote 4B El Pochote con don Ernesto. Cultivo Limón Persa en 3.5 hectáreas. Apliqué Abamectina 1.1 litros por hectárea contra ácaro blanco y regué 180 metros cúbicos por goteo. El productor planea cosechar en 6 días.'
  },
  {
    id: 'preset-aprobado-maiz',
    label: 'Caso 2 · Cumplimiento limpio (Lote 1A)',
    parcelId: 'parcel-1a',
    transcript:
      'Visita técnica en Lote 1A Las Juntas, Maíz Blanco sobre 4.2 hectáreas. Aplicación preventiva de Spinosad 0.4 litros por hectárea para gusano cogollero, riego de 260 metros cúbicos y cosecha programada en 18 días. Productor confirma en campo.'
  },
  {
    id: 'preset-prohibido',
    label: 'Caso 3 · Molécula prohibida (Clorpirifos)',
    parcelId: 'parcel-3a',
    transcript:
      'Inspección en Lote 3A La Noria, Hortaliza Mixta en 2.4 hectáreas. Se detectó aplicación reciente de Clorpirifos 1.5 litros por hectárea para plaga de suelo, con corte previsto en 10 días.'
  }
];
