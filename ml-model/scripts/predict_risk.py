import pandas as pd
import joblib


# ============================================================
# CONFIGURATION
# ============================================================

MODEL_PATH = "models/road_risk_random_forest_spatial.pkl"

DATA_PATH = "data/processed/master/road_risk_labeled.csv"


FEATURES = [
    "elevation_m",
    "slope_deg",
    "rain_mean_daily_mm",
    "rain_max_daily_mm",
    "rain_max_7day_mm",
    "heavy_rain_days",
    "very_heavy_rain_days",
    "extreme_rain_days",
    "landslide_distance_km",
    "landslide_count_5km",
    "landslide_count_10km",
    "landslide_nearby",
    "flood_direct_count",
    "flood_direct_exposure",
    "flood_events_5km",
    "flood_events_10km",
    "flood_nearby_5km",
    "flood_nearby_10km",
    "nearest_flood_distance_km"
]


# ============================================================
# LOAD MODEL
# ============================================================

print("Loading AI model...")

model = joblib.load(MODEL_PATH)

print("Model loaded successfully.")


# ============================================================
# PREDICT ONE ROAD
# ============================================================

def predict_road_risk(road_data):

    # Convert input into DataFrame
    input_df = pd.DataFrame([road_data])

    # Check that all required features exist
    missing_features = [
        feature
        for feature in FEATURES
        if feature not in input_df.columns
    ]

    if missing_features:
        raise ValueError(
            f"Missing required features: {missing_features}"
        )

    # Select features in the exact order used during training
    X = input_df[FEATURES]

    # Predict risk class
    prediction = model.predict(X)[0]

    # Predict probabilities
    probabilities = model.predict_proba(X)[0]

    # Get class names
    classes = model.classes_

    probability_dict = {
        class_name: float(probability)
        for class_name, probability in zip(classes, probabilities)
    }

    # Highest probability
    confidence = float(max(probabilities))

    return {
        "risk_label": prediction,
        "confidence": confidence,
        "probabilities": probability_dict
    }


# ============================================================
# TEST USING A REAL ROAD FROM DATASET
# ============================================================

if __name__ == "__main__":

    print("\nLoading road dataset...")

    df = pd.read_csv(DATA_PATH)

    # Select first road as test example
    road = df.iloc[0]

    road_data = {
        feature: road[feature]
        for feature in FEATURES
    }

    result = predict_road_risk(road_data)

    print("\n" + "=" * 60)
    print("ROAD RISK PREDICTION")
    print("=" * 60)

    print(f"\nRoad ID: {road['road_id']}")

    print(f"\nPredicted Risk: {result['risk_label']}")

    print(
        f"Confidence: "
        f"{result['confidence'] * 100:.2f}%"
    )

    print("\nRisk Probabilities:")

    for label, probability in result["probabilities"].items():

        print(
            f"  {label:<10} "
            f"{probability * 100:.2f}%"
        )

    print("\n" + "=" * 60)