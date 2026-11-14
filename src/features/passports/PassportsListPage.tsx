import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Mic,
  QrCode,
  ShieldCheck
} from 'lucide-react';
import { db } from '@/lib/db';
import { formatDateShort } from '@/lib/utils';
import { ImageWithFallback } from '@/components/ui/ImageWithFallback';

export const PassportsListPage: React.FC = () => {
  const navigate = useNavigate();
  const passports =
    useLiveQuery(() => db.passports.orderBy('issuedAt').reverse().toArray(), []) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-app-ink">
            Pasaportes QR
          </h1>
          <p className="text-xs text-app-muted">
            Certificados listos para mostrar al comprador o centro de acopio
          </p>
        </div>

        <Link
          to="/verificar"
          className="px-3.5 py-2 btn-duo-secondary text-xs shrink-0"
        >
          Verificador QR
        </Link>
      </div>

      <div className="space-y-3.5">
        {passports.map((pass) => (
          <div key={pass.id} className="card-duo p-4 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono-tech text-xs font-extrabold px-2.5 py-1 rounded-full bg-app-surface-2 text-app-ink">
                {pass.id}
              </span>
              <span
                className={`text-xs font-extrabold px-2.5 py-1 rounded-full inline-flex items-center gap-1 ${
                  pass.status === 'valid'
                    ? 'bg-[#58A700]/15 text-[#58A700] dark:text-[#7BD62B]'
                    : 'bg-[#FFC800] text-[#1B2A1F]'
                }`}
              >
                {pass.status === 'valid' ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Válido SHA-256</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Requiere reemisión</span>
                  </>
                )}
              </span>
            </div>

            <div>
              <h2 className="font-display font-extrabold text-lg text-app-ink">
                {pass.crop} · {pass.lotWeightTons} toneladas ({pass.parcelName})
              </h2>
              <p className="text-xs text-app-muted mt-0.5">
                Productor: <strong>{pass.producerName}</strong> · {formatDateShort(pass.issuedAt)}
              </p>
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-app-surface-2 border border-app-hairline">
              <ImageWithFallback
                src={pass.buyerAvatarUrl}
                alt={pass.buyerName}
                fallbackType="avatar"
                fallbackLabel={pass.buyerName}
                className="w-9 h-9 rounded-full object-cover border border-app-hairline"
              />
              <div className="min-w-0">
                <div className="text-[10px] font-extrabold uppercase text-app-muted">
                  Destino / Recepción
                </div>
                <div className="text-xs font-bold text-app-ink truncate">
                  {pass.buyerName}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#58A700] dark:text-[#7BD62B]">
                <ShieldCheck className="w-4 h-4" />
                Escudo {pass.canonicalPayload.complianceScore}/100
              </span>

              <Link
                to={`/pasaportes/${pass.id}`}
                className="px-4 py-2.5 btn-duo-primary text-xs inline-flex items-center gap-1.5"
              >
                <QrCode className="w-4 h-4" />
                <span>Abrir certificado QR</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => navigate('/visitas/nueva')}
        className="w-full py-3.5 px-4 btn-duo-secondary text-xs inline-flex items-center justify-center gap-2"
      >
        <Mic className="w-4 h-4 text-[#58A700]" />
        <span>Registrar nueva visita para sellar otro lote</span>
      </button>
    </div>
  );
};
