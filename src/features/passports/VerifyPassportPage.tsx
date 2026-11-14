import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ClipboardPaste,
  Loader2,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  X
} from 'lucide-react';
import { BrandWordmark } from '@/components/brand/BrandWordmark';
import {
  canonicalizePassportPayload,
  computeSha256Hex,
  decodePassportEnvelopeFromBase64Url,
  SignedQrEnvelope
} from '@/lib/crypto';
import { db } from '@/lib/db';
import { triggerHaptic } from '@/lib/sensors';
import { useLiveQuery } from 'dexie-react-hooks';

type VerifyStatus = 'idle' | 'checking' | 'valid' | 'invalid' | 'error';

function extractToken(raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  if (value.includes('?d=')) {
    return value.split('?d=')[1].split('&')[0];
  }
  try {
    const url = new URL(value);
    const token = url.searchParams.get('d');
    if (token) return token;
  } catch {
    // No es una URL; se asume que ya es el token.
  }
  return value;
}

export const VerifyPassportPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialToken = searchParams.get('d') || '';

  const localPassports = useLiveQuery(() => db.passports.toArray(), []) ?? [];

  const [input, setInput] = useState(initialToken);
  const [status, setStatus] = useState<VerifyStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [original, setOriginal] = useState<SignedQrEnvelope | null>(null);
  const [envelope, setEnvelope] = useState<SignedQrEnvelope | null>(null);
  const [computedHash, setComputedHash] = useState('');
  const [tampered, setTampered] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanError, setScanError] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const runVerification = async (raw: string) => {
    const token = extractToken(raw);
    if (!token) {
      setStatus('error');
      setErrorMessage('Pega el enlace del pasaporte o escanea su código QR.');
      return;
    }

    setStatus('checking');
    setTampered(false);
    const decoded = decodePassportEnvelopeFromBase64Url(token);
    if (!decoded) {
      setEnvelope(null);
      setStatus('error');
      setErrorMessage('Ese código no es un pasaporte de Voz de Campo, o está incompleto.');
      triggerHaptic([8, 40, 8]);
      return;
    }

    const hash = await computeSha256Hex(canonicalizePassportPayload(decoded.p));
    setOriginal(decoded);
    setEnvelope(decoded);
    setComputedHash(hash);
    setStatus(hash === decoded.h ? 'valid' : 'invalid');
    triggerHaptic(hash === decoded.h ? [10, 20, 10] : [8, 40, 8]);
  };

  useEffect(() => {
    if (initialToken) {
      void runVerification(initialToken);
    }
    // Solo al abrir con un enlace que ya trae el pasaporte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escáner QR con la cámara del teléfono (Chrome Android, Safari reciente)
  useEffect(() => {
    if (!scanOpen) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;

    const start = async () => {
      const Detector = (window as unknown as { BarcodeDetector?: any }).BarcodeDetector;
      if (!Detector) {
        setScanError(
          'Este navegador no puede leer QR con la cámara. Pega el enlace o abre el QR con la cámara del sistema.'
        );
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setScanError('La cámara solo está disponible en HTTPS o dentro de la app instalada.');
        return;
      }

      try {
        const detector = new Detector({ formats: ['qr_code'] });
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        if (cancelled || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const loop = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes?.[0]?.rawValue as string | undefined;
            if (value) {
              setScanOpen(false);
              setInput(value);
              await runVerification(value);
              return;
            }
          } catch {
            // Ignorar fotogramas sin lectura y seguir intentando.
          }
          raf = requestAnimationFrame(loop);
        };
        void loop();
      } catch {
        setScanError('No pudimos abrir la cámara. Revisa el permiso en los ajustes del teléfono.');
      }
    };

    void start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanOpen]);

  const restoreLegitimate = async () => {
    if (!original) return;
    setTampered(false);
    const hash = await computeSha256Hex(canonicalizePassportPayload(original.p));
    setEnvelope(original);
    setComputedHash(hash);
    setStatus(hash === original.h ? 'valid' : 'invalid');
    triggerHaptic(10);
  };

  const simulateTamper = async () => {
    if (!original) return;
    const altered: SignedQrEnvelope = {
      p: { ...original.p, daysBeforeHarvest: original.p.daysBeforeHarvest - 9 },
      h: original.h
    };
    const hash = await computeSha256Hex(canonicalizePassportPayload(altered.p));
    setEnvelope(altered);
    setComputedHash(hash);
    setTampered(true);
    setStatus('invalid');
    triggerHaptic([8, 40, 8]);
  };

  const isAuthentic = status === 'valid';

  return (
    <div className="h-dvh w-full bg-app-canvas text-app-ink flex justify-center overflow-hidden">
      <div className="w-full max-w-[520px] h-dvh flex flex-col overflow-y-auto app-scroll px-4 pt-safe-top pb-safe">
        <div className="flex items-center justify-between py-3">
          <BrandWordmark size="sm" />
          <Link
            to="/inicio"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--brand)]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Abrir app</span>
          </Link>
        </div>

        <div className="space-y-3.5 pb-6">
          <div className="space-y-1">
            <h1 className="font-display font-extrabold text-2xl leading-tight">
              Verificador de pasaportes
            </h1>
            <p className="text-xs text-app-muted leading-relaxed">
              Comprueba con el sello SHA-256 que los datos de un lote no fueron alterados después de
              su emisión. No hace falta conexión.
            </p>
          </div>

          <div className="card-duo p-4 space-y-3">
            <label htmlFor="verify-input" className="text-xs font-bold text-app-muted block">
              Enlace o código del pasaporte
            </label>
            <textarea
              id="verify-input"
              rows={3}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setStatus('idle');
              }}
              placeholder="https://…/verificar?d=eyJwIjo…"
              className="field-input h-auto min-h-20 py-2.5 resize-none font-mono-tech text-[11px] leading-relaxed"
            />

            <div className="grid grid-cols-[1fr_auto] gap-2">
              <button
                type="button"
                onClick={() => void runVerification(input)}
                disabled={status === 'checking'}
                className="py-2.5 btn-duo-primary text-xs inline-flex items-center justify-center gap-1.5"
              >
                {status === 'checking' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                <span>Verificar sello</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    setInput(text);
                    await runVerification(text);
                  } catch {
                    setStatus('error');
                    setErrorMessage(
                      'El navegador no permite leer el portapapeles. Mantén pegado el enlace manualmente.'
                    );
                  }
                }}
                aria-label="Pegar desde el portapapeles"
                className="w-11 h-11 rounded-xl bg-app-surface-2 text-app-ink inline-flex items-center justify-center"
              >
                <ClipboardPaste className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setScanError('');
                setScanOpen(true);
              }}
              className="w-full py-2.5 rounded-xl bg-app-surface-2 text-xs font-bold text-app-ink inline-flex items-center justify-center gap-1.5"
            >
              <Camera className="w-4 h-4 text-[var(--brand)]" />
              <span>Escanear el QR con la cámara</span>
            </button>
          </div>

          {status === 'error' && (
            <div
              role="alert"
              className="px-3.5 py-3 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-xs font-semibold text-[var(--danger-dark)] dark:text-[var(--danger)]"
            >
              {errorMessage}
            </div>
          )}

          {envelope && (
            <div
              className={`card-duo p-4 space-y-3.5 border-2 ${
                isAuthentic ? 'border-[var(--brand)]' : 'border-[var(--danger)]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    isAuthentic
                      ? 'bg-[var(--brand)]/15 text-[var(--brand)]'
                      : 'bg-[var(--danger)]/12 text-[var(--danger)]'
                  }`}
                >
                  {isAuthentic ? (
                    <ShieldCheck className="w-6 h-6" />
                  ) : (
                    <ShieldAlert className="w-6 h-6" />
                  )}
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-extrabold uppercase tracking-wide text-app-muted">
                    Resultado
                  </span>
                  <h2 className="font-display font-extrabold text-lg leading-tight">
                    {isAuthentic ? 'Pasaporte íntegro' : 'Los datos no coinciden'}
                  </h2>
                  <p className="text-[11px] text-app-muted">
                    {isAuthentic
                      ? 'El contenido es idéntico al que se selló al emitir.'
                      : 'Al menos un dato cambió después de la emisión.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-app-surface-2 border border-app-hairline">
                  <span className="text-[10px] uppercase font-bold text-app-muted block">
                    Productor
                  </span>
                  <strong className="text-[13px] leading-tight">{envelope.p.producerName}</strong>
                </div>
                <div className="p-2.5 rounded-xl bg-app-surface-2 border border-app-hairline">
                  <span className="text-[10px] uppercase font-bold text-app-muted block">
                    Lote
                  </span>
                  <strong className="text-[13px] leading-tight">
                    {envelope.p.parcelName} ({envelope.p.parcelCode})
                  </strong>
                </div>
                <div className="p-2.5 rounded-xl bg-app-surface-2 border border-app-hairline">
                  <span className="text-[10px] uppercase font-bold text-app-muted block">
                    Cultivo
                  </span>
                  <strong className="text-[13px] leading-tight">
                    {envelope.p.crop} · {envelope.p.areaHa} ha
                  </strong>
                </div>
                <div className="p-2.5 rounded-xl bg-app-surface-2 border border-app-hairline">
                  <span className="text-[10px] uppercase font-bold text-app-muted block">
                    Carencia
                  </span>
                  <strong className="text-[13px] leading-tight">
                    {envelope.p.daysBeforeHarvest} d / norma {envelope.p.requiredPhiDays} d
                  </strong>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#0F1611] text-white font-mono-tech text-[10px] space-y-2 leading-relaxed">
                <div>
                  <span className="text-white/50 block text-[9px] mb-0.5">SELLO DEL QR</span>
                  <span className="text-[var(--brand-bright)] break-all">{envelope.h}</span>
                </div>
                <div className="pt-2 border-t border-white/10">
                  <span className="text-white/50 block text-[9px] mb-0.5">
                    RECALCULADO AQUÍ
                  </span>
                  <span
                    className={`break-all ${
                      isAuthentic ? 'text-[var(--brand-bright)]' : 'text-[#FF9E8A]'
                    }`}
                  >
                    {computedHash}
                  </span>
                </div>
              </div>

              {!isAuthentic && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/25 text-[11px] font-semibold text-[var(--danger-dark)] dark:text-[var(--danger)]">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    El hash cambió por completo: un solo dato alterado invalida todo el documento.
                    Si ves esto en un pasaporte real, no recibas el lote y avisa a tu cooperativa.
                  </span>
                </div>
              )}

              <div className="space-y-2 pt-1">
                {tampered ? (
                  <button
                    type="button"
                    onClick={() => void restoreLegitimate()}
                    className="w-full py-2.5 btn-duo-primary text-xs"
                  >
                    Restaurar el certificado legítimo
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void simulateTamper()}
                    className="w-full py-2.5 rounded-xl bg-app-surface-2 text-[11px] font-bold text-app-muted"
                  >
                    Demostrar qué pasa si alguien altera un dato
                  </button>
                )}
                <p className="text-[10px] text-app-muted leading-snug">
                  El sello SHA-256 prueba integridad del contenido. No equivale a una firma
                  electrónica avanzada ni a una certificación oficial.
                </p>
              </div>
            </div>
          )}

          {localPassports.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-app-muted uppercase tracking-wide">
                Pasaportes guardados en este teléfono
              </p>
              {localPassports.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    const token = p.qrVerificationData.split('?d=')[1] || '';
                    setInput(p.qrVerificationData);
                    void runVerification(token || p.qrVerificationData);
                  }}
                  className="w-full card-duo p-3 flex items-center gap-2.5 text-left"
                >
                  <QrCode className="w-4 h-4 text-[var(--brand)] shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-app-ink truncate">
                      {p.parcelName}
                    </span>
                    <span className="block text-[11px] text-app-muted">
                      {p.id} · {p.parcelCode}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {scanOpen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex items-center justify-between p-4 text-white">
            <span className="text-sm font-bold">Apunta al código QR</span>
            <button
              type="button"
              onClick={() => setScanOpen(false)}
              aria-label="Cerrar escáner"
              className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 relative flex items-center justify-center overflow-hidden">
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-60 h-60 border-2 border-[var(--brand-bright)] rounded-2xl" />
            </div>
            {scanError && (
              <div className="absolute inset-x-5 bottom-6 px-4 py-3 rounded-xl bg-white text-[#142418] text-xs font-semibold leading-relaxed">
                {scanError}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
