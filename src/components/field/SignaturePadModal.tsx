import React, { useEffect, useRef, useState } from 'react';
import { Check, Eraser, PenTool, X } from 'lucide-react';
import { triggerHaptic } from '@/lib/sensors';

interface SignaturePadModalProps {
  open: boolean;
  producerName: string;
  parcelCode: string;
  onClose: () => void;
  onSaveSignature: (signatureDataUrl: string) => void;
}

export const SignaturePadModal: React.FC<SignaturePadModalProps> = ({
  open,
  producerName,
  parcelCode,
  onClose,
  onSaveSignature
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1B2A1F';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setHasStrokes(false);
  }, [open]);

  if (!open) return null;

  const getCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasStrokes(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
  };

  const handleSimulateQuickSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#1B2A1F';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(60, 120);
    ctx.bezierCurveTo(110, 60, 160, 150, 210, 90);
    ctx.bezierCurveTo(250, 50, 290, 135, 360, 100);
    ctx.stroke();

    ctx.font = '600 13px "IBM Plex Mono", monospace';
    ctx.fillStyle = '#58A700';
    ctx.fillText(`Conformidad en parcela · ${parcelCode}`, 60, 165);
    setHasStrokes(true);
    triggerHaptic(12);
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    triggerHaptic([12, 30, 18]);
    onSaveSignature(canvas.toDataURL('image/png'));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Firma de conformidad del productor"
    >
      <div className="w-full max-w-md bg-app-surface border-t-2 sm:border-2 border-app-hairline rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#58A700]/15 text-[#58A700] flex items-center justify-center">
              <PenTool className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-extrabold text-base text-app-ink">
                Firma del Productor
              </h3>
              <p className="text-xs text-app-muted">
                {producerName} · {parcelCode}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-app-muted hover:bg-app-surface-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="rounded-2xl overflow-hidden border-2 border-dashed border-[#58A700]/50 bg-white relative">
          <canvas
            ref={canvasRef}
            width={440}
            height={190}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className="w-full h-44 touch-none cursor-crosshair block"
          />
          {!hasStrokes && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold text-neutral-400">
              Firma aquí con el dedo o toca “Firma rápida de prueba”
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleClear}
            className="px-3 py-2 rounded-xl bg-app-surface-2 text-app-ink text-xs font-bold inline-flex items-center gap-1.5"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Limpiar</span>
          </button>

          <button
            type="button"
            onClick={handleSimulateQuickSignature}
            className="px-3 py-2 rounded-xl bg-app-tint text-[#58A700] dark:text-[#7BD62B] text-xs font-bold"
          >
            Firma rápida de prueba
          </button>
        </div>

        <button
          type="button"
          disabled={!hasStrokes}
          onClick={handleConfirm}
          className="w-full py-3.5 btn-duo-primary text-sm inline-flex items-center justify-center gap-2 disabled:opacity-45"
        >
          <Check className="w-4 h-4" />
          <span>Guardar firma en la bitácora</span>
        </button>
      </div>
    </div>
  );
};
