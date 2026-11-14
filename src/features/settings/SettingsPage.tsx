import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Building2,
  ChevronRight,
  ClipboardList,
  Compass,
  Download,
  FlaskConical,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Moon,
  Pencil,
  QrCode,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Sprout,
  Sun,
  Trash2,
  Wifi,
  WifiOff,
  X
} from 'lucide-react';
import { db, ensureSeedData, useAppStore } from '@/lib/db';
import { clearStoredAccount, isValidEmail, updateStoredAccountProfile } from '@/lib/auth';
import { useNetworkStatus } from '@/lib/network';
import { triggerHaptic } from '@/lib/sensors';
import { ImageWithFallback } from '@/components/ui/ImageWithFallback';
import { ThemeMode } from '@/types/domain';

type ConfirmAction = 'logout' | 'delete' | null;

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    technician,
    themeMode,
    setThemeMode,
    setPlanTier,
    toggleForcedOfflineMode,
    startTutorial,
    updateTechnicianProfile,
    logout,
    pushToast
  } = useAppStore();

  const network = useNetworkStatus();
  const isReallyOffline = !network.browserOnline;

  const parcelCount = useLiveQuery(() => db.parcels.count(), []) ?? 0;
  const visitCount = useLiveQuery(() => db.visits.count(), []) ?? 0;
  const passportCount = useLiveQuery(() => db.passports.count(), []) ?? 0;

  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(technician.name);
  const [emailDraft, setEmailDraft] = useState(technician.email || '');
  const [formError, setFormError] = useState('');
  const [showPrivacyArco, setShowPrivacyArco] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [working, setWorking] = useState(false);

  const startEditing = () => {
    setNameDraft(technician.name);
    setEmailDraft(technician.email || '');
    setFormError('');
    setEditing(true);
  };

  const saveProfile = () => {
    const cleanName = nameDraft.trim();
    const cleanEmail = emailDraft.trim().toLowerCase();

    if (cleanName.length < 3) {
      setFormError('Escribe tu nombre completo, como quieres que aparezca en los pasaportes.');
      return;
    }
    if (!isValidEmail(cleanEmail)) {
      setFormError('Ese correo no parece válido. Revísalo antes de guardar.');
      return;
    }

    updateTechnicianProfile({ name: cleanName, email: cleanEmail });
    updateStoredAccountProfile({
      name: cleanName,
      email: cleanEmail,
      cipCode: technician.cipCode
    });
    setEditing(false);
    triggerHaptic([10, 18, 10]);
    pushToast({
      title: 'Perfil actualizado',
      description: 'Los próximos documentos usarán estos datos.',
      tone: 'success'
    });
  };

  const handleExportMyDataJson = async () => {
    triggerHaptic(14);
    const [parcels, visits, passports] = await Promise.all([
      db.parcels.toArray(),
      db.visits.toArray(),
      db.passports.toArray()
    ]);

    const bundle = {
      exportedAt: new Date().toISOString(),
      technician,
      parcels,
      visits,
      passports
    };

    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voz-de-campo-arco-${technician.cipCode.toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    pushToast({
      title: 'Copia de tus datos lista',
      description: 'Se descargó un archivo JSON con todo lo guardado en este teléfono.',
      tone: 'success'
    });
  };

  const handleResetDemoData = async () => {
    triggerHaptic(16);
    await ensureSeedData(true);
    pushToast({
      title: 'Datos de ejemplo restaurados',
      description: 'Las parcelas, visitas y pasaportes volvieron a su estado inicial.',
      tone: 'success'
    });
  };

  const runConfirmedAction = async () => {
    if (!confirmAction) return;
    setWorking(true);
    triggerHaptic([16, 30]);

    if (confirmAction === 'logout') {
      logout();
      setWorking(false);
      navigate('/entrar');
      return;
    }

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
    clearStoredAccount();
    logout();
    setWorking(false);
    setConfirmAction(null);
    navigate('/entrar');
    pushToast({
      title: 'Tus datos se borraron de este teléfono',
      description: 'La cuenta local también quedó eliminada.',
      tone: 'info'
    });
  };

  return (
    <div className="space-y-4">
      {/* Identidad del técnico */}
      <section className="card-duo p-5 space-y-4">
        <div className="flex items-start gap-3.5">
          <ImageWithFallback
            src="/media/avatar-productor.webp"
            alt={technician.name}
            fallbackType="avatar"
            fallbackLabel={technician.name}
            className="w-16 h-16 rounded-2xl object-cover border-2 border-[var(--brand)] shrink-0"
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h1 className="font-display font-extrabold text-lg text-app-ink leading-tight truncate">
                  {technician.name}
                </h1>
                <p className="text-[11px] text-app-muted leading-snug mt-0.5">
                  {technician.role}
                </p>
              </div>
              {!editing && (
                <button
                  type="button"
                  onClick={startEditing}
                  aria-label="Editar perfil"
                  className="w-8 h-8 rounded-full bg-app-surface-2 flex items-center justify-center text-app-muted shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full bg-[var(--brand)]/12 text-[var(--brand)] dark:text-[var(--brand-bright)] text-[10px] font-extrabold">
              <BadgeCheck className="w-3 h-3" />
              Cédula {technician.cipCode}
            </span>
          </div>
        </div>

        {editing ? (
          <div className="space-y-2.5 pt-2 border-t border-app-hairline">
            <label className="block space-y-1">
              <span className="text-[11px] font-bold text-app-muted">Nombre completo</span>
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => {
                  setNameDraft(e.target.value);
                  setFormError('');
                }}
                className="field-input"
                autoComplete="name"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-bold text-app-muted">Correo</span>
              <input
                type="email"
                value={emailDraft}
                onChange={(e) => {
                  setEmailDraft(e.target.value);
                  setFormError('');
                }}
                className="field-input"
                inputMode="email"
                autoComplete="email"
              />
            </label>
            {formError && (
              <p role="alert" className="text-[11px] font-semibold text-[var(--danger)]">
                {formError}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="py-2.5 btn-duo-secondary text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveProfile}
                className="py-2.5 btn-duo-primary text-xs"
              >
                Guardar cambios
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 pt-1">
            {[
              { label: 'Parcelas', value: parcelCount, icon: Sprout },
              { label: 'Visitas', value: visitCount, icon: ClipboardList },
              { label: 'Pasaportes', value: passportCount, icon: QrCode }
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="p-2.5 rounded-xl bg-app-surface-2 border border-app-hairline text-center"
                >
                  <Icon className="w-4 h-4 text-[var(--brand)] mx-auto mb-1" />
                  <div className="font-display font-extrabold text-base text-app-ink leading-none">
                    {stat.value}
                  </div>
                  <div className="text-[10px] font-bold text-app-muted mt-0.5">
                    {stat.label}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-1.5 pt-2 border-t border-app-hairline text-[11px]">
          <div className="flex items-center gap-2 text-app-muted">
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {technician.organizationName || 'Cooperativa AgroExport del Pacífico'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-app-muted">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{technician.region}</span>
          </div>
          <div className="flex items-center gap-2 text-app-muted">
            <Mail className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{technician.email || 'Sin correo registrado'}</span>
          </div>
        </div>
      </section>

      {/* Apariencia */}
      <section className="card-duo p-4 space-y-2.5">
        <span className="text-xs font-extrabold text-app-ink">Cómo se ve la app</span>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: 'light', label: 'Claro', icon: Sun },
              { id: 'dark', label: 'Oscuro', icon: Moon },
              { id: 'system', label: 'Automático', icon: Sparkles }
            ] as { id: ThemeMode; label: string; icon: any }[]
          ).map((opt) => {
            const Icon = opt.icon;
            const active = themeMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  setThemeMode(opt.id);
                }}
                aria-pressed={active}
                className={`py-2.5 px-2 rounded-xl text-[11px] font-extrabold inline-flex items-center justify-center gap-1.5 border-2 transition-all ${
                  active
                    ? 'bg-[var(--brand)] text-white border-[var(--brand-dark)]'
                    : 'bg-app-surface-2 text-app-ink border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Accesos de la app */}
      <section className="card-duo divide-y divide-app-hairline overflow-hidden">
        <button
          type="button"
          onClick={() => {
            triggerHaptic(12);
            startTutorial(0);
            navigate('/inicio');
          }}
          className="w-full p-4 flex items-center gap-3 text-left hover:bg-app-surface-2 transition-colors"
        >
          <Compass className="w-4.5 h-4.5 text-[var(--brand)] shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-extrabold text-app-ink">
              Ver el recorrido de la app
            </span>
            <span className="block text-[11px] text-app-muted">
              7 pasos por las funciones que usarás en campo
            </span>
          </span>
          <ChevronRight className="w-4 h-4 text-app-muted shrink-0" />
        </button>

        <Link
          to="/diagnostico"
          className="w-full p-4 flex items-center gap-3 text-left hover:bg-app-surface-2 transition-colors"
        >
          <Activity className="w-4.5 h-4.5 text-[var(--brand)] shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-extrabold text-app-ink">
              Revisar micrófono, cámara y GPS
            </span>
            <span className="block text-[11px] text-app-muted">
              Comprueba permisos y espacio de guardado en este equipo
            </span>
          </span>
          <ChevronRight className="w-4 h-4 text-app-muted shrink-0" />
        </Link>

        <Link
          to="/evaluacion"
          className="w-full p-4 flex items-center gap-3 text-left hover:bg-app-surface-2 transition-colors"
        >
          <FlaskConical className="w-4.5 h-4.5 text-[var(--brand)] shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-extrabold text-app-ink">
              Modo evaluación
            </span>
            <span className="block text-[11px] text-app-muted">
              Arquitectura, gobernanza de datos y guion de demostración
            </span>
          </span>
          <ChevronRight className="w-4 h-4 text-app-muted shrink-0" />
        </Link>
      </section>

      {/* Planes */}
      <section className="card-duo p-5 space-y-3">
        <div>
          <span className="text-[11px] font-extrabold uppercase text-[var(--brand)]">
            Tu plan
          </span>
          <h2 className="font-display font-extrabold text-base text-app-ink">
            Planes pensados para el campo mexicano
          </h2>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          {[
            { id: 'semilla', name: 'Semilla', price: '$0', desc: 'Hasta 3 lotes' },
            { id: 'pro', name: 'Ing. Pro', price: '$199/m', desc: 'Ilimitado + IA' },
            { id: 'cooperativa', name: 'Coop B2B', price: '$4,500/m', desc: '25 técnicos' }
          ].map((pl) => {
            const active = (technician.planTier || 'pro') === pl.id;
            return (
              <button
                key={pl.id}
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  setPlanTier(pl.id as typeof technician.planTier);
                  pushToast({
                    title: `Plan ${pl.name} seleccionado`,
                    description: 'Es una vista previa: no se cobra nada en esta demo.',
                    tone: 'info'
                  });
                }}
                aria-pressed={active}
                className={`p-3 rounded-2xl border-2 text-left transition-all ${
                  active
                    ? 'bg-app-tint border-[var(--brand)]'
                    : 'bg-app-surface-2 border-transparent'
                }`}
              >
                <div className="font-extrabold text-app-ink">{pl.name}</div>
                <div className="font-display font-extrabold text-sm text-[var(--brand)] dark:text-[var(--brand-bright)] mt-0.5">
                  {pl.price}
                </div>
                <div className="text-[10px] text-app-muted mt-0.5">{pl.desc}</div>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-app-muted leading-snug">
          Los precios son de ejemplo. No hay cobros, suscripciones ni servicios externos activos.
        </p>
      </section>

      {/* Instalar en Android */}
      <section className="card-duo p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-app-tint text-[var(--brand)] flex items-center justify-center shrink-0">
          <Download className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-extrabold text-app-ink">Instalar en Android</div>
          <div className="text-[11px] text-app-muted leading-snug">
            Descarga el APK de la demo y ábrelo en el teléfono para instalarlo.
          </div>
        </div>
        <a
          href="/descargas/voz-de-campo-demo.apk"
          download="voz-de-campo-demo.apk"
          className="btn-duo-primary px-3 py-2 text-xs shrink-0"
        >
          Descargar
        </a>
      </section>

      {/* Conexión y datos demo */}
      <section className="card-duo p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {isReallyOffline ? (
              <WifiOff className="w-5 h-5 text-[var(--amber)]" />
            ) : (
              <Wifi className="w-5 h-5 text-[var(--brand)]" />
            )}
            <div className="text-xs">
              <div className="font-extrabold text-app-ink">
                {isReallyOffline
                  ? 'Sin internet en este teléfono'
                  : technician.forcedOfflineMode
                    ? 'Modo sin señal (simulado)'
                    : 'Trabajando con señal'}
              </div>
              <div className="text-[11px] text-app-muted">
                {isReallyOffline
                  ? 'Puedes seguir trabajando: todo se guarda aquí.'
                  : technician.forcedOfflineMode
                    ? 'Así se siente la app en una parcela sin cobertura.'
                    : 'Los registros pendientes pueden enviarse.'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleForcedOfflineMode}
            aria-pressed={technician.forcedOfflineMode}
            className="px-3.5 py-2 btn-duo-secondary text-xs shrink-0"
          >
            {technician.forcedOfflineMode ? 'Usar señal' : 'Simular sin señal'}
          </button>
        </div>

        <div className="pt-2 border-t border-app-hairline">
          <button
            type="button"
            onClick={handleResetDemoData}
            className="w-full py-2.5 px-3 btn-duo-secondary text-xs inline-flex items-center justify-center gap-1.5"
          >
            <RefreshCcw className="w-3.5 h-3.5 text-[var(--brand)]" />
            <span>Restaurar los datos de ejemplo</span>
          </button>
        </div>
      </section>

      {/* Privacidad */}
      <section className="card-duo p-4 space-y-3">
        <button
          type="button"
          onClick={() => setShowPrivacyArco((v) => !v)}
          aria-expanded={showPrivacyArco}
          className="w-full flex items-center justify-between gap-2 text-xs font-extrabold text-app-ink"
        >
          <span className="inline-flex items-center gap-2">
            <Lock className="w-4 h-4 text-[var(--brand)]" />
            <span>Privacidad y tus derechos sobre los datos</span>
          </span>
          <span className="text-[var(--brand)] shrink-0">
            {showPrivacyArco ? 'Ocultar' : 'Abrir'}
          </span>
        </button>

        <AnimatePresence initial={false}>
          {showPrivacyArco && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 pt-2 border-t border-app-hairline text-xs text-app-muted">
                <p className="leading-relaxed">
                  Tus grabaciones, fotos y firmas viven solo en este teléfono. Antes de consultar
                  al asistente, un filtro local borra nombres, teléfonos y ubicaciones exactas.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleExportMyDataJson}
                    className="py-2.5 px-3 btn-duo-secondary text-xs inline-flex items-center justify-center gap-1.5 text-app-ink"
                  >
                    <Download className="w-3.5 h-3.5 text-[var(--brand)]" />
                    <span>Descargar mis datos</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmAction('delete')}
                    className="py-2.5 px-3 rounded-xl bg-[var(--danger)]/12 text-[var(--danger)] font-extrabold text-xs inline-flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Borrar mis datos</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Sesión */}
      <section className="card-duo p-4 space-y-3">
        <button
          type="button"
          onClick={() => setConfirmAction('logout')}
          className="w-full py-2.5 btn-duo-secondary text-xs inline-flex items-center justify-center gap-1.5"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Cerrar sesión</span>
        </button>
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-app-muted">
          <ShieldCheck className="w-3 h-3 text-[var(--brand)]" />
          <span>Voz de Campo · Versión 1.0 · Datos de ejemplo en tu teléfono</span>
        </div>
      </section>

      {/* Confirmaciones */}
      <AnimatePresence>
        {confirmAction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-3"
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="w-full max-w-sm card-duo p-5 space-y-3 bg-app-surface"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-display font-extrabold text-base text-app-ink">
                  {confirmAction === 'logout'
                    ? '¿Cerrar sesión?'
                    : '¿Borrar tus datos de este teléfono?'}
                </h2>
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  aria-label="Cancelar"
                  className="w-8 h-8 rounded-full bg-app-surface-2 flex items-center justify-center text-app-muted"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-app-muted leading-relaxed">
                {confirmAction === 'logout'
                  ? 'Tus parcelas, visitas y pasaportes se quedan guardados aquí. Entrarás de nuevo con tu correo y contraseña.'
                  : 'Se eliminan visitas, fotos, firmas, pasaportes y la cuenta local. Esta acción no se puede deshacer.'}
              </p>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  className="py-2.5 btn-duo-secondary text-xs"
                >
                  Mejor no
                </button>
                <button
                  type="button"
                  onClick={() => void runConfirmedAction()}
                  disabled={working}
                  className={
                    confirmAction === 'logout'
                      ? 'py-2.5 btn-duo-primary text-xs'
                      : 'py-2.5 btn-duo-danger text-xs'
                  }
                >
                  {working
                    ? 'Un momento…'
                    : confirmAction === 'logout'
                      ? 'Cerrar sesión'
                      : 'Sí, borrar todo'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
