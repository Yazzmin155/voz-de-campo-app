import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { EvidenceStampMeta, stampEvidenceOnCanvas } from '@/lib/sensors';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateShort(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export async function compressImageFile(
  file: File,
  maxWidth = 1100,
  stamp?: EvidenceStampMeta
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagen inválido'));
      img.onload = () => {
        const result = stampEvidenceOnCanvas(img, img.width, img.height, stamp, maxWidth);
        resolve(result || String(reader.result));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
