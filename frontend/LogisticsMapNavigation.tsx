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
  };
}

export interface LogisticsMapProps {
  features: RouteFeature[];
  selectedRouteId: string;
  tripActive?: boolean;
  onTripEnd?: () => void;
  mapTilerKey?: string;
}

const ROUTE_COLORS: Record<string, { main: string; glow: string }> = {
  route_a: { main: '#10b981', glow: '#34d399' },
  route_b: { main: '#f59e0b', glow: '#fbbf24' },
  route_c: { main: '#ef4444', glow: '#f87171' },
};

const getTurnIcon = (type: string, modifier: string): string => {
  if (type === 'depart') return '🟢';
  if (type === 'arrive') return '🚩';
  if (type === 'roundabout') return '🔄';

  const mod = (modifier || '').toLowerCase();
  if (mod.includes('slight right') || mod.includes('right')) return '↗️';
  if (mod.includes('sharp right')) return '➡️';
  if (mod.includes('slight left') || mod.includes('left')) return '↖️';
  if (mod.includes('sharp left')) return '⬅️';
  return '⬆️';
};

const calculateBearing = (lng1: number, lat1: number, lng2: number, lat2: number): number => {
  const p1Lat = (lat1 * Math.PI) / 180;
  const p1Lng = (lng1 * Math.PI) / 180;
  const p2Lat = (lat2 * Math.PI) / 180;
  const p2Lng = (lng2 * Math.PI) / 180;

  const dLng = p2Lng - p1Lng;
  const y = Math.sin(dLng) * Math.cos(p2Lat);
  const x =
    Math.cos(p1Lat) * Math.sin(p2Lat) -
    Math.sin(p1Lat) * Math.cos(p2Lat) * Math.cos(dLng);

  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
};

const interpolateCoords = (rawCoords: number[][], samplesPerSegment = 6): number[][] => {
  if (rawCoords.length < 2) return rawCoords;
  const points: number[][] = [];
  for (let i = 0; i < rawCoords.length - 1; i++) {
    const [lng1, lat1] = rawCoords[i];
    const [lng2, lat2] = rawCoords[i + 1];
    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      points.push([lng1 + (lng2 - lng1) * t, lat1 + (lat2 - lat1) * t]);
    }
  }
  points.push(rawCoords[rawCoords.length - 1]);
  return points;
};

export const LogisticsMapNavigation: React.FC<LogisticsMapProps> = ({
  features,
  selectedRouteId,
  tripActive = false,
  onTripEnd,
  mapTilerKey = '',
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const vehicleMarkerRef = useRef<maplibregl.Marker | null>(null);
  const animIntervalRef = useRef<number | null>(null);
  const coordIdxRef = useRef<number>(0);
  const interpolatedCoordsRef = useRef<number[][]>([]);

  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [currentBearing, setCurrentBearing] = useState<number>(0);

  const activeRoute = features.find(f => f.properties.route_id === selectedRouteId) || features[0];
  const activeSteps = activeRoute?.properties.steps || [];

  const getMapStyle = (): string | maplibregl.StyleSpecification => {
    if (mapTilerKey) {
      return `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${mapTilerKey}`;
    }
    return 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
  };

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const m = new maplibregl.Map({
      container: mapContainer.current,
      style: getMapStyle(),
      center: [91.7362, 26.1445],
      zoom: 7.5,
      pitch: 20,
      bearing: 0,
      antialias: true,
    });

    // Hide minor district boundary lines, keeping State & Country borders
    m.on('load', () => {
      const styleLayers = m.getStyle().layers || [];
      styleLayers.forEach(layer => {
        const id = layer.id.toLowerCase();
        if (id.includes('boundary') || id.includes('border') || id.includes('admin')) {
          const isStateOrCountry =
            id.includes('country') ||
            id.includes('state') ||
            id.includes('province') ||
            id.includes('admin-0') ||
            id.includes('admin-1') ||
            id.includes('level-2') ||
            id.includes('level-4');

          if (!isStateOrCountry) {
            try {
              m.setLayoutProperty(layer.id, 'visibility', 'none');
            } catch (e) {}
          }
        }
      });
    });

    m.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.current = m;

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  const drawRoutesOnMap = (routeFeatures: RouteFeature[], activeId: string) => {
    const m = map.current;
    if (!m) return;

    const apply = () => {
      if (!m) return;

      markersRef.current.forEach(mk => mk.remove());
      markersRef.current = [];

      routeFeatures.forEach(feature => {
        const id = feature.properties.route_id;
        const colors = ROUTE_COLORS[id] || { main: '#60a5fa', glow: '#93c5fd' };
        const isActive = id === activeId;
        const glowId = `${id}-glow`;
        const lineId = `${id}-line`;

        [glowId, lineId].forEach(l => { if (m.getLayer(l)) m.removeLayer(l); });
        if (m.getSource(id)) m.removeSource(id);

        m.addSource(id, { type: 'geojson', data: feature as any });

        m.addLayer({
          id: glowId,
          type: 'line',
          source: id,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': colors.glow,
            'line-width': isActive ? 20 : 8,
            'line-opacity': isActive ? 0.45 : 0.15,
            'line-blur': 8,
          },
        });

        m.addLayer({
          id: lineId,
          type: 'line',
          source: id,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': colors.main,
            'line-width': isActive ? 7 : 2.5,
            'line-opacity': isActive ? 1 : 0.4,
            'line-dasharray': isActive ? [1] : [3, 3],
          },
        });
      });

      const activeFeat = routeFeatures.find(f => f.properties.route_id === activeId) || routeFeatures[0];
      if (!activeFeat) return;

      const coords = activeFeat.geometry.coordinates;

      const makeEl = (cls: string, label: string) => {
        const el = document.createElement('div');
        el.className = `custom-marker ${cls}`;
        el.innerHTML = `<span>${label}</span>`;
        return el;
      };

      const wp = activeFeat.properties.waypoints;
      markersRef.current.push(
        new maplibregl.Marker({ element: makeEl('start-marker', `🟢 ${wp[0]}`) })
          .setLngLat(coords[0] as [number, number])
          .addTo(m)
      );
      markersRef.current.push(
        new maplibregl.Marker({ element: makeEl('end-marker', `🚩 ${wp[wp.length - 1]}`) })
          .setLngLat(coords[coords.length - 1] as [number, number])
          .addTo(m)
      );

      if (!tripActive) {
        const bounds = coords.reduce(
          (b: maplibregl.LngLatBounds, c: number[]) => b.extend(c as [number, number]),
          new maplibregl.LngLatBounds(coords[0] as [number, number], coords[0] as [number, number])
        );
        m.fitBounds(bounds, { padding: 80, pitch: 30, bearing: 0, duration: 1800 });
      }
    };

    if (m.isStyleLoaded()) {
      apply();
    } else {
      m.once('load', apply);
    }
  };

  useEffect(() => {
    if (features.length > 0) {
      drawRoutesOnMap(features, selectedRouteId);
    }
  }, [features, selectedRouteId]);

  const updatePovPosition = (curr: [number, number], next?: [number, number]) => {
    const m = map.current;
    if (!m) return;

    const heading = next
      ? calculateBearing(curr[0], curr[1], next[0], next[1])
      : currentBearing;
    setCurrentBearing(heading);

    if (!vehicleMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'pov-vehicle-marker';
      el.innerHTML = `
        <div class="google-nav-chevron">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L4.5 20.29C4.19 21.05 4.95 21.81 5.71 21.5L12 18.5L18.29 21.5C19.05 21.81 19.81 21.05 19.5 20.29L12 2Z" fill="#38BDF8" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>
          </svg>
        </div>
      `;
      vehicleMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat(curr)
        .addTo(m);
    } else {
      vehicleMarkerRef.current.setLngLat(curr);
    }

    m.easeTo({
      center: curr,
      bearing: heading,
      pitch: 52,
      zoom: 18.0,
      padding: { top: 40, bottom: 200, left: 0, right: 0 },
      duration: 180,
      easing: t => t,
    });
  };

  useEffect(() => {
    if (tripActive && activeRoute) {
      setIsSimulating(true);
      setCurrentStepIdx(0);
      const rawCoords = activeRoute.geometry.coordinates;
      const denseCoords = interpolateCoords(rawCoords, 8);
      interpolatedCoordsRef.current = denseCoords;
      coordIdxRef.current = 0;

      if (denseCoords.length > 0) {
        const first = denseCoords[0] as [number, number];
        const second = (denseCoords[1] || denseCoords[0]) as [number, number];
        updatePovPosition(first, second);
      }
    } else {
      setIsSimulating(false);
      if (vehicleMarkerRef.current) {
        vehicleMarkerRef.current.remove();
        vehicleMarkerRef.current = null;
      }
    }
  }, [tripActive, activeRoute]);

  useEffect(() => {
    if (tripActive && isSimulating && interpolatedCoordsRef.current.length > 0) {
      const intervalMs = Math.max(60, 220 / simSpeed);
      animIntervalRef.current = window.setInterval(() => {
        const coords = interpolatedCoordsRef.current;
        const idx = coordIdxRef.current;

        if (idx >= coords.length - 1) {
          setIsSimulating(false);
          return;
        }

        const nextIdx = idx + 1;
        coordIdxRef.current = nextIdx;

        const curr = coords[nextIdx] as [number, number];
        const ahead = (coords[nextIdx + 1] || curr) as [number, number];

        updatePovPosition(curr, ahead);

        if (activeSteps.length > 0) {
          let minD = Infinity;
          let closestIdx = 0;
          activeSteps.forEach((st, sIdx) => {
            const d = Math.hypot(st.location[0] - curr[0], st.location[1] - curr[1]);
            if (d < minD) {
              minD = d;
              closestIdx = sIdx;
            }
          });
          setCurrentStepIdx(closestIdx);
        }
      }, intervalMs);
    } else {
      if (animIntervalRef.current) {
        clearInterval(animIntervalRef.current);
        animIntervalRef.current = null;
      }
    }
    return () => {
      if (animIntervalRef.current) clearInterval(animIntervalRef.current);
    };
  }, [tripActive, isSimulating, simSpeed, activeSteps]);

  const currentStep = activeSteps[currentStepIdx] || {
    instruction: 'Proceed along route',
    distance_km: activeRoute?.properties.distance_km || 0,
    distance_m: 0,
    duration_min: 0,
    type: 'depart',
    modifier: 'straight',
    location: [0, 0] as [number, number],
  };

  return (
    <div className="logistics-map-wrapper">
      <div ref={mapContainer} className="logistics-map-container" />

      {tripActive && (
        <>
          <div className="nav-hud-top">
            <div className="nav-turn-icon-container">
              {getTurnIcon(currentStep.type, currentStep.modifier)}
            </div>
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
              <button
                className="btn-nav-control"
                onClick={() => setSimSpeed(s => (s === 1 ? 2 : s === 2 ? 4 : 1))}
              >
                {simSpeed}x
              </button>
              <button
                className="btn-nav-control"
                onClick={() => setIsSimulating(prev => !prev)}
              >
                {isSimulating ? '⏸' : '▶'}
              </button>
              <button
                className="btn-end-trip"
                onClick={onTripEnd}
              >
                End Drive
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LogisticsMapNavigation;
