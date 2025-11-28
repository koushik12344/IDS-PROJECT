from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import numpy as np
import joblib
import os
from typing import Dict, Any

app = FastAPI(docs_url="/docs", redoc_url="/redoc", openapi_url="/openapi.json")

# Allow browser access to docs from local machine (adjust origins for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Paths
MODEL_PATH = "model/ids_model.pkl"
SCALER_PATH = "model/scaler.pkl"
COLUMNS_PATH = "model/columns.pkl"
LABEL_ENCODER_PATH = "model/label_encoder.pkl"


class PredictRequest(BaseModel):
    features: Dict[str, Any]


# --- Load Model & Scaler Safely ---
def safe_load(path):
    if not os.path.exists(path):
        raise FileNotFoundError(f"Required file not found: {path}")
    return joblib.load(path)


try:
    model = safe_load(MODEL_PATH)
    scaler = safe_load(SCALER_PATH)
except Exception as e:
    # If running as a module, we want startup failures to be visible
    raise RuntimeError(f"Failed to load model artifacts: {e}")

# Try loading feature columns (optional)
columns = None
if os.path.exists(COLUMNS_PATH):
    try:
        columns = joblib.load(COLUMNS_PATH)
    except Exception:
        columns = None

# Optional label encoder for human-readable labels
label_encoder = None
if os.path.exists(LABEL_ENCODER_PATH):
    try:
        label_encoder = joblib.load(LABEL_ENCODER_PATH)
    except Exception:
        label_encoder = None


@app.get("/")
def home():
    # Redirect to the interactive docs UI for convenience
    return RedirectResponse(url="/docs")


@app.post("/predict")
def predict(req: PredictRequest):
    data = req.features

    # If we have stored column order, require those keys
    if columns is not None:
        missing = [c for c in columns if c not in data]
        if missing:
            raise HTTPException(status_code=400, detail={
                "error": "Missing features",
                "missing": missing,
                "expected_count": len(columns)
            })

        try:
            input_arr = np.array([data[c] for c in columns], dtype=float).reshape(1, -1)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid feature values: {e}")
    else:
        # Fallback: use provided values in insertion order
        try:
            input_arr = np.array(list(data.values()), dtype=float).reshape(1, -1)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid feature values: {e}")

    # Validate input shape against scaler/model if possible
    expected_n = getattr(scaler, "n_features_in_", None) or getattr(model, "n_features_in_", None)
    if expected_n is not None and input_arr.shape[1] != expected_n:
        raise HTTPException(status_code=400, detail={
            "error": "Feature count mismatch",
            "expected": expected_n,
            "received": input_arr.shape[1]
        })

    # Scale and predict
    try:
        scaled = scaler.transform(input_arr)
        pred = model.predict(scaled)[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")

    # Build human-friendly label if encoder exists
    human_label = None
    if label_encoder is not None:
        try:
            human_label = label_encoder.inverse_transform([pred])[0]
        except Exception:
            human_label = str(pred)
    else:
        human_label = str(int(pred)) if (isinstance(pred, (int, np.integer)) or float(pred).is_integer()) else str(pred)

    alert_msg = "⚠️ Intrusion Detected! Threat Alert Triggered!" if int(pred) == 1 else "✔ System Safe — No threat detected."

    return {
        "prediction": int(pred) if (isinstance(pred, (int, np.integer)) or float(pred).is_integer()) else pred,
        "label": human_label,
        "alert": alert_msg
    }


if __name__ == "__main__":
    # Prefer running the app via uvicorn for better logs in production, but allow python app.py
    uvicorn.run("app:app", host="0.0.0.0", port=8000)
