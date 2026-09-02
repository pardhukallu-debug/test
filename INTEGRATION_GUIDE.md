# Standalone GIS & Route Navigation Integration Guide

This package contains all the self-contained files required to plug real road routing, geocoding, turn-by-turn guidance, and 3D POV driver navigation into **any custom backend and frontend codebase**.

---

## Package Files

```
export/
├── backend/
│   └── logistics_router.py            # Complete Python Routing & Geocoding Module
├── frontend/
│   ├── LogisticsMapNavigation.tsx     # React 3D POV Navigation Map Component
│   └── LogisticsMapNavigation.css     # CSS Styles for Map Markers & Navigation HUD
└── INTEGRATION_GUIDE.md
```

---

## 1. Backend Integration (FastAPI / Flask / Django)

### Dependencies
Install the required packages in your backend environment:

```bash
pip install requests polyline pydantic
```

### Option A: Using with FastAPI
Import `process_route_analysis` or `RouteRequest` in your FastAPI app:

```python
from fastapi import FastAPI, HTTPException
from logistics_router import process_route_analysis, RouteRequest

app = FastAPI()

@app.post("/api/route/analyze")
def analyze_route(req: RouteRequest):
    try:
        return process_route_analysis(
            source_name=req.source,
            destination_name=req.destination,
            transport_type=req.transport_type,
            via_name=req.via
        )
    except ValueError as err:
        raise HTTPException(status_code=404, detail=str(err))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
```

### Option B: Using with Flask
```python
from flask import Flask, request, jsonify
from logistics_router import process_route_analysis

app = Flask(__name__)

@app.route("/api/route/analyze", methods=["POST"])
def analyze():
    data = request.get_json()
    result = process_route_analysis(
        source_name=data.get("source"),
        destination_name=data.get("destination"),
        transport_type=data.get("transport_type", "truck")
    )
    return jsonify(result)
```

---

## 2. Frontend Integration (React / Next.js / Vite)

### Dependencies
Install MapLibre GL in your frontend project:

```bash
npm install maplibre-gl
```

### Copying Component Files
Copy `LogisticsMapNavigation.tsx` and `LogisticsMapNavigation.css` into your project's `components/` directory.

### Usage in React Page / Component
```tsx
import React, { useState } from 'react';
import LogisticsMapNavigation, { RouteFeature } from './components/LogisticsMapNavigation';

export default function MyLogisticsPage() {
  const [routes, setRoutes] = useState<RouteFeature[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState('route_a');
  const [tripActive, setTripActive] = useState(false);

  const handleFetchRoute = async () => {
    const res = await fetch("http://localhost:8000/api/route/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "Guwahati, Assam",
        destination: "Tawang, Arunachal Pradesh",
        transport_type: "truck"
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      setRoutes(data.data.features);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Your Sidebar / Form Controls */}
      <div style={{ width: '360px', padding: '20px' }}>
        <button onClick={handleFetchRoute}>Get Routes</button>
        {routes.length > 0 && (
          <button onClick={() => setTripActive(true)}>
            Start 3D POV Drive
          </button>
        )}
      </div>

      {/* Standalone 3D POV Navigation Map Container */}
      <div style={{ flex: 1 }}>
        <LogisticsMapNavigation
          features={routes}
          selectedRouteId={selectedRouteId}
          tripActive={tripActive}
          onTripEnd={() => setTripActive(false)}
        />
      </div>
    </div>
  );
}
```

---

## Key Features Included
- **Geocoding & Fallbacks**: Smart OpenStreetMap Nominatim geocoding + OSRM road network routing + optional Google Maps Directions API fallback.
- **State-Only Boundaries**: Automatically filters out minor district/county spiderweb lines, showing clean state/country borders.
- **3D POV Driver Navigation Mode**: Real-time course-up map rotation (`bearing`), 52° windshield pitch angle, and authentic Google Maps navigation chevron arrow (`▲`).
- **Turn-by-Turn Guidance**: Full step maneuver parsing (`instruction`, `distance_m`, `duration_min`, `type`, `modifier`, `location`).
