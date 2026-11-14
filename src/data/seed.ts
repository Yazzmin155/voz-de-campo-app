import {
  AiTelemetryEvent,
  Parcel,
  PassportRecord,
  Producer,
  SyncQueueItem,
  TechnicianSession,
  VisitRecord
} from '@/types/domain';

export const DEFAULT_TECHNICIAN: TechnicianSession = {
  id: 'tech-danny-01',
  name: 'Ing. Danny Cárdenas',
  role: 'Ingeniero Agrónomo de Enlace · Zona Pacífico-Centro',
  cipCode: 'CIP-84920',
  organizationId: 'coop-agroexport',
  organizationName: 'SAC · Cooperativa AgroExport del Pacífico',
  region: 'Valle de Culiacán y Altos · Ruta Técnica 04',
  pin: '2468',
  fieldSunlightMode: false,
  forcedOfflineMode: true,
  loggedInAt: '2026-11-13T07:15:00.000Z'
};

export const SEED_PRODUCERS: Producer[] = [
  {
    id: 'prod-ernesto',
    name: 'Ernesto Beltrán Sauceda',
    community: 'Ejido El Pochote',
    municipality: 'Navolato',
    state: 'Sinaloa',
    avatarUrl: '/media/avatar-productor.webp',
    cooperativeCode: 'SAC-SIN-104',
    phoneLast4: '4821',
    smallholder: true,
    yearsInProgram: 4
  },
  {
    id: 'prod-rosa',
    name: 'Rosa María Cazares Gámez',
    community: 'Las Juntas del Humaya',
    municipality: 'Culiacán',
    state: 'Sinaloa',
    avatarUrl: '/media/avatar-productor.webp',
    cooperativeCode: 'SAC-SIN-089',
    phoneLast4: '9103',
    smallholder: true,
    yearsInProgram: 6
  },
  {
    id: 'prod-javier',
    name: 'Javier Orozco Villaseñor',
    community: 'Lomas de San Julián',
    municipality: 'Arandas',
    state: 'Jalisco',
    avatarUrl: '/media/avatar-productor.webp',
    cooperativeCode: 'SAC-JAL-211',
    phoneLast4: '3370',
    smallholder: true,
    yearsInProgram: 3
  },
  {
    id: 'prod-carmen',
    name: 'Carmen Lucía Peñuelas',
    community: 'La Noria Norte',
    municipality: 'Guasave',
    state: 'Sinaloa',
    avatarUrl: '/media/avatar-productor.webp',
    cooperativeCode: 'SAC-SIN-142',
    phoneLast4: '6654',
    smallholder: true,
    yearsInProgram: 5
  }
];

export const SEED_PARCELS: Parcel[] = [
  {
    id: 'parcel-4b',
    code: 'LOTE-4B',
    name: 'El Pochote Sur',
    producerId: 'prod-ernesto',
    producerName: 'Ernesto Beltrán Sauceda',
    crop: 'Limón Persa',
    variety: 'Tahití Sin Semilla · Exportación',
    areaHa: 3.5,
    altitudeM: 38,
    soilType: 'Franco arcilloso aluvial',
    irrigationType: 'Goteo presurizado',
    coordinates: { lat: 24.7642, lng: -107.6948, accuracyM: 1.4 },
    imageUrl: '/media/lote-limon.webp',
    stage: 'Llenado de fruto · Pre-corte',
    plannedHarvestDate: '2026-11-19',
    lastVisitDate: '2026-11-12T15:30:00.000Z',
    complianceStatus: 'critical',
    complianceScore: 48,
    activeAlertTitle: 'Carencia activa: faltan 8 días para cumplir LMR de Abamectina (14d)',
    activeAlertRuleCode: 'R-PHI-04',
    syncStatus: 'pending',
    routeOrder: 1,
    polygon: [
      { x: 18, y: 24 },
      { x: 78, y: 18 },
      { x: 86, y: 74 },
      { x: 24, y: 82 }
    ]
  },
  {
    id: 'parcel-1a',
    code: 'LOTE-1A',
    name: 'Las Juntas Norte',
    producerId: 'prod-rosa',
    producerName: 'Rosa María Cazares Gámez',
    crop: 'Maíz Blanco',
    variety: 'Híbrido Sinaloa Grano Cristalino',
    areaHa: 4.2,
    altitudeM: 54,
    soilType: 'Vertisol profundo',
    irrigationType: 'Gravedad tecnificada',
    coordinates: { lat: 24.8291, lng: -107.4312, accuracyM: 1.1 },
    imageUrl: '/media/lote-maiz.webp',
    stage: 'Madurez fisiológica · Listo acopio',
    plannedHarvestDate: '2026-11-28',
    lastVisitDate: '2026-11-11T11:20:00.000Z',
    complianceStatus: 'pass',
    complianceScore: 96,
    syncStatus: 'synced',
    routeOrder: 2,
    polygon: [
      { x: 14, y: 28 },
      { x: 84, y: 22 },
      { x: 78, y: 80 },
      { x: 20, y: 76 }
    ]
  },
  {
    id: 'parcel-2c',
    code: 'LOTE-2C',
    name: 'Ladera Los Altos',
    producerId: 'prod-javier',
    producerName: 'Javier Orozco Villaseñor',
    crop: 'Agave Azul',
    variety: 'Tequilana Weber · Piña Madura',
    areaHa: 5.0,
    altitudeM: 2040,
    soilType: 'Luvisol férrico rocoso',
    irrigationType: 'Temporal asistido',
    coordinates: { lat: 20.7052, lng: -102.3419, accuracyM: 1.8 },
    imageUrl: '/media/lote-agave.webp',
    stage: 'Jima programada · Trazabilidad Denominación',
    plannedHarvestDate: '2026-12-04',
    lastVisitDate: '2026-11-10T16:10:00.000Z',
    complianceStatus: 'pass',
    complianceScore: 94,
    syncStatus: 'synced',
    routeOrder: 3,
    polygon: [
      { x: 22, y: 16 },
      { x: 80, y: 26 },
      { x: 84, y: 82 },
      { x: 16, y: 72 }
    ]
  },
  {
    id: 'parcel-3a',
    code: 'LOTE-3A',
    name: 'La Noria Surco 8',
    producerId: 'prod-carmen',
    producerName: 'Carmen Lucía Peñuelas',
    crop: 'Hortaliza Mixta',
    variety: 'Hoja Verde y Crucíferas Exportación',
    areaHa: 2.4,
    altitudeM: 29,
    soilType: 'Franco limoso orgánico',
    irrigationType: 'Goteo presurizado',
    coordinates: { lat: 25.5688, lng: -108.4671, accuracyM: 1.2 },
    imageUrl: '/media/lote-general.webp',
    stage: 'Desarrollo vegetativo · Cero residuos',
    plannedHarvestDate: '2026-11-24',
    lastVisitDate: '2026-11-12T09:45:00.000Z',
    complianceStatus: 'warning',
    complianceScore: 78,
    activeAlertTitle: 'Lámina de riego cercana al tope de concesión semanal CONAGUA',
    activeAlertRuleCode: 'R-H2O-01',
    syncStatus: 'pending',
    routeOrder: 4,
    polygon: [
      { x: 16, y: 20 },
      { x: 86, y: 20 },
      { x: 82, y: 78 },
      { x: 18, y: 78 }
    ]
  }
];

export const SEED_VISITS: VisitRecord[] = [
  {
    id: 'visit-4b-01',
    parcelId: 'parcel-4b',
    parcelCode: 'LOTE-4B',
    parcelName: 'El Pochote Sur',
    producerId: 'prod-ernesto',
    producerName: 'Ernesto Beltrán Sauceda',
    crop: 'Limón Persa',
    technicianId: 'tech-danny-01',
    technicianCip: 'CIP-84920',
    visitedAt: '2026-11-12T15:30:00.000Z',
    activity: 'aplicacion_fitosanitaria',
    voiceTranscript:
      'Recorrido en Lote 4B El Pochote con don Ernesto. Cultivo Limón Persa en 3.5 hectáreas. Apliqué Abamectina 1.1 litros por hectárea contra ácaro blanco y regué 180 metros cúbicos por goteo. El productor planea cosechar en 6 días.',
    extractedBy: 'ibm-granite',
    extractionConfidence: 0.95,
    agrochemicalProduct: 'Abamectina 1.8 CE',
    activeIngredient: 'Abamectina',
    dosePerHa: 1.1,
    doseUnit: 'L/ha',
    treatedAreaHa: 3.5,
    waterVolumeM3: 180,
    soilMoisturePct: 64,
    daysBeforeHarvest: 6,
    requiredPhiDays: 14,
    pestOrTarget: 'Ácaro blanco (Polyphagotarsonemus latus)',
    photoDataUrl: '/media/lote-limon.webp',
    producerConfirmed: true,
    producerConfirmationName: 'Ernesto Beltrán Sauceda',
    coordinates: { lat: 24.7642, lng: -107.6948, accuracyM: 1.4 },
    notes: 'Se advierte en campo que el corte debe posponerse al menos 8 días adicionales.',
    compliance: {
      overallStatus: 'critical',
      score: 48,
      canIssuePassport: false,
      evaluatedAt: '2026-11-12T15:31:00.000Z',
      checks: [
        {
          ruleCode: 'R-PHI-04',
          title: 'Violación de Período de Carencia (PHI)',
          authority: 'SENASICA',
          severity: 'critical',
          message:
            'Abamectina 1.8 CE exige 14 días de carencia en Limón Persa, pero la cosecha está programada en 6 días.',
          recommendation:
            'Reprogramar la fecha de corte a 14+ días desde la aplicación antes de emitir el Pasaporte QR.',
          referenceDoc: 'Lineamiento Técnico LMR Cítricos y Hortalizas · SENASICA (Demo)',
          updatedAt: '2026-10-01'
        },
        {
          ruleCode: 'R-DOS-01',
          title: 'Dosis dentro de rango autorizado',
          authority: 'COFEPRIS',
          severity: 'pass',
          message: 'Dosis aplicada de 1.1 L/ha dentro del máximo permitido (1.2 L/ha).',
          recommendation: 'Mantener calibración de boquillas.',
          referenceDoc: 'Registro Sanitario RSCO-INAC-0101 (Demo)',
          updatedAt: '2026-10-01'
        },
        {
          ruleCode: 'R-H2O-01',
          title: 'Volumen de riego en rango de concesión',
          authority: 'CONAGUA',
          severity: 'pass',
          message: '180 m³ en 3.5 ha (51.4 m³/ha) respeta el tope de 80 m³/ha.',
          recommendation: 'Continuar bitácora volumétrica.',
          referenceDoc: 'Anexo Técnico Distrito de Riego 010 · CONAGUA (Demo)',
          updatedAt: '2026-09-10'
        }
      ]
    },
    syncStatus: 'pending'
  },
  {
    id: 'visit-1a-01',
    parcelId: 'parcel-1a',
    parcelCode: 'LOTE-1A',
    parcelName: 'Las Juntas Norte',
    producerId: 'prod-rosa',
    producerName: 'Rosa María Cazares Gámez',
    crop: 'Maíz Blanco',
    technicianId: 'tech-danny-01',
    technicianCip: 'CIP-84920',
    visitedAt: '2026-11-11T11:20:00.000Z',
    activity: 'aplicacion_fitosanitaria',
    voiceTranscript:
      'Visita en Lote 1A Las Juntas con doña Rosa María. Maíz Blanco de 4.2 hectáreas. Aplicación de Spinosad SC 0.4 litros por hectárea para control de cogollero, riego de 260 metros cúbicos y cosecha en 17 días.',
    extractedBy: 'ibm-granite',
    extractionConfidence: 0.97,
    agrochemicalProduct: 'Spinosad SC',
    activeIngredient: 'Spinosad',
    dosePerHa: 0.4,
    doseUnit: 'L/ha',
    treatedAreaHa: 4.2,
    waterVolumeM3: 260,
    soilMoisturePct: 58,
    daysBeforeHarvest: 17,
    requiredPhiDays: 7,
    pestOrTarget: 'Gusano cogollero (Spodoptera frugiperda)',
    photoDataUrl: '/media/lote-maiz.webp',
    producerConfirmed: true,
    producerConfirmationName: 'Rosa María Cazares Gámez',
    coordinates: { lat: 24.8291, lng: -107.4312, accuracyM: 1.1 },
    notes: 'Lote libre de residuos críticos; autorizado para centro de acopio.',
    compliance: {
      overallStatus: 'pass',
      score: 96,
      canIssuePassport: true,
      evaluatedAt: '2026-11-11T11:22:00.000Z',
      checks: [
        {
          ruleCode: 'R-PHI-01',
          title: 'Período de carencia cumplido',
          authority: 'SENASICA',
          severity: 'pass',
          message: 'Cosecha a 17 días supera ampliamente los 7 días requeridos para Spinosad SC.',
          recommendation: 'Lote apto para emisión de Pasaporte QR.',
          referenceDoc: 'Catálogo Demo Fitosanitario SENASICA-COFEPRIS · LMR 2026',
          updatedAt: '2026-09-15'
        },
        {
          ruleCode: 'R-DOS-01',
          title: 'Dosis autorizada',
          authority: 'COFEPRIS',
          severity: 'pass',
          message: '0.4 L/ha por debajo del límite máximo de 0.5 L/ha.',
          recommendation: 'Sin observaciones.',
          referenceDoc: 'Catálogo Demo Fitosanitario SENASICA-COFEPRIS · LMR 2026',
          updatedAt: '2026-09-15'
        },
        {
          ruleCode: 'R-H2O-01',
          title: 'Huella hídrica verificada',
          authority: 'CONAGUA',
          severity: 'pass',
          message: '61.9 m³/ha dentro de la dotación autorizada (95 m³/ha).',
          recommendation: 'Mantener registro.',
          referenceDoc: 'Anexo Técnico Distrito de Riego 010 · CONAGUA (Demo)',
          updatedAt: '2026-09-10'
        }
      ]
    },
    passportId: 'PASS-2026-1A09',
    syncStatus: 'synced'
  },
  {
    id: 'visit-2c-01',
    parcelId: 'parcel-2c',
    parcelCode: 'LOTE-2C',
    parcelName: 'Ladera Los Altos',
    producerId: 'prod-javier',
    producerName: 'Javier Orozco Villaseñor',
    crop: 'Agave Azul',
    technicianId: 'tech-danny-01',
    technicianCip: 'CIP-84920',
    visitedAt: '2026-11-10T16:10:00.000Z',
    activity: 'aplicacion_fitosanitaria',
    voiceTranscript:
      'Revisión de pre-jima en Lote 2C Ladera Los Altos con don Javier Orozco, 5 hectáreas de Agave Azul. Aplicación preventiva de Oxicloruro de Cobre 1.8 kilos por hectárea, riego auxiliar de 110 metros cúbicos y jima programada en 24 días.',
    extractedBy: 'local-deterministic',
    extractionConfidence: 0.92,
    agrochemicalProduct: 'Oxicloruro de Cobre 50',
    activeIngredient: 'Oxicloruro de cobre',
    dosePerHa: 1.8,
    doseUnit: 'kg/ha',
    treatedAreaHa: 5.0,
    waterVolumeM3: 110,
    soilMoisturePct: 46,
    daysBeforeHarvest: 24,
    requiredPhiDays: 5,
    pestOrTarget: 'Prevención bacteriosis en piña',
    photoDataUrl: '/media/lote-agave.webp',
    producerConfirmed: true,
    producerConfirmationName: 'Javier Orozco Villaseñor',
    coordinates: { lat: 20.7052, lng: -102.3419, accuracyM: 1.8 },
    notes: 'Piñas con brix óptimo y trazabilidad completa para planta procesadora.',
    compliance: {
      overallStatus: 'pass',
      score: 94,
      canIssuePassport: true,
      evaluatedAt: '2026-11-10T16:12:00.000Z',
      checks: [
        {
          ruleCode: 'R-FIT-09',
          title: 'Carencia y molécula aprobadas',
          authority: 'SENASICA',
          severity: 'pass',
          message: '24 días previos a jima superan los 5 días requeridos para Oxicloruro de Cobre.',
          recommendation: 'Apto para recepción en acopio.',
          referenceDoc: 'Manual de Buenas Prácticas Agrícolas SRRC-SENASICA (Demo)',
          updatedAt: '2026-09-02'
        }
      ]
    },
    passportId: 'PASS-2026-2C04',
    syncStatus: 'synced'
  }
];

export const SEED_PASSPORTS: PassportRecord[] = [
  {
    id: 'PASS-2026-1A09',
    parcelId: 'parcel-1a',
    parcelCode: 'LOTE-1A',
    parcelName: 'Las Juntas Norte',
    producerName: 'Rosa María Cazares Gámez',
    buyerName: 'Centro de Acopio AgroExport Pacífico · Silo 03',
    buyerAvatarUrl: '/media/avatar-comprador.webp',
    crop: 'Maíz Blanco',
    lotWeightTons: 38.5,
    visitId: 'visit-1a-01',
    issuedAt: '2026-11-11T11:25:00.000Z',
    expiresAt: '2026-12-11T11:25:00.000Z',
    status: 'valid',
    sha256Hash: '9f4d8c21e0a347b8c1d507e6b29a4f83d1c074a2b86e51c92a4e8f10d3b67c12',
    canonicalPayload: {
      passportId: 'PASS-2026-1A09',
      version: 1,
      issuedAt: '2026-11-11T11:25:00.000Z',
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
    },
    qrVerificationData: '',
    aiNarrativeSummary:
      'Lote de 4.2 ha de Maíz Blanco verificado en campo por Ing. Danny Cárdenas (CIP-84920). Aplicación biológica de Spinosad SC (0.4 L/ha) con 17 días de resguardo previo a cosecha (norma: 7 días). Cumple parámetros fitosanitarios y volumétricos.',
    syncStatus: 'synced'
  },
  {
    id: 'PASS-2026-2C04',
    parcelId: 'parcel-2c',
    parcelCode: 'LOTE-2C',
    parcelName: 'Ladera Los Altos',
    producerName: 'Javier Orozco Villaseñor',
    buyerName: 'Destilería y Acopio Los Altos S.A.',
    buyerAvatarUrl: '/media/avatar-comprador.webp',
    crop: 'Agave Azul',
    lotWeightTons: 62.0,
    visitId: 'visit-2c-01',
    issuedAt: '2026-11-10T16:18:00.000Z',
    expiresAt: '2026-12-10T16:18:00.000Z',
    status: 'valid',
    sha256Hash: '3a8e11c4f9b27d6051e820c47a19d3e5b7c680a1492f5d8e3c107a6b9d2e4f08',
    canonicalPayload: {
      passportId: 'PASS-2026-2C04',
      version: 1,
      issuedAt: '2026-11-10T16:18:00.000Z',
      parcelCode: 'LOTE-2C',
      parcelName: 'Ladera Los Altos',
      producerName: 'Javier Orozco Villaseñor',
      cooperativeCode: 'SAC-JAL-211',
      crop: 'Agave Azul',
      areaHa: 5.0,
      visitId: 'visit-2c-01',
      visitedAt: '2026-11-10T16:10:00.000Z',
      technicianCip: 'CIP-84920',
      agrochemicalProduct: 'Oxicloruro de Cobre 50',
      activeIngredient: 'Oxicloruro de cobre',
      dosePerHa: 1.8,
      doseUnit: 'kg/ha',
      daysBeforeHarvest: 24,
      requiredPhiDays: 5,
      waterVolumeM3: 110,
      complianceStatus: 'pass',
      complianceScore: 94,
      coordinates: { lat: 20.7052, lng: -102.3419 }
    },
    qrVerificationData: '',
    aiNarrativeSummary:
      'Lote de 5.0 ha de Agave Azul en Arandas, Jalisco. Manejo preventivo con Oxicloruro de Cobre dentro de límite y 24 días antes de jima. Trazabilidad validada para recepción industrial.',
    syncStatus: 'synced'
  }
];

export const SEED_SYNC_QUEUE: SyncQueueItem[] = [
  {
    id: 'sync-item-01',
    entityType: 'visit',
    entityId: 'visit-4b-01',
    parcelCode: 'LOTE-4B',
    summary: 'Bitácora fitosanitaria + Alerta R-PHI-04 (Limón Persa · 3.5 ha)',
    createdAt: '2026-11-12T15:31:00.000Z',
    status: 'pending',
    targetEndpoint: 'watsonx.data · bronze_agro_field_events_v2',
    payloadPreview: {
      schema_version: '2.6.0',
      tenant_id: 'coop-agroexport',
      technician_cip: 'CIP-84920',
      parcel_code: 'LOTE-4B',
      crop: 'Limón Persa',
      event_type: 'aplicacion_fitosanitaria',
      active_ingredient: 'Abamectina',
      dose_per_ha: 1.1,
      dose_unit: 'L/ha',
      days_before_harvest: 6,
      required_phi_days: 14,
      compliance_status: 'critical',
      rule_triggered: 'R-PHI-04',
      captured_offline: true
    }
  }
];

export const SEED_AI_TELEMETRY: AiTelemetryEvent[] = [
  {
    id: 'ai-ev-01',
    createdAt: '2026-11-12T15:30:40.000Z',
    mode: 'extract',
    provider: 'demo-fallback',
    model: 'ibm/granite-4-h-small',
    parcelCode: 'LOTE-4B',
    promptPreview: 'Extracción estructurada de nota de voz en Lote 4B (Abamectina 1.1 L/ha)...',
    responsePreview: '{"activity":"aplicacion_fitosanitaria","product":"Abamectina 1.8 CE","dose":1.1}',
    latencyMs: 210,
    totalTokens: 248,
    requestId: 'granite-local-8f21'
  },
  {
    id: 'ai-ev-02',
    createdAt: '2026-11-12T15:32:10.000Z',
    mode: 'chat',
    provider: 'demo-fallback',
    model: 'ibm/granite-4-h-small',
    parcelCode: 'LOTE-4B',
    promptPreview: '¿Por qué se bloqueó el pasaporte del Lote 4B?',
    responsePreview:
      'Bloqueo por regla R-PHI-04 (SENASICA): Abamectina requiere 14 días de carencia en Limón Persa y restan 8 días.',
    latencyMs: 185,
    totalTokens: 312,
    requestId: 'granite-local-9c04'
  }
];
