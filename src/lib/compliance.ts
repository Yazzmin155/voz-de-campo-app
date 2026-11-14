import { AGROCHEMICAL_CATALOG, WATER_CONCESSION_LIMITS_M3_PER_HA } from '@/data/rules';
import {
  ActivityType,
  ComplianceCheckItem,
  ComplianceReport,
  ComplianceSeverity,
  CropType
} from '@/types/domain';

export interface ComplianceEvaluationInput {
  crop: CropType;
  activity: ActivityType;
  agrochemicalProduct: string | null;
  dosePerHa: number | null;
  doseUnit: string | null;
  treatedAreaHa: number;
  waterVolumeM3: number | null;
  daysBeforeHarvest: number;
  producerConfirmed: boolean;
}

export function evaluateAgronomicCompliance(input: ComplianceEvaluationInput): ComplianceReport {
  const checks: ComplianceCheckItem[] = [];
  let score = 100;

  const productQuery = (input.agrochemicalProduct || '').trim().toLowerCase();
  const matchedSpec = productQuery
    ? AGROCHEMICAL_CATALOG.find(
        (spec) =>
          spec.productName.toLowerCase() === productQuery ||
          spec.activeIngredient.toLowerCase() === productQuery ||
          spec.aliases.some((a) => productQuery.includes(a.toLowerCase()))
      )
    : undefined;

  // 1. Evaluación fitosanitaria (SENASICA / COFEPRIS)
  if (matchedSpec) {
    if (matchedSpec.status === 'banned') {
      score -= 70;
      checks.push({
        ruleCode: matchedSpec.ruleCode,
        title: `Molécula prohibida detectada: ${matchedSpec.activeIngredient}`,
        authority: matchedSpec.authority,
        severity: 'critical',
        message: `${matchedSpec.productName} tiene tolerancia cero de exportación y prohibición sanitaria vigente.`,
        recommendation:
          'Suspender cosecha del lote, aislar producción y notificar al comité técnico de inocuidad.',
        referenceDoc: matchedSpec.referenceDoc,
        updatedAt: matchedSpec.updatedAt
      });
    } else {
      // Verificar autorización por cultivo
      if (!matchedSpec.allowedCrops.includes(input.crop)) {
        score -= 40;
        checks.push({
          ruleCode: 'R-CRP-03',
          title: 'Producto sin registro para este cultivo',
          authority: 'SENASICA',
          severity: 'critical',
          message: `${matchedSpec.productName} no cuenta con autorización en catálogo para ${input.crop}.`,
          recommendation: 'Verificar etiqueta RSCO o reclasificar el lote antes de envío a acopio.',
          referenceDoc: matchedSpec.referenceDoc,
          updatedAt: matchedSpec.updatedAt
        });
      }

      // Verificar período de carencia (PHI)
      const requiredPhi =
        matchedSpec.phiDaysByCrop[input.crop] ?? matchedSpec.defaultPhiDays;

      if (input.daysBeforeHarvest < requiredPhi) {
        score -= 48;
        const missingDays = requiredPhi - input.daysBeforeHarvest;
        checks.push({
          ruleCode: matchedSpec.ruleCode,
          title: 'Incumplimiento de Período de Carencia (PHI)',
          authority: 'SENASICA',
          severity: 'critical',
          message: `${matchedSpec.productName} exige ${requiredPhi} días de carencia en ${input.crop}, pero la cosecha está programada en ${input.daysBeforeHarvest} días.`,
          recommendation: `Posponer la fecha de cosecha al menos ${missingDays} días adicionales (mínimo ${requiredPhi} días desde aplicación).`,
          referenceDoc: matchedSpec.referenceDoc,
          updatedAt: matchedSpec.updatedAt
        });
      } else {
        checks.push({
          ruleCode: matchedSpec.ruleCode,
          title: 'Período de carencia (PHI) cumplido',
          authority: 'SENASICA',
          severity: 'pass',
          message: `Cosecha en ${input.daysBeforeHarvest} días respeta el intervalo mínimo de ${requiredPhi} días para ${matchedSpec.activeIngredient}.`,
          recommendation: 'Apto para continuar con emisión de Pasaporte QR.',
          referenceDoc: matchedSpec.referenceDoc,
          updatedAt: matchedSpec.updatedAt
        });
      }

      // Verificar dosis máxima por hectárea
      if (input.dosePerHa !== null) {
        if (input.dosePerHa > matchedSpec.maxDosePerHa) {
          score -= 28;
          checks.push({
            ruleCode: 'R-DOS-02',
            title: 'Sobredosificación respecto a etiqueta oficial',
            authority: 'COFEPRIS',
            severity: 'warning',
            message: `Dosis registrada de ${input.dosePerHa} ${matchedSpec.doseUnit} excede el tope de ${matchedSpec.maxDosePerHa} ${matchedSpec.doseUnit}.`,
            recommendation:
              'Ampliar el intervalo de seguridad en 5 días o realizar análisis rápido de LMR antes de cosechar.',
            referenceDoc: matchedSpec.referenceDoc,
            updatedAt: matchedSpec.updatedAt
          });
        } else {
          checks.push({
            ruleCode: 'R-DOS-01',
            title: 'Dosis dentro de parámetro técnico',
            authority: 'COFEPRIS',
            severity: 'pass',
            message: `Dosis de ${input.dosePerHa} ${matchedSpec.doseUnit} dentro del límite máximo (${matchedSpec.maxDosePerHa} ${matchedSpec.doseUnit}).`,
            recommendation: 'Conservar registro de calibración.',
            referenceDoc: matchedSpec.referenceDoc,
            updatedAt: matchedSpec.updatedAt
          });
        }
      }

      if (matchedSpec.status === 'restricted') {
        score -= 12;
        checks.push({
          ruleCode: matchedSpec.ruleCode,
          title: 'Molécula sujeta a transición agroecológica',
          authority: 'COFEPRIS',
          severity: 'warning',
          message: `${matchedSpec.activeIngredient} requiere justificación técnica de extensión y manejo de deriva.`,
          recommendation: 'Documentar justificación en observaciones del lote.',
          referenceDoc: matchedSpec.referenceDoc,
          updatedAt: matchedSpec.updatedAt
        });
      }
    }
  } else if (input.activity === 'aplicacion_fitosanitaria' && productQuery) {
    score -= 20;
    checks.push({
      ruleCode: 'R-CAT-00',
      title: 'Insumo no homologado en catálogo rápido',
      authority: 'SENASICA',
      severity: 'warning',
      message: `El insumo "${input.agrochemicalProduct}" no figura en el catálogo local precargado.`,
      recommendation: 'Seleccionar una molécula verificada del catálogo oficial para validar LMR.',
      referenceDoc: 'Catálogo Demo Fitosanitario SENASICA-COFEPRIS · LMR 2026',
      updatedAt: '2026-10-01'
    });
  } else {
    checks.push({
      ruleCode: 'R-FIT-00',
      title: 'Sin aplicación química de riesgo',
      authority: 'SENASICA',
      severity: 'pass',
      message: 'Actividad registrada sin moléculas residuales restringidas.',
      recommendation: 'Sin restricciones fitosanitarias activas.',
      referenceDoc: 'Manual de Buenas Prácticas Agrícolas SRRC-SENASICA (Demo)',
      updatedAt: '2026-09-02'
    });
  }

  // 2. Evaluación hídrica (CONAGUA)
  const maxWaterPerHa = WATER_CONCESSION_LIMITS_M3_PER_HA[input.crop] ?? 85;
  if (input.waterVolumeM3 !== null && input.treatedAreaHa > 0) {
    const m3PerHa = Number((input.waterVolumeM3 / input.treatedAreaHa).toFixed(1));
    if (m3PerHa > maxWaterPerHa) {
      score -= 18;
      checks.push({
        ruleCode: 'R-H2O-02',
        title: 'Exceso sobre lámina de concesión semanal',
        authority: 'CONAGUA',
        severity: 'warning',
        message: `Volumen de ${m3PerHa} m³/ha supera la referencia técnica de ${maxWaterPerHa} m³/ha para ${input.crop}.`,
        recommendation: 'Revisar presión de cintilla/goteros y anexar lectura de medidor.',
        referenceDoc: 'Anexo Técnico Distrito de Riego 010 · CONAGUA (Demo)',
        updatedAt: '2026-09-10'
      });
    } else {
      checks.push({
        ruleCode: 'R-H2O-01',
        title: 'Uso volumétrico dentro de concesión',
        authority: 'CONAGUA',
        severity: 'pass',
        message: `${m3PerHa} m³/ha cumple con la dotación máxima de ${maxWaterPerHa} m³/ha.`,
        recommendation: 'Trazabilidad hídrica en orden.',
        referenceDoc: 'Anexo Técnico Distrito de Riego 010 · CONAGUA (Demo)',
        updatedAt: '2026-09-10'
      });
    }
  }

  // 3. Conformidad de productor en terreno
  if (!input.producerConfirmed) {
    score -= 10;
    checks.push({
      ruleCode: 'R-AUD-01',
      title: 'Pendiente confirmación del productor en parcela',
      authority: 'CODEX-EXPORT',
      severity: 'warning',
      message: 'La bitácora requiere validación de conformidad del productor responsable.',
      recommendation: 'Marcar casilla de conformidad del productor antes de sellar el pasaporte.',
      referenceDoc: 'Protocolo de Auditoría de Última Milla SAC · watsonx Governance (Demo)',
      updatedAt: '2026-10-05'
    });
  }

  const boundedScore = Math.max(12, Math.min(100, score));
  const hasCritical = checks.some((c) => c.severity === 'critical');
  const hasWarning = checks.some((c) => c.severity === 'warning');

  const overallStatus: ComplianceSeverity = hasCritical
    ? 'critical'
    : hasWarning
      ? 'warning'
      : 'pass';

  return {
    overallStatus,
    score: boundedScore,
    canIssuePassport: !hasCritical && input.producerConfirmed,
    evaluatedAt: new Date().toISOString(),
    checks
  };
}
