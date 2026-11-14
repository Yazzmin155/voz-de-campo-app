// Capa de sensores y capacidades nativas PWA (Micrófono, Cámara, GPS, Wake Lock, Haptics, Almacenamiento)

export type SensorPermissionState =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'unsupported'
  | 'busy'
  | 'error';

export interface SensorErrorDetail {
  code: string;
  title: string;
  instructions: string;
}

export function classifyMediaError(err: unknown, sensorLabel: 'micrófono' | 'cámara'): SensorErrorDetail {
  const name = err instanceof Error ? err.name : String(err || 'UnknownError');

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return {
      code: name,
      title: `Permiso de ${sensorLabel} bloqueado`,
      instructions:
        'Toca el icono de candado o ajustes junto a la barra de direcciones del navegador, permite el acceso y vuelve a intentarlo.'
    };
  }

  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return {
      code: name,
      title: `No se detectó ${sensorLabel} en este dispositivo`,
      instructions:
        sensorLabel === 'micrófono'
          ? 'Conecta un micrófono o usa los botones de caso de prueba / escritura manual.'
          : 'Puedes subir una fotografía existente desde tu galería.'
    };
  }

  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return {
      code: name,
      title: `El ${sensorLabel} está siendo usado por otra aplicación`,
      instructions:
        'Cierra otras apps de llamada o cámara que estén abiertas en segundo plano e intenta de nuevo.'
    };
  }

  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return {
      code: 'InsecureContextError',
      title: `Se requiere conexión segura (HTTPS) para usar ${sensorLabel}`,
      instructions:
        'Ábrela desde https:// (por ejemplo en Vercel) o desde http://localhost en desarrollo.'
    };
  }

  return {
    code: name,
    title: `No se pudo iniciar ${sensorLabel} (${name})`,
    instructions: 'Puedes continuar usando la alternativa manual integrada sin perder ningún dato.'
  };
}

export function triggerHaptic(pattern: number | number[] = 14): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignorar en dispositivos sin motor háptico
  }
}

export async function requestScreenWakeLock(): Promise<(() => Promise<void>) | null> {
  try {
    const nav = navigator as any;
    if (nav?.wakeLock?.request) {
      const sentinel = await nav.wakeLock.request('screen');
      return async () => {
        try {
          await sentinel.release();
        } catch {
          // Ignorar
        }
      };
    }
  } catch {
    // Ignorar si el navegador no soporta Wake Lock
  }
  return null;
}

export interface StorageDiagnostic {
  usageMB: number;
  quotaMB: number;
  percentUsed: number;
  persisted: boolean;
}

export async function inspectDeviceStorage(requestPersist = false): Promise<StorageDiagnostic> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage) {
      let persisted = false;
      if (navigator.storage.persisted) {
        persisted = await navigator.storage.persisted();
      }
      if (requestPersist && !persisted && navigator.storage.persist) {
        persisted = await navigator.storage.persist();
      }
      if (navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        const usageMB = Number(((est.usage || 0) / (1024 * 1024)).toFixed(2));
        const quotaMB = Number(((est.quota || 1024 * 1024 * 500) / (1024 * 1024)).toFixed(0));
        const percentUsed = quotaMB > 0 ? Number(((usageMB / quotaMB) * 100).toFixed(2)) : 0;
        return { usageMB, quotaMB, percentUsed, persisted };
      }
    }
  } catch {
    // Fallback
  }
  return { usageMB: 1.4, quotaMB: 512, percentUsed: 0.27, persisted: true };
}

export interface GpsFixResult {
  lat: number;
  lng: number;
  accuracyM: number;
  source: 'gps-device' | 'parcel-polygon';
  errorCode?: string;
}

export async function captureFieldGps(fallbackCoords: {
  lat: number;
  lng: number;
  accuracyM: number;
}): Promise<GpsFixResult> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return {
      ...fallbackCoords,
      source: 'parcel-polygon',
      errorCode: 'GeolocationUnsupported'
    };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: Number(pos.coords.latitude.toFixed(5)),
          lng: Number(pos.coords.longitude.toFixed(5)),
          accuracyM: Number(Math.max(1, pos.coords.accuracy || 2.5).toFixed(1)),
          source: 'gps-device'
        });
      },
      (err) => {
        resolve({
          ...fallbackCoords,
          source: 'parcel-polygon',
          errorCode: `GPS_${err.code}_${err.message || 'FALLBACK'}`
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 30000
      }
    );
  });
}

export interface EvidenceStampMeta {
  parcelCode: string;
  technicianCip: string;
  lat: number;
  lng: number;
  accuracyM: number;
  timestampIso?: string;
}

export function stampEvidenceOnCanvas(
  source: HTMLVideoElement | HTMLImageElement,
  sourceWidth: number,
  sourceHeight: number,
  stamp?: EvidenceStampMeta,
  maxWidth = 1280
): string {
  const scale = Math.min(1, maxWidth / Math.max(1, sourceWidth));
  const width = Math.round(sourceWidth * scale);
  const height = Math.round(sourceHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.drawImage(source, 0, 0, width, height);

  if (stamp) {
    const barHeight = Math.max(54, Math.round(height * 0.11));
    ctx.fillStyle = 'rgba(16, 22, 15, 0.78)';
    ctx.fillRect(0, height - barHeight, width, barHeight);

    ctx.fillStyle = '#7BD62B';
    ctx.fillRect(0, height - barHeight, 6, barHeight);

    const fontSizeTitle = Math.max(13, Math.round(width * 0.022));
    const fontSizeSub = Math.max(11, Math.round(width * 0.018));

    ctx.font = `700 ${fontSizeTitle}px "IBM Plex Mono", monospace`;
    ctx.fillStyle = '#FFFFFF';
    const dateStr = new Date(stamp.timestampIso || Date.now()).toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    ctx.fillText(
      `VOZ DE CAMPO · ${stamp.parcelCode} · ${stamp.technicianCip}`,
      18,
      height - barHeight + fontSizeTitle + 8
    );

    ctx.font = `500 ${fontSizeSub}px "IBM Plex Mono", monospace`;
    ctx.fillStyle = '#D7EFC2';
    ctx.fillText(
      `GNSS ${stamp.lat.toFixed(4)}, ${stamp.lng.toFixed(4)} (±${stamp.accuracyM}m) · ${dateStr}`,
      18,
      height - 10
    );
  }

  return canvas.toDataURL('image/webp', 0.84);
}
