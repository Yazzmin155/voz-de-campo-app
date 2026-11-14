import Dexie, { type Table } from 'dexie';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_TECHNICIAN,
  SEED_AI_TELEMETRY,
  SEED_PARCELS,
  SEED_PASSPORTS,
  SEED_PRODUCERS,
  SEED_SYNC_QUEUE,
  SEED_VISITS
} from '@/data/seed';
import { buildPassportVerificationUrl, canonicalizePassportPayload, computeSha256Hex } from '@/lib/crypto';
import { AuthIdentity } from '@/lib/auth';
import {
  AiTelemetryEvent,
  CopilotMessage,
  Parcel,
  PassportRecord,
  Producer,
  SyncQueueItem,
  TechnicianSession,
  ThemeMode,
  VisitRecord
} from '@/types/domain';

export class VozDeCampoDatabase extends Dexie {
  producers!: Table<Producer, string>;
  parcels!: Table<Parcel, string>;
  visits!: Table<VisitRecord, string>;
  passports!: Table<PassportRecord, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  aiTelemetry!: Table<AiTelemetryEvent, string>;

  constructor() {
    super('VozDeCampoEdgeDB_v1');
    this.version(1).stores({
      producers: 'id, municipality, cooperativeCode',
      parcels: 'id, code, producerId, complianceStatus, syncStatus, routeOrder',
      visits: 'id, parcelId, visitedAt, syncStatus',
      passports: 'id, parcelId, visitId, issuedAt, status',
      syncQueue: 'id, entityType, entityId, status, createdAt',
      aiTelemetry: 'id, createdAt, mode, provider'
    });
  }
}

export const db = new VozDeCampoDatabase();

export function applyThemeToDom(themeMode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = themeMode === 'dark' || (themeMode === 'system' && prefersDark);
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  document.documentElement.classList.toggle('dark', isDark);
  // Nunca alterar el tamaño de fuente global
  document.documentElement.classList.remove('field-sunlight');
}

export async function ensureSeedData(forceReset = false): Promise<void> {
  if (forceReset) {
    await db.transaction(
      'rw',
      [db.producers, db.parcels, db.visits, db.passports, db.syncQueue, db.aiTelemetry],
      async () => {
        await db.producers.clear();
        await db.parcels.clear();
        await db.visits.clear();
        await db.passports.clear();
        await db.syncQueue.clear();
        await db.aiTelemetry.clear();
      }
    );
  }

  const parcelCount = await db.parcels.count();
  if (parcelCount > 0 && !forceReset) {
    return;
  }

  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://voz-de-campo.vercel.app';

  const preparedPassports: PassportRecord[] = [];
  for (const pass of SEED_PASSPORTS) {
    const canonical = canonicalizePassportPayload(pass.canonicalPayload);
    const computedHash = await computeSha256Hex(canonical);
    const qrUrl = buildPassportVerificationUrl(origin, pass.canonicalPayload, computedHash);
    preparedPassports.push({
      ...pass,
      sha256Hash: computedHash,
      qrVerificationData: qrUrl
    });
  }

  await db.transaction(
    'rw',
    [db.producers, db.parcels, db.visits, db.passports, db.syncQueue, db.aiTelemetry],
    async () => {
      await db.producers.bulkPut(SEED_PRODUCERS);
      await db.parcels.bulkPut(SEED_PARCELS);
      await db.visits.bulkPut(SEED_VISITS);
      await db.passports.bulkPut(preparedPassports);
      await db.syncQueue.bulkPut(SEED_SYNC_QUEUE);
      await db.aiTelemetry.bulkPut(SEED_AI_TELEMETRY);
    }
  );
}

export interface ToastNotice {
  id: string;
  title: string;
  description?: string;
  tone?: 'success' | 'warning' | 'danger' | 'info';
}

interface AppUiState {
  isAuthenticated: boolean;
  hasSeenSplash: boolean;
  hasCompletedOnboarding: boolean;
  tutorialActive: boolean;
  tutorialStep: number;
  hasCompletedTutorial: boolean;
  themeMode: ThemeMode;
  lowDataMode: boolean;
  desktopWideMode: boolean;
  technician: TechnicianSession;
  copilotOpen: boolean;
  copilotParcelId: string | null;
  copilotMessages: CopilotMessage[];
  syncDrawerOpen: boolean;
  notificationsOpen: boolean;
  demoGuideOpen: boolean;
  toasts: ToastNotice[];
  login: (identity: AuthIdentity, launchTutorialIfNew?: boolean) => void;
  logout: () => void;
  markSplashSeen: () => void;
  completeOnboarding: () => void;
  startTutorial: (fromStep?: number) => void;
  nextTutorialStep: () => void;
  setTutorialStep: (step: number) => void;
  skipTutorial: () => void;
  completeTutorial: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  setPlanTier: (tier: TechnicianSession['planTier']) => void;
  updateTechnicianProfile: (patch: { name?: string; email?: string }) => void;
  toggleDarkMode: () => void;
  toggleFieldSunlightMode: () => void;
  toggleForcedOfflineMode: () => void;
  toggleLowDataMode: () => void;
  toggleDesktopWideMode: () => void;
  openCopilot: (parcelId?: string | null) => void;
  closeCopilot: () => void;
  addCopilotMessage: (msg: CopilotMessage) => void;
  clearCopilotMessages: () => void;
  setSyncDrawerOpen: (open: boolean) => void;
  setNotificationsOpen: (open: boolean) => void;
  setDemoGuideOpen: (open: boolean) => void;
  pushToast: (notice: Omit<ToastNotice, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const INITIAL_COPILOT_MESSAGES: CopilotMessage[] = [
  {
    id: 'msg-welcome-01',
    role: 'assistant',
    content:
      '¡Hola! Soy tu copiloto de campo. Pregúntame por qué una parcela tiene alerta, cuántos días faltan para cosechar sin riesgo o pídeme el resumen para acopio. En esta demo respondo con el motor local.',
    createdAt: '2026-11-13T07:16:00.000Z',
    provider: 'demo-fallback',
    model: 'ibm/granite-4-h-small',
    citedRules: ['R-PHI-04', 'R-H2O-01'],
    latencyMs: 120,
    totalTokens: 164,
    requestId: 'granite-init-01'
  }
];

export const useAppStore = create<AppUiState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      hasSeenSplash: false,
      hasCompletedOnboarding: false,
      tutorialActive: false,
      tutorialStep: 0,
      hasCompletedTutorial: false,
      themeMode: 'light',
      lowDataMode: false,
      desktopWideMode: false,
      technician: {
        ...DEFAULT_TECHNICIAN,
        email: 'danny@vozdecampo.mx',
        planTier: 'pro'
      },
      copilotOpen: false,
      copilotParcelId: 'parcel-4b',
      copilotMessages: INITIAL_COPILOT_MESSAGES,
      syncDrawerOpen: false,
      notificationsOpen: false,
      demoGuideOpen: false,
      toasts: [],
      login: (identity, launchTutorialIfNew = true) =>
        set((state) => {
          const shouldStartTour = launchTutorialIfNew && !state.hasCompletedTutorial;
          return {
            isAuthenticated: true,
            hasCompletedOnboarding: true,
            tutorialActive: shouldStartTour,
            tutorialStep: shouldStartTour ? 0 : state.tutorialStep,
            technician: {
              ...state.technician,
              name: identity.name,
              email: identity.email,
              cipCode: identity.cipCode,
              loggedInAt: new Date().toISOString()
            }
          };
        }),
      logout: () =>
        set({
          isAuthenticated: false,
          tutorialActive: false
        }),
      markSplashSeen: () => set({ hasSeenSplash: true }),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      startTutorial: (fromStep = 0) =>
        set({
          tutorialActive: true,
          tutorialStep: fromStep
        }),
      nextTutorialStep: () =>
        set((state) => {
          if (state.tutorialStep >= 6) {
            return {
              tutorialActive: false,
              tutorialStep: 0,
              hasCompletedTutorial: true
            };
          }
          return { tutorialStep: state.tutorialStep + 1 };
        }),
      setTutorialStep: (step) => set({ tutorialStep: step }),
      skipTutorial: () =>
        set({
          tutorialActive: false,
          hasCompletedTutorial: true
        }),
      completeTutorial: () =>
        set({
          tutorialActive: false,
          tutorialStep: 0,
          hasCompletedTutorial: true
        }),
      setThemeMode: (mode) => {
        applyThemeToDom(mode);
        set((state) => ({
          themeMode: mode,
          technician: {
            ...state.technician,
            fieldSunlightMode: mode === 'dark'
          }
        }));
      },
      setPlanTier: (planTier) =>
        set((state) => ({
          technician: { ...state.technician, planTier }
        })),
      updateTechnicianProfile: (patch) =>
        set((state) => ({
          technician: {
            ...state.technician,
            name: patch.name?.trim() || state.technician.name,
            email: patch.email?.trim() || state.technician.email
          }
        })),
      toggleDarkMode: () => {
        const current = get().themeMode;
        const next: ThemeMode = current === 'dark' ? 'light' : 'dark';
        applyThemeToDom(next);
        set((state) => ({
          themeMode: next,
          technician: {
            ...state.technician,
            fieldSunlightMode: next === 'dark'
          }
        }));
      },
      toggleFieldSunlightMode: () => {
        get().toggleDarkMode();
      },
      toggleForcedOfflineMode: () =>
        set((state) => ({
          technician: {
            ...state.technician,
            forcedOfflineMode: !state.technician.forcedOfflineMode
          }
        })),
      toggleLowDataMode: () => set((state) => ({ lowDataMode: !state.lowDataMode })),
      toggleDesktopWideMode: () =>
        set((state) => ({ desktopWideMode: !state.desktopWideMode })),
      openCopilot: (parcelId) =>
        set((state) => ({
          copilotOpen: true,
          copilotParcelId: parcelId !== undefined ? parcelId : state.copilotParcelId
        })),
      closeCopilot: () => set({ copilotOpen: false }),
      addCopilotMessage: (msg) =>
        set((state) => ({
          copilotMessages: [...state.copilotMessages.slice(-40), msg]
        })),
      clearCopilotMessages: () => set({ copilotMessages: INITIAL_COPILOT_MESSAGES }),
      setSyncDrawerOpen: (open) => set({ syncDrawerOpen: open }),
      setNotificationsOpen: (open) => set({ notificationsOpen: open }),
      setDemoGuideOpen: (open) => set({ demoGuideOpen: open }),
      pushToast: (notice) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        set((state) => ({
          toasts: [...state.toasts.slice(-2), { ...notice, id }]
        }));
        setTimeout(() => {
          get().dismissToast(id);
        }, 3600);
      },
      dismissToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id)
        }))
    }),
    {
      name: 'voz-de-campo-session-v2',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        tutorialActive: state.tutorialActive,
        tutorialStep: state.tutorialStep,
        hasCompletedTutorial: state.hasCompletedTutorial,
        themeMode: state.themeMode,
        lowDataMode: state.lowDataMode,
        desktopWideMode: state.desktopWideMode,
        technician: state.technician,
        copilotParcelId: state.copilotParcelId,
        copilotMessages: state.copilotMessages
      })
    }
  )
);
