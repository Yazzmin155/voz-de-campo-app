import { PassportCanonicalPayload } from '@/types/domain';

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    const ordered: Record<string, unknown> = {};
    for (const [k, v] of entries) {
      ordered[k] = sortObjectKeys(v);
    }
    return ordered;
  }
  return value;
}

export function canonicalizePassportPayload(payload: PassportCanonicalPayload): string {
  return JSON.stringify(sortObjectKeys(payload));
}

function fallbackDeterministicHash(input: string): string {
  // Fallback determinista de 256 bits (8 bloques de 32 bits) si Web Crypto no está disponible
  const seeds = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    for (let j = 0; j < 8; j++) {
      seeds[j] = Math.imul(seeds[j] ^ (code + j * 31 + i), 0x01000193) >>> 0;
    }
  }
  return seeds.map((n) => n.toString(16).padStart(8, '0')).join('');
}

export async function computeSha256Hex(canonicalText: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(canonicalText));
      return Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // Usar fallback determinista
  }
  return fallbackDeterministicHash(canonicalText);
}

export interface SignedQrEnvelope {
  p: PassportCanonicalPayload;
  h: string;
}

export function encodePassportEnvelopeToBase64Url(envelope: SignedQrEnvelope): string {
  const json = JSON.stringify(envelope);
  const utf8Bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of utf8Bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodePassportEnvelopeFromBase64Url(token: string): SignedQrEnvelope | null {
  try {
    const clean = token.trim().replace(/-/g, '+').replace(/_/g, '/');
    const pad = clean.length % 4 === 0 ? '' : '='.repeat(4 - (clean.length % 4));
    const binary = atob(clean + pad);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as SignedQrEnvelope;
    if (!parsed || typeof parsed.h !== 'string' || !parsed.p?.passportId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function buildPassportVerificationUrl(
  origin: string,
  payload: PassportCanonicalPayload,
  sha256Hash: string
): string {
  const token = encodePassportEnvelopeToBase64Url({ p: payload, h: sha256Hash });
  return `${origin.replace(/\/$/, '')}/verificar?d=${token}`;
}
