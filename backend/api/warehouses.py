import math
import random
from pydantic import BaseModel
import requests

class WarehouseResponse(BaseModel):
    status: str
    data: list
    message: str = ""

def reverse_geocode_sim(lat: float, lon: float) -> str:
    """Simulate regional location names using real, recognizable cities 
    so that Nominatim can actually geocode them when routing."""
    places = [
        "Guwahati, Assam",
        "Dispur, Assam",
        "Jorabat, India",
        "Tezpur, Assam",
        "Shillong, Meghalaya",
        "Silchar, Assam",
        "Dimapur, Nagaland",
        "Nagaon, Assam"
    ]
    return random.choice(places)

def get_nearby_warehouses(lat: float, lon: float, radius_km: float = 50.0):
    warehouses = []
    
    prefixes = ["Alpha", "Prime", "Apex", "Global", "Regional", "Central", "Northeast", "Frontier", "Swift", "Gati"]
    suffixes = ["Logistics Hub", "Distribution Center", "Storage Facility", "Supply Chain Node", "Fulfillment Center", "Warehouse"]
    
    num_warehouses = random.randint(4, 8)
    random.seed(int(lat * 100) + int(lon * 100))
    
    for i in range(num_warehouses):
        dist_km = random.uniform(1.0, radius_km)
        angle = random.uniform(0, 2 * math.pi)
        
        lat_offset = (dist_km * math.cos(angle)) / 111.0
        lon_offset = (dist_km * math.sin(angle)) / (111.0 * math.cos(math.radians(lat)))
        
        w_lat = lat + lat_offset
        w_lon = lon + lon_offset
        
        name = f"{random.choice(prefixes)} {random.choice(suffixes)}"
        
        capacity_choice = random.choice(['Small', 'Medium', 'Large', 'Massive'])
        sqft = {
            'Small': random.randint(2000, 5000),
            'Medium': random.randint(5000, 15000),
            'Large': random.randint(15000, 50000),
            'Massive': random.randint(50000, 100000)
        }[capacity_choice]

        warehouses.append({
            "id": f"wh_fake_{i}",
            "name": name,
            "lat": w_lat,
            "lon": w_lon,
            "location_name": reverse_geocode_sim(w_lat, w_lon),
            "capacity": capacity_choice,
            "storage_sqft": f"{sqft:,}",
            "status": "Available" if random.random() > 0.1 else "Full",
            "distance_km": round(dist_km, 1)
        })
        
    warehouses.sort(key=lambda w: w["distance_km"])
    
    return {
        "status": "success",
        "data": warehouses,
        "message": f"Generated {num_warehouses} synthetic warehouses."
    }
