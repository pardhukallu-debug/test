import os
import sys
from pydantic import BaseModel

possible_paths = [
    os.getenv("ML_MODEL_SRC"),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "ml-model", "src")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ml-model", "src")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "ml-model", "src")),
]
for p in possible_paths:
    if p and os.path.exists(p) and p not in sys.path:
        sys.path.insert(0, p)
        break

try:
    from predict import predict_risk as _predict_risk
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False

class RiskPredictionRequest(BaseModel):
    lat: float
    lon: float
    weather_precipitation: float = 5.0
    route_distance_km: float = 0.0   # used to vary predictions per route
    route_index: int = 0             # explicitly determine alternate route severity

def predict_road_risk(req: RiskPredictionRequest) -> dict:
    if not ML_AVAILABLE:
        return {"status": "error", "message": "ML predict module unavailable."}
    try:
        weather = {"precipitation": req.weather_precipitation}
        result = _predict_risk(req.lat, req.lon, weather, req.route_index)
        return {"status": "success", "data": result}
    except Exception as e:
        return {"status": "error", "message": f"Prediction failed: {str(e)}"}
