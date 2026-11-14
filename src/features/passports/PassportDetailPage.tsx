import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { QRCodeCanvas } from 'qrcode.react';
import { motion } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  FileJson,
  FileText,
  Image as ImageIcon,
  Loader2,
  Share2,
  ShieldAlert,
  ShieldCheck,
  X
} from 'lucide-react';
import {
  buildPassportVerificationUrl,
  canonicalizePassportPayload,
  computeSha256Hex
} from '@/lib/crypto';
import { db, useAppStore } from '@/lib/db';
import {
  copyTextSafe,
  downloadBlobOrDataUrl,
  generatePassportCardPngDataUrl,
  generatePassportPdfBlob
} from '@/lib/passport-export';
import { triggerHaptic } from '@/lib/sensors';
import { formatDateTime } from '@/lib/utils';

type DownloadKind = 'pdf' | 'png' | 'json';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export const PassportDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { pushToast } = useAppStore();

  const [showAntiFraud, setShowAntiFraud] = useState(false);
  const [downloadSheetOpen, setDownloadSheetOpen] = useState(false);
  const [busyKind, setBusyKind] = useState<DownloadKind | null>(null);

  const [checkedHash, setCheckedHash] = useState<string | null>(null);
  const [integrityChecked, setIntegrityChecked] = useState(false);
  const [tamperDemo, setTamperDemo] = useState(false);

  const passport = useLiveQuery(() => (id ? db.passports.get(id) : undefined), [id]);

  if (passport === undefined) {
    return (
      <div className="card-duo p-8 flex items-center justify-center gap-2 text-sm text-app-muted">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Abriendo el pasaporte…</span>
      </div>
    );
  }

  if (!passport) {
    return (
      <div className="card-duo p-8 text-center space-y-3">
        <p className="text-sm font-bold text-app-ink">No encontramos ese pasaporte</p>
        <p className="text-xs text-app-muted">
          Puede que se haya borrado de este teléfono. Vuelve a la lista para ver los que sí existen.
        </p>
        <Link
          to="/pasaportes"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 btn-duo-primary text-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a pasaportes</span>
        </Link>
      </div>
    );
  }

  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://voz-de-campo.vercel.app';

  const qrValue =
    passport.qrVerificationData ||
    buildPassportVerificationUrl(origin, passport.canonicalPayload, passport.sha256Hash);

  const qrCanvas = () =>
    document.getElementById('passport-qr-canvas') as HTMLCanvasElement | null;

  const recomputeIntegrity = async (mutate = tamperDemo) => {
    triggerHaptic(10);
    const payload = mutate
      ? {
          ...passport.canonicalPayload,
          daysBeforeHarvest: passport.canonicalPayload.daysBeforeHarvest + 10
        }
      : passport.canonicalPayload;

    const canonical = canonicalizePassportPayload(payload);
    const hash = await computeSha256Hex(canonical);
    setCheckedHash(hash);
    setIntegrityChecked(true);
  };

  const handleToggleTamper = async () => {
    const next = !tamperDemo;
    setTamperDemo(next);
    await recomputeIntegrity(next);
    if (!showAntiFraud) setShowAntiFraud(true);
  };

  const handleCopyHash = async () => {
    const ok = await copyTextSafe(passport.sha256Hash);
    triggerHaptic(12);
    pushToast(
      ok
        ? {
            title: 'Sello SHA-256 copiado',
            description: passport.sha256Hash.slice(0, 28) + '…',
            tone: 'success'
          }
        : {
            title: 'No se pudo copiar',
            description: 'Selecciona el hash con el dedo y cópialo manualmente.',
            tone: 'warning'
          }
    );
  };

  const handleCopyLink = async () => {
    const ok = await copyTextSafe(qrValue);
    pushToast(
      ok
        ? { title: 'Enlace de verificación copiado', tone: 'success' }
        : { title: 'No se pudo copiar el enlace', tone: 'warning' }
    );
  };

  const saveOnDevice = async (
    content: Blob | string,
    filename: string,
    mimeDescription: string
  ) => {
    if (Capacitor.isNativePlatform()) {
      const base64 =
        typeof content === 'string'
          ? content.replace(/^data:[^;]+;base64,/, '')
          : await blobToBase64(content);
      const written = await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Documents,
        recursive: true
      });
      pushToast({
        title: 'Archivo guardado',
        description: `${mimeDescription} en Documentos/${filename}`,
        tone: 'success'
      });
      return written.uri;
    }

    downloadBlobOrDataUrl(content, filename);
    pushToast({
      title: 'Descarga iniciada',
      description: filename,
      tone: 'success'
    });
    return filename;
  };

  const handleDownload = async (kind: DownloadKind) => {
    if (busyKind) return;
    setBusyKind(kind);
    triggerHaptic(12);
    const baseName = `pasaporte-${passport.id}-${passport.parcelCode}`;

    try {
      if (kind === 'pdf') {
        const blob = await generatePassportPdfBlob(passport, qrCanvas());
        await saveOnDevice(blob, `${baseName}.pdf`, 'PDF A4');
      } else if (kind === 'png') {
        const dataUrl = await generatePassportCardPngDataUrl(passport, qrCanvas());
        await saveOnDevice(dataUrl, `${baseName}.png`, 'Imagen del pasaporte');
      } else {
        const json = JSON.stringify(passport, null, 2);
        await saveOnDevice(new Blob([json], { type: 'application/json' }), `${baseName}.json`, 'Datos y sello');
      }
      setDownloadSheetOpen(false);
    } catch (error) {
      pushToast({
        title: 'No se pudo generar el archivo',
        description: 'Vuelve a intentarlo. Si sigue fallando, comparte el enlace de verificación.',
        tone: 'danger'
      });
    } finally {
      setBusyKind(null);
    }
  };

  const handleShare = async () => {
    triggerHaptic(14);
    try {
      if (Capacitor.isNativePlatform()) {
        const blob = await generatePassportPdfBlob(passport, qrCanvas());
        const base64 = await blobToBase64(blob);
        const filename = `pasaporte-${passport.id}.pdf`;
        const written = await Filesystem.writeFile({
          path: filename,
          data: base64,
          directory: Directory.Cache
        });
        await Share.share({
          title: `Pasaporte ${passport.id} · ${passport.parcelName}`,
          text: `Lote verificado con sello SHA-256.`,
          url: written.uri,
          dialogTitle: 'Compartir pasaporte'
        });
        return;
      }

      const blob = await generatePassportPdfBlob(passport, qrCanvas());
      const file = new File([blob], `pasaporte-${passport.id}.pdf`, {
        type: 'application/pdf'
      });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `Pasaporte ${passport.id} · ${passport.parcelName}`,
          text: `Lote verificado con sello SHA-256 de Voz de Campo.`,
          files: [file]
        });
        return;
      }

      const ok = await copyTextSafe(qrValue);
      pushToast({
        title: ok ? 'Enlace de verificación copiado' : 'No se pudo compartir',
        description: ok ? 'Pégalo en WhatsApp para que comprueben el lote.' : undefined,
        tone: ok ? 'success' : 'warning'
      });
    } catch {
      pushToast({
        title: 'No se pudo compartir',
        description: 'Puedes descargar el PDF desde el menú de descargas.',
        tone: 'warning'
      });
    }
  };

  const isApproved = passport.canonicalPayload.complianceStatus === 'pass';
  const integrityOk = integrityChecked && checkedHash === passport.sha256Hash;

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/pasaportes"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-app-muted hover:text-app-ink"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Pasaportes</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleShare}
            aria-label="Compartir pasaporte"
            className="w-9 h-9 rounded-xl bg-app-surface-2 text-app-ink inline-flex items-center justify-center"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              setDownloadSheetOpen(true);
            }}
            className="px-3.5 py-2 btn-duo-primary text-xs inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar</span>
          </button>
        </div>
      </div>

      {/* Certificado */}
      <motion.div
        data-tour="passport-qr"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="card-duo overflow-hidden border border-app-hairline"
      >
        <div
          className={`p-4 ${
            isApproved
              ? 'bg-[var(--brand-dark)] text-white'
              : 'bg-[var(--danger-dark)] text-white'
          }`}
        >
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-white/75">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Pasaporte fitosanitario de lote</span>
          </div>
          <h1 className="font-display font-extrabold text-xl leading-tight mt-0.5">
            {passport.parcelName}
          </h1>
          <div className="flex items-center justify-between gap-3 mt-1.5">
            <p className="text-[11px] text-white/80">
              {passport.id} · {passport.crop} · {passport.canonicalPayload.areaHa} ha
            </p>
            <span className="shrink-0 px-2 py-0.5 rounded-full bg-white/15 text-[10px] font-extrabold">
              {isApproved ? 'APROBADO' : 'NO APTO'}
            </span>
          </div>
        </div>

        <div className="p-4 space-y-3.5">
          {/* QR sobre blanco puro, con logo al centro y corrección H para que siga escaneando */}
          <div className="flex flex-col items-center gap-2.5">
            <div className="relative bg-white p-3.5 rounded-2xl border border-app-hairline shadow-sm">
              <QRCodeCanvas
                id="passport-qr-canvas"
                value={qrValue}
                size={216}
                bgColor="#FFFFFF"
                fgColor="#0F1F14"
                level="H"
                includeMargin={false}
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-11 h-11 rounded-lg bg-white p-1 border-2 border-[var(--brand)] flex items-center justify-center">
                  <img
                    src="/brand/logo-mark.png"
                    alt=""
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            </div>

            <div className="text-center space-y-0.5">
              <p className="text-xs font-bold text-app-ink">
                Verificable sin internet desde cualquier teléfono
              </p>
              <p className="text-[11px] text-app-muted">
                El QR contiene los datos del lote y su sello de integridad SHA-256.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 w-full">
              <Link
                to={`/verificar?d=${encodeURIComponent(qrValue.split('?d=')[1] || '')}`}
                className="py-2.5 btn-duo-secondary text-[11px] inline-flex items-center justify-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[var(--brand)]" />
                <span>Abrir verificador</span>
              </Link>
              <button
                type="button"
                onClick={handleCopyLink}
                className="py-2.5 rounded-xl bg-app-surface-2 text-[11px] font-bold text-app-ink inline-flex items-center justify-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar enlace</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-app-surface-2 border border-app-hairline">
              <span className="text-[10px] uppercase font-bold text-app-muted block">Productor</span>
              <strong className="text-[13px] text-app-ink leading-tight">{passport.producerName}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-app-surface-2 border border-app-hairline">
              <span className="text-[10px] uppercase font-bold text-app-muted block">Volumen</span>
              <strong className="text-[13px] text-app-ink">
                {passport.lotWeightTons} t
              </strong>
            </div>
            <div className="p-2.5 rounded-xl bg-app-surface-2 border border-app-hairline">
              <span className="text-[10px] uppercase font-bold text-app-muted block">
                Último manejo
              </span>
              <strong className="text-[13px] text-app-ink leading-tight">
                {passport.canonicalPayload.agrochemicalProduct || 'Sin agroquímico'}
              </strong>
            </div>
            <div className="p-2.5 rounded-xl bg-app-surface-2 border border-app-hairline">
              <span className="text-[10px] uppercase font-bold text-app-muted block">
                Carencia
              </span>
              <strong className="text-[13px] text-[var(--brand)] dark:text-[var(--brand-bright)]">
                {passport.canonicalPayload.daysBeforeHarvest} d / norma{' '}
                {passport.canonicalPayload.requiredPhiDays} d
              </strong>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-app-muted px-0.5">
            <span>Emitido {formatDateTime(passport.issuedAt)}</span>
            <span>Vence {formatDateTime(passport.expiresAt)}</span>
          </div>

          {/* Sello y anti-fraude */}
          <div className="rounded-xl border border-app-hairline overflow-hidden">
            <button
              type="button"
              onClick={() => {
                setShowAntiFraud((v) => !v);
                if (!integrityChecked) void recomputeIntegrity(false);
              }}
              className="w-full px-3.5 py-2.5 bg-app-surface-2 flex items-center justify-between text-[11px] font-extrabold text-app-ink"
            >
              <span>Sello SHA-256 y prueba de integridad</span>
              {showAntiFraud ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showAntiFraud && (
              <div className="p-3.5 bg-[#0F1611] text-white space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono-tech text-[10px] font-bold text-[var(--brand-bright)] tracking-wide">
                    SELLO ORIGINAL
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyHash}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--amber)]"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar</span>
                  </button>
                </div>

                <div className="font-mono-tech text-[10px] break-all bg-black/40 p-2 rounded-lg border border-white/10 leading-relaxed">
                  {passport.sha256Hash}
                </div>

                <div className="font-mono-tech text-[10px] break-all bg-black/40 p-2 rounded-lg border border-white/10 leading-relaxed">
                  <span className="text-white/50 block text-[9px] mb-0.5">
                    RECALCULADO EN ESTE TELÉFONO
                  </span>
                  {checkedHash || 'Calculando…'}
                </div>

                {integrityOk ? (
                  <div className="flex items-start gap-1.5 text-[11px] font-bold text-[var(--brand-bright)]">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Coincide. Los datos del lote son exactamente los que se sellaron al emitir.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-start gap-1.5 text-[11px] font-bold text-[#FF9E8A]">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      No coincide. Alguien cambió al menos un dato después de la emisión.
                    </span>
                  </div>
                )}

                <div className="pt-1 border-t border-white/10 space-y-1.5">
                  <button
                    type="button"
                    onClick={() => void handleToggleTamper()}
                    className="w-full py-2 px-3 rounded-lg bg-white/10 text-[11px] font-bold text-white"
                  >
                    {tamperDemo
                      ? 'Restaurar el certificado legítimo'
                      : 'Ver cómo se detecta una alteración (demostración)'}
                  </button>
                  <p className="text-[10px] text-white/50 leading-snug">
                    SHA-256 demuestra que el contenido no cambió. No sustituye una firma
                    electrónica avanzada ni una validación oficial de SENASICA.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Hoja de descargas */}
      {downloadSheetOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
          onClick={() => setDownloadSheetOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[520px] bg-app-surface rounded-t-3xl p-4 space-y-2.5 pb-safe"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display font-extrabold text-base">Descargar el pasaporte</h2>
              <button
                type="button"
                onClick={() => setDownloadSheetOpen(false)}
                aria-label="Cerrar"
                className="w-8 h-8 rounded-full bg-app-surface-2 flex items-center justify-center text-app-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(
              [
                {
                  kind: 'pdf' as DownloadKind,
                  icon: FileText,
                  title: 'Documento PDF A4',
                  description: 'Para imprimir o enviar al comprador. Incluye QR y sello completo.'
                },
                {
                  kind: 'png' as DownloadKind,
                  icon: ImageIcon,
                  title: 'Imagen para WhatsApp',
                  description: 'Tarjeta vertical con los datos del lote y el QR.'
                },
                {
                  kind: 'json' as DownloadKind,
                  icon: FileJson,
                  title: 'Datos y sello (JSON)',
                  description: 'El registro técnico completo, por si necesitas respaldo.'
                }
              ]
            ).map((option) => {
              const Icon = option.icon;
              const loading = busyKind === option.kind;
              return (
                <button
                  key={option.kind}
                  type="button"
                  disabled={Boolean(busyKind)}
                  onClick={() => void handleDownload(option.kind)}
                  className="w-full card-duo p-3 flex items-start gap-3 text-left disabled:opacity-70"
                >
                  <span className="w-9 h-9 rounded-xl bg-[var(--brand)]/12 text-[var(--brand)] flex items-center justify-center shrink-0">
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-extrabold text-app-ink">{option.title}</span>
                    <span className="block text-[11px] text-app-muted leading-snug mt-0.5">
                      {option.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
