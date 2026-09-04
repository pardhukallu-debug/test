# Deployment Guide: Smart Logistics NER

This guide covers everything required to deploy the full-stack Smart Logistics application into production environments.

---

## Architecture Overview

- **Frontend**: React 19 + TypeScript + Vite + TailwindCSS + MapLibre GL
- **Backend**: FastAPI (Python 3.11) + Uvicorn ASGI Server
- **ML / AI**: Scikit-Learn Spatial Random Forest model (`ml-model/`)
- **APIs & Services**: OpenStreetMap / Nominatim (free geocoding), Open-Meteo (real-time weather)

---

## Option 1: Docker Compose (Local & Self-Hosted VPS / EC2)

Deploy the entire stack (both frontend and backend) with a single command:

```bash
# Clone the repository
git clone https://github.com/pardhukallu-debug/test.git
cd test

# Launch both services in background
docker compose up --build -d
```

- **Frontend**: Accessible at `http://localhost:3000` (and `http://localhost:80`)
- **Backend**: Accessible at `http://localhost:8000` (Swagger docs at `http://localhost:8000/docs`)
- **Health check**: `http://localhost:8000/health`

To view logs:
```bash
docker compose logs -f
```

To stop:
```bash
docker compose down
```

---

## Option 2: Cloud PaaS (Free Tier Compatible: Render + Vercel)

### Step 1: Deploy Backend (Render or Railway)

#### Using Render:
1. Go to [Render.com](https://render.com) and create a **New Web Service**.
2. Connect this GitHub repository.
3. Configure the settings:
   - **Root Directory**: `.`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `python -m uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
4. Set Environment Variables:
   - `ALLOWED_ORIGINS`: `*` (or your frontend Vercel/domain URL)
   - `PYTHONUNBUFFERED`: `1`
5. Click **Create Web Service**.
6. Once deployed, copy your backend URL: e.g. `https://smart-logistics-backend.onrender.com`.

---

### Step 2: Deploy Frontend (Vercel or Netlify)

#### Using Vercel:
1. Go to [Vercel.com](https://vercel.com) and import this GitHub repository.
2. Configure project settings:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Add Environment Variable:
   - `VITE_API_URL`: `https://smart-logistics-backend.onrender.com` (your backend URL from Step 1)
4. Click **Deploy**.
5. Client-side routing is automatically handled via the included [frontend/vercel.json](frontend/vercel.json).

#### Using Netlify:
1. Connect repo on Netlify.
2. Base directory: `frontend`
3. Build command: `npm run build`
4. Publish directory: `frontend/dist`
5. Add build environment variable: `VITE_API_URL`
6. Client-side routing is handled via the included [frontend/public/_redirects](frontend/public/_redirects).

---

## Option 3: One-Click Render Blueprint

The repository includes a [render.yaml](render.yaml) file.
1. Connect this repo to Render via **Blueprints**.
2. Render will automatically detect and deploy both the backend service and the static frontend with environment variables connected!

---

## Environment Variables Reference

### Frontend (`frontend/.env`)
| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `VITE_API_URL` | Full URL of the backend API service | `http://localhost:8000` or `https://backend.domain.com` |

### Backend (`backend/.env`)
| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | Port for the HTTP server to listen on | `8000` |
| `HOST` | Host address | `0.0.0.0` |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowed origins | `*` |
| `GOOGLE_MAPS_API_KEY` | *(Optional)* Google Directions API key | Fallback to OSM / OSRM if unset |

---

## Health Check & Verification

Once deployed, verify the installation:

```bash
# 1. Check Backend Health
curl https://<your-backend-domain>/health
# Expected output: {"status":"ok","message":"Smart Logistics API is running"}

# 2. Test Weather API
curl "https://<your-backend-domain>/api/weather?lat=26.1158&lon=91.7086"

# 3. Test Warehouses API
curl "https://<your-backend-domain>/api/warehouses?lat=26.1158&lon=91.7086"
```
