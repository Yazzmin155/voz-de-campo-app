import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Flashlight,
  ImagePlus,
  RefreshCw,
  ShieldCheck,
  X
} from 'lucide-react';
import {
  classifyMediaError,
  EvidenceStampMeta,
  SensorErrorDetail,
  stampEvidenceOnCanvas,
  triggerHaptic
} from '@/lib/sensors';
import { compressImageFile } from '@/lib/utils';

interface CameraCaptureModalProps {
  open: boolean;
  stampMeta: EvidenceStampMeta;
  onClose: () => void;
  onCapturePhoto: (dataUrl: string, stamped: boolean) => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  open,
  stampMeta,
  onClose,
  onCapturePhoto
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [burnStamp, setBurnStamp] = useState(true);
  const [cameraError, setCameraError] = useState<SensorErrorDetail | null>(null);
  const [starting, setStarting] = useState(false);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async (mode: 'environment' | 'user') => {
    stopCameraStream();
    setCameraError(null);
    setStarting(true);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setStarting(false);
      setCameraError({
        code: 'MediaDevicesUnsupported',
        title: 'Vista previa de cámara no disponible en este navegador',
        instructions: 'Usa el botón de abajo para abrir la cámara nativa o elegir una foto.'
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      const track = stream.getVideoTracks()[0];
      const caps = track && typeof (track as any).getCapabilities === 'function'
        ? (track as any).getCapabilities()
        : {};
      setTorchSupported(Boolean(caps?.torch));
      setTorchOn(false);
    } catch (err) {
      setCameraError(classifyMediaError(err, 'cámara'));
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    if (open) {
      startCamera(facingMode);
    } else {
      stopCameraStream();
    }
    return () => {
      stopCameraStream();
    };
  }, [open, facingMode]);

  if (!open) return null;

  const handleToggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()?.[0] as any;
    if (!track || !torchSupported) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch {
      // Ignorar si falla el hardware
    }
  };

  const handleTakeSnapshot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    triggerHaptic(18);
    const stampedUrl = stampEvidenceOnCanvas(
      video,
      video.videoWidth,
      video.videoHeight,
      burnStamp ? stampMeta : undefined
    );
    if (stampedUrl) {
      stopCameraStream();
      onCapturePhoto(stampedUrl, burnStamp);
      onClose();
    }
  };

  const handleFallbackFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(
        file,
        1100,
        burnStamp ? stampMeta : undefined
      );
      stopCameraStream();
      onCapturePhoto(dataUrl, burnStamp);
      onClose();
    } catch {
      // Ignorar
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Cámara de evidencia en campo"
    >
      <div className="w-full max-w-md bg-app-surface border-t-2 sm:border-2 border-app-hairline rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl">
        {/* Cabecera */}
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-app-hairline">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#58A700]" />
            <span className="font-display font-extrabold text-base text-app-ink">
              Cámara de Evidencia
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-app-muted hover:bg-app-surface-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Visor o mensaje de respaldo */}
          {!cameraError ? (
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-4/3 flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Guía de encuadre */}
              <div className="pointer-events-none absolute inset-5 border-2 border-white/45 rounded-2xl" />
              {burnStamp && (
                <div className="pointer-events-none absolute bottom-2 inset-x-2 bg-black/75 text-white px-3 py-1.5 rounded-xl font-mono-tech text-[10px] flex items-center justify-between">
                  <span>
                    {stampMeta.parcelCode} · {stampMeta.technicianCip}
                  </span>
                  <span className="text-[#7BD62B]">
                    GPS ±{stampMeta.accuracyM}m
                  </span>
                </div>
              )}

              <div className="absolute top-3 right-3 flex items-center gap-2">
                {torchSupported && (
                  <button
                    type="button"
                    onClick={handleToggleTorch}
                    className="p-2 rounded-full bg-black/60 text-white"
                    title="Linterna"
                  >
                    <Flashlight className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))
                  }
                  className="p-2 rounded-full bg-black/60 text-white"
                  title="Cambiar cámara"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-app-surface-2 border border-app-hairline space-y-2 text-xs">
              <div className="flex items-center gap-2 text-[#D64545] font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{cameraError.title}</span>
              </div>
              <p className="text-app-muted">{cameraError.instructions}</p>
              <div className="font-mono-tech text-[11px] text-app-muted">
                Código: {cameraError.code}
              </div>
            </div>
          )}

          {/* Switch Sello de Evidencia */}
          <label className="flex items-center justify-between p-3 rounded-2xl bg-app-surface-2 cursor-pointer">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#58A700]" />
              <div className="text-xs">
                <div className="font-bold text-app-ink">
                  Estampar sello de evidencia en la foto
                </div>
                <div className="text-[11px] text-app-muted">
                  Graba lote, cédula, fecha y GPS directo en la imagen
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={burnStamp}
              onChange={(e) => setBurnStamp(e.target.checked)}
              className="w-4 h-4 accent-[#58A700]"
            />
          </label>

          {/* Acciones */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {!cameraError && (
              <button
                type="button"
                disabled={starting}
                onClick={handleTakeSnapshot}
                className="py-3.5 px-4 btn-duo-primary text-xs inline-flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                <span>Capturar fotografía</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="py-3.5 px-4 btn-duo-secondary text-xs inline-flex items-center justify-center gap-2"
            >
              <ImagePlus className="w-4 h-4 text-[#58A700]" />
              <span>Abrir cámara nativa / Galería</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFallbackFile}
              className="sr-only"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
