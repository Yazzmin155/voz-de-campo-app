import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Compass,
  Mic,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { db, useAppStore } from '@/lib/db';
import { triggerHaptic } from '@/lib/sensors';
import { ImageWithFallback } from '@/components/ui/ImageWithFallback';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { technician, openCopilot, startTutorial } = useAppStore();

  const parcels = useLiveQuery(() => db.parcels.orderBy('routeOrder').toArray(), []) ?? [];
  const passports =
    useLiveQuery(() => db.passports.orderBy('issuedAt').reverse().toArray(), []) ?? [];

  const readyCount = parcels.filter((p) => p.complianceStatus === 'pass').length;
  const totalCount = Math.max(1, parcels.length);
  const progressPct = Math.round((readyCount / totalCount) * 100);
  const criticalParcel = parcels.find((p) => p.complianceStatus === 'critical');

  const firstName = technician.name.replace(/^Ing\.\s*/i, '').split(' ')[0] || 'Danny';

  return (
    <div className="space-y-4">
      {/* Tarjeta Principal: Progreso de la Ruta de Hoy */}
      <section
        data-tour="route-progress"
        className="card-duo p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#58A700] dark:text-[#7BD62B]">
              Ruta de hoy · En campo
            </span>
            <h1 className="font-display font-extrabold text-2xl text-app-ink mt-0.5">
              ¡Hola, {firstName}!
            </h1>
            <p className="text-xs text-app-muted">
              Llevas <strong>{readyCount} de {parcels.length} parcelas</strong> listas para acopio
            </p>
          </div>

          <button
            type="button"
            onClick={() => startTutorial(0)}
            title="Ver tutorial paso a paso"
            className="px-3 py-1.5 rounded-full bg-app-surface-2 hover:bg-app-tint text-xs font-extrabold text-app-ink inline-flex items-center gap-1.5 shrink-0"
          >
            <Compass className="w-3.5 h-3.5 text-[#58A700]" />
            <span>Tutorial</span>
          </button>
        </div>

        {/* Barra de progreso suave */}
        <div className="space-y-1.5">
          <div className="h-3.5 w-full rounded-full bg-app-surface-2 overflow-hidden p-0.5 border border-app-hairline">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-[#58A700] to-[#7BD62B]"
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-bold text-app-muted">
            <span>{progressPct}% completado hoy</span>
            <span>{passports.length} Pasaportes QR listos</span>
          </div>
        </div>

        {/* Único CTA Primario de Pantalla */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic(14);
            navigate('/visitas/nueva');
          }}
          className="w-full py-3.5 px-4 btn-duo-primary text-sm inline-flex items-center justify-center gap-2"
        >
          <Mic className="w-5 h-5" />
          <span>Registrar visita con la voz</span>
        </button>
      </section>

      {/* Aviso Prioritario en lenguaje humano (si hay riesgo de carencia) */}
      {criticalParcel && (
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          aria-label="Aviso importante antes de cosechar"
          className="card-duo p-4 border-2 border-[#FFC800] space-y-3"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFC800]/25 text-[#D9A700] dark:text-[#FFD34D] flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <span className="text-[11px] font-extrabold uppercase text-[#D64545]">
                Atención en {criticalParcel.name} ({criticalParcel.crop})
              </span>
              <h2 className="font-display font-extrabold text-base text-app-ink leading-snug">
                Faltan 8 días de espera antes de poder cosechar sin residuos
              </h2>
              <p className="text-xs text-app-muted">
                Productor: {criticalParcel.producerName}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => navigate(`/visitas/nueva/${criticalParcel.id}?step=3&fixPhi=15`)}
              className="py-2.5 px-3 btn-duo-amber text-xs inline-flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Corregir fecha</span>
            </button>

            <button
              type="button"
              onClick={() => openCopilot(criticalParcel.id)}
              className="py-2.5 px-3 btn-duo-secondary text-xs inline-flex items-center justify-center gap-1.5"
            >
              <Bot className="w-3.5 h-3.5 text-[#0F62FE]" />
              <span>Explicar con IA</span>
            </button>
          </div>
        </motion.section>
      )}

      {/* Camino de Parcelas del Día (Nodos limpios estilo Duolingo/Finch) */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-display font-extrabold text-base text-app-ink">
            Tus parcelas de hoy ({parcels.length})
          </h2>
          <Link
            to="/parcelas"
            className="text-xs font-extrabold text-[#58A700] dark:text-[#7BD62B] hover:underline"
          >
            Buscar o filtrar →
          </Link>
        </div>

        <div className="space-y-3">
          {parcels.map((parcel, idx) => {
            const statusConfig = {
              critical: {
                pill: 'Riesgo de carencia',
                pillClass: 'bg-[#D64545]/15 text-[#D64545]',
                icon: ShieldAlert
              },
              warning: {
                pill: 'Por revisar riego',
                pillClass: 'bg-[#FFC800]/25 text-[#1B2A1F] dark:text-[#FFD34D]',
                icon: AlertTriangle
              },
              pass: {
                pill: 'Lista para acopio',
                pillClass: 'bg-[#58A700]/15 text-[#58A700] dark:text-[#7BD62B]',
                icon: CheckCircle2
              }
            }[parcel.complianceStatus];

            const StatusIcon = statusConfig.icon;

            return (
              <motion.div
                key={parcel.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="card-duo p-4 flex items-center justify-between gap-3"
              >
                <Link
                  to={`/parcelas/${parcel.id}`}
                  className="flex items-center gap-3.5 min-w-0 flex-1"
                >
                  <div className="relative shrink-0">
                    <ImageWithFallback
                      src={parcel.imageUrl}
                      alt={parcel.name}
                      fallbackLabel={parcel.crop}
                      className="w-15 h-15 rounded-2xl object-cover border-2 border-app-hairline"
                    />
                    <span className="absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full bg-app-surface border-2 border-app-hairline text-[11px] font-extrabold text-app-ink flex items-center justify-center">
                      {idx + 1}
                    </span>
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 ${statusConfig.pillClass}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        <span>{statusConfig.pill}</span>
                      </span>
                    </div>

                    <h3 className="font-display font-extrabold text-base text-app-ink truncate">
                      {parcel.name}
                    </h3>

                    <p className="text-xs text-app-muted truncate">
                      {parcel.crop} · {parcel.areaHa} ha · {parcel.producerName.split(' ')[0]}
                    </p>
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(12);
                    navigate(`/visitas/nueva/${parcel.id}`);
                  }}
                  aria-label={`Registrar visita en ${parcel.name}`}
                  className="px-3.5 py-2.5 btn-duo-secondary text-xs shrink-0 inline-flex items-center gap-1.5"
                >
                  <Mic className="w-4 h-4 text-[#58A700]" />
                  <span>Visitar</span>
                </button>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Tarjeta de Acceso Rápido a Impacto IBM y Pasaportes QR */}
      <section className="grid grid-cols-2 gap-3 pt-1">
        <Link
          to="/pasaportes"
          className="card-duo p-4 hover:bg-app-surface-2 transition-colors space-y-1.5"
        >
          <div className="w-9 h-9 rounded-2xl bg-[#58A700]/15 text-[#58A700] flex items-center justify-center">
            <QrCode className="w-5 h-5" />
          </div>
          <div className="font-display font-extrabold text-sm text-app-ink">
            Pasaportes QR
          </div>
          <p className="text-[11px] text-app-muted">
            {passports.length} certificados listos para escaneo
          </p>
        </Link>

        <Link
          to="/verificar"
          className="card-duo p-4 hover:bg-app-surface-2 transition-colors space-y-1.5"
        >
          <div className="w-9 h-9 rounded-2xl bg-[#58A700]/15 text-[#58A700] flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="font-display font-extrabold text-sm text-app-ink flex items-center gap-1">
            <span>Verificar pasaporte</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#58A700]" />
          </div>
          <p className="text-[11px] text-app-muted">
            Revisa el sello SHA-256 de un lote recibido
          </p>
        </Link>
      </section>
    </div>
  );
};
