import { describe, expect, it } from 'vitest';
import {
  computePolygonAreaHa,
  computePolygonPerimeterMeters,
  haversineDistanceMeters,
  latLngToNormalizedPolygon,
  normalizedPolygonToLatLng
} from '@/lib/geo';

describe('croquis GPS verificado', () => {
  const square = [
    { lat: 24.7642, lng: -107.6948 },
    { lat: 24.7652, lng: -107.6948 },
    { lat: 24.7652, lng: -107.6938 },
    { lat: 24.7642, lng: -107.6938 }
  ];

  it('calcula una hectárea aproximada para un cuadrado de ~100 m por lado', () => {
    const area = computePolygonAreaHa(square);
    expect(area).toBeGreaterThan(1.0);
    expect(area).toBeLessThan(1.25);
  });

  it('calcula un perímetro coherente con la distancia entre vértices', () => {
    const perimeter = computePolygonPerimeterMeters(square);
    expect(perimeter).toBeGreaterThan(350);
    expect(perimeter).toBeLessThan(460);

    const sideLat = haversineDistanceMeters(square[0], square[1]);
    const sideLng = haversineDistanceMeters(square[1], square[2]);
    expect(Math.abs(perimeter - (sideLat + sideLng) * 2)).toBeLessThan(5);
  });

  it('convierte entre coordenadas reales y el croquis normalizado sin perder la forma', () => {
    const normalized = latLngToNormalizedPolygon(square);
    expect(normalized).toHaveLength(4);
    for (const point of normalized) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(100);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(100);
    }

    const center = { lat: 24.7647, lng: -107.6943 };
    const back = normalizedPolygonToLatLng(center, normalized, 1.1);
    expect(back).toHaveLength(4);
    for (const vertex of back) {
      expect(haversineDistanceMeters(center, vertex)).toBeLessThan(300);
    }
  });
});
