import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import {
  Bot,
  CheckCircle2,
  ChevronLeft,
  CloudOff,
  Download,
  Home,
  MapPin,
  Mic,
  Moon,
  QrCode,
  ShieldAlert,
  Sun,
  User,
  Wifi,
  WifiOff,
  X
} from 'lucide-react';
import { BrandWordmark } from '@/components/brand/BrandWordmark';
import { FieldCopilotSheet } from '@/components/field/FieldCopilotSheet';
import { SyncCenterSheet } from '@/components/field/SyncCenterSheet';
import { InteractiveTourOverlay } from '@/components/tutorial/InteractiveTourOverlay';
import { db, useAppStore } from '@/lib/db';
import { useNetworkStatus } from '@/lib/network';
import { triggerHaptic } from '@/lib/sensors';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/inicio', label: 'Inicio', icon: Home },
  { to: '/parcelas', label: 'Parcelas', icon: MapPin },
  { to: '/visitas/nueva', label: 'Dictar', icon: Mic, isCenterAction: true },
  { to: '/pasaportes', label: 'Pasaportes', icon: QrCode },
  { to: '/ajustes', label: 'Perfil', icon: User }
];

function routeWeight(pathname: string): number {
  const exactIndex = NAV_ITEMS.findIndex((item) => pathname === item.to);
  if (exactIndex >= 0) return exactIndex * 10;
  const tabIndex = NAV_ITEMS.findIndex(
    (item) => item.to !== '/inicio' && pathname.startsWith(item.to)
  );
  const base = tabIndex >= 0 ? tabIndex * 10 : 0;
  return base + pathname.split('/').filter(Boolean).length;
}

export const AppShell: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    technician,
    themeMode,
    toggleDarkMode,
    openCopilot,
    closeCopilot,
    setSyncDrawerOpen,
    syncDrawerOpen,
    copilotOpen,
    tutorialActive,
    toasts,
    dismissToast,
    pushToast
  } = useAppStore();

  const scrollRef = useRef<HTMLElement | null>(null);
  const previousWeight = useRef(routeWeight(location.pathname));
  const [direction, setDirection] = useState(1);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);

  const pendingSyncCount =
    useLiveQuery(() => db.syncQueue.where('status').equals('pending').count(), []) ?? 0;

  const network = useNetworkStatus();
  const isSimulatedOffline = technician.forcedOfflineMode;
  const isReallyOffline = !network.browserOnline;
  const isOffline = isSimulatedOffline || isReallyOffline;
  const connectionLabel = isSimulatedOffline
    ? 'Modo sin señal'
    : isReallyOffline
      ? 'Sin internet'
      : network.reachability === 'offline'
        ? 'Señal débil'
        : 'En línea';
  const isDark = themeMode === 'dark';
  const isCaptureScreen = location.pathname.startsWith('/visitas/nueva');
  const isRootTab = useMemo(
    () => NAV_ITEMS.some((item) => item.to === location.pathname),
    [location.pathname]
  );

  // Transición direccional: avanzar hacia la derecha, volver hacia la izquierda.
  useEffect(() => {
    const nextWeight = routeWeight(location.pathname);
    setDirection(nextWeight >= previousWeight.current ? 1 : -1);
    previousWeight.current = nextWeight;

    // Cada pantalla arranca desde arriba, como una app nativa.
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Botón físico / gesto de atrás de Android.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let removeListener: (() => void) | undefined;

    CapacitorApp.addListener('backButton', () => {
      if (tutorialActive) return;
      if (syncDrawerOpen) {
        setSyncDrawerOpen(false);
        return;
      }
      if (copilotOpen) {
        closeCopilot();
        return;
      }
      if (!isRootTab) {
        navigate(-1);
        return;
      }
      CapacitorApp.exitApp();
    }).then((listener) => {
      removeListener = () => {
        listener.remove();
      };
    });

    return () => removeListener?.();
  }, [syncDrawerOpen, copilotOpen, tutorialActive, isRootTab, navigate, setSyncDrawerOpen, closeCopilot]);

  const handleInstallPwa = async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    if (choice?.outcome === 'accepted') {
      pushToast({
        title: 'App instalada en tu dispositivo',
        description: 'Ya puedes abrir Voz de Campo desde tu pantalla de inicio.',
        tone: 'success'
      });
    }
    setDeferredInstallPrompt(null);
  };

  return (
    <div className="h-dvh w-full bg-app-canvas text-app-ink flex justify-center overflow-hidden">
      <div className="w-full max-w-[520px] h-dvh flex flex-col relative bg-app-canvas lg:border-x lg:border-app-hairline">
        {/* Cabecera */}
        <header className="shrink-0 pt-safe-top bg-app-surface/92 backdrop-blur-md border-b border-app-hairline z-20">
          <div className="h-14 px-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 min-w-0">
              {!isRootTab && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(8);
                    navigate(-1);
                  }}
                  aria-label="Volver"
                  className="w-9 h-9 -ml-1.5 rounded-full flex items-center justify-center text-app-ink active:bg-app-surface-2 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              <BrandWordmark size="sm" />
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setSyncDrawerOpen(true)}
                className={cn(
                  'h-9 px-2.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-colors',
                  isOffline
                    ? 'bg-[var(--amber)]/20 text-app-ink'
                    : 'bg-[var(--brand)]/12 text-[var(--brand)] dark:text-[var(--brand-bright)]'
                )}
                title="Estado de conexión y memoria local"
              >
                {isSimulatedOffline ? (
                  <CloudOff className="w-3.5 h-3.5" />
                ) : isReallyOffline ? (
                  <WifiOff className="w-3.5 h-3.5" />
                ) : (
                  <Wifi className="w-3.5 h-3.5" />
                )}
                <span className="hidden min-[425px]:inline">{connectionLabel}</span>
                {pendingSyncCount > 0 && (
                  <span className="min-w-4 h-4 px-1 rounded-full bg-app-surface text-app-ink text-[10px] font-extrabold flex items-center justify-center">
                    {pendingSyncCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  openCopilot();
                }}
                aria-label="Abrir asistente de campo"
                className="h-9 px-2.5 rounded-full bg-[var(--ibm)]/12 text-[var(--ibm)] text-xs font-bold inline-flex items-center gap-1.5 transition-colors active:bg-[var(--ibm)]/20"
              >
                <Bot className="w-4 h-4" />
                <span className="hidden min-[380px]:inline">IA</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  toggleDarkMode();
                }}
                aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                className="w-9 h-9 rounded-full bg-app-surface-2 text-app-ink flex items-center justify-center transition-colors active:bg-app-tint"
              >
                {isDark ? (
                  <Sun className="w-4 h-4 text-[var(--amber)]" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {deferredInstallPrompt && (
            <div className="bg-app-tint px-3 py-2 border-t border-app-hairline flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-app-ink">Instala Voz de Campo</span>
              <button
                type="button"
                onClick={handleInstallPwa}
                className="px-3 py-1 rounded-lg bg-[var(--brand)] text-white font-bold inline-flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Instalar</span>
              </button>
            </div>
          )}
        </header>

        {/* Único contenedor de scroll de la app */}
        <main
          ref={scrollRef}
          className={cn(
            'flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden app-scroll px-3.5 py-3.5',
            isCaptureScreen ? 'pb-8' : 'pb-4'
          )}
        >
          {/* La animación de entrada es CSS pura: nunca deja la pantalla en blanco
              aunque se navegue varias veces seguidas (p. ej. durante el tutorial). */}
          <div
            key={location.pathname}
            className="page-enter"
            style={{ '--page-shift': `${direction * 12}px` } as React.CSSProperties}
          >
            <Outlet />
          </div>
        </main>

        {/* Navegación inferior */}
        {!isCaptureScreen && (
          <nav
            aria-label="Navegación principal"
            className="shrink-0 z-30 bg-app-surface border-t border-app-hairline pb-safe"
          >
            <div className="grid grid-cols-5 items-end px-1.5 pt-1.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActiveItem =
                  location.pathname === item.to ||
                  (item.to !== '/inicio' && location.pathname.startsWith(item.to));

                if (item.isCenterAction) {
                  return (
                    <button
                      key={item.to}
                      type="button"
                      data-tour="nav-dictar"
                      onClick={() => {
                        triggerHaptic(14);
                        navigate(item.to);
                      }}
                      aria-label="Dictar visita en campo"
                      className="flex flex-col items-center justify-center gap-1 group"
                    >
                      <span className="w-12 h-9 rounded-xl bg-[var(--brand)] text-white flex items-center justify-center shadow-sm border-b-2 border-[var(--brand-dark)] group-active:translate-y-0.5 group-active:border-b-0 transition-transform">
                        <Mic className="w-5 h-5" />
                      </span>
                      <span className="text-[10px] font-bold text-[var(--brand)] dark:text-[var(--brand-bright)] leading-none">
                        {item.label}
                      </span>
                    </button>
                  );
                }

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => triggerHaptic(8)}
                    className="relative flex flex-col items-center justify-center gap-1 py-1 min-h-11"
                  >
                    {isActiveItem && (
                      <motion.span
                        layoutId="bottom-nav-pill"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                        className="absolute inset-x-2 top-0 h-8 rounded-lg bg-[var(--brand)]/12"
                      />
                    )}
                    <Icon
                      className={cn(
                        'relative w-[21px] h-[21px] transition-colors',
                        isActiveItem
                          ? 'text-[var(--brand)] dark:text-[var(--brand-bright)]'
                          : 'text-app-muted'
                      )}
                      strokeWidth={isActiveItem ? 2.4 : 1.9}
                    />
                    <span
                      className={cn(
                        'relative text-[10px] leading-none transition-colors',
                        isActiveItem
                          ? 'font-extrabold text-[var(--brand)] dark:text-[var(--brand-bright)]'
                          : 'font-semibold text-app-muted'
                      )}
                    >
                      {item.label}
                    </span>
                  </NavLink>
                );
              })}
            </div>
          </nav>
        )}
      </div>

      {/* Toasts */}
      <div className="fixed top-[calc(env(safe-area-inset-top,0px)+4.25rem)] inset-x-0 z-50 flex flex-col items-center gap-2 px-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              className="pointer-events-auto w-full max-w-[440px] card-duo px-3.5 py-2.5 shadow-lg flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-2.5">
                {t.tone === 'warning' || t.tone === 'danger' ? (
                  <ShieldAlert className="w-4 h-4 text-[var(--amber)] shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-[var(--brand)] shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="text-xs font-bold text-app-ink">{t.title}</div>
                  {t.description && (
                    <div className="text-[11px] text-app-muted mt-0.5">{t.description}</div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                className="text-app-muted hover:text-app-ink p-1"
                aria-label="Cerrar aviso"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <FieldCopilotSheet />
      <SyncCenterSheet />
      <InteractiveTourOverlay />
    </div>
  );
};
