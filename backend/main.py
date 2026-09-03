from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import os

# Import existing router logic
from logistics_router import process_route_analysis, RouteRequest

load_dotenv()

app = FastAPI(title="SIH Smart Logistics API")

# Configure CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For hackathon/development; restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "ok", "message": "Smart Logistics API is running"}

from api.weather import get_weather
from api.warehouses import get_nearby_warehouses
from api.ml_risk import predict_road_risk, RiskPredictionRequest

@app.get("/api/weather")
def weather(lat: float, lon: float):
    return get_weather(lat, lon)

@app.get("/api/warehouses")
def warehouses(lat: float, lon: float, radius: int = 50000):
    return get_nearby_warehouses(lat, lon, radius)

@app.post("/api/ml/predict-risk")
def ml_predict(req: RiskPredictionRequest):
    result = predict_road_risk(req)
    if result["status"] == "error":
        raise HTTPException(status_code=501, detail=result["message"])
    return result

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
