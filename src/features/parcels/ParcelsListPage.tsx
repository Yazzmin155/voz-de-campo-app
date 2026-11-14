import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Mic,
  Search,
  ShieldAlert
} from 'lucide-react';
import { db } from '@/lib/db';
import { triggerHaptic } from '@/lib/sensors';
import { ImageWithFallback } from '@/components/ui/ImageWithFallback';

type FilterMode = 'all' | 'alerts' | 'ready';

export const ParcelsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');

  const parcels = useLiveQuery(() => db.parcels.orderBy('routeOrder').toArray(), []) ?? [];
  const producers = useLiveQuery(() => db.producers.toArray(), []) ?? [];

  const filtered = parcels.filter((p) => {
    const matchesSearch =
      !query.trim() ||
      p.code.toLowerCase().includes(query.toLowerCase()) ||
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.producerName.toLowerCase().includes(query.toLowerCase()) ||
      p.crop.toLowerCase().includes(query.toLowerCase());

    if (!matchesSearch) return false;
    if (filter === 'alerts') return p.complianceStatus !== 'pass';
    if (filter === 'ready') return p.complianceStatus === 'pass';
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-app-ink">
            Parcelas
          </h1>
          <p className="text-xs text-app-muted">
            Toca una parcela para ver su croquis o registrar visita
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic(12);
            navigate('/visitas/nueva');
          }}
          className="px-3.5 py-2.5 btn-duo-primary text-xs inline-flex items-center gap-1.5"
        >
          <Mic className="w-4 h-4" />
          <span>Dictar visita</span>
        </button>
      </div>

      {/* Buscador y Filtros */}
      <div className="card-duo p-3.5 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-app-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar parcela, productor o cultivo…"
            className="w-full h-11 pl-10 pr-4 rounded-2xl bg-app-surface-2 border border-app-hairline text-sm font-semibold text-app-ink focus:outline-none focus:border-[#58A700]"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: `Todas (${parcels.length})` },
            {
              id: 'alerts',
              label: `Por atender (${parcels.filter((p) => p.complianceStatus !== 'pass').length})`
            },
            {
              id: 'ready',
              label: `Listas (${parcels.filter((p) => p.complianceStatus === 'pass').length})`
            }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id as FilterMode)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-colors shrink-0 ${
                filter === tab.id
                  ? 'bg-[#58A700] text-white'
                  : 'bg-app-surface-2 text-app-muted hover:text-app-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Parcelas */}
      <div className="space-y-3.5">
        {filtered.map((parcel) => {
          const producer = producers.find((pr) => pr.id === parcel.producerId);
          const statusBadge = {
            critical: {
              text: 'Riesgo de carencia',
              cls: 'bg-[#D64545] text-white',
              icon: ShieldAlert
            },
            warning: {
              text: 'Revisar riego',
              cls: 'bg-[#FFC800] text-[#1B2A1F]',
              icon: AlertTriangle
            },
            pass: {
              text: 'Lista para acopio',
              cls: 'bg-[#58A700] text-white',
              icon: CheckCircle2
            }
          }[parcel.complianceStatus];

          const BadgeIcon = statusBadge.icon;

          return (
            <div key={parcel.id} className="card-duo overflow-hidden">
              <Link to={`/parcelas/${parcel.id}`} className="block relative h-36">
                <ImageWithFallback
                  src={parcel.imageUrl}
                  alt={parcel.name}
                  fallbackLabel={parcel.crop}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full bg-white/95 text-[#1B2A1F] text-xs font-extrabold">
                    {parcel.crop} · {parcel.areaHa} ha
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-extrabold inline-flex items-center gap-1 ${statusBadge.cls}`}
                  >
                    <BadgeIcon className="w-3.5 h-3.5" />
                    <span>{statusBadge.text}</span>
                  </span>
                </div>
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <h2 className="font-display font-extrabold text-lg leading-tight">
                    {parcel.name}
                  </h2>
                  <p className="text-xs text-white/85">
                    {producer?.community || 'Parcela registrada'} · {parcel.stage}
                  </p>
                </div>
              </Link>

              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ImageWithFallback
                      src={producer?.avatarUrl || '/media/avatar-productor.webp'}
                      alt={parcel.producerName}
                      fallbackType="avatar"
                      fallbackLabel={parcel.producerName}
                      className="w-9 h-9 rounded-full object-cover border border-app-hairline"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-app-ink truncate">
                        {parcel.producerName}
                      </div>
                      <div className="text-[11px] text-app-muted flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#58A700]" />
                        <span>{parcel.irrigationType}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[11px] font-bold text-app-muted block">Puntaje</span>
                    <span className="font-display font-extrabold text-sm text-[#58A700] dark:text-[#7BD62B]">
                      {parcel.complianceScore}/100
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Link
                    to={`/parcelas/${parcel.id}`}
                    className="py-2.5 btn-duo-secondary text-xs text-center"
                  >
                    Ver ficha
                  </Link>
                  <button
                    type="button"
                    onClick={() => navigate(`/visitas/nueva/${parcel.id}`)}
                    className="py-2.5 btn-duo-primary text-xs inline-flex items-center justify-center gap-1.5"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Registrar visita</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
