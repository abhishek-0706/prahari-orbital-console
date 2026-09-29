# PRAHARI × Google Earth Engine

Real satellite analysis for Cyclone Fani / Puri — **no mock data**. Everything here
derives from live Earth Engine datasets (Sentinel-1 SAR, Copernicus DEM, WorldPop,
GPM IMERG) and feeds the PRAHARI Orbital Console.

## What each file does

| File | Purpose |
|------|---------|
| `prahari_gee.js` | Paste into the [GEE Code Editor](https://code.earthengine.google.com). Computes SAR flood extent, DEM surge zone, population exposure, rainfall; prints a live tile URL; exports real GeoJSON. |
| `export_prahari.py` | Headless version (Python API / service account). Prints a live tile URL and starts GeoJSON export tasks. |
| `tile_proxy/` | Cloud Run service that serves **stable** GEE tiles (`/tiles/{z}/{x}/{y}`) so the static console needs no expiring token. |

## Prerequisites (the real schedule risk)

1. A Google Cloud project with the **Earth Engine API enabled**.
2. **Earth Engine registration** approved for that project (`https://code.earthengine.google.com` → sign up). Approval can take a day or two.
3. For headless/proxy use: a **service account** with the *Earth Engine Resource Viewer* role and a JSON key.

## Two ways to get GEE into the console

### A. Quick demo — Code Editor tile URL
1. Open `prahari_gee.js` in the Code Editor and **Run**.
2. In the console output, copy the printed **`>>> GEE tile URL`** (an XYZ template ending `/{z}/{x}/{y}`).
3. In the PRAHARI console, layer dock → **right-click the 🌍 GEE button** → paste the URL.
4. Left-click the GEE button to toggle the live flood + surge overlay on/off.

> Code Editor tile URLs are session-scoped and expire — fine for a live demo, not for production.

### B. Stable — Cloud Run tile proxy (recommended for submission link)
```bash
cd tile_proxy
npm install
export EE_KEY=./service-account.json
export EE_PROJECT=your-ee-project
node server.js            # -> http://localhost:8080/tiles/{z}/{x}/{y}
```
Deploy:
```bash
gcloud run deploy prahari-gee-proxy --source . --allow-unauthenticated \
  --set-env-vars EE_PROJECT=your-ee-project \
  --set-secrets EE_KEY=/secrets/key.json:gee-sa-key:latest
```
Then paste `https://<cloud-run-url>/tiles/{z}/{x}/{y}` into the console's GEE button. This URL never expires — the proxy refreshes the mapid internally.

## Replace the synthetic fixtures with real data (Path A)

`prahari_gee.js` / `export_prahari.py` start two GeoJSON export tasks:
`prahari_flood_zones_gee` and `prahari_surge_zone_gee`. When they finish (Drive),
drop the GeoJSON into `prahari_data.js` under `floodZones` / a new `surgeZone` key —
now the map's analytic layers are GEE-derived, not synthetic.

## Datasets used

- `COPERNICUS/S1_GRD` — Sentinel-1 C-band SAR (flood detection)
- `COPERNICUS/DEM/GLO30` — Copernicus 30 m DEM (surge-exposure elevation)
- `JRC/GSW1_4/GlobalSurfaceWater` — permanent-water mask
- `WorldPop/GP/100m/pop` — population exposure
- `NASA/GPM_L3/IMERG_V07` — rainfall accumulation
