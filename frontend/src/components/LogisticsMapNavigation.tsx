import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './LogisticsMapNavigation.css';

export interface RouteStep {
  instruction: string;
  distance_km: number;
  distance_m: number;
  duration_min: number;
  type: string;
  modifier: string;
  location: [number, number];
}

export interface RouteFeature {
  type: 'Feature';
  geometry: { type: 'LineString'; coordinates: number[][] };
  properties: {
    route_id: string;
    route_label: string;
    route_name: string;
    is_best_route: boolean;
    color: string;
    distance_km: number;
    eta_hrs: number;
    delay_risk: string;
    accessibility_score: number;
    waypoints: string[];
    recommendation: string;
    steps?: RouteStep[];
    risk_level?: string;    // 'Low Risk' | 'Moderate Risk' | 'High Risk'
    risk_color?: string;    // hex color from ML prediction
  };
}

export interface LogisticsMapProps {
  features: RouteFeature[];
  selectedRouteId: string;
  tripActive?: boolean;
  onTripEnd?: () => void;
}

const getRiskLineColor = (riskLevel?: string): { main: string; glow: string } => {
  if (riskLevel === 'High Risk')     return { main: '#ef4444', glow: '#f87171' };
  if (riskLevel === 'Moderate Risk') return { main: '#f59e0b', glow: '#fbbf24' };
  return { main: '#10b981', glow: '#34d399' }; // Low Risk (default)
};

const calculateBearing = (lng1: number, lat1: number, lng2: number, lat2: number): number => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

const interpolateCoords = (rawCoords: number[][], samplesPerSegment = 6): number[][] => {
  if (rawCoords.length < 2) return rawCoords;
  const pts: number[][] = [];
  for (let i = 0; i < rawCoords.length - 1; i++) {
    const [lng1, lat1] = rawCoords[i];
    const [lng2, lat2] = rawCoords[i + 1];
    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      pts.push([lng1 + (lng2 - lng1) * t, lat1 + (lat2 - lat1) * t]);
    }
  }
  pts.push(rawCoords[rawCoords.length - 1]);
  return pts;
};

export const LogisticsMapNavigation: React.FC<LogisticsMapProps> = ({
  features,
  selectedRouteId,
  tripActive = false,
  onTripEnd,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const mapReady = useRef(false);

  // ← These refs always hold latest values — no stale closure issues
  const featuresRef = useRef<RouteFeature[]>([]);
  const selectedRouteIdRef = useRef<string>(selectedRouteId);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const vehicleMarkerRef = useRef<maplibregl.Marker | null>(null);
  const animIntervalRef = useRef<number | null>(null);
  const coordIdxRef = useRef<number>(0);
  const interpolatedCoordsRef = useRef<number[][]>([]);

  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1);
  const [currentBearing, setCurrentBearing] = useState(0);

  const activeRoute = features.find(f => f.properties.route_id === selectedRouteId) || features[0];
  const activeSteps = activeRoute?.properties.steps || [];

  // Keep refs in sync
  featuresRef.current = features;
  selectedRouteIdRef.current = selectedRouteId;

  // ── MAP INIT (runs only once) ──
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const m = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap Contributors',
            maxzoom: 19,
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      center: [91.7362, 26.1445],
      zoom: 7.5,
      pitch: 20,
      antialias: true,
    });

    m.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.current = m;

    m.on('load', () => {
      mapReady.current = true;
      // Draw any routes that arrived before map was ready
      if (featuresRef.current.length > 0) {
        drawRoutes(m, featuresRef.current, selectedRouteIdRef.current);
      }
    });

    return () => {
      mapReady.current = false;
      m.remove();
      map.current = null;
    };
  }, []);

  // ── RE-DRAW when features or selectedRouteId change ──
  useEffect(() => {
    const m = map.current;
    if (!m || !mapReady.current) return;
    if (features.length === 0) return;
    drawRoutes(m, features, selectedRouteId);
  }, [features, selectedRouteId]);

  const drawRoutes = (m: maplibregl.Map, routeFeatures: RouteFeature[], activeId: string) => {
    // Remove old markers
    markersRef.current.forEach(mk => mk.remove());
    markersRef.current = [];

    // Clean up old layers/sources
    ['route_a', 'route_b', 'route_c'].forEach(id => {
      [`${id}-glow`, `${id}-line`].forEach(l => {
        try { if (m.getLayer(l)) m.removeLayer(l); } catch (e) {}
      });
      try { if (m.getSource(id)) m.removeSource(id); } catch (e) {}
    });

    // Draw each route
    routeFeatures.forEach(feature => {
      const id = feature.properties.route_id;
      const isActive = id === activeId;

      // Use ML risk color for the route line
      const colors = getRiskLineColor(feature.properties.risk_level);

      try {
        m.addSource(id, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: feature.geometry,
            properties: feature.properties,
          } as any,
        });

        // Outer glow
        m.addLayer({
          id: `${id}-glow`,
          type: 'line',
          source: id,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': colors.glow,
            'line-width': isActive ? 20 : 8,
            'line-opacity': isActive ? 0.5 : 0.15,
            'line-blur': 8,
          },
        });

        // Main line
        m.addLayer({
          id: `${id}-line`,
          type: 'line',
          source: id,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': colors.main,
            'line-width': isActive ? 7 : 3,
            'line-opacity': isActive ? 1 : 0.5,
          },
        });
      } catch (err) {
        console.error('Failed to add route layer:', id, err);
      }
    });

    // Add start/end markers for active route
    const activeFeat = routeFeatures.find(f => f.properties.route_id === activeId) || routeFeatures[0];
    if (!activeFeat || activeFeat.geometry.coordinates.length < 2) return;

    const coords = activeFeat.geometry.coordinates;
    const wp = activeFeat.properties.waypoints || [];

    const makeMarkerEl = (cls: string, label: string) => {
      const el = document.createElement('div');
      el.className = `custom-marker ${cls}`;
      el.innerHTML = `<span>${label}</span>`;
      return el;
    };

    markersRef.current.push(
      new maplibregl.Marker({ element: makeMarkerEl('start-marker', `🟢 ${wp[0] || 'Start'}`) })
        .setLngLat(coords[0] as [number, number])
        .addTo(m)
    );
    markersRef.current.push(
      new maplibregl.Marker({ element: makeMarkerEl('end-marker', `🚩 ${wp[wp.length - 1] || 'End'}`) })
        .setLngLat(coords[coords.length - 1] as [number, number])
        .addTo(m)
    );

    // Fit map bounds to show full route
    if (!tripActive) {
      const bounds = coords.reduce(
        (b: maplibregl.LngLatBounds, c: number[]) => b.extend(c as [number, number]),
        new maplibregl.LngLatBounds(coords[0] as [number, number], coords[0] as [number, number])
      );
      m.fitBounds(bounds, { padding: 60, pitch: 20, duration: 1200 });
    }
  };

  // ── POV NAVIGATION ──
  const updatePovPosition = (curr: [number, number], next?: [number, number]) => {
    const m = map.current;
    if (!m) return;
    const heading = next ? calculateBearing(curr[0], curr[1], next[0], next[1]) : currentBearing;
    setCurrentBearing(heading);
    if (!vehicleMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'pov-vehicle-marker';
      el.innerHTML = `<div class="google-nav-chevron"><svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 2L4.5 20.29C4.19 21.05 4.95 21.81 5.71 21.5L12 18.5L18.29 21.5C19.05 21.81 19.81 21.05 19.5 20.29L12 2Z" fill="#38BDF8" stroke="#FFF" stroke-width="1.8" stroke-linejoin="round"/></svg></div>`;
      vehicleMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat(curr).addTo(m);
    } else {
      vehicleMarkerRef.current.setLngLat(curr);
    }
    m.easeTo({ center: curr, bearing: heading, pitch: 55, zoom: 15, duration: 200 });
  };

  useEffect(() => {
    if (tripActive && activeRoute) {
      setIsSimulating(true);
      setCurrentStepIdx(0);
      const dense = interpolateCoords(activeRoute.geometry.coordinates, 8);
      interpolatedCoordsRef.current = dense;
      coordIdxRef.current = 0;
      if (dense.length > 0) updatePovPosition(dense[0] as [number, number], dense[1] as [number, number]);
    } else {
      setIsSimulating(false);
      if (vehicleMarkerRef.current) { vehicleMarkerRef.current.remove(); vehicleMarkerRef.current = null; }
      // Reset map view when trip ends
      if (map.current && features.length > 0) {
        drawRoutes(map.current, features, selectedRouteId);
      }
    }
  }, [tripActive]);

  useEffect(() => {
    if (!tripActive || !isSimulating) {
      if (animIntervalRef.current) clearInterval(animIntervalRef.current);
      return;
    }
    const ms = Math.max(60, 220 / simSpeed);
    animIntervalRef.current = window.setInterval(() => {
      const coords = interpolatedCoordsRef.current;
      const idx = coordIdxRef.current;
      if (idx >= coords.length - 1) { setIsSimulating(false); return; }
      const next = idx + 1;
      coordIdxRef.current = next;
      updatePovPosition(coords[next] as [number, number], (coords[next + 1] || coords[next]) as [number, number]);
    }, ms);
    return () => { if (animIntervalRef.current) clearInterval(animIntervalRef.current); };
  }, [tripActive, isSimulating, simSpeed]);

  const currentStep = activeSteps[currentStepIdx] || {
    instruction: 'Proceed along route', distance_km: activeRoute?.properties.distance_km || 0,
    distance_m: 0, type: 'depart', modifier: '',
  };

  return (
    <div className="logistics-map-wrapper">
      <div ref={mapContainer} className="logistics-map-container" />

      {tripActive && (
        <>
          <div className="nav-hud-top">
            <div className="nav-turn-info">
              <div className="nav-turn-distance">
                {currentStep.distance_m > 1000 ? `${currentStep.distance_km} km` : `${currentStep.distance_m} m`}
              </div>
              <div className="nav-turn-instruction">{currentStep.instruction}</div>
            </div>
          </div>

          <div className="nav-hud-bottom">
            <div className="nav-stat">
              <span className="nav-stat-val">{activeRoute?.properties.distance_km} km</span>
              <span className="nav-stat-lbl">Distance</span>
            </div>
            <div className="nav-stat">
              <span className="nav-stat-val">{activeRoute?.properties.eta_hrs} hrs</span>
              <span className="nav-stat-lbl">ETA</span>
            </div>
            <div className="nav-stat">
              <span className="nav-stat-val">{Math.round(currentBearing)}°</span>
              <span className="nav-stat-lbl">Heading</span>
            </div>
            <div className="nav-controls">
              <button className="btn-nav-control" onClick={() => setSimSpeed(s => s === 1 ? 2 : s === 2 ? 4 : 1)}>{simSpeed}x</button>
              <button className="btn-nav-control" onClick={() => setIsSimulating(p => !p)}>{isSimulating ? '⏸' : '▶'}</button>
              <button className="btn-end-trip" onClick={onTripEnd}>End Drive</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LogisticsMapNavigation;
