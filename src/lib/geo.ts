import { ParcelPolygonPoint } from '@/types/domain';

export interface LatLngVertex {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6371008.8;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Convierte puntos normalizados (0..100) de un croquis relativo a coordenadas reales
 * alrededor del centroide GPS del lote.
 */
export function normalizedPolygonToLatLng(
  center: { lat: number; lng: number },
  polygon: ParcelPolygonPoint[],
  areaHa = 3.5
): LatLngVertex[] {
  if (!polygon || polygon.length < 3) {
    const d = 0.00095;
    return [
      { lat: Number((center.lat + d).toFixed(6)), lng: Number((center.lng - d).toFixed(6)) },
      { lat: Number((center.lat + d).toFixed(6)), lng: Number((center.lng + d).toFixed(6)) },
      { lat: Number((center.lat - d).toFixed(6)), lng: Number((center.lng + d).toFixed(6)) },
      { lat: Number((center.lat - d).toFixed(6)), lng: Number((center.lng - d).toFixed(6)) }
    ];
  }

  // Escalar según la raíz del área para que el polígono coincida con las hectáreas reales
  const sideMeters = Math.sqrt(Math.max(0.5, areaHa) * 10000) * 1.45;
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos(toRad(center.lat));

  return polygon.map((pt) => {
    const dxNorm = (pt.x - 50) / 100;
    const dyNorm = (50 - pt.y) / 100;
    const dLat = (dyNorm * sideMeters) / metersPerDegLat;
    const dLng = (dxNorm * sideMeters) / Math.max(1, metersPerDegLng);
    return {
      lat: Number((center.lat + dLat).toFixed(6)),
      lng: Number((center.lng + dLng).toFixed(6))
    };
  });
}

/**
 * Convierte vértices GPS de vuelta a coordenadas normalizadas (10..90) para compatibilidad.
 */
export function latLngToNormalizedPolygon(vertices: LatLngVertex[]): ParcelPolygonPoint[] {
  if (vertices.length < 3) {
    return [
      { x: 20, y: 20 },
      { x: 80, y: 20 },
      { x: 80, y: 80 },
      { x: 20, y: 80 }
    ];
  }
  const lats = vertices.map((v) => v.lat);
  const lngs = vertices.map((v) => v.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const spanLat = Math.max(0.0001, maxLat - minLat);
  const spanLng = Math.max(0.0001, maxLng - minLng);

  return vertices.map((v) => ({
    x: Math.round(16 + ((v.lng - minLng) / spanLng) * 68),
    y: Math.round(16 + ((maxLat - v.lat) / spanLat) * 68)
  }));
}

/**
 * Calcula la distancia Haversine en metros entre dos coordenadas.
 */
export function haversineDistanceMeters(a: LatLngVertex, b: LatLngVertex): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Calcula el perímetro total en metros de un polígono GPS cerrado.
 */
export function computePolygonPerimeterMeters(vertices: LatLngVertex[]): number {
  if (vertices.length < 2) return 0;
  let perimeter = 0;
  for (let i = 0; i < vertices.length; i++) {
    const next = vertices[(i + 1) % vertices.length];
    perimeter += haversineDistanceMeters(vertices[i], next);
  }
  return Math.round(perimeter);
}

/**
 * Calcula la superficie en hectáreas de un polígono GPS usando proyección planar local (Shoelace).
 */
export function computePolygonAreaHa(vertices: LatLngVertex[]): number {
  if (vertices.length < 3) return 0;
  const refLat = vertices[0].lat;
  const refLng = vertices[0].lng;
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos(toRad(refLat));

  const pts = vertices.map((v) => ({
    x: (v.lng - refLng) * metersPerDegLng,
    y: (v.lat - refLat) * metersPerDegLat
  }));

  let doubleArea = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    doubleArea += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  const areaSqMeters = Math.abs(doubleArea) / 2;
  const ha = areaSqMeters / 10000;
  return Number(Math.max(0.1, ha).toFixed(2));
}
