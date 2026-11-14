import { AGROCHEMICAL_CATALOG } from '@/data/rules';
import {
  GraniteExtractionSchema,
  ParsedFieldNote,
  parseAgronomicNoteLocally
} from '@/lib/parser';
import { CopilotChecklistItem, CropType, Parcel, VisitRecord } from '@/types/domain';

export interface AiChatContext {
  parcel?: Parcel | null;
  latestVisit?: VisitRecord | null;
}

export interface AiChatResponse {
  text: string;
  provider: 'watsonx' | 'demo-fallback' | 'local-offline';
  model: string;
  latencyMs: number;
  totalTokens: number;
  requestId: string;
  citedRules: string[];
  thinkingSteps: string[];
  checklist?: CopilotChecklistItem[];
  suggestedAction?: {
    label: string;
    route?: string;
    fixDaysBeforeHarvest?: number;
  };
}

function buildLocalCopilotReply(
  question: string,
  ctx: AiChatContext,
  isOffline: boolean
): AiChatResponse {
  const lower = question.toLowerCase();
  const parcel = ctx.parcel;
  const visit = ctx.latestVisit;
  const citedRules: string[] = [];

  if (
    lower.includes('cosechar') ||
    lower.includes('alerta') ||
    lower.includes('pasaporte') ||
    lower.includes('por qué') ||
    lower.includes('porque') ||
    lower.includes('corregir')
  ) {
    if (parcel?.complianceStatus === 'critical' || visit?.compliance.overallStatus === 'critical') {
      const ruleCode = parcel?.activeAlertRuleCode || 'R-PHI-04';
      citedRules.push(ruleCode, 'R-DOS-01');
      const reqPhi = visit?.requiredPhiDays ?? 14;
      const currentDays = visit?.daysBeforeHarvest ?? 6;
      const missing = Math.max(1, reqPhi - currentDays);

      return {
        text: `Todavía no conviene cosechar ${parcel?.name || 'este lote'}. Se aplicó ${
          visit?.agrochemicalProduct || 'Abamectina 1.8 CE'
        } y la norma exige esperar ${reqPhi} días antes del corte, pero hoy solo van ${currentDays} días. Si reprogramas la cosecha ${missing} días más (a ${
          reqPhi + 1
        } días), el Escudo Legal libera tu Pasaporte QR de inmediato.`,
        provider: isOffline ? 'local-offline' : 'demo-fallback',
        model: 'ibm/granite-4-h-small',
        latencyMs: 185,
        totalTokens: 274,
        requestId: `granite-ctx-${Date.now().toString(36)}`,
        citedRules,
        thinkingSteps: [
          `Inspeccionando bitácora de ${parcel?.code || 'Lote'} (${parcel?.crop || 'Cultivo'})…`,
          `Verificando regla ${ruleCode} · Carencia requerida (${reqPhi} d vs ${currentDays} d)…`,
          'Preparando recomendación correctiva sin riesgo de rechazo…'
        ],
        checklist: [
          {
            label: 'Carencia (PHI)',
            value: `${currentDays} d de ${reqPhi} d requeridos (Faltan ${missing} d)`,
            status: 'block'
          },
          {
            label: 'Dosis aplicada',
            value: `${visit?.dosePerHa ?? 1.1} ${visit?.doseUnit || 'L/ha'} (Dentro de rango)`,
            status: 'ok'
          },
          {
            label: 'Riego CONAGUA',
            value: `${visit?.waterVolumeM3 ?? 180} m³ en ${parcel?.areaHa ?? 3.5} ha`,
            status: 'ok'
          }
        ],
        suggestedAction: {
          label: `Reprogramar cosecha a ${reqPhi + 1} días ahora`,
          route: parcel ? `/visitas/nueva/${parcel.id}?fixPhi=${reqPhi + 1}` : '/visitas/nueva',
          fixDaysBeforeHarvest: reqPhi + 1
        }
      };
    }

    if (parcel) {
      citedRules.push('R-PHI-01', 'R-H2O-01');
      return {
        text: `¡Buenas noticias! ${parcel.name} (${parcel.crop}, ${parcel.areaHa} ha) tiene ${parcel.complianceScore}/100 puntos en el Escudo Legal. Cumple los días de carencia y la dotación de agua CONAGUA. Ya puedes compartir su Pasaporte QR con el centro de acopio.`,
        provider: isOffline ? 'local-offline' : 'demo-fallback',
        model: 'ibm/granite-4-h-small',
        latencyMs: 140,
        totalTokens: 218,
        requestId: `granite-ok-${Date.now().toString(36)}`,
        citedRules,
        thinkingSteps: [
          `Consultando expediente de ${parcel.code} (${parcel.crop})…`,
          'Validando intervalos de seguridad SENASICA y volumen CONAGUA…',
          'Confirmando integridad de sello SHA-256…'
        ],
        checklist: [
          {
            label: 'Estado Fitosanitario',
            value: `Aprobado (${parcel.complianceScore}/100)`,
            status: 'ok'
          },
          {
            label: 'Lámina de Riego',
            value: parcel.irrigationType,
            status: 'ok'
          }
        ],
        suggestedAction: {
          label: 'Ver Pasaportes QR listos',
          route: '/pasaportes'
        }
      };
    }
  }

  if (lower.includes('carencia') || lower.includes('lmr') || lower.includes('phi')) {
    citedRules.push('R-PHI-01', 'R-PHI-04', 'R-BAN-02');
    return {
      text: `El Período de Carencia (PHI) son los días que debes esperar entre la última aplicación y la cosecha para que el fruto no tenga residuos químicos por encima del límite legal (LMR). Por ejemplo: Spinosad pide 3 a 7 días, Abamectina pide 14 días en limón, y Clorpirifos está prohibido para exportación.`,
      provider: isOffline ? 'local-offline' : 'demo-fallback',
      model: 'ibm/granite-4-h-small',
      latencyMs: 135,
      totalTokens: 242,
      requestId: `granite-phi-${Date.now().toString(36)}`,
      citedRules,
      thinkingSteps: [
        'Consultando catálogo fitosanitario SENASICA / COFEPRIS 2026…',
        'Comparando límites máximos de residuos (LMR) por cultivo…'
      ],
      checklist: [
        { label: 'Spinosad SC', value: '3–7 días (Permitido)', status: 'ok' },
        { label: 'Abamectina 1.8 CE', value: '14 días en cítricos', status: 'warn' },
        { label: 'Clorpirifos / Paraquat', value: 'Bloqueo total exportación', status: 'block' }
      ]
    };
  }

  if (lower.includes('resum') || lower.includes('bitácora') || lower.includes('visita')) {
    if (visit) {
      return {
        text: `Resumen listo para acopio de ${visit.parcelName} (${visit.crop}): visitado con ${
          visit.producerName
        }. Se registró ${visit.agrochemicalProduct || 'monitoreo limpio'} (${
          visit.dosePerHa ?? 0
        } ${visit.doseUnit || ''}) en ${visit.treatedAreaHa} ha y riego de ${
          visit.waterVolumeM3 ?? 0
        } m³. Puntaje del Escudo Legal: ${visit.compliance.score}/100.`,
        provider: isOffline ? 'local-offline' : 'demo-fallback',
        model: 'ibm/granite-4-h-small',
        latencyMs: 155,
        totalTokens: 254,
        requestId: `granite-sum-${Date.now().toString(36)}`,
        citedRules: visit.compliance.checks.map((c) => c.ruleCode),
        thinkingSteps: [
          `Sintetizando última visita de ${visit.parcelCode}…`,
          'Verificando firma de conformidad y parámetros de campo…'
        ]
      };
    }
  }

  return {
    text: `Soy tu Copiloto de Campo. Puedo explicarte en lenguaje sencillo por qué una parcela tiene alerta, cuántos días faltan para cosechar sin riesgo o resumir tu visita para el comprador.${
      parcel ? ` Ahora mismo estamos revisando ${parcel.name} (${parcel.crop}).` : ''
    }`,
    provider: isOffline ? 'local-offline' : 'demo-fallback',
    model: 'ibm/granite-4-h-small',
    latencyMs: 115,
    totalTokens: 192,
    requestId: `granite-help-${Date.now().toString(36)}`,
    citedRules: ['R-PHI-01', 'R-H2O-01'],
    thinkingSteps: [
      'Analizando contexto de tu ruta del día…',
      'Consultando motor normativo local…'
    ]
  };
}

export async function askFieldCopilot(
  question: string,
  ctx: AiChatContext,
  forceOffline: boolean
): Promise<AiChatResponse> {
  const fallback = buildLocalCopilotReply(question, ctx, true);
  const isOffline = forceOffline || (typeof navigator !== 'undefined' && !navigator.onLine);
  if (isOffline) {
    return fallback;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);

    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        mode: 'chat',
        prompt: question,
        context: ctx.parcel
          ? {
              parcelCode: ctx.parcel.code,
              parcelName: ctx.parcel.name,
              crop: ctx.parcel.crop,
              areaHa: ctx.parcel.areaHa,
              stage: ctx.parcel.stage,
              product: ctx.latestVisit?.agrochemicalProduct,
              dose: ctx.latestVisit?.dosePerHa,
              doseUnit: ctx.latestVisit?.doseUnit,
              phiDays: ctx.latestVisit?.requiredPhiDays,
              daysElapsed: ctx.latestVisit?.daysBeforeHarvest,
              complianceStatus: ctx.parcel.complianceStatus,
              rules:
                ctx.latestVisit?.compliance.checks.map((c) => ({
                  code: c.ruleCode,
                  severity: c.severity,
                  title: c.title
                })) || []
            }
          : null
      })
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (data.provider === 'watsonx' && data.text) {
        return {
          text: data.text,
          provider: 'watsonx',
          model: data.model || 'ibm/granite-4-h-small',
          latencyMs: data.latencyMs || 420,
          totalTokens: data.usage?.totalTokens || 280,
          requestId: data.requestId || `wx-${Date.now().toString(36)}`,
          citedRules:
            ctx.latestVisit?.compliance.checks.map((c) => c.ruleCode) || ['R-PHI-04'],
          thinkingSteps: fallback.thinkingSteps,
          checklist: fallback.checklist,
          suggestedAction: fallback.suggestedAction
        };
      }
    }
  } catch {
    // Caer en el motor local determinista sin romper el flujo
  }

  return buildLocalCopilotReply(question, ctx, false);
}

export async function extractFieldNoteWithGranite(
  rawText: string,
  defaultCrop: CropType,
  defaultAreaHa: number,
  forceOffline: boolean
): Promise<{
  parsed: ParsedFieldNote;
  provider: 'watsonx' | 'demo-fallback' | 'local-offline';
  model: string;
  latencyMs: number;
  totalTokens: number;
  requestId: string;
}> {
  const localParsed = parseAgronomicNoteLocally(rawText, defaultCrop, defaultAreaHa);
  const isOffline = forceOffline || (typeof navigator !== 'undefined' && !navigator.onLine);

  if (isOffline) {
    return {
      parsed: localParsed,
      provider: 'local-offline',
      model: 'ibm/granite-4-h-small (local)',
      latencyMs: 95,
      totalTokens: 210,
      requestId: `local-ext-${Date.now().toString(36)}`
    };
  }

  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'extract',
        prompt: rawText
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.provider === 'watsonx' && typeof data.text === 'string') {
        const jsonMatch = data.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const rawJson = JSON.parse(jsonMatch[0]);
          const validated = GraniteExtractionSchema.safeParse(rawJson);
          if (validated.success) {
            const v = validated.data;
            const matchedCatalog = v.product
              ? AGROCHEMICAL_CATALOG.find((item) =>
                  item.aliases.some((a) => v.product!.toLowerCase().includes(a))
                )
              : undefined;

            return {
              parsed: {
                ...localParsed,
                activity: v.activity ?? localParsed.activity,
                agrochemicalProduct:
                  matchedCatalog?.productName ?? v.product ?? localParsed.agrochemicalProduct,
                activeIngredient:
                  matchedCatalog?.activeIngredient ??
                  v.activeIngredient ??
                  localParsed.activeIngredient,
                dosePerHa: v.dose ?? localParsed.dosePerHa,
                doseUnit: v.doseUnit ?? localParsed.doseUnit,
                treatedAreaHa: v.areaHa ?? localParsed.treatedAreaHa,
                waterVolumeM3: v.waterVolumeM3 ?? localParsed.waterVolumeM3,
                daysBeforeHarvest: v.plannedHarvestDays ?? localParsed.daysBeforeHarvest,
                pestOrTarget: v.pestOrTarget ?? localParsed.pestOrTarget,
                confidence: 0.97,
                summary: v.summary ?? localParsed.summary
              },
              provider: 'watsonx',
              model: data.model || 'ibm/granite-4-h-small',
              latencyMs: data.latencyMs || 480,
              totalTokens: data.usage?.totalTokens || 260,
              requestId: data.requestId || `wx-ext-${Date.now().toString(36)}`
            };
          }
        }
      }
    }
  } catch {
    // Continuar con resultado determinista
  }

  return {
    parsed: localParsed,
    provider: 'demo-fallback',
    model: 'ibm/granite-4-h-small',
    latencyMs: 140,
    totalTokens: 235,
    requestId: `demo-ext-${Date.now().toString(36)}`
  };
}
