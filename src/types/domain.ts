export type CropType = 'Maíz Blanco' | 'Limón Persa' | 'Agave Azul' | 'Hortaliza Mixta';

export type ActivityType =
  | 'aplicacion_fitosanitaria'
  | 'riego'
  | 'cosecha'
  | 'monitoreo'
  | 'fertilizacion';

export type ComplianceSeverity = 'pass' | 'warning' | 'critical';

export type SyncStatus = 'synced' | 'pending' | 'error';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface TechnicianSession {
  id: string;
  name: string;
  email?: string;
  role: string;
  cipCode: string;
  organizationId: string;
  organizationName: string;
  region: string;
  pin: string;
  planTier?: 'semilla' | 'pro' | 'cooperativa';
  fieldSunlightMode: boolean;
  forcedOfflineMode: boolean;
  loggedInAt: string;
}

export interface Producer {
  id: string;
  name: string;
  community: string;
  municipality: string;
  state: string;
  avatarUrl: string;
  cooperativeCode: string;
  phoneLast4: string;
  smallholder: boolean;
  yearsInProgram: number;
}

export interface ParcelPolygonPoint {
  x: number;
  y: number;
}

export interface ParcelGeoVertex {
  lat: number;
  lng: number;
}

export interface Parcel {
  id: string;
  code: string;
  name: string;
  producerId: string;
  producerName: string;
  crop: CropType;
  variety: string;
  areaHa: number;
  altitudeM: number;
  soilType: string;
  irrigationType: 'Goteo presurizado' | 'Gravedad tecnificada' | 'Temporal asistido' | 'Microaspersión';
  coordinates: {
    lat: number;
    lng: number;
    accuracyM: number;
  };
  imageUrl: string;
  stage: string;
  plannedHarvestDate: string;
  lastVisitDate: string;
  complianceStatus: ComplianceSeverity;
  complianceScore: number;
  activeAlertTitle?: string;
  activeAlertRuleCode?: string;
  syncStatus: SyncStatus;
  routeOrder: number;
  polygon: ParcelPolygonPoint[];
  /** Vértices GPS reales del croquis, cuando el técnico lo dibujó sobre el mapa. */
  geoPolygon?: ParcelGeoVertex[];
}

export interface ComplianceCheckItem {
  ruleCode: string;
  title: string;
  authority: 'SENASICA' | 'CONAGUA' | 'COFEPRIS' | 'CODEX-EXPORT';
  severity: ComplianceSeverity;
  message: string;
  recommendation: string;
  referenceDoc: string;
  updatedAt: string;
}

export interface ComplianceReport {
  overallStatus: ComplianceSeverity;
  score: number;
  canIssuePassport: boolean;
  evaluatedAt: string;
  checks: ComplianceCheckItem[];
}

export interface VisitRecord {
  id: string;
  parcelId: string;
  parcelCode: string;
  parcelName: string;
  producerId: string;
  producerName: string;
  crop: CropType;
  technicianId: string;
  technicianCip: string;
  visitedAt: string;
  activity: ActivityType;
  voiceTranscript: string;
  audioClipDataUrl?: string;
  extractedBy: 'ibm-granite' | 'local-deterministic' | 'manual';
  extractionConfidence: number;
  agrochemicalProduct: string | null;
  activeIngredient: string | null;
  dosePerHa: number | null;
  doseUnit: 'L/ha' | 'kg/ha' | 'mL/ha' | 'g/ha' | null;
  treatedAreaHa: number;
  waterVolumeM3: number | null;
  soilMoisturePct: number | null;
  daysBeforeHarvest: number;
  requiredPhiDays: number;
  pestOrTarget: string | null;
  photoDataUrl?: string;
  evidenceStamped?: boolean;
  producerConfirmed: boolean;
  producerConfirmationName: string;
  signatureDataUrl?: string;
  coordinates: {
    lat: number;
    lng: number;
    accuracyM: number;
    source?: 'gps-device' | 'parcel-polygon';
  };
  notes: string;
  compliance: ComplianceReport;
  passportId?: string;
  syncStatus: SyncStatus;
}

export interface PassportCanonicalPayload {
  passportId: string;
  version: number;
  issuedAt: string;
  parcelCode: string;
  parcelName: string;
  producerName: string;
  cooperativeCode: string;
  crop: CropType;
  areaHa: number;
  visitId: string;
  visitedAt: string;
  technicianCip: string;
  agrochemicalProduct: string | null;
  activeIngredient: string | null;
  dosePerHa: number | null;
  doseUnit: string | null;
  daysBeforeHarvest: number;
  requiredPhiDays: number;
  waterVolumeM3: number | null;
  complianceStatus: ComplianceSeverity;
  complianceScore: number;
  coordinates: {
    lat: number;
    lng: number;
  };
}

export interface PassportRecord {
  id: string;
  parcelId: string;
  parcelCode: string;
  parcelName: string;
  producerName: string;
  buyerName: string;
  buyerAvatarUrl: string;
  crop: CropType;
  lotWeightTons: number;
  visitId: string;
  issuedAt: string;
  expiresAt: string;
  status: 'valid' | 'requires_reissue' | 'revoked';
  sha256Hash: string;
  canonicalPayload: PassportCanonicalPayload;
  qrVerificationData: string;
  aiNarrativeSummary?: string;
  syncStatus: SyncStatus;
}

export interface SyncQueueItem {
  id: string;
  entityType: 'visit' | 'passport';
  entityId: string;
  parcelCode: string;
  summary: string;
  createdAt: string;
  status: SyncStatus;
  syncedAt?: string;
  targetEndpoint: string;
  payloadPreview: Record<string, unknown>;
}

export interface AiTelemetryEvent {
  id: string;
  createdAt: string;
  mode: 'chat' | 'extract' | 'summarize';
  provider: 'watsonx' | 'demo-fallback' | 'local-offline';
  model: string;
  parcelCode?: string;
  promptPreview: string;
  responsePreview: string;
  latencyMs: number;
  totalTokens: number;
  requestId: string;
}

export interface CopilotChecklistItem {
  label: string;
  value: string;
  status: 'ok' | 'warn' | 'block';
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  provider: 'watsonx' | 'demo-fallback' | 'local-offline';
  model: string;
  citedRules?: string[];
  checklist?: CopilotChecklistItem[];
  latencyMs?: number;
  totalTokens?: number;
  requestId?: string;
  suggestedAction?: {
    label: string;
    route?: string;
    fixDaysBeforeHarvest?: number;
  };
}
