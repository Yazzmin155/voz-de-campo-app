import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  Copy,
  Cpu,
  Database,
  Lock,
  Mic,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { db, ensureSeedData, useAppStore } from '@/lib/db';
import { triggerHaptic } from '@/lib/sensors';
import { formatDateTime } from '@/lib/utils';

const PIPELINE_STEPS = [
  {
    step: '01',
    title: 'Captura en Surco (Sin Señal)',
    desc: 'Voz, foto sellada con GPS y firma del productor en IndexedDB.',
    icon: Mic,
    color: '#58A700'
  },
  {
    step: '02',
    title: 'Filtro Edge Zero-PII',
    desc: 'Elimina teléfonos, firmas y datos personales antes de salir del teléfono.',
    icon: Lock,
    color: '#FFC800'
  },
  {
    step: '03',
    title: 'IBM watsonx.ai (Granite 4)',
    desc: 'Extrae JSON agronómico y explica reglas citando la norma oficial.',
    icon: Bot,
    color: '#0F62FE'
  },
  {
    step: '04',
    title: 'Escudo Determinista + SHA-256',
    desc: 'La IA nunca inventa permisos: el motor de reglas decide y sella el QR.',
    icon: ShieldCheck,
    color: '#58A700'
  },
  {
    step: '05',
    title: 'Ingesta en IBM watsonx.data',
    desc: 'Sincronización atómica de paquetes auditables hacia el lakehouse.',
    icon: Database,
    color: '#0F62FE'
  }
];

const SAMPLE_LAKEHOUSE_CONTRACT = {
  schema_version: '2.6.0',
  target_table: 'watsonx_data.bronze_agro_field_events_v2',
  governance_profile: 'zero_pii_edge_filtered',
  parcel_code: 'LOTE-4B',
  crop: 'Limón Persa',
  extracted_by: 'ibm/granite-4-h-small',
  active_ingredient: 'Abamectina',
  dose_per_ha: 1.1,
  dose_unit: 'L/ha',
  days_before_harvest: 15,
  required_phi_days: 14,
  deterministic_verdict: 'pass',
  sha256_passport_seal: '9f4d8c21e0a347b8c1d507e6b29a4f83d1c074a2b86e51c92a4e8f10d3b67c12'
};

export const IbmImpactPage: React.FC = () => {
  const navigate = useNavigate();
  const { startTutorial, pushToast } = useAppStore();

  const [checkingHealth, setCheckingHealth] = useState(false);
  const [healthData, setHealthData] = useState<{
    checked: boolean;
    configured: boolean;
    sttConfigured?: boolean;
    provider: string;
    modelId: string;
    region: string;
  } | null>(null);
  const [showContract, setShowContract] = useState(false);
  const [showZeroPii, setShowZeroPii] = useState(true);

  const aiEvents =
    useLiveQuery(() => db.aiTelemetry.orderBy('createdAt').reverse().limit(6).toArray(), []) ??
    [];
  const totalTokensUsed = aiEvents.reduce((acc, ev) => acc + ev.totalTokens, 0);

  const handleTestConnector = async () => {
    setCheckingHealth(true);
    triggerHaptic(14);
    try {
      const res = await fetch('/api/ai/health');
      if (res.ok) {
        const data = await res.json();
        setHealthData({
          checked: true,
          configured: Boolean(data.configured),
          sttConfigured: Boolean(data.sttConfigured),
          provider: data.provider || 'local-demo-engine',
          modelId: data.modelId || 'ibm/granite-4-h-small',
          region: data.region || 'us-south'
        });
        pushToast({
          title: data.configured
            ? '¡Conectado en vivo con IBM watsonx.ai!'
            : 'Conector verificado · Modo Demo Determinista activo',
          description: `Modelo: ${data.modelId || 'ibm/granite-4-h-small'} (${data.region || 'us-south'})`,
          tone: 'success'
        });
      }
    } catch {
      setHealthData({
        checked: true,
        configured: false,
        provider: 'local-demo-engine',
        modelId: 'ibm/granite-4-h-small',
        region: 'us-south'
      });
      pushToast({
        title: 'Motor Local Determinista Verificado',
        description: 'Funciona sin llaves externas ni conexión.',
        tone: 'info'
      });
    } finally {
      setCheckingHealth(false);
    }
  };

  const handleLaunchJuryDemo = async () => {
    triggerHaptic([14, 28, 16]);
    await ensureSeedData(true);
    startTutorial(0);
    navigate('/inicio');
    pushToast({
      title: '¡Demo de 2 minutos iniciada!',
      description: 'Datos restaurados y recorrido interactivo activado.',
      tone: 'success'
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/ajustes')}
          className="inline-flex items-center gap-1.5 text-xs font-extrabold text-app-muted hover:text-app-ink"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al perfil</span>
        </button>

        <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-[#0F62FE]/12 text-[#0F62FE]">
          Modo evaluación
        </span>
      </div>

      {/* Hero de Propuesta de Valor para IBM */}
      <section className="card-duo p-5 space-y-3 border-2 border-[#0F62FE]/40">
        <div className="flex items-center gap-2.5">
          <div className="w-11 h-11 rounded-2xl bg-[#0F62FE]/15 text-[#0F62FE] flex items-center justify-center shrink-0">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-extrabold uppercase text-[#0F62FE]">
              Preparado para integrarse con IBM watsonx
            </span>
            <h1 className="font-display font-extrabold text-xl text-app-ink leading-tight">
              Del surco sin señal a la nube
            </h1>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-app-muted leading-relaxed">
          <strong>IBM watsonx</strong> es extraordinario analizando y gobernando datos empresariales,
          pero en la agricultura el dato nace a kilómetros de la antena más cercana.{' '}
          <strong>Voz de Campo</strong> captura esa última milla, filtra datos personales y entrega
          registros limpios y sellados con SHA-256.
        </p>

        <button
          type="button"
          onClick={handleLaunchJuryDemo}
          className="w-full py-3.5 px-4 btn-duo-primary text-xs sm:text-sm inline-flex items-center justify-center gap-2"
        >
          <Compass className="w-4 h-4" />
          <span>Iniciar Recorrido Guiado de 2 Minutos (Demo Jurado)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </section>

      {/* Pipeline Animado de 5 Nodos */}
      <section className="card-duo p-5 space-y-3">
        <h2 className="font-display font-extrabold text-base text-app-ink">
          Flujo de Gobernanza en 5 Pasos
        </h2>

        <div className="space-y-2.5">
          {PIPELINE_STEPS.map((node, idx) => {
            const NodeIcon = node.icon;
            return (
              <motion.div
                key={node.step}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.06 }}
                className="p-3 rounded-2xl bg-app-surface-2 border border-app-hairline flex items-start gap-3"
              >
                <div
                  style={{ backgroundColor: `${node.color}20`, color: node.color }}
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-extrabold text-xs"
                >
                  <NodeIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-app-ink">
                    {node.step} · {node.title}
                  </div>
                  <p className="text-[11px] text-app-muted mt-0.5">{node.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Conector en Vivo y Telemetría */}
      <section
        data-tour="ibm-connector"
        className="card-duo p-5 space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-display font-extrabold text-base text-app-ink">
              Estado del Conector IBM Granite
            </h2>
            <p className="text-xs text-app-muted">
              Proxy serverless seguro (`/api/ai/chat`, `/api/ai/stt`, `/api/ai/health`)
            </p>
          </div>

          <button
            type="button"
            disabled={checkingHealth}
            onClick={handleTestConnector}
            className="px-3.5 py-2 rounded-xl bg-[#0F62FE] text-white text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>{checkingHealth ? 'Probando…' : 'Probar conexión'}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <div className="p-3 rounded-2xl bg-app-surface-2 border border-app-hairline">
            <span className="text-[10px] uppercase font-bold text-app-muted block">
              Modelo Configurado
            </span>
            <strong className="font-mono-tech text-xs text-[#0F62FE] block mt-0.5">
              {healthData?.modelId || 'ibm/granite-4-h-small'}
            </strong>
            <span className="text-[11px] text-app-muted">
              Región: {healthData?.region || 'us-south'}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-app-surface-2 border border-app-hairline">
            <span className="text-[10px] uppercase font-bold text-app-muted block">
              Presupuesto Plan Lite
            </span>
            <strong className="font-mono-tech text-xs text-app-ink block mt-0.5">
              {totalTokensUsed.toLocaleString('es-MX')} / 300k tok
            </strong>
            <span className="text-[11px] text-[#58A700] dark:text-[#7BD62B] font-bold">
              {healthData?.configured ? 'Modo Live API' : 'Modo Demo Determinista'}
            </span>
          </div>
        </div>

        {/* Gobernanza Zero-PII */}
        <div className="rounded-2xl border border-app-hairline overflow-hidden">
          <button
            type="button"
            onClick={() => setShowZeroPii((v) => !v)}
            className="w-full px-4 py-2.5 bg-app-surface-2 flex items-center justify-between text-xs font-extrabold text-app-ink"
          >
            <span>Filtro de Privacidad Zero-PII (Gobernanza)</span>
            {showZeroPii ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showZeroPii && (
            <div className="p-3.5 bg-app-surface text-xs space-y-1.5">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#58A700] shrink-0 mt-0.5" />
                <span>
                  <strong>Sí viaja a watsonx:</strong> código de lote, cultivo, ingrediente activo,
                  dosis/ha, días a cosecha y códigos de regla SENASICA/CONAGUA.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-[#D64545] shrink-0 mt-0.5" />
                <span>
                  <strong>Nunca sale del teléfono:</strong> teléfono del productor, firma autógrafa
                  en bruto ni credenciales del técnico.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Contrato JSON de Ingesta */}
        <div className="rounded-2xl border border-app-hairline overflow-hidden">
          <button
            type="button"
            onClick={() => setShowContract((v) => !v)}
            className="w-full px-4 py-2.5 bg-app-surface-2 flex items-center justify-between text-xs font-extrabold text-app-ink"
          >
            <span>Ver contrato JSON para IBM watsonx.data</span>
            {showContract ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showContract && (
            <div className="p-3.5 bg-[#10160F] text-white space-y-2">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(
                      JSON.stringify(SAMPLE_LAKEHOUSE_CONTRACT, null, 2)
                    );
                    pushToast({ title: 'Contrato JSON copiado', tone: 'success' });
                  }}
                  className="text-[11px] font-bold text-[#FFC800] inline-flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copiar JSON</span>
                </button>
              </div>
              <pre className="font-mono-tech text-[10px] text-[#D7EFC2] overflow-x-auto">
                {JSON.stringify(SAMPLE_LAKEHOUSE_CONTRACT, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Últimas llamadas registradas */}
        <div className="space-y-2">
          <span className="text-[11px] font-extrabold uppercase text-app-muted block">
            Bitácora de llamadas recientes ({aiEvents.length})
          </span>
          {aiEvents.slice(0, 3).map((ev) => (
            <div
              key={ev.id}
              className="p-2.5 rounded-xl bg-app-surface-2 border border-app-hairline text-[11px] flex items-center justify-between gap-2"
            >
              <div className="truncate">
                <strong className="text-[#0F62FE] font-mono-tech">[{ev.mode}]</strong>{' '}
                <span className="text-app-ink font-semibold">{ev.promptPreview}</span>
              </div>
              <span className="font-mono-tech text-[10px] text-app-muted shrink-0">
                {ev.latencyMs}ms · {formatDateTime(ev.createdAt)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Modelo de Negocio y Monetización Accesible (Estimación Comercial) */}
      <section className="card-duo p-5 space-y-3">
        <div>
          <span className="text-[11px] font-extrabold uppercase text-[#58A700] dark:text-[#7BD62B]">
            Sostenibilidad y Escala (Estimación de Proyecto)
          </span>
          <h2 className="font-display font-extrabold text-base text-app-ink">
            Modelo Freemium B2B2C sin publicidad molesta
          </h2>
          <p className="text-xs text-app-muted">
            Accesible para el técnico independiente y rentable mediante cooperativas y agroindustrias
          </p>
        </div>

        <div className="space-y-2.5 text-xs">
          <div className="p-3.5 rounded-2xl bg-app-surface-2 border border-app-hairline flex items-center justify-between">
            <div>
              <div className="font-extrabold text-app-ink">1. Plan Semilla (Técnico Inicial)</div>
              <div className="text-app-muted">Hasta 3 parcelas · Voz offline y verificación QR</div>
            </div>
            <span className="font-display font-extrabold text-sm text-[#58A700] shrink-0">
              $0 MXN
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-app-tint border-2 border-[#58A700] flex items-center justify-between">
            <div>
              <div className="font-extrabold text-app-ink flex items-center gap-1">
                <span>2. Plan Ingeniero Pro</span>
                <Sparkles className="w-3.5 h-3.5 text-[#58A700]" />
              </div>
              <div className="text-app-muted">
                Parcelas ilimitadas + Copiloto Granite + Pasaportes QR
              </div>
            </div>
            <span className="font-display font-extrabold text-sm text-[#58A700] shrink-0">
              $199 / mes
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-app-surface-2 border border-app-hairline flex items-center justify-between">
            <div>
              <div className="font-extrabold text-app-ink">
                3. Plan Cooperativa / Agroexportadora (B2B)
              </div>
              <div className="text-app-muted">
                Hasta 25 técnicos + Conector IBM watsonx.data + Auditoría
              </div>
            </div>
            <span className="font-display font-extrabold text-sm text-app-ink shrink-0">
              $4,500 / mes
            </span>
          </div>
        </div>

        <p className="text-[11px] text-app-muted italic">
          Nota de transparencia: Prototipo funcional preparado para integrarse con IBM watsonx. Los
          precios y proyecciones corresponden al modelo de negocio propuesto.
        </p>
      </section>
    </div>
  );
};
