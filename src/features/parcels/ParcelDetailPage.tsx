import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  Bot,
  Calendar,
  CheckCircle2,
  Droplets,
  Mic,
  PenTool,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Volume2
} from 'lucide-react';
import { ParcelLeafletMap } from '@/components/map/ParcelLeafletMap';
import { ImageWithFallback } from '@/components/ui/ImageWithFallback';
import { db, useAppStore } from '@/lib/db';
import { LatLngVertex } from '@/lib/geo';
import { formatDateShort, formatDateTime } from '@/lib/utils';
import { ParcelPolygonPoint } from '@/types/domain';

export const ParcelDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { openCopilot, pushToast } = useAppStore();
  const [tab, setTab] = useState<'resumen' | 'bitacoras' | 'escudo'>('resumen');

  const parcel = useLiveQuery(() => (id ? db.parcels.get(id) : undefined), [id]);
  const producer = useLiveQuery(
    () => (parcel ? db.producers.get(parcel.producerId) : undefined),
    [parcel?.producerId]
  );
  const visits =
    useLiveQuery(
      async () => {
        if (!id) return [];
        return db.visits.where('parcelId').equals(id).reverse().sortBy('visitedAt');
      },
      [id]
    ) ?? [];
  const passports =
    useLiveQuery(
      async () => {
        if (!id) return [];
        return db.passports.where('parcelId').equals(id).toArray();
      },
      [id]
    ) ?? [];

  if (!parcel) {
    return (
      <div className="card-duo p-8 text-center space-y-3">
        <p className="text-sm font-extrabold text-app-ink">Parcela no encontrada</p>
        <Link
          to="/parcelas"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 btn-duo-primary text-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a parcelas</span>
        </Link>
      </div>
    );
  }

  const latestVisit = visits[0];

  const handleSaveCroquis = async (
    geoVertices: LatLngVertex[],
    normalized: ParcelPolygonPoint[],
    newAreaHa: number
  ) => {
    await db.parcels.update(parcel.id, {
      geoPolygon: geoVertices,
      polygon: normalized,
      areaHa: newAreaHa
    });
    pushToast({
      title: 'Croquis guardado en el teléfono',
      description: `Superficie medida: ${newAreaHa} ha.`,
      tone: 'success'
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link
          to="/parcelas"
          className="inline-flex items-center gap-1.5 text-xs font-extrabold text-app-muted hover:text-app-ink"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Parcelas</span>
        </Link>

        <button
          type="button"
          onClick={() => openCopilot(parcel.id)}
          className="px-3 py-1.5 rounded-full bg-[#0F62FE]/12 text-[#0F62FE] text-xs font-extrabold inline-flex items-center gap-1.5"
        >
          <Bot className="w-3.5 h-3.5" />
          <span>Preguntar al copiloto</span>
        </button>
      </div>

      {/* Tarjeta Hero */}
      <div className="card-duo overflow-hidden">
        <div className="relative h-44">
          <ImageWithFallback
            src={parcel.imageUrl}
            alt={parcel.name}
            fallbackLabel={parcel.crop}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            <span className="px-3 py-1 rounded-full bg-white/95 text-[#1B2A1F] text-xs font-extrabold">
              {parcel.crop} · {parcel.areaHa} ha
            </span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                parcel.complianceStatus === 'critical'
                  ? 'bg-[#D64545] text-white'
                  : parcel.complianceStatus === 'warning'
                    ? 'bg-[#FFC800] text-[#1B2A1F]'
                    : 'bg-[#58A700] text-white'
              }`}
            >
              Escudo {parcel.complianceScore}/100
            </span>
          </div>

          <div className="absolute bottom-3 left-3 right-3 text-white">
            <h1 className="font-display font-extrabold text-2xl leading-tight">
              {parcel.name}
            </h1>
            <p className="text-xs text-white/85">
              Productor: {parcel.producerName} · {producer?.community}
            </p>
          </div>
        </div>

        {/* Control segmentado */}
        <div className="p-3 bg-app-surface-2 border-b border-app-hairline grid grid-cols-3 gap-1.5">
          {[
            { id: 'resumen', label: 'Croquis' },
            { id: 'bitacoras', label: `Visitas (${visits.length})` },
            { id: 'escudo', label: 'Escudo y QR' }
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as typeof tab)}
              className={`py-2 rounded-xl text-xs font-extrabold transition-colors ${
                tab === t.id
                  ? 'bg-app-surface text-[#58A700] dark:text-[#7BD62B] shadow-2xs'
                  : 'text-app-muted hover:text-app-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-4">
          {tab === 'resumen' && (
            <div className="space-y-4">
              {/* Mapa real del lote con dibujo de croquis (Leaflet + OpenStreetMap) */}
              <ParcelLeafletMap parcel={parcel} onSavePolygon={handleSaveCroquis} />

              <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-app-muted px-1">
                <span>Los mapas visitados quedan guardados para consulta sin señal.</span>
                <span className="text-[#58A700] dark:text-[#7BD62B] font-extrabold shrink-0">
                  {parcel.areaHa} ha
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-app-surface-2 border border-app-hairline">
                  <span className="font-bold text-app-muted flex items-center gap-1">
                    <Droplets className="w-3.5 h-3.5 text-[#58A700]" />
                    Riego y suelo
                  </span>
                  <strong className="text-sm text-app-ink block mt-1">
                    {parcel.irrigationType}
                  </strong>
                  <span className="text-[11px] text-app-muted">{parcel.soilType}</span>
                </div>

                <div className="p-3 rounded-2xl bg-app-surface-2 border border-app-hairline">
                  <span className="font-bold text-app-muted flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[#58A700]" />
                    Cosecha estimada
                  </span>
                  <strong className="text-sm text-app-ink block mt-1">
                    {formatDateShort(parcel.plannedHarvestDate)}
                  </strong>
                  <span className="text-[11px] text-app-muted">{parcel.stage}</span>
                </div>
              </div>
            </div>
          )}

          {tab === 'bitacoras' && (
            <div className="space-y-3">
              {visits.map((v) => (
                <div
                  key={v.id}
                  className="p-3.5 rounded-2xl bg-app-surface-2 border border-app-hairline space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-app-ink">
                      {v.agrochemicalProduct || 'Recorrido de campo'}
                    </span>
                    <span className="text-[11px] font-bold text-app-muted">
                      {formatDateTime(v.visitedAt)}
                    </span>
                  </div>

                  <p className="text-xs text-app-muted italic">“{v.voiceTranscript}”</p>

                  {v.audioClipDataUrl && (
                    <div className="flex items-center gap-2 pt-1">
                      <Volume2 className="w-4 h-4 text-[#58A700] shrink-0" />
                      <audio controls src={v.audioClipDataUrl} className="h-8 w-full" />
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2 rounded-xl bg-app-surface border border-app-hairline">
                      <span className="text-[10px] text-app-muted block">Dosis</span>
                      <strong>
                        {v.dosePerHa ?? 0} {v.doseUnit || ''}
                      </strong>
                    </div>
                    <div className="p-2 rounded-xl bg-app-surface border border-app-hairline">
                      <span className="text-[10px] text-app-muted block">Espera</span>
                      <strong>
                        {v.daysBeforeHarvest}d / {v.requiredPhiDays}d
                      </strong>
                    </div>
                    <div className="p-2 rounded-xl bg-app-surface border border-app-hairline">
                      <span className="text-[10px] text-app-muted block">Riego</span>
                      <strong>{v.waterVolumeM3 ?? 0} m³</strong>
                    </div>
                  </div>

                  {v.signatureDataUrl && (
                    <div className="flex items-center gap-2 pt-1 text-[11px] font-bold text-[#58A700]">
                      <PenTool className="w-3.5 h-3.5" />
                      <span>Firmado en parcela por {v.producerConfirmationName}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === 'escudo' && (
            <div className="space-y-3">
              {latestVisit?.compliance.checks.map((chk) => (
                <div
                  key={chk.ruleCode}
                  className="p-3.5 rounded-2xl bg-app-surface-2 border border-app-hairline space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-app-ink flex items-center gap-1.5">
                      {chk.severity === 'critical' ? (
                        <ShieldAlert className="w-4 h-4 text-[#D64545]" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-[#58A700]" />
                      )}
                      {chk.title}
                    </span>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-app-surface text-app-muted">
                      {chk.authority}
                    </span>
                  </div>
                  <p className="text-xs text-app-muted">{chk.message}</p>
                  <p className="text-xs font-bold text-[#58A700] dark:text-[#7BD62B]">
                    Recomendación: {chk.recommendation}
                  </p>
                </div>
              ))}

              {passports.map((pass) => (
                <Link
                  key={pass.id}
                  to={`/pasaportes/${pass.id}`}
                  className="flex items-center justify-between p-4 rounded-2xl bg-[#58A700] text-white font-bold"
                >
                  <div className="flex items-center gap-3">
                    <QrCode className="w-6 h-6 text-[#FFC800]" />
                    <div>
                      <div className="text-xs opacity-90">{pass.id}</div>
                      <div className="text-sm font-extrabold">Abrir Pasaporte QR</div>
                    </div>
                  </div>
                  <ShieldCheck className="w-5 h-5" />
                </Link>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => navigate(`/visitas/nueva/${parcel.id}`)}
            className="w-full py-3.5 px-4 btn-duo-primary text-sm inline-flex items-center justify-center gap-2"
          >
            <Mic className="w-4 h-4" />
            <span>Registrar nueva visita en {parcel.name}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
