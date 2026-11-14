import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CheckCircle2,
  CloudOff,
  CloudUpload,
  Code2,
  Database,
  RefreshCw,
  Wifi,
  WifiOff,
  X
} from 'lucide-react';
import { db, useAppStore } from '@/lib/db';
import { useNetworkStatus } from '@/lib/network';
import { triggerHaptic } from '@/lib/sensors';
import { formatDateTime } from '@/lib/utils';

export const SyncCenterSheet: React.FC = () => {
  const {
    syncDrawerOpen,
    setSyncDrawerOpen,
    technician,
    toggleForcedOfflineMode,
    pushToast
  } = useAppStore();

  const network = useNetworkStatus();
  const isReallyOffline = !network.browserOnline;
  const isSimulatedOffline = technician.forcedOfflineMode;

  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedPayload, setSelectedPayload] = useState<Record<string, unknown> | null>(null);

  const queueItems =
    useLiveQuery(() => db.syncQueue.orderBy('createdAt').reverse().toArray(), []) ?? [];
  const pendingItems = queueItems.filter((item) => item.status === 'pending');

  if (!syncDrawerOpen) return null;

  const handleRunAtomicSync = async () => {
    if (isReallyOffline) {
      pushToast({
        title: 'Este teléfono no tiene internet',
        description: 'Tus registros ya están guardados aquí. Enviaremos todo en cuanto vuelva la señal.',
        tone: 'warning'
      });
      return;
    }

    if (isSimulatedOffline) {
      pushToast({
        title: 'Estás probando el modo sin señal',
        description: 'Toca "Conectar señal" arriba para enviar los registros pendientes.',
        tone: 'warning'
      });
      return;
    }

    setIsSyncing(true);
    triggerHaptic(14);
    await new Promise((r) => setTimeout(r, 850));

    const nowIso = new Date().toISOString();
    await db.transaction('rw', [db.syncQueue, db.parcels, db.visits, db.passports], async () => {
      for (const item of pendingItems) {
        await db.syncQueue.update(item.id, {
          status: 'synced',
          syncedAt: nowIso
        });
      }
      const pendingParcels = await db.parcels.where('syncStatus').equals('pending').toArray();
      for (const p of pendingParcels) {
        await db.parcels.update(p.id, { syncStatus: 'synced' });
      }
      const pendingVisits = await db.visits.where('syncStatus').equals('pending').toArray();
      for (const v of pendingVisits) {
        await db.visits.update(v.id, { syncStatus: 'synced' });
      }
    });

    setIsSyncing(false);
    triggerHaptic([14, 30, 18]);
    pushToast({
      title: 'Sincronización completada',
      description: `${pendingItems.length || 1} registro(s) marcados como enviados.`,
      tone: 'success'
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Memoria local y sincronización"
    >
      <div className="w-full max-w-md bg-app-canvas border-t-2 sm:border-2 border-app-hairline rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        <div className="bg-app-surface px-5 py-4 border-b border-app-hairline flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#58A700]/15 flex items-center justify-center text-[#58A700]">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-extrabold text-base text-app-ink">
                Memoria Offline y Sincronización
              </h2>
              <p className="text-xs text-app-muted">
                Tus visitas se guardan en el teléfono y suben cuando vuelve la señal
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSyncDrawerOpen(false)}
            className="p-2 rounded-xl text-app-ink hover:bg-app-surface-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          {/* Estado real de la conexión */}
          <div className="card-duo p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  isReallyOffline || isSimulatedOffline
                    ? 'bg-[#FFC800]/25 text-[#1B2A1F] dark:text-[#FFD34D]'
                    : 'bg-[#58A700]/20 text-[#58A700]'
                }`}
              >
                {isReallyOffline ? (
                  <WifiOff className="w-5 h-5" />
                ) : isSimulatedOffline ? (
                  <CloudOff className="w-5 h-5" />
                ) : (
                  <Wifi className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="text-sm font-extrabold text-app-ink">
                  {isReallyOffline
                    ? 'Sin internet en este teléfono'
                    : isSimulatedOffline
                      ? 'Modo sin señal (simulado)'
                      : 'Señal conectada'}
                </div>
                <p className="text-xs text-app-muted">
                  {isReallyOffline
                    ? 'Trabaja normal: todo se guarda aquí y sube al volver la cobertura.'
                    : isSimulatedOffline
                      ? 'Así se siente la app en una parcela sin cobertura.'
                      : 'Los registros pendientes pueden enviarse ahora.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleForcedOfflineMode}
              className="px-3.5 py-2 btn-duo-secondary text-xs shrink-0"
            >
              {isSimulatedOffline ? 'Conectar señal' : 'Simular sin señal'}
            </button>
          </div>

          {/* Botón Sincronizar */}
          <button
            type="button"
            onClick={handleRunAtomicSync}
            disabled={isSyncing || pendingItems.length === 0}
            className="w-full py-3.5 px-4 btn-duo-primary text-sm inline-flex items-center justify-center gap-2 disabled:opacity-45"
          >
            {isSyncing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CloudUpload className="w-4 h-4" />
            )}
            <span>
              {isReallyOffline
                ? 'Guardado en el teléfono, esperando señal'
                : pendingItems.length > 0
                  ? `Enviar ${pendingItems.length} registro(s) pendientes`
                  : 'Todo está sincronizado al día'}
            </span>
          </button>

          {/* Lista de paquetes */}
          <div className="space-y-2.5">
            {queueItems.map((item) => (
              <div key={item.id} className="card-duo p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-extrabold text-app-ink">{item.summary}</div>
                    <p className="text-xs text-app-muted mt-0.5">
                      {formatDateTime(item.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full shrink-0 ${
                      item.status === 'synced'
                        ? 'bg-[#58A700]/20 text-[#58A700] dark:text-[#7BD62B]'
                        : 'bg-[#FFC800]/30 text-[#1B2A1F] dark:text-[#FFD34D]'
                    }`}
                  >
                    {item.status === 'synced' ? 'Enviado' : 'Guardado en teléfono'}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedPayload(
                        selectedPayload === item.payloadPreview ? null : item.payloadPreview
                      )
                    }
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#0F62FE] hover:underline"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>Ver paquete de datos (esquema IBM)</span>
                  </button>
                  {item.syncedAt && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#58A700]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Sincronizado
                    </span>
                  )}
                </div>

                {selectedPayload === item.payloadPreview && (
                  <pre className="mt-2 p-3 rounded-xl bg-[#10160F] text-[#F2F6EE] font-mono-tech text-[11px] overflow-x-auto">
                    {JSON.stringify(item.payloadPreview, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
