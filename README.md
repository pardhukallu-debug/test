# Smart Logistics GIS Routing & 3D POV Navigation Module

SIH Hackathon 2026 — GIS Road Routing, Geocoding, Turn-by-Turn Guidance, and 3D POV Driver Navigation.

## Directory Structure

```
.
├── backend/
│   └── logistics_router.py            # Standalone Python Routing & Geocoding Module
├── frontend/
│   ├── LogisticsMapNavigation.tsx     # React 3D POV Navigation Map Component
│   └── LogisticsMapNavigation.css     # CSS Styles for Map Markers & Navigation HUD
├── INTEGRATION_GUIDE.md               # Quickstart Integration Docs
└── README.md
```

## Features
- **Smart Routing & Fallback**: Real road network routing via OpenStreetMap OSRM with optional Google Maps Directions API fallback.
- **State-Only Borders**: Hides cluttering district/county lines, displaying clean State and Country borders.
- **3D POV Driver Navigation Mode**: Real-time course-up map rotation (`bearing`), 52° windshield pitch angle, speed controls (`1x`, `2x`, `4x`), and authentic Google Maps navigation chevron arrow (`▲`).
- **Turn-by-Turn Steps**: Structured step guidance (`instruction`, `distance_m`, `duration_min`, `type`, `modifier`, `location`).

Refer to [`INTEGRATION_GUIDE.md`](./INTEGRATION_GUIDE.md) for full integration details into any custom backend/frontend stack.
