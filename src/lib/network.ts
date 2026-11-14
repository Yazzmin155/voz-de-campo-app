import { useEffect, useSyncExternalStore } from 'react';

export type Reachability = 'checking' | 'online' | 'offline';

export interface NetworkSnapshot {
  /** Lo que el sistema operativo reporta como conectado. */
  browserOnline: boolean;
  /** Resultado de una prueba real de salida a internet. */
  reachability: Reachability;
  lastCheckedAt: number | null;
}

const PING_URL = 'https://tile.openstreetmap.org/0/0/0.png';
const PING_TIMEOUT_MS = 4500;
const RECHECK_INTERVAL_MS = 60_000;

let snapshot: NetworkSnapshot = {
  browserOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
  reachability: 'checking',
  lastCheckedAt: null
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function setSnapshot(next: Partial<NetworkSnapshot>) {
  snapshot = { ...snapshot, ...next };
  emit();
}

export function getNetworkSnapshot(): NetworkSnapshot {
  return snapshot;
}

export function subscribeNetwork(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Comprueba de verdad si hay salida a internet (no solo si el sistema dice estar conectado).
 * Usa una petición opaca a un mosaico de OpenStreetMap que ya se cachea para el mapa.
 */
export async function checkReachability(): Promise<boolean> {
  if (typeof navigator === 'undefined') return true;

  if (!navigator.onLine) {
    setSnapshot({
      browserOnline: false,
      reachability: 'offline',
      lastCheckedAt: Date.now()
    });
    return false;
  }

  if (typeof fetch !== 'function') {
    setSnapshot({ browserOnline: true, reachability: 'online', lastCheckedAt: Date.now() });
    return true;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);

  try {
    await fetch(PING_URL, {
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal
    });
    setSnapshot({
      browserOnline: true,
      reachability: 'online',
      lastCheckedAt: Date.now()
    });
    return true;
  } catch {
    setSnapshot({
      browserOnline: navigator.onLine,
      reachability: 'offline',
      lastCheckedAt: Date.now()
    });
    return false;
  } finally {
    clearTimeout(timer);
  }
}

let monitoringStarted = false;

function startMonitoring() {
  if (monitoringStarted || typeof window === 'undefined') return;
  monitoringStarted = true;

  const handleOnline = () => {
    setSnapshot({ browserOnline: true, reachability: 'checking' });
    void checkReachability();
  };
  const handleOffline = () => {
    setSnapshot({ browserOnline: false, reachability: 'offline', lastCheckedAt: Date.now() });
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  void checkReachability();
  window.setInterval(() => {
    if (document.visibilityState === 'visible') {
      void checkReachability();
    }
  }, RECHECK_INTERVAL_MS);
}

/**
 * Estado de conexión para la interfaz: distingue "el teléfono no tiene internet"
 * de "estás en modo sin señal simulado" y de "hay red pero está débil".
 */
export function useNetworkStatus(): NetworkSnapshot {
  const state = useSyncExternalStore(subscribeNetwork, getNetworkSnapshot, getNetworkSnapshot);

  useEffect(() => {
    startMonitoring();
  }, []);

  return state;
}
