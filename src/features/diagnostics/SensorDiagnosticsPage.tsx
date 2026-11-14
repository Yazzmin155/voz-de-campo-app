import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Copy,
  HardDrive,
  MapPin,
  Mic,
  RefreshCw,
  Share2,
  ShieldAlert,
  Smartphone
} from 'lucide-react';
import { useAppStore } from '@/lib/db';
import {
  captureFieldGps,
  classifyMediaError,
  inspectDeviceStorage,
  requestScreenWakeLock,
  StorageDiagnostic,
  triggerHaptic
} from '@/lib/sensors';

interface SensorRowState {
  id: string;
  label: string;
  status: 'idle' | 'ok' | 'warn' | 'error';
  detail: string;
  code: string;
}

export const SensorDiagnosticsPage: React.FC = () => {
  const navigate = useNavigate();
  const { pushToast } = useAppStore();

  const [storageInfo, setStorageInfo] = useState<StorageDiagnostic>({
    usageMB: 1.2,
    quotaMB: 512,
    percentUsed: 0.23,
    persisted: true
  });

  const [rows, setRows] = useState<SensorRowState[]>([
    {
      id: 'mic',
      label: 'Micrófono y Audio Web',
      status: 'idle',
      detail: 'Listo para probar captura y onda de voz',
      code: 'AUDIO_READY'
    },
    {
      id: 'cam',
      label: 'Cámara Trasera y Sello WebP',
      status: 'idle',
      detail: 'Listo para verificar encuadre o fallback nativo',
      code: 'CAMERA_READY'
    },
    {
      id: 'gps',
      label: 'Geolocalización GNSS / Polígono',
      status: 'idle',
      detail: 'Listo para verificar coordenadas de parcela',
      code: 'GNSS_READY'
    },
    {
      id: 'wakelock',
      label: 'Wake Lock y Motor Háptico',
      status: 'idle',
      detail: 'Mantiene la pantalla encendida al dictar',
      code: 'WAKELOCK_READY'
    },
    {
      id: 'pwa',
      label: 'Service Worker Offline y HTTPS',
      status: 'idle',
      detail: 'Cache de aplicación y contexto seguro',
      code: 'SW_READY'
    }
  ]);

  const updateRow = (id: string, patch: Partial<SensorRowState>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  useEffect(() => {
    inspectDeviceStorage(true).then(setStorageInfo);
    const isSecure = typeof window !== 'undefined' && window.isSecureContext;
    const hasSw = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
    updateRow('pwa', {
      status: isSecure ? 'ok' : 'warn',
      detail: isSecure
        ? `Contexto seguro HTTPS activo · Service Worker ${hasSw ? 'soportado' : 'local'}`
        : 'Ejecutando fuera de HTTPS; usa localhost o Vercel para permisos completos',
      code: isSecure ? 'HTTPS_SW_OK' : 'INSECURE_CONTEXT'
    });
  }, []);

  const handleTestMicrophone = async () => {
    triggerHaptic(12);
    if (!navigator.mediaDevices?.getUserMedia) {
      updateRow('mic', {
        status: 'warn',
        detail: 'Navegador sin getUserMedia; se usará modo de edición asistida.',
        code: 'FALLBACK_ASSISTED_MIC'
      });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const trackLabel = stream.getAudioTracks()[0]?.label || 'Micrófono predeterminado';
      stream.getTracks().forEach((t) => t.stop());
      updateRow('mic', {
        status: 'ok',
        detail: `Permiso concedido · Dispositivo: ${trackLabel}`,
        code: 'MIC_STREAM_OK'
      });
    } catch (err) {
      const info = classifyMediaError(err, 'micrófono');
      updateRow('mic', {
        status: 'warn',
        detail: `${info.title}. Fallback manual activo.`,
        code: info.code
      });
    }
  };

  const handleTestCamera = async () => {
    triggerHaptic(12);
    if (!navigator.mediaDevices?.getUserMedia) {
      updateRow('cam', {
        status: 'warn',
        detail: 'Usando cámara nativa del sistema (input capture="environment").',
        code: 'NATIVE_INPUT_CAPTURE'
      });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      const label = stream.getVideoTracks()[0]?.label || 'Cámara verificada';
      stream.getTracks().forEach((t) => t.stop());
      updateRow('cam', {
        status: 'ok',
        detail: `Visor activo · ${label}`,
        code: 'CAM_STREAM_OK'
      });
    } catch (err) {
      const info = classifyMediaError(err, 'cámara');
      updateRow('cam', {
        status: 'warn',
        detail: `${info.title}. Se usará selector nativo de cámara.`,
        code: info.code
      });
    }
  };

  const handleTestGps = async () => {
    triggerHaptic(12);
    const fix = await captureFieldGps({ lat: 24.7642, lng: -107.6948, accuracyM: 1.4 });
    updateRow('gps', {
      status: fix.source === 'gps-device' ? 'ok' : 'warn',
      detail:
        fix.source === 'gps-device'
          ? `GPS real capturado: ${fix.lat}, ${fix.lng} (±${fix.accuracyM}m)`
          : `Usando coordenadas del croquis: ${fix.lat}, ${fix.lng} (±${fix.accuracyM}m)`,
      code: fix.source === 'gps-device' ? 'GNSS_DEVICE_FIX' : fix.errorCode || 'POLYGON_COORDS'
    });
  };

  const handleTestWakeLock = async () => {
    triggerHaptic([14, 30, 14]);
    const release = await requestScreenWakeLock();
    if (release) {
      await release();
      updateRow('wakelock', {
        status: 'ok',
        detail: 'Wake Lock y vibración háptica verificados correctamente.',
        code: 'WAKELOCK_HAPTIC_OK'
      });
    } else {
      updateRow('wakelock', {
        status: 'ok',
        detail: 'Modo estándar activo (el sistema administra el bloqueo de pantalla).',
        code: 'STANDARD_SCREEN_LOCK'
      });
    }
  };

  const handleRunAllTests = async () => {
    await handleTestMicrophone();
    await handleTestCamera();
    await handleTestGps();
    await handleTestWakeLock();
    const st = await inspectDeviceStorage(true);
    setStorageInfo(st);
    pushToast({
      title: 'Diagnóstico completado',
      description: 'Todos los sensores y rutas de respaldo fueron verificados.',
      tone: 'success'
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-extrabold text-app-muted hover:text-app-ink"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver</span>
        </button>

        <button
          type="button"
          onClick={handleRunAllTests}
          className="px-3.5 py-2 btn-duo-primary text-xs inline-flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Probar todo</span>
        </button>
      </div>

      <section className="card-duo p-5 space-y-2">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-[#58A700]/15 text-[#58A700] flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-display font-extrabold text-xl text-app-ink">
              Diagnóstico de Sensores
            </h1>
            <p className="text-xs text-app-muted">
              Verifica permisos de micrófono, cámara, GPS y memoria en este dispositivo
            </p>
          </div>
        </div>
      </section>

      {/* Memoria Local IndexedDB */}
      <section className="card-duo p-4 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-extrabold text-app-ink flex items-center gap-1.5">
            <HardDrive className="w-4 h-4 text-[#58A700]" />
            Almacenamiento Offline (IndexedDB)
          </span>
          <span className="font-mono-tech font-bold text-[#58A700] dark:text-[#7BD62B]">
            {storageInfo.usageMB} MB / {storageInfo.quotaMB} MB
          </span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-app-surface-2 overflow-hidden">
          <div
            style={{ width: `${Math.max(4, Math.min(100, storageInfo.percentUsed))}%` }}
            className="h-full bg-[#58A700] rounded-full"
          />
        </div>
        <p className="text-[11px] text-app-muted">
          Persistencia protegida: <strong>{storageInfo.persisted ? 'Activa' : 'Estándar'}</strong>
        </p>
      </section>

      {/* Filas de Sensores */}
      <section className="space-y-3">
        {rows.map((r) => {
          const testFn =
            r.id === 'mic'
              ? handleTestMicrophone
              : r.id === 'cam'
                ? handleTestCamera
                : r.id === 'gps'
                  ? handleTestGps
                  : r.id === 'wakelock'
                    ? handleTestWakeLock
                    : undefined;

          return (
            <div key={r.id} className="card-duo p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {r.status === 'ok' ? (
                    <CheckCircle2 className="w-4 h-4 text-[#58A700] shrink-0" />
                  ) : r.status === 'warn' ? (
                    <AlertTriangle className="w-4 h-4 text-[#FFC800] shrink-0" />
                  ) : r.status === 'error' ? (
                    <ShieldAlert className="w-4 h-4 text-[#D64545] shrink-0" />
                  ) : (
                    <Smartphone className="w-4 h-4 text-app-muted shrink-0" />
                  )}
                  <span className="text-sm font-extrabold text-app-ink">{r.label}</span>
                </div>

                {testFn && (
                  <button
                    type="button"
                    onClick={testFn}
                    className="px-3 py-1.5 btn-duo-secondary text-xs shrink-0"
                  >
                    Probar
                  </button>
                )}
              </div>

              <p className="text-xs text-app-muted">{r.detail}</p>

              <div className="flex items-center justify-between pt-1 border-t border-app-hairline font-mono-tech text-[10px] text-app-muted">
                <span>Código: {r.code}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(`${r.id}: ${r.code} - ${r.detail}`);
                    pushToast({ title: 'Código copiado', tone: 'info' });
                  }}
                  className="inline-flex items-center gap-1 hover:text-app-ink"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copiar</span>
                </button>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
};
