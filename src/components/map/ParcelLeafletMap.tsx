import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Check,
  Compass,
  Layers,
  MapPin,
  PenTool,
  RotateCcw,
  Trash2,
  X
} from 'lucide-react';
import {
  computePolygonAreaHa,
  computePolygonPerimeterMeters,
  latLngToNormalizedPolygon,
  LatLngVertex,
  normalizedPolygonToLatLng
} from '@/lib/geo';
import { captureFieldGps, triggerHaptic } from '@/lib/sensors';
import { Parcel } from '@/types/domain';

interface ParcelLeafletMapProps {
  parcel: Parcel;
  onSavePolygon?: (
    geoVertices: LatLngVertex[],
    normalized: { x: number; y: number }[],
    newAreaHa: number
  ) => Promise<void>;
}

export const ParcelLeafletMap: React.FC<ParcelLeafletMapProps> = ({
  parcel,
  onSavePolygon
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polygonLayerRef = useRef<L.Polygon | null>(null);
  const vertexMarkersRef = useRef<L.CircleMarker[]>([]);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const initialVertices =
    parcel.geoPolygon && parcel.geoPolygon.length >= 3
      ? parcel.geoPolygon
      : normalizedPolygonToLatLng(parcel.coordinates, parcel.polygon, parcel.areaHa);

  const [vertices, setVertices] = useState<LatLngVertex[]>(initialVertices);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mapStyle, setMapStyle] = useState<'osm' | 'topo'>('osm');
  const [isLocating, setIsLocating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Actualizar vértices cuando cambie la parcela seleccionada
  useEffect(() => {
    const next =
      parcel.geoPolygon && parcel.geoPolygon.length >= 3
        ? parcel.geoPolygon
        : normalizedPolygonToLatLng(parcel.coordinates, parcel.polygon, parcel.areaHa);
    setVertices(next);
    setIsDrawing(false);
  }, [parcel.id]);

  // Inicializar instancia de Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [parcel.coordinates.lat, parcel.coordinates.lng],
      zoom: 16,
      zoomControl: false,
      attributionControl: true
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    tileLayerRef.current = tileLayer;
    mapInstanceRef.current = map;

    const ro = new ResizeObserver(() => {
      map.invalidateSize();
    });
    ro.observe(mapContainerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Cambiar capa de mapa (OSM Estándar vs Topográfico Agrícola)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !tileLayerRef.current) return;

    const url =
      mapStyle === 'osm'
        ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        : 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';

    tileLayerRef.current.setUrl(url);
  }, [mapStyle]);

  // Manejar clic en el mapa cuando está activo el modo dibujo
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (!isDrawing) return;
      triggerHaptic(10);
      const nextPt: LatLngVertex = {
        lat: Number(e.latlng.lat.toFixed(6)),
        lng: Number(e.latlng.lng.toFixed(6))
      };
      setVertices((prev) => [...prev, nextPt]);
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [isDrawing]);

  // Redibujar polígono y marcadores de vértices
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (polygonLayerRef.current) {
      polygonLayerRef.current.remove();
      polygonLayerRef.current = null;
    }
    vertexMarkersRef.current.forEach((m) => m.remove());
    vertexMarkersRef.current = [];

    if (vertices.length > 0) {
      const latlngs = vertices.map((v) => [v.lat, v.lng] as [number, number]);
      const poly = L.polygon(latlngs, {
        color: isDrawing ? '#F59E0B' : '#1F7A3A',
        weight: 3,
        fillColor: isDrawing ? '#FBBF24' : '#58A700',
        fillOpacity: 0.28
      }).addTo(map);
      polygonLayerRef.current = poly;

      vertices.forEach((v, idx) => {
        const marker = L.circleMarker([v.lat, v.lng], {
          radius: isDrawing ? 6 : 4.5,
          color: '#FFFFFF',
          weight: 2,
          fillColor: idx === 0 ? '#F59E0B' : '#1F7A3A',
          fillOpacity: 1
        })
          .bindTooltip(`Vértice ${idx + 1}: ${v.lat.toFixed(4)}, ${v.lng.toFixed(4)}`, {
            direction: 'top'
          })
          .addTo(map);
        vertexMarkersRef.current.push(marker);
      });

      if (!isDrawing && vertices.length >= 3) {
        map.fitBounds(poly.getBounds(), { padding: [26, 26], maxZoom: 17 });
      }
    } else {
      map.setView([parcel.coordinates.lat, parcel.coordinates.lng], 16);
    }
  }, [vertices, isDrawing, parcel.id]);

  const computedAreaHa =
    vertices.length >= 3 ? computePolygonAreaHa(vertices) : parcel.areaHa;
  const computedPerimeterM =
    vertices.length >= 2 ? computePolygonPerimeterMeters(vertices) : 0;

  const handleAddGpsVertex = async () => {
    setIsLocating(true);
    triggerHaptic(12);
    const fix = await captureFieldGps(parcel.coordinates);
    setIsLocating(false);

    const pt: LatLngVertex = {
      lat: Number(fix.lat.toFixed(6)),
      lng: Number(fix.lng.toFixed(6))
    };

    if (isDrawing) {
      setVertices((prev) => [...prev, pt]);
    } else {
      mapInstanceRef.current?.setView([pt.lat, pt.lng], 17);
    }
  };

  const handleSave = async () => {
    if (vertices.length < 3 || !onSavePolygon) return;
    setIsSaving(true);
    triggerHaptic([12, 24, 14]);
    const normalized = latLngToNormalizedPolygon(vertices);
    await onSavePolygon(vertices, normalized, computedAreaHa);
    setIsSaving(false);
    setIsDrawing(false);
  };

  return (
    <div className="rounded-2xl bg-app-surface-2 border border-app-hairline overflow-hidden space-y-0">
      {/* Barra superior del mapa */}
      <div className="p-3 bg-app-surface border-b border-app-hairline flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-extrabold text-app-ink flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#1F7A3A] dark:text-[#7BD62B]" />
            <span>Mapa y Croquis GPS en Tiempo Real</span>
          </div>
          <div className="text-[11px] text-app-muted font-medium">
            {vertices.length} vértices · <strong>{computedAreaHa} ha</strong> · Perímetro{' '}
            {computedPerimeterM} m
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMapStyle((s) => (s === 'osm' ? 'topo' : 'osm'))}
            className="px-2.5 py-1.5 rounded-xl bg-app-surface-2 hover:bg-app-tint text-[11px] font-bold text-app-ink inline-flex items-center gap-1"
            title="Cambiar estilo de mapa"
          >
            <Layers className="w-3.5 h-3.5 text-[#1F7A3A]" />
            <span>{mapStyle === 'osm' ? 'Relieve' : 'Mapa'}</span>
          </button>

          {!isDrawing ? (
            <button
              type="button"
              onClick={() => {
                triggerHaptic(12);
                setIsDrawing(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-[#1F7A3A] text-white text-[11px] font-bold inline-flex items-center gap-1 shadow-xs"
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Dibujar croquis</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setVertices(initialVertices);
                setIsDrawing(false);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-app-surface-2 text-app-muted hover:text-app-ink text-[11px] font-bold inline-flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancelar</span>
            </button>
          )}
        </div>
      </div>

      {/* Instrucción interactiva cuando está en modo dibujo */}
      {isDrawing && (
        <div className="px-3.5 py-2 bg-[#FEF3C7] dark:bg-[#3A2A08] text-[#92400E] dark:text-[#FDE68A] text-xs font-semibold flex items-center justify-between gap-2">
          <span>
            Toca sobre el mapa para marcar cada esquina del lote (mínimo 3 puntos).
          </span>
          <span className="font-mono-tech font-bold shrink-0">{vertices.length} pts</span>
        </div>
      )}

      {/* Contenedor del mapa Leaflet */}
      <div className="relative h-64 sm:h-72 w-full bg-[#E4ECE0]">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      {/* Controles inferiores de edición o centrado GPS */}
      <div className="p-2.5 bg-app-surface border-t border-app-hairline flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleAddGpsVertex}
          disabled={isLocating}
          className="px-3 py-1.5 rounded-xl bg-app-surface-2 hover:bg-app-tint text-xs font-bold text-app-ink inline-flex items-center gap-1.5"
        >
          <Compass className={`w-3.5 h-3.5 text-[#1F7A3A] ${isLocating ? 'animate-spin' : ''}`} />
          <span>{isDrawing ? 'Marcar esquina con mi GPS' : 'Centrar en lote'}</span>
        </button>

        {isDrawing && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setVertices((prev) => prev.slice(0, -1))}
              disabled={vertices.length === 0}
              className="px-2.5 py-1.5 rounded-xl bg-app-surface-2 text-xs font-bold text-app-ink disabled:opacity-40 inline-flex items-center gap-1"
              title="Deshacer último vértice"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Deshacer</span>
            </button>

            <button
              type="button"
              onClick={() => setVertices([])}
              disabled={vertices.length === 0}
              className="px-2.5 py-1.5 rounded-xl bg-app-surface-2 text-xs font-bold text-[#DC2626] disabled:opacity-40 inline-flex items-center gap-1"
              title="Limpiar puntos"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpiar</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={vertices.length < 3 || isSaving}
              className="px-3.5 py-1.5 rounded-xl bg-[#1F7A3A] text-white text-xs font-bold disabled:opacity-40 inline-flex items-center gap-1 shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Guardando…' : 'Guardar croquis'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
