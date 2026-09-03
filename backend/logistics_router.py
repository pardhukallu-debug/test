import os
import re
import time
import requests
import polyline
from pydantic import BaseModel

HEADERS = {
    "User-Agent": "SmartLogisticsNER/2.0 (educational logistics demo)",
    "Accept-Language": "en",
}

# Google Maps API Key (optional fallback to OSRM if missing/invalid)
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

class RouteRequest(BaseModel):
    source: str
    destination: str
    transport_type: str = "truck"
    via: str = ""

_GEOCODE_CACHE: dict = {}

def geocode(place: str) -> tuple[float, float]:
    """
    Resolve a city/place name to (longitude, latitude) using Nominatim.
    Caches results to avoid hitting Nominatim rate limit (1 req/sec).
    """
    key = place.strip().lower()
    if key in _GEOCODE_CACHE:
        return _GEOCODE_CACHE[key]

    url = "https://nominatim.openstreetmap.org/search"
    q = place if "india" in place.lower() else f"{place}, India"

    for attempt in range(3):
        try:
            time.sleep(1.1)   # Nominatim strictly enforces 1 req/sec
            params = {"q": q, "format": "json", "limit": 1, "countrycodes": "in"}
            resp = requests.get(url, params=params, headers=HEADERS, timeout=12)
            resp.raise_for_status()
            data = resp.json()
            if data:
                result = (float(data[0]["lon"]), float(data[0]["lat"]))
                _GEOCODE_CACHE[key] = result
                return result

            # Fallback without country filter
            time.sleep(1.1)
            params_fb = {"q": place, "format": "json", "limit": 1}
            resp_fb = requests.get(url, params=params_fb, headers=HEADERS, timeout=12)
            data_fb = resp_fb.json()
            if data_fb:
                result = (float(data_fb[0]["lon"]), float(data_fb[0]["lat"]))
                _GEOCODE_CACHE[key] = result
                return result

        except Exception as exc:
            if attempt == 2:
                raise RuntimeError(f"Geocoding failed after 3 attempts: {exc}")
            time.sleep(2)
            continue

    raise ValueError(f"Location '{place}' not found. Try adding state/country (e.g. 'Guwahati, Assam').")

def reverse_geocode(lon: float, lat: float) -> str:
    """Best-effort reverse geocoding for waypoint labels."""
    url = "https://nominatim.openstreetmap.org/reverse"
    params = {"lon": lon, "lat": lat, "format": "json", "zoom": 10}
    try:
        resp = requests.get(url, params=params, headers=HEADERS, timeout=8)
        data = resp.json()
        addr = data.get("address", {})
        return (
            addr.get("city")
            or addr.get("town")
            or addr.get("village")
            or addr.get("county")
            or addr.get("state_district")
            or "Waypoint"
        )
    except Exception:
        return "Waypoint"

def parse_osrm_steps(legs: list) -> list[dict]:
    """Format OSRM turn-by-turn steps into clean instructions."""
    formatted_steps = []
    for leg in legs:
        for step in leg.get("steps", []):
            dist = step.get("distance", 0)
            dur = step.get("duration", 0)
            name = step.get("name", "").strip()
            maneuver = step.get("maneuver", {})
            m_type = maneuver.get("type", "continue")
            m_mod = maneuver.get("modifier", "")
            loc = maneuver.get("location", [0, 0])

            instruction = ""
            if m_type == "depart":
                instruction = f"Head {'on ' + name if name else 'towards destination'}"
            elif m_type == "arrive":
                instruction = f"Arrive at {name if name else 'destination'}"
            elif m_type in ["turn", "fork"]:
                direction = m_mod.replace("sharp ", "sharply ").replace("slight ", "slightly ")
                instruction = f"Turn {direction}{' onto ' + name if name else ''}"
            elif m_type == "roundabout":
                instruction = f"Take roundabout exit{' onto ' + name if name else ''}"
            else:
                if m_mod:
                    instruction = f"Continue {m_mod}{' on ' + name if name else ''}"
                else:
                    instruction = f"Continue{' on ' + name if name else ''}"

            formatted_steps.append({
                "instruction": instruction,
                "distance_km": round(dist / 1000, 2),
                "distance_m": round(dist),
                "duration_min": round(dur / 60, 1),
                "type": m_type,
                "modifier": m_mod,
                "location": loc,
            })
    return formatted_steps

def parse_google_steps(legs: list) -> list[dict]:
    """Format Google Maps turn-by-turn steps into clean instructions."""
    formatted_steps = []
    for leg in legs:
        for step in leg.get("steps", []):
            html_inst = step.get("html_instructions", "")
            clean_inst = re.sub(r'<[^>]+>', '', html_inst)
            dist = step.get("distance", {}).get("value", 0)
            dur = step.get("duration", {}).get("value", 0)
            loc_dict = step.get("start_location", {})
            loc = [loc_dict.get("lng", 0), loc_dict.get("lat", 0)]
            maneuver = step.get("maneuver", "")

            formatted_steps.append({
                "instruction": clean_inst,
                "distance_km": round(dist / 1000, 2),
                "distance_m": round(dist),
                "duration_min": round(dur / 60, 1),
                "type": maneuver or "turn",
                "modifier": "",
                "location": loc,
            })
    return formatted_steps

def fetch_osrm_routes(src: tuple[float, float], dst: tuple[float, float], via: tuple[float, float] | None = None, alternatives: int = 3) -> list[dict]:
    """Fetch real road network routes from free public OSRM engine."""
    coords = f"{src[0]},{src[1]};"
    if via:
        coords += f"{via[0]},{via[1]};"
    coords += f"{dst[0]},{dst[1]}"
    url = f"https://router.project-osrm.org/route/v1/driving/{coords}"
    params = {"alternatives": "true", "geometries": "polyline", "overview": "full", "steps": "true"}
    try:
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        routes_output = []
        for route in data.get("routes", [])[:alternatives]:
            pts = polyline.decode(route["geometry"])
            coordinates = [[lon, lat] for lat, lon in pts]
            steps = parse_osrm_steps(route.get("legs", []))
            routes_output.append({
                "geometry": {"type": "LineString", "coordinates": coordinates},
                "distance": route["distance"],
                "duration": route["duration"],
                "steps": steps,
            })
        return routes_output
    except Exception:
        return []

def fetch_google_maps_routes(src: tuple[float, float], dst: tuple[float, float], via: tuple[float, float] | None = None, alternatives: int = 3) -> list[dict]:
    """Fetch routes from Google Maps Directions API (requires valid GOOGLE_MAPS_API_KEY)."""
    key = os.getenv("GOOGLE_MAPS_API_KEY")
    if not key:
        return []
    base_url = "https://maps.googleapis.com/maps/api/directions/json"
    origin = f"{src[1]},{src[0]}"  # lat,lon for Google
    destination = f"{dst[1]},{dst[0]}"
    params = {
        "origin": origin,
        "destination": destination,
        "key": key,
        "mode": "driving",
        "alternatives": "true",
    }
    if via:
        params["waypoints"] = f"{via[1]},{via[0]}"
    try:
        resp = requests.get(base_url, params=params, headers=HEADERS, timeout=20)
        resp.raise_for_status()
        data = resp.json()
        if data.get("status") != "OK":
            print(f"[Google Maps] API error: {data.get('status')}")
            return []
        routes_output = []
        for route in data.get("routes", [])[:alternatives]:
            pts = polyline.decode(route["overview_polyline"]["points"])
            coordinates = [[lon, lat] for lat, lon in pts]
            total_distance = sum(leg["distance"]["value"] for leg in route.get("legs", []))
            total_duration = sum(leg["duration"]["value"] for leg in route.get("legs", []))
            steps = parse_google_steps(route.get("legs", []))
            routes_output.append({
                "geometry": {"type": "LineString", "coordinates": coordinates},
                "distance": total_distance,
                "duration": total_duration,
                "steps": steps,
            })
        return routes_output
    except Exception as exc:
        print(f"[Google Maps] Request error: {exc}")
        return []

def get_routes(src: tuple[float, float], dst: tuple[float, float], via: tuple[float, float] | None = None, alternatives: int = 3) -> list[dict]:
    """Dispatch routing to Google Maps if configured, with fallback to OSRM."""
    if os.getenv("GOOGLE_MAPS_API_KEY"):
        try:
            g_routes = fetch_google_maps_routes(src, dst, via=via, alternatives=alternatives)
            if g_routes:
                return g_routes
        except Exception:
            pass
    return fetch_osrm_routes(src, dst, via=via, alternatives=alternatives)

def process_route_analysis(source_name: str, destination_name: str, transport_type: str = "truck", via_name: str = "") -> dict:
    """Complete route analysis pipeline: Geocoding -> Routing -> Response FeatureCollection."""
    src_coord = geocode(source_name)
    dst_coord = geocode(destination_name)

    via_coord = None
    if via_name.strip():
        via_coord = geocode(via_name)

    routes = get_routes(src_coord, dst_coord, via=via_coord, alternatives=3)
    if not routes:
        raise ValueError("Routing service returned no valid routes.")

    ROUTE_META = [
        {"id": "route_a", "label": "Route A", "color": "#10b981"},
        {"id": "route_b", "label": "Route B", "color": "#f59e0b"},
        {"id": "route_c", "label": "Route C", "color": "#ef4444"},
    ]

    features = []
    for rank, route in enumerate(routes[:3]):
        meta = ROUTE_META[rank]
        coords = route["geometry"]["coordinates"]
        dist_km = round(route["distance"] / 1000, 1)
        dur_hrs = round(route["duration"] / 3600, 1)

        time.sleep(0.3)
        mid_label = reverse_geocode(coords[len(coords)//2][0], coords[len(coords)//2][1])
        waypoints = [source_name.split(",")[0].strip(), mid_label, destination_name.split(",")[0].strip()]

        features.append({
            "type": "Feature",
            "geometry": route["geometry"],
            "properties": {
                "route_id": meta["id"],
                "route_label": meta["label"],
                "route_name": f"{'Primary' if rank == 0 else f'Alternative {rank}'} Road Route",
                "is_best_route": rank == 0,
                "color": meta["color"],
                "distance_km": dist_km,
                "eta_hrs": dur_hrs,
                "delay_risk": "LOW" if rank == 0 else ("MEDIUM" if rank == 1 else "HIGH"),
                "accessibility_score": max(40, 95 - rank * 15),
                "waypoints": waypoints,
                "recommendation": f"Route {meta['label']}: {'Shortest travel path' if rank == 0 else 'Alternative route option'}.",
                "steps": route.get("steps", []),
            },
        })

    return {
        "status": "success",
        "route_count": len(features),
        "source": {"name": source_name, "lon": src_coord[0], "lat": src_coord[1]},
        "destination": {"name": destination_name, "lon": dst_coord[0], "lat": dst_coord[1]},
        "data": {
            "type": "FeatureCollection",
            "features": features,
        },
    }
