import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  X
} from 'lucide-react';
import { useAppStore } from '@/lib/db';
import { triggerHaptic } from '@/lib/sensors';

export interface TourStepSpec {
  step: number;
  title: string;
  body: string;
  route: string;
  targetSelector?: string;
  ctaLabel: string;
  badge: string;
}

export const TOUR_STEPS: TourStepSpec[] = [
  {
    step: 0,
    badge: 'Paso 1 de 7',
    title: 'Esta es tu ruta de hoy',
    body: 'Arriba ves cuántas parcelas están listas y cuál tiene una alerta pendiente. Toca una parcela para abrir su croquis y sus visitas.',
    route: '/inicio',
    targetSelector: '[data-tour="route-progress"]',
    ctaLabel: 'Siguiente'
  },
  {
    step: 1,
    badge: 'Paso 2 de 7',
    title: 'El botón verde es para dictar',
    body: 'Con el botón central abres el registro de una visita. Funciona sin señal: todo se guarda en el teléfono.',
    route: '/inicio',
    targetSelector: '[data-tour="nav-dictar"]',
    ctaLabel: 'Ver cómo se dicta'
  },
  {
    step: 2,
    badge: 'Paso 3 de 7',
    title: 'Habla o usa un caso de prueba',
    body: 'Puedes grabar tu voz o tocar uno de los tres casos de ejemplo. La app separa producto, dosis y días a cosecha.',
    route: '/visitas/nueva/parcel-4b',
    targetSelector: '[data-tour="voice-capture-step"]',
    ctaLabel: 'Ver lo que entendió'
  },
  {
    step: 3,
    badge: 'Paso 4 de 7',
    title: 'Tú confirmas los datos',
    body: 'Revisa lo que se extrajo, agrega una foto sellada si quieres y pide la firma del productor. Nada se guarda sin tu confirmación.',
    route: '/visitas/nueva/parcel-4b?step=2',
    targetSelector: '[data-tour="confirm-step"]',
    ctaLabel: 'Pasar a la revisión'
  },
  {
    step: 4,
    badge: 'Paso 5 de 7',
    title: 'La revisión de carencia',
    body: 'Si faltan días de espera o el producto está restringido, la app bloquea el pasaporte y te propone reprogramar la cosecha.',
    route: '/visitas/nueva/parcel-4b?step=3',
    targetSelector: '[data-tour="shield-step"]',
    ctaLabel: 'Ver el pasaporte'
  },
  {
    step: 5,
    badge: 'Paso 6 de 7',
    title: 'Este es el pasaporte del lote',
    body: 'Lleva un QR sobre fondo blanco y un sello SHA-256. Cualquier cambio en los datos invalida la firma.',
    route: '/pasaportes/PASS-2026-1A09',
    targetSelector: '[data-tour="passport-qr"]',
    ctaLabel: 'Último paso'
  },
  {
    step: 6,
    badge: 'Paso 7 de 7',
    title: 'Listo para trabajar',
    body: 'Puedes repetir este recorrido cuando quieras desde Perfil. Lo que registres hoy queda guardado en este teléfono.',
    route: '/inicio',
    targetSelector: undefined,
    ctaLabel: 'Empezar'
  }
];

export const InteractiveTourOverlay: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    tutorialActive,
    tutorialStep,
    nextTutorialStep,
    setTutorialStep,
    skipTutorial,
    completeTutorial,
    pushToast
  } = useAppStore();

  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [confirmingSkip, setConfirmingSkip] = useState(false);

  const currentSpec = TOUR_STEPS[tutorialStep] || TOUR_STEPS[0];

  // Navegar a la pantalla del paso, sin que el usuario pueda alterarlo.
  useEffect(() => {
    if (!tutorialActive) return;
    const targetPath = currentSpec.route.split('?')[0];
    const currentFull = `${location.pathname}${location.search}`;
    if (currentFull !== currentSpec.route) {
      navigate(currentSpec.route, { replace: true });
    }
  }, [tutorialActive, tutorialStep, currentSpec.route, location.pathname, location.search, navigate]);

  const measureTarget = useCallback(() => {
    if (!tutorialActive || !currentSpec.targetSelector) {
      setHighlightRect(null);
      return;
    }
    const el = document.querySelector(currentSpec.targetSelector);
    setHighlightRect(el ? el.getBoundingClientRect() : null);
  }, [tutorialActive, currentSpec.targetSelector]);

  useLayoutEffect(() => {
    if (!tutorialActive) return;
    const raf = requestAnimationFrame(measureTarget);
    const timer = setTimeout(measureTarget, 320);
    const observer = new ResizeObserver(measureTarget);
    observer.observe(document.documentElement);
    window.addEventListener('resize', measureTarget);
    window.addEventListener('orientationchange', measureTarget);
    window.addEventListener('scroll', measureTarget, true);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener('resize', measureTarget);
      window.removeEventListener('orientationchange', measureTarget);
      window.removeEventListener('scroll', measureTarget, true);
    };
  }, [tutorialActive, tutorialStep, location.pathname, location.search, measureTarget]);

  useEffect(() => {
    if (!tutorialActive) setConfirmingSkip(false);
  }, [tutorialActive]);

  if (!tutorialActive) return null;

  const finish = () => {
    triggerHaptic([12, 24, 14]);
    completeTutorial();
    navigate('/inicio', { replace: true });
    pushToast({
      title: 'Recorrido terminado',
      description: 'Puedes repetirlo desde Perfil cuando quieras.',
      tone: 'success'
    });
  };

  const handleAdvance = () => {
    triggerHaptic(14);
    if (tutorialStep >= TOUR_STEPS.length - 1) {
      finish();
      return;
    }
    nextTutorialStep();
  };

  const handleBack = () => {
    if (tutorialStep === 0) return;
    triggerHaptic(8);
    setTutorialStep(tutorialStep - 1);
  };

  const pad = 6;
  const rect = highlightRect
    ? {
        top: Math.max(0, highlightRect.top - pad),
        left: Math.max(0, highlightRect.left - pad),
        width: highlightRect.width + pad * 2,
        height: highlightRect.height + pad * 2
      }
    : null;

  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 400;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-between"
      role="dialog"
      aria-modal="true"
      aria-label="Recorrido guiado de Voz de Campo"
    >
      {/* Scrim bloqueante con hueco sobre el elemento resaltado */}
      {rect ? (
        <>
          <div
            className="absolute bg-black/60"
            style={{ top: 0, left: 0, right: 0, height: rect.top }}
          />
          <div
            className="absolute bg-black/60"
            style={{ top: rect.top + rect.height, left: 0, right: 0, bottom: 0 }}
          />
          <div
            className="absolute bg-black/60"
            style={{ top: rect.top, left: 0, width: rect.left, height: rect.height }}
          />
          <div
            className="absolute bg-black/60"
            style={{
              top: rect.top,
              left: rect.left + rect.width,
              right: 0,
              height: rect.height
            }}
          />
          {/* Bloquea también el propio elemento resaltado */}
          <div
            className="absolute"
            style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
          />
          <motion.div
            layout
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="absolute rounded-2xl border-2 border-[var(--brand-bright)] pointer-events-none"
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              boxShadow: '0 0 0 1px rgba(123,214,43,0.35), 0 0 24px rgba(123,214,43,0.35)'
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-black/60" />
      )}

      {/* Cabecera del recorrido */}
      <div className="relative z-10 flex items-center justify-between gap-2 px-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/55 text-white text-[11px] font-bold">
          <Sparkles className="w-3.5 h-3.5 text-[var(--brand-bright)]" />
          Recorrido guiado
        </span>
        <button
          type="button"
          onClick={() => setConfirmingSkip(true)}
          className="px-3 py-1.5 rounded-full bg-black/60 text-white text-xs font-bold inline-flex items-center gap-1.5"
        >
          <span>Saltar</span>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tarjeta del paso */}
      <div className="relative z-10 w-full max-w-[520px] mx-auto px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSpec.step}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18 }}
            className="card-duo p-4 space-y-3 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--brand)]/12 text-[var(--brand)] dark:text-[var(--brand-bright)]">
                {currentSpec.badge}
              </span>
              <div className="flex items-center gap-1.5" aria-hidden="true">
                {TOUR_STEPS.map((s) => (
                  <span
                    key={s.step}
                    className={`h-1.5 rounded-full transition-all ${
                      s.step === tutorialStep
                        ? 'w-5 bg-[var(--brand)]'
                        : s.step < tutorialStep
                          ? 'w-1.5 bg-[var(--brand-bright)]'
                          : 'w-1.5 bg-app-hairline'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="font-display font-extrabold text-lg leading-tight">
                {currentSpec.title}
              </h3>
              <p className="text-[13px] text-app-muted leading-relaxed">{currentSpec.body}</p>
            </div>

            <div className="flex items-center gap-2 pt-0.5">
              {tutorialStep > 0 && (
                <button
                  type="button"
                  onClick={handleBack}
                  aria-label="Paso anterior"
                  className="w-11 h-11 rounded-xl bg-app-surface-2 text-app-ink inline-flex items-center justify-center"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={handleAdvance}
                className="flex-1 py-3 px-4 btn-duo-primary text-sm inline-flex items-center justify-center gap-2"
              >
                <span>{currentSpec.ctaLabel}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Confirmación de salida */}
      <AnimatePresence>
        {confirmingSkip && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 bg-black/60 flex items-end justify-center"
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              className="w-full max-w-[520px] bg-app-surface rounded-t-3xl p-5 space-y-3 pb-safe"
            >
              <div className="w-10 h-1 rounded-full bg-app-hairline mx-auto" />
              <h2 className="font-display font-extrabold text-lg">¿Salir del recorrido?</h2>
              <p className="text-xs text-app-muted leading-relaxed">
                Puedes retomarlo donde lo dejaste desde Perfil. Si sales ahora, la app seguirá
                funcionando igual.
              </p>
              <button
                type="button"
                onClick={() => setConfirmingSkip(false)}
                className="w-full py-3 btn-duo-primary text-sm"
              >
                Seguir viendo
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmingSkip(false);
                  skipTutorial();
                  pushToast({
                    title: 'Recorrido pausado',
                    description: 'Puedes retomarlo desde Perfil → Ver recorrido.',
                    tone: 'info'
                  });
                }}
                className="w-full py-2.5 text-xs font-bold text-app-muted"
              >
                Salir del recorrido
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
