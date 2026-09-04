import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './LogisticsMapNavigation.css';
import {
  CornerUpRight,
  CornerUpLeft,
  ArrowUp,
  RotateCcw,
  MapPin,
  Navigation as NavIcon,
  AlertTriangle,
  Droplets,
  Mountain,
  CloudRain,
  ShieldAlert,
  X as CloseIcon,
} from 'lucide-react';

export interface RouteStep {
  instruction: string;
  distance_km: number;
  distance_m: number;
  duration_min: number;
  type: string;
  modifier: string;
  location: [number, number];
}

export interface RouteHazard {
  id: string;
  type: 'flood' | 'landslide' | 'heavy_rain' | 'earthquake' | string;
  title: string;
  severity: 'High Risk' | 'Moderate Risk' | string;
  location: [number, number];
  affected_stretch_km: number;
  description: string;
  icon?: string;
}

export interface RouteSegment {
  coordinates: number[][];
  risk_level: string;
  color: string;
  label: string;
  hazard_id: string | null;
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
    hazards?: RouteHazard[];
    segments?: RouteSegment[];
    risk_level?: string;    // 'Low Risk' | 'Moderate Risk' | 'High Risk'
    risk_color?: string;    // hex color from ML prediction
  };
}

export interface LogisticsMapProps {
  features: RouteFeature[];
  selectedRouteId: string;
  tripActive?: boolean;
  onTripEnd?: () => void;
  onSelectRoute?: (routeId: string) => void;
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

const getDistanceMeters = (c1: [number, number], c2: [number, number]): number => {
  const R = 6371e3;
  const rad = Math.PI / 180;
  const dLat = (c2[1] - c1[1]) * rad;
  const dLng = (c2[0] - c1[0]) * rad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(c1[1] * rad) * Math.cos(c2[1] * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getTurnIcon = (type?: string, modifier?: string) => {
  const mod = (modifier || '').toLowerCase();
  const t = (type || '').toLowerCase();

  if (t === 'arrive' || t.includes('destination') || t.includes('arrived')) {
    return <MapPin size={24} className="text-white" />;
  }
  if (mod.includes('slight right') || mod.includes('bear right') || (t.includes('fork') && mod.includes('right'))) {
    return <CornerUpRight size={24} className="text-white" />;
  }
  if (mod.includes('slight left') || mod.includes('bear left') || (t.includes('fork') && mod.includes('left'))) {
    return <CornerUpLeft size={24} className="text-white" />;
  }
  if (mod.includes('right') || t.includes('right')) {
    return <CornerUpRight size={24} className="text-white" />;
  }
  if (mod.includes('left') || t.includes('left')) {
    return <CornerUpLeft size={24} className="text-white" />;
  }
  if (mod.includes('u-turn') || t.includes('uturn')) {
    return <RotateCcw size={24} className="text-white" />;
  }
  if (mod.includes('straight') || t === 'continue' || t === 'depart' || t === 'new name') {
    return <ArrowUp size={24} className="text-white" />;
  }
  return <NavIcon size={24} className="text-white" />;
};

const getHazardIcon = (type?: string) => {
  const t = (type || '').toLowerCase();
  if (t === 'flood') return <Droplets size={22} className="text-blue-400 animate-pulse" />;
  if (t === 'landslide') return <Mountain size={22} className="text-amber-500 animate-pulse" />;
  if (t === 'heavy_rain') return <CloudRain size={22} className="text-cyan-300 animate-pulse" />;
  return <AlertTriangle size={22} className="text-red-500 animate-pulse" />;
};

const SPEED_CONFIG: Record<number, { ms: number; step: number }> = {
  1: { ms: 140, step: 1 },
  2: { ms: 100, step: 2 },
  4: { ms: 75, step: 3 },
  8: { ms: 50, step: 5 },
  10: { ms: 35, step: 8 },
};

const SPEED_STAGES = [1, 2, 4, 8, 10];

export const LogisticsMapNavigation: React.FC<LogisticsMapProps> = ({
  features,
  selectedRouteId,
  tripActive = false,
  onTripEnd,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const mapReady = useRef(false);

  const featuresRef = useRef<RouteFeature[]>([]);
  const selectedRouteIdRef = useRef<string>(selectedRouteId);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const vehicleMarkerRef = useRef<maplibregl.Marker | null>(null);
  const animIntervalRef = useRef<number | null>(null);
  const coordIdxRef = useRef<number>(0);
  const interpolatedCoordsRef = useRef<number[][]>([]);
  const stepIndicesRef = useRef<number[]>([]);
  const tripActiveRef = useRef<boolean>(false);
  const followRef = useRef<boolean>(true);
  const currentStepIdxRef = useRef<number>(0);

  const [activeHazardAlert, setActiveHazardAlert] = useState<RouteHazard | null>(null);
  const triggeredHazardIdsRef = useRef<Set<string>>(new Set());
  const hazardAlertTimeoutRef = useRef<number | null>(null);

  const [currentStep, setCurrentStep] = useState<RouteStep | null>(null);
  const [turnDistanceM, setTurnDistanceM] = useState<number>(0);
  const [remainingDistKm, setRemainingDistKm] = useState<number>(0);
  const [remainingEtaHrs, setRemainingEtaHrs] = useState<number>(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1);
  const currentCoordRef = useRef<[number, number] | null>(null);
  const nextCoordRef = useRef<[number, number] | null>(null);
  const currentBearingRef = useRef<number>(0);
  const currentScreenAngleRef = useRef<number>(0);
  const [vehiclePos, setVehiclePos] = useState<{ x: number; y: number; bearing: number } | null>(null);
  const [currentBearing, setCurrentBearing] = useState(0);
  const [isFollowing, setIsFollowing] = useState(true);
  const [svgPaths, setSvgPaths] = useState<{ id: string; d: string; color: string; width: number; opacity: number; glow?: boolean }[]>([]);
  const [markersPos, setMarkersPos] = useState<{ id: string; x: number; y: number; label: string; cls: string }[]>([]);

  const activeRoute = features.find(f => f.properties.route_id === selectedRouteId) || features[0];

  const effectiveSteps = useMemo(() => {
    const rawSteps = activeRoute?.properties.steps;
    if (rawSteps && rawSteps.length > 1) {
      return rawSteps;
    }
    if (!activeRoute?.geometry?.coordinates || activeRoute.geometry.coordinates.length < 2) return [];
    const coords = activeRoute.geometry.coordinates;
    const totalKm = activeRoute.properties.distance_km || 10;
    const count = Math.min(8, Math.max(3, Math.floor(coords.length / 15)));
    const generated: RouteStep[] = [];

    generated.push({
      instruction: 'Head towards destination',
      distance_km: 0.5,
      distance_m: 500,
      duration_min: 1,
      type: 'depart',
      modifier: 'straight',
      location: coords[0] as [number, number],
    });

    for (let i = 1; i < count; i++) {
      const idx = Math.floor((i / count) * (coords.length - 1));
      const prev = coords[Math.max(0, idx - 2)];
      const curr = coords[idx];
      const next = coords[Math.min(coords.length - 1, idx + 2)];
      const b1 = calculateBearing(prev[0], prev[1], curr[0], curr[1]);
      const b2 = calculateBearing(curr[0], curr[1], next[0], next[1]);
      let diff = b2 - b1;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;

      let instruction = 'Continue on highway';
      let type = 'continue';
      let modifier = 'straight';

      if (diff > 25) {
        instruction = 'Turn right onto connector';
        type = 'turn';
        modifier = 'right';
      } else if (diff > 10) {
        instruction = 'Bear slightly right';
        type = 'turn';
        modifier = 'slight right';
      } else if (diff < -25) {
        instruction = 'Turn left onto expressway';
        type = 'turn';
        modifier = 'left';
      } else if (diff < -10) {
        instruction = 'Bear slightly left';
        type = 'turn';
        modifier = 'slight left';
      }

      generated.push({
        instruction,
        distance_km: Math.round((totalKm / count) * 10) / 10,
        distance_m: Math.round((totalKm / count) * 1000),
        duration_min: 2,
        type,
        modifier,
        location: curr as [number, number],
      });
    }

    generated.push({
      instruction: 'Arrive at destination',
      distance_km: 0,
      distance_m: 0,
      duration_min: 0,
      type: 'arrive',
      modifier: '',
      location: coords[coords.length - 1] as [number, number],
    });

    return generated;
  }, [activeRoute]);

  featuresRef.current = features;
  selectedRouteIdRef.current = selectedRouteId;
  tripActiveRef.current = tripActive;

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
          'routes-base-source': {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          },
          'routes-segments-source': {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          },
        },
        layers: [
          { id: 'osm', type: 'raster', source: 'osm' },
          {
            id: 'routes-base-glow',
            type: 'line',
            source: 'routes-base-source',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#38bdf8',
              'line-width': 14,
              'line-opacity': 0.5,
              'line-blur': 6,
            },
          },
          {
            id: 'routes-base-line',
            type: 'line',
            source: 'routes-base-source',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#2563eb',
              'line-width': 8,
              'line-opacity': 1,
            },
          },
          {
            id: 'routes-segments-line',
            type: 'line',
            source: 'routes-segments-source',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': ['coalesce', ['get', 'color'], '#ef4444'],
              'line-width': 9,
              'line-opacity': 1,
            },
          },
        ],
      },
      center: [91.7362, 26.1445],
      zoom: 7.5,
      pitch: 20,
    });

    m.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.current = m;

    m.on('dragstart', () => {
      if (tripActiveRef.current) {
        followRef.current = false;
        setIsFollowing(false);
      }
    });

    m.on('move', updateSvgOverlay);
    m.on('zoom', updateSvgOverlay);
    m.on('resize', updateSvgOverlay);

    m.on('load', () => {
      mapReady.current = true;
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

  const updateSvgOverlay = () => {
    const m = map.current;
    if (!m) return;

    const feats = featuresRef.current;
    const activeId = selectedRouteIdRef.current;
    const activeFeat = feats.find(f => f.properties.route_id === activeId) || feats[0];

    if (!activeFeat?.geometry?.coordinates || activeFeat.geometry.coordinates.length < 2) {
      setSvgPaths([]);
      setMarkersPos([]);
      return;
    }

    // Keep vehicle screen position and screen angle synchronized with camera
    if (currentCoordRef.current) {
      const pt = m.project(currentCoordRef.current);
      let screenAngle = currentScreenAngleRef.current;
      if (
        nextCoordRef.current &&
        (nextCoordRef.current[0] !== currentCoordRef.current[0] ||
          nextCoordRef.current[1] !== currentCoordRef.current[1])
      ) {
        const ptNext = m.project(nextCoordRef.current);
        const dx = ptNext.x - pt.x;
        const dy = ptNext.y - pt.y;
        if (dx * dx + dy * dy > 0.04) {
          screenAngle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
          currentScreenAngleRef.current = screenAngle;
        }
      } else {
        screenAngle = (currentBearingRef.current - m.getBearing() + 360) % 360;
        currentScreenAngleRef.current = screenAngle;
      }
      setVehiclePos({ x: pt.x, y: pt.y, bearing: screenAngle });
    } else {
      setVehiclePos(null);
    }

    // Keep start and destination marker labels synchronized with camera (rendered above route lines)
    if (activeFeat?.geometry?.coordinates && activeFeat.geometry.coordinates.length >= 2) {
      const coords = activeFeat.geometry.coordinates;
      const wp = activeFeat.properties.waypoints || [];
      const startPt = m.project(coords[0] as [number, number]);
      const endPt = m.project(coords[coords.length - 1] as [number, number]);
      setMarkersPos([
        {
          id: 'start-marker',
          x: startPt.x,
          y: startPt.y,
          label: `🟢 ${wp[0] || 'Start'}`,
          cls: 'start-marker',
        },
        {
          id: 'end-marker',
          x: endPt.x,
          y: endPt.y,
          label: `🚩 ${wp[wp.length - 1] || 'Destination'}`,
          cls: 'end-marker',
        },
      ]);
    } else {
      setMarkersPos([]);
    }

    const paths: { id: string; d: string; color: string; width: number; opacity: number; glow?: boolean }[] = [];

    const coordsToPath = (coords: number[][]) => {
      if (!coords || coords.length < 2) return '';
      let d = '';
      for (let i = 0; i < coords.length; i++) {
        const pt = m.project(coords[i] as [number, number]);
        d += (i === 0 ? `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}` : ` L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`);
      }
      return d;
    };

    // 1. Inactive routes (subtle grey background)
    feats.forEach(feat => {
      if (feat.properties.route_id === activeId) return;
      if (feat.geometry?.coordinates && feat.geometry.coordinates.length >= 2) {
        const d = coordsToPath(feat.geometry.coordinates);
        if (d) {
          paths.push({
            id: `inactive_${feat.properties.route_id}`,
            d,
            color: '#64748b',
            width: 5,
            opacity: 0.35,
          });
        }
      }
    });

    const isDriving = tripActiveRef.current && interpolatedCoordsRef.current.length > 1;
    const dense = interpolatedCoordsRef.current;
    const currentIdx = Math.min(coordIdxRef.current, Math.max(0, dense.length - 1));

    if (isDriving) {
      // 2a. Upcoming Route Portion (Ahead of Vehicle) - Glowing Vibrant Blue/Cyan
      const upcomingCoords = dense.slice(currentIdx);
      if (upcomingCoords.length >= 2) {
        const upcomingD = coordsToPath(upcomingCoords);
        if (upcomingD) {
          paths.push({
            id: 'upcoming-glow',
            d: upcomingD,
            color: '#38bdf8',
            width: 14,
            opacity: 0.5,
            glow: true,
          });
          paths.push({
            id: 'upcoming-line',
            d: upcomingD,
            color: activeFeat.properties.color || '#2563eb',
            width: 8,
            opacity: 0.95,
          });
        }
      }

      // 2b. Active Hazard & Disaster Segments
      if (activeFeat.properties.segments) {
        activeFeat.properties.segments.forEach((seg, sIdx) => {
          if (seg.coordinates && seg.coordinates.length >= 2) {
            const segD = coordsToPath(seg.coordinates);
            if (segD) {
              const isHigh = seg.risk_level === 'High Risk';
              const isMod = seg.risk_level === 'Moderate Risk';
              const segColor = seg.color || (isHigh ? '#ef4444' : isMod ? '#f59e0b' : '#10b981');
              paths.push({
                id: `seg-${sIdx}`,
                d: segD,
                color: segColor,
                width: isHigh ? 10 : 8,
                opacity: 1,
                glow: isHigh,
              });
            }
          }
        });
      }

      // 2c. Traveled Route Portion (Passed Behind Vehicle) - Solid Grey on top of all passed stretches
      if (currentIdx > 0) {
        const traveledCoords = dense.slice(0, currentIdx + 1);
        if (traveledCoords.length >= 2) {
          const traveledD = coordsToPath(traveledCoords);
          if (traveledD) {
            paths.push({
              id: 'traveled-line',
              d: traveledD,
              color: '#64748b', // Slate grey
              width: 8,
              opacity: 1,
              glow: false,
            });
          }
        }
      }
    } else {
      // 2d. Before Driving Starts: Full Active Route
      const mainD = coordsToPath(activeFeat.geometry.coordinates);
      if (mainD) {
        paths.push({
          id: 'active-glow',
          d: mainD,
          color: '#38bdf8',
          width: 14,
          opacity: 0.5,
          glow: true,
        });
        paths.push({
          id: 'active-line',
          d: mainD,
          color: activeFeat.properties.color || '#2563eb',
          width: 8,
          opacity: 0.95,
        });
      }

      // Disaster & Hazard Segments
      if (activeFeat.properties.segments) {
        activeFeat.properties.segments.forEach((seg, sIdx) => {
          if (seg.coordinates && seg.coordinates.length >= 2) {
            const segD = coordsToPath(seg.coordinates);
            if (segD) {
              const isHigh = seg.risk_level === 'High Risk';
              const isMod = seg.risk_level === 'Moderate Risk';
              const segColor = seg.color || (isHigh ? '#ef4444' : isMod ? '#f59e0b' : '#10b981');
              paths.push({
                id: `seg-${sIdx}`,
                d: segD,
                color: segColor,
                width: isHigh ? 10 : 8,
                opacity: 1,
                glow: isHigh,
              });
            }
          }
        });
      }
    }

    setSvgPaths(paths);
  };

  const drawRoutes = (m: maplibregl.Map, routeFeatures: RouteFeature[], activeId: string) => {
    // 1. Clear legacy DOM markers and fit bounds
    markersRef.current.forEach(mk => mk.remove());
    markersRef.current = [];

    try { m.resize(); } catch (_) {}

    const activeFeat = routeFeatures.find(f => f.properties.route_id === activeId) || routeFeatures[0];
    if (activeFeat && activeFeat.geometry?.coordinates?.length >= 2) {
      const coords = activeFeat.geometry.coordinates;

      if (!tripActive) {
        const bounds = coords.reduce(
          (b: maplibregl.LngLatBounds, c: number[]) => b.extend(c as [number, number]),
          new maplibregl.LngLatBounds(coords[0] as [number, number], coords[0] as [number, number])
        );
        m.fitBounds(bounds, { padding: 60, pitch: 20, duration: 1000 });
      }
    }

    // 2. PREPARE GEOJSON DATA
    const baseFeatures: any[] = [];
    routeFeatures.forEach(feature => {
      const coords = feature.geometry?.coordinates;
      if (!coords || coords.length < 2) return;

      const isActive = feature.properties.route_id === activeId;
      if (tripActive && isActive) return;
      const colors = getRiskLineColor(feature.properties.risk_level);
      const color = isActive ? (feature.properties.color || colors.main) : '#64748b';
      const glow = isActive ? colors.glow : '#94a3b8';

      baseFeatures.push({
        type: 'Feature',
        geometry: feature.geometry,
        properties: {
          ...feature.properties,
          is_active: isActive,
          line_color: color,
          glow_color: glow,
        }
      });
    });

    const segmentFeatures: any[] = [];
    if (activeFeat?.properties?.segments) {
      activeFeat.properties.segments.forEach(seg => {
        if (seg.coordinates && seg.coordinates.length >= 2) {
          const isHighRisk = seg.risk_level === 'High Risk';
          const isModRisk = seg.risk_level === 'Moderate Risk';
          const segColor = seg.color || (isHighRisk ? '#ef4444' : isModRisk ? '#f59e0b' : '#10b981');

          segmentFeatures.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: seg.coordinates },
            properties: {
              color: segColor,
              is_high_risk: isHighRisk,
            }
          });
        }
      });
    }

    // 3. SET DATA ON MAP SOURCES (Synchronously or on style load)
    const updateSources = () => {
      try {
        const baseSrc = m.getSource('routes-base-source') as maplibregl.GeoJSONSource | undefined;
        if (baseSrc && typeof baseSrc.setData === 'function') {
          baseSrc.setData({
            type: 'FeatureCollection',
            features: baseFeatures,
          });
        }
        const segSrc = m.getSource('routes-segments-source') as maplibregl.GeoJSONSource | undefined;
        if (segSrc && typeof segSrc.setData === 'function') {
          segSrc.setData({
            type: 'FeatureCollection',
            features: segmentFeatures,
          });
        }
      } catch (err) {
        console.warn('Map source update notice:', err);
      }
    };

    if (m.isStyleLoaded()) {
      updateSources();
    } else {
      m.once('load', updateSources);
    }
    updateSvgOverlay();
  };

  // ── POV NAVIGATION ──
  const updatePovPosition = (curr: [number, number], next?: [number, number], durationMs = 140) => {
    const m = map.current;
    if (!m) return;
    const heading = next ? calculateBearing(curr[0], curr[1], next[0], next[1]) : currentBearing;
    setCurrentBearing(heading);
    currentCoordRef.current = curr;
    nextCoordRef.current = next || null;
    currentBearingRef.current = heading;

    // Clean up DOM marker if it exists so only top SVG chevron renders
    if (vehicleMarkerRef.current) {
      vehicleMarkerRef.current.remove();
      vehicleMarkerRef.current = null;
    }

    const pt = m.project(curr);
    let screenAngle = currentScreenAngleRef.current;
    if (next && (next[0] !== curr[0] || next[1] !== curr[1])) {
      const ptNext = m.project(next);
      const dx = ptNext.x - pt.x;
      const dy = ptNext.y - pt.y;
      if (dx * dx + dy * dy > 0.04) {
        screenAngle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
        currentScreenAngleRef.current = screenAngle;
      }
    } else {
      screenAngle = (heading - m.getBearing() + 360) % 360;
      currentScreenAngleRef.current = screenAngle;
    }

    setVehiclePos({ x: pt.x, y: pt.y, bearing: screenAngle });

    updateSvgOverlay();

    if (followRef.current) {
      m.easeTo({ center: curr, bearing: heading, pitch: 55, zoom: m.getZoom(), duration: durationMs });
    }
  };

  const handleRecenter = () => {
    const m = map.current;
    if (!m) return;
    const targetCoord = currentCoordRef.current || (activeRoute?.geometry?.coordinates?.[0] as [number, number]);
    if (!targetCoord) return;
    followRef.current = true;
    setIsFollowing(true);
    m.easeTo({
      center: targetCoord,
      bearing: currentBearingRef.current,
      pitch: 55,
      zoom: Math.max(m.getZoom(), 15),
      duration: 600,
    });
  };

  useEffect(() => {
    if (tripActive && activeRoute) {
      setIsSimulating(true);
      currentStepIdxRef.current = 0;
      followRef.current = true;
      setIsFollowing(true);
      triggeredHazardIdsRef.current.clear();
      setActiveHazardAlert(null);
      if (hazardAlertTimeoutRef.current) {
        clearTimeout(hazardAlertTimeoutRef.current);
        hazardAlertTimeoutRef.current = null;
      }

      const dense = interpolateCoords(activeRoute.geometry.coordinates, 5);
      interpolatedCoordsRef.current = dense;
      coordIdxRef.current = 0;

      // Pre-calculate indices in dense for each step
      const indices: number[] = [];
      let searchStart = 0;
      effectiveSteps.forEach((st, sIdx) => {
        if (sIdx === 0) {
          indices.push(0);
          return;
        }
        if (sIdx === effectiveSteps.length - 1) {
          indices.push(dense.length - 1);
          return;
        }
        let bestIdx = searchStart;
        let minD = Infinity;
        for (let j = searchStart; j < dense.length; j++) {
          const d = (dense[j][0] - st.location[0]) ** 2 + (dense[j][1] - st.location[1]) ** 2;
          if (d < minD) {
            minD = d;
            bestIdx = j;
          }
        }
        indices.push(bestIdx);
        searchStart = bestIdx;
      });
      stepIndicesRef.current = indices;

      // Initialize stats & step instruction
      setRemainingDistKm(activeRoute.properties.distance_km || 0);
      setRemainingEtaHrs(activeRoute.properties.eta_hrs || 0);

      if (effectiveSteps.length > 0) {
        setCurrentStep(effectiveSteps[0]);
        const targetIdx = indices[1] || Math.floor(dense.length / 5);
        let initD = 0;
        for (let k = 0; k < targetIdx && k < dense.length - 1; k++) {
          initD += getDistanceMeters(dense[k] as [number, number], dense[k + 1] as [number, number]);
        }
        setTurnDistanceM(initD || effectiveSteps[0].distance_m || 300);
      }

      if (dense.length > 0) {
        const m = map.current;
        if (m) m.jumpTo({ zoom: 15 });
        const lookAhead = Math.min(dense.length - 1, 2);
        updatePovPosition(dense[0] as [number, number], dense[lookAhead] as [number, number], 300);
      }
    } else {
      setIsSimulating(false);
      setActiveHazardAlert(null);
      if (hazardAlertTimeoutRef.current) {
        clearTimeout(hazardAlertTimeoutRef.current);
        hazardAlertTimeoutRef.current = null;
      }
      triggeredHazardIdsRef.current.clear();
      currentCoordRef.current = null;
      nextCoordRef.current = null;
      currentScreenAngleRef.current = 0;
      setVehiclePos(null);
      if (vehicleMarkerRef.current) { vehicleMarkerRef.current.remove(); vehicleMarkerRef.current = null; }
      if (map.current && features.length > 0) {
        drawRoutes(map.current, features, selectedRouteId);
      }
    }
  }, [tripActive, effectiveSteps]);

  useEffect(() => {
    if (!tripActive || !isSimulating) {
      if (animIntervalRef.current) clearInterval(animIntervalRef.current);
      return;
    }
    const speedProfile = SPEED_CONFIG[simSpeed] || { ms: 140, step: 1 };
    const ms = speedProfile.ms;
    const stepIncrement = speedProfile.step;

    animIntervalRef.current = window.setInterval(() => {
      const coords = interpolatedCoordsRef.current;
      const idx = coordIdxRef.current;
      if (idx >= coords.length - 1) {
        setIsSimulating(false);
        setRemainingDistKm(0);
        setRemainingEtaHrs(0);
        setTurnDistanceM(0);
        setCurrentStep({
          instruction: 'Arrived at destination',
          distance_km: 0,
          distance_m: 0,
          duration_min: 0,
          type: 'arrive',
          modifier: '',
          location: coords[coords.length - 1] as [number, number],
        });
        updateSvgOverlay();
        return;
      }

      const next = Math.min(coords.length - 1, idx + stepIncrement);
      coordIdxRef.current = next;
      const lookAhead = Math.min(coords.length - 1, next + Math.max(2, stepIncrement));
      updatePovPosition(
        coords[next] as [number, number],
        coords[lookAhead] as [number, number],
        ms
      );

      // Dynamic total remaining distance & ETA
      const progressRatio = next / (coords.length - 1);
      const totalKm = activeRoute?.properties.distance_km || 0;
      const totalEta = activeRoute?.properties.eta_hrs || 0;
      setRemainingDistKm(Math.max(0, totalKm * (1 - progressRatio)));
      setRemainingEtaHrs(Math.max(0, totalEta * (1 - progressRatio)));

      // Step guidance tracking
      const indices = stepIndicesRef.current;
      if (indices.length > 0 && effectiveSteps.length > 0) {
        let currentSegIdx = 0;
        for (let k = 0; k < indices.length - 1; k++) {
          if (next >= indices[k] && next < indices[k + 1]) {
            currentSegIdx = k;
            break;
          }
          if (next >= indices[indices.length - 1]) {
            currentSegIdx = indices.length - 1;
          }
        }

        const nextManeuverIdx = Math.min(effectiveSteps.length - 1, currentSegIdx + 1);
        const targetCoordIdx = indices[nextManeuverIdx] || coords.length - 1;

        let dM = 0;
        for (let k = next; k < targetCoordIdx; k++) {
          dM += getDistanceMeters(coords[k] as [number, number], coords[k + 1] as [number, number]);
        }

        // When nearing a maneuver or moving through segments, update the instruction
        const stepToDisplay = (dM < 50 || currentSegIdx > 0)
          ? effectiveSteps[nextManeuverIdx]
          : effectiveSteps[currentSegIdx];

        setCurrentStep(stepToDisplay);
        setTurnDistanceM(dM);
        currentStepIdxRef.current = nextManeuverIdx;

        // Check proximity to disaster hazards along the route (within 1.2 km)
        const hazards = activeRoute?.properties?.hazards || [];
        for (const h of hazards) {
          if (!triggeredHazardIdsRef.current.has(h.id)) {
            const distToHazard = getDistanceMeters(coords[next] as [number, number], h.location);
            if (distToHazard <= 1200) {
              triggeredHazardIdsRef.current.add(h.id);
              setActiveHazardAlert(h);
              if (hazardAlertTimeoutRef.current) {
                clearTimeout(hazardAlertTimeoutRef.current);
              }
              hazardAlertTimeoutRef.current = window.setTimeout(() => {
                setActiveHazardAlert(null);
              }, 5000);
              break;
            }
          }
        }
      }
    }, ms);

    return () => {
      if (animIntervalRef.current) clearInterval(animIntervalRef.current);
    };
  }, [tripActive, isSimulating, simSpeed, effectiveSteps, activeRoute]);

  const displayTurnDistance = useMemo(() => {
    if (turnDistanceM > 1000) {
      return `${(turnDistanceM / 1000).toFixed(1)} km`;
    }
    return `${Math.max(0, Math.round(turnDistanceM))} m`;
  }, [turnDistanceM]);

  const displayInstruction = currentStep?.instruction || 'Proceed along route';

  const displayRemainingDistance = `${remainingDistKm.toFixed(1)} km`;
  const displayRemainingEta =
    remainingEtaHrs < 0.05
      ? '< 1 min'
      : remainingEtaHrs < 1
      ? `${Math.max(1, Math.round(remainingEtaHrs * 60))} min`
      : `${remainingEtaHrs.toFixed(1)} hrs`;

  return (
    <div className="logistics-map-wrapper">
      <div ref={mapContainer} className="logistics-map-container" />

      {/* Guaranteed SVG Vector Route Line Overlay */}
      <svg
        className="pointer-events-none absolute inset-0 w-full h-full z-10 overflow-visible"
        style={{ pointerEvents: 'none' }}
      >
        {svgPaths.map(p => (
          <path
            key={p.id}
            d={p.d}
            stroke={p.color}
            strokeWidth={p.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={p.opacity}
            style={p.glow ? { filter: `drop-shadow(0 0 6px ${p.color})` } : undefined}
          />
        ))}

        {/* 3D Navigation Vehicle Chevron - Always Rendered Above Route Lines */}
        {tripActive && vehiclePos && (
          <g
            transform={`translate(${vehiclePos.x}, ${vehiclePos.y})`}
          >
            {/* Outer Cyan Pulse Glow Halo */}
            <circle
              r="26"
              fill="rgba(56, 189, 248, 0.22)"
              stroke="rgba(56, 189, 248, 0.45)"
              strokeWidth="1.5"
            />
            {/* Dark Vehicle Base Puck */}
            <circle
              r="22"
              fill="#0f172a"
              stroke="#38bdf8"
              strokeWidth="2.5"
              style={{ filter: 'drop-shadow(0 4px 14px rgba(0, 0, 0, 0.85))' }}
            />
            {/* Rotating Directional Navigation Arrow */}
            <g transform={`rotate(${vehiclePos.bearing})`}>
              <path
                d="M 0 -13 L -8 9 L 0 5 L 8 9 Z"
                fill="#38BDF8"
                stroke="#FFFFFF"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </g>
          </g>
        )}
      </svg>

      {/* Route Marker Labels - Guaranteed Above Route Lines (z-20) */}
      {markersPos.map(mk => (
        <div
          key={mk.id}
          className={`custom-marker ${mk.cls}`}
          style={{
            position: 'absolute',
            left: `${mk.x}px`,
            top: `${mk.y}px`,
            transform: 'translate(-50%, -50%)',
            zIndex: 20,
            pointerEvents: 'none',
          }}
        >
          <span>{mk.label}</span>
        </div>
      ))}

      {tripActive && (
        <>
          <div className="nav-hud-top">
            <div className="nav-turn-icon-container">
              {getTurnIcon(currentStep?.type, currentStep?.modifier)}
            </div>
            <div className="nav-turn-info">
              <div className="nav-turn-distance">{displayTurnDistance}</div>
              <div className="nav-turn-instruction">{displayInstruction}</div>
            </div>
          </div>

          {/* 5-Second Proximity Disaster Warning Popup */}
          {activeHazardAlert && (
            <div className="nav-hazard-popup" role="alert">
              <div className="hazard-timer-bar" />
              <div className="nav-hazard-icon-box">
                {getHazardIcon(activeHazardAlert.type)}
              </div>
              <div className="nav-hazard-content">
                <div className="nav-hazard-header">
                  <span className="nav-hazard-badge">
                    <ShieldAlert size={13} /> DISASTER WARNING
                  </span>
                  <button
                    className="nav-hazard-close"
                    onClick={() => {
                      if (hazardAlertTimeoutRef.current) clearTimeout(hazardAlertTimeoutRef.current);
                      setActiveHazardAlert(null);
                    }}
                    aria-label="Dismiss warning"
                  >
                    <CloseIcon size={14} />
                  </button>
                </div>
                <div className="nav-hazard-title">{activeHazardAlert.title}</div>
                <p className="nav-hazard-desc">{activeHazardAlert.description}</p>
                <div className="nav-hazard-meta">
                  <span>Stretch: {activeHazardAlert.affected_stretch_km} km</span>
                  <span>•</span>
                  <span className="nav-hazard-severity">{activeHazardAlert.severity}</span>
                </div>
              </div>
            </div>
          )}

          {!isFollowing && (
            <button className="btn-recenter" onClick={handleRecenter} aria-label="Recenter on vehicle">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L4.5 20.29C4.19 21.05 4.95 21.81 5.71 21.5L12 18.5L18.29 21.5C19.05 21.81 19.81 21.05 19.5 20.29L12 2Z" fill="#38BDF8" stroke="#FFF" strokeWidth="1.8" strokeLinejoin="round"/>
              </svg>
              Recenter
            </button>
          )}

          <div className="nav-hud-bottom">
            <div className="nav-stat">
              <span className="nav-stat-val">{displayRemainingDistance}</span>
              <span className="nav-stat-lbl">Distance</span>
            </div>
            <div className="nav-stat">
              <span className="nav-stat-val">{displayRemainingEta}</span>
              <span className="nav-stat-lbl">ETA</span>
            </div>
            <div className="nav-stat">
              <span className="nav-stat-val">{Math.round(currentBearing)}°</span>
              <span className="nav-stat-lbl">Heading</span>
            </div>
            <div className="nav-controls">
              <button
                className="btn-nav-control"
                onClick={() => setSimSpeed(s => {
                  const nextIdx = (SPEED_STAGES.indexOf(s) + 1) % SPEED_STAGES.length;
                  return SPEED_STAGES[nextIdx];
                })}
                title="Change Simulation Speed"
              >
                {simSpeed}x
              </button>
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
