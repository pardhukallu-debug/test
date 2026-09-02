import pandas as pd
import joblib


# ============================================================
# CONFIGURATION
# ============================================================

MODEL_PATH = "models/road_risk_random_forest_spatial.pkl"

INPUT_PATH = "data/processed/master/road_risk_labeled.csv"

OUTPUT_PATH = "data/processed/master/road_risk_predictions.csv"


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
# 1. LOAD MODEL
# ============================================================

print("=" * 70)
print("ROAD RISK PREDICTION - ALL ROADS")
print("=" * 70)

print("\nLoading Random Forest model...")

model = joblib.load(MODEL_PATH)

print("Model loaded successfully.")


# ============================================================
# 2. LOAD DATASET
# ============================================================

print("\nLoading road dataset...")

df = pd.read_csv(
    INPUT_PATH,
    low_memory=False
)

print(f"Total roads loaded: {len(df):,}")


# ============================================================
# 3. CHECK FEATURES
# ============================================================

missing_features = [
    feature
    for feature in FEATURES
    if feature not in df.columns
]

if missing_features:

    raise ValueError(
        f"Missing required features: {missing_features}"
    )

print(f"Required features found: {len(FEATURES)}")


# ============================================================
# 4. PREPARE MODEL INPUT
# ============================================================

X = df[FEATURES]

print("\nPreparing environmental features...")


# ============================================================
# 5. PREDICT RISK
# ============================================================

print("Running predictions...")
print("This may take some time for 300,813 roads...")

predictions = model.predict(X)

probabilities = model.predict_proba(X)

classes = model.classes_


# ============================================================
# 6. CREATE OUTPUT DATAFRAME
# ============================================================

output = pd.DataFrame()

# Basic road information
output["road_id"] = df["road_id"]
output["latitude"] = df["latitude"]
output["longitude"] = df["longitude"]
output["road_type"] = df["road_type"]

# Model prediction
output["risk_label"] = predictions

# Confidence
output["confidence"] = probabilities.max(axis=1)


# ============================================================
# 7. ADD CLASS PROBABILITIES
# ============================================================

for i, class_name in enumerate(classes):

    output[
        f"probability_{class_name.lower().replace(' ', '_')}"
    ] = probabilities[:, i]


# ============================================================
# 8. ADD IMPORTANT RISK FEATURES
# ============================================================

output["slope_deg"] = df["slope_deg"]

output["rain_max_7day_mm"] = df["rain_max_7day_mm"]

output["landslide_distance_km"] = (
    df["landslide_distance_km"]
)

output["landslide_count_5km"] = (
    df["landslide_count_5km"]
)

output["flood_direct_exposure"] = (
    df["flood_direct_exposure"]
)

output["nearest_flood_distance_km"] = (
    df["nearest_flood_distance_km"]
)


# ============================================================
# 9. SAVE RESULTS
# ============================================================

print("\nSaving predictions...")

output.to_csv(
    OUTPUT_PATH,
    index=False
)


# ============================================================
# 10. SUMMARY
# ============================================================

print("\n" + "=" * 70)
print("PREDICTION COMPLETE")
print("=" * 70)

print(f"\nRoads processed: {len(output):,}")

print("\nRisk distribution:")

print(
    output["risk_label"]
    .value_counts()
    .sort_index()
)

print("\nRisk percentages:")

risk_percent = (
    output["risk_label"]
    .value_counts(normalize=True)
    .mul(100)
    .sort_index()
)

for label, percentage in risk_percent.items():

    print(
        f"  {label:<10} "
        f"{percentage:.2f}%"
    )


print("\nAverage model confidence:")

print(
    f"  {output['confidence'].mean() * 100:.2f}%"
)


print("\nOutput saved to:")

print(OUTPUT_PATH)

print("\n" + "=" * 70)
print("DONE")
print("=" * 70)