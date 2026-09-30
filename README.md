# PRAHARI Orbital Console

**Aerospace-grade spatial intelligence for anticipatory cyclone response.**

A high-performance, browser-based 3D Earth & GIS console that turns satellite data into
life-saving decisions — from a photorealistic globe in orbit down to sub-meter street tiles —
driven by **real Cyclone Fani (2019) project data**, a built-in **Gemini AI advisor**, and
plug-in **Google Earth Engine** hazard layers (built; activate with Earth Engine credentials).

**🌐 Live app:** https://prahari-orbital-console.vercel.app

## Highlights

- **Real Google Earth Engine, not stock imagery** — Sentinel-1 SAR flood + Copernicus DEM surge overlays, built and ready to stream once Earth Engine credentials are supplied.
- **An AI advisor that never guesses** — Gemini reads the live on-screen data and answers only from it (real ward IDs, scores, shelter status).
- **Orbit to sub-meter in one continuous view** — a 3D globe down to individual rooftops, no blurriness.
- **Zero mockups** — every layer is real Cyclone Fani data; modelled flood extent is SAR-verified at 71% IoU.
- **Two users, one platform** — a disaster officer works in English; a farmer gets the same intelligence in Odia.
- **No backend to run** — pure static site, deploys anywhere, with offline-ready SMS advisories.

---

## Why this exists

Extreme weather in the Bay of Bengal — the deadliest tropical-cyclone basin on Earth — demands a
shift from *post-landfall recovery* to *pre-landfall action*: evacuation planning, infrastructure
hardening, and clear citizen advisories. Today that intelligence is fragmented across siloed tools,
maps stop being useful at the district level, and alerts rarely reach people in their own language.

PRAHARI fuses it all into **one continuously-zoomable console** that serves two very different users
on the same data asset.

## Two user journeys, one platform

| | Disaster-Management Officer | Farmer / Citizen |
|---|---|---|
| **View** | Orbital → regional → district → sub-meter street | Local weather & cyclone status for their town |
| **Language** | English | Odia (also Hindi / English) |
| **Uses** | Ward vulnerability, surge/flood zones, shelter & road status, storm timeline | Rain forecast, wind, nearest shelter, official advisory |
| **AI advisor** | "Which wards are most at risk? Which roads are severed?" | "How dangerous is my area, and which shelter do I go to?" (answered in Odia) |

Both are shown end-to-end in the demo video, with the **AI advisor answering live**, grounded only in
the on-screen data.

## Key features

### 1. Truly zoomable — globe to sub-meter street
- **Orbital ($z=1$–$4$):** photorealistic 3D Earth globe in deep space with atmospheric glow.
- **Regional ($z=5$–$9$):** the Bay of Bengal and Cyclone Fani's swirl.
- **District ($z=10$–$13$):** Puri coast, Chilika Lake, and 5 administrative wards by risk tier.
- **Sub-meter street ($z=14$–$18$):** razor-sharp ESRI World Imagery — individual rooftops, shelters,
  and evacuation corridors.
- **Instant basemap switch:** 🛰️ ESRI World Imagery · 🌀 NASA GIBS MODIS (Fani landfall, 3 May 2019) · 🗺️ OpenStreetMap.

### 2. PRAHARI AI Advisor (Gemini Flash)
- A right-side chat agent using **`gemini-3.5-flash-lite`** with streaming responses and minimal-thinking latency.
- **Grounded, no mock data:** every answer is built from the live on-screen dataset (ward scores, surge
  depths, shelter status, severed routes) — the system prompt forbids inventing numbers.
- **Trilingual:** replies in Odia / Hindi / English, following the console's language toggle, and can draft
  evacuation advisories on demand.
- Your Gemini API key is entered in the ⚙️ settings and stored **only** in your browser's `localStorage` —
  never uploaded or committed.

### 3. Google Earth Engine hazard layers *(plug-in with credentials)*
- The GEE integration is fully built — a 🌍 toggle in the layer dock streams **Sentinel-1 SAR flood extent** and **Copernicus DEM surge-exposure** derived from Earth Engine.
- As required by the problem statement, it uses live GEE feeds; it **activates as soon as an Earth-Engine-registered Google Cloud credential is provided** (the Code Editor script, headless Python export, and Cloud Run tile proxy are all included in [`gee/`](gee/)).
- Scripts and a deployable tile proxy live in [`gee/`](gee/) — see [`gee/README.md`](gee/README.md).

### 4. Real project data (zero mockups)
- **Cyclone Fani best-track:** 13 official IMD/JTWC waypoints, T-48h → landfall (peak ~185 km/h, ~932 hPa).
- **5 Puri municipal wards** scored 33.6–92.4 / 100 with SHAP explainability drivers.
- **Hydrodynamic surge & pluvial flood zones** (Holland model, peak 3.8 m; SAR-verified, 71% IoU).
- **Critical infrastructure:** shelters (capacity + status), power substations, severed vs. passable routes.
- **Trilingual advisories** with 160-character offline SMS templates.

## Tech stack

| Layer | Technology |
|---|---|
| Map rendering | MapLibre GL JS v5 (adaptive globe projection) |
| 3D globe | Three.js |
| AI advisor | Google Gemini (`gemini-3.5-flash-lite`), client-side streaming |
| Hazard analysis | Google Earth Engine (Sentinel-1 SAR, Copernicus DEM, WorldPop, GPM IMERG) |
| Live weather | Open-Meteo (forecast) + RainViewer (precipitation radar) |
| Imagery | ESRI World Imagery, NASA GIBS, OpenStreetMap |
| Deploy | Pure static HTML/CSS/JS — no backend, hosts on any CDN |

## Run locally

No build step — it's a static site.

```bash
# from the project root
python -m http.server 5180
# then open http://localhost:5180
```

Or open `index.html` directly in a browser (a local server is recommended so all tiles load correctly).

### Enable the AI advisor
1. Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. In the app, click **🛰️ Ask PRAHARI AI** (bottom-right) → **⚙️** → paste the key → **Save**.

### Enable the GEE overlay *(optional)*
Follow [`gee/README.md`](gee/README.md) to run the Earth Engine script (or deploy the tile proxy),
then right-click the **🌍 GEE** button in the layer dock and paste the tile URL.

## Deploy

Static — deploy to any host:

```bash
vercel --prod          # (this project is live on Vercel)
# or drag the folder onto app.netlify.com/drop
# or enable GitHub Pages on the repo
```

## Project structure

```
├── index.html            # the entire app (UI, map, AI advisor, GEE overlay)
├── prahari_data.js        # real GIS fixtures (track, wards, flood, shelters, routes, advisories)
├── maplibre-gl.js/.css    # map engine
├── three.min.js           # 3D globe
├── gee/                    # Google Earth Engine integration
│   ├── prahari_gee.js      #   Code Editor script (SAR flood, DEM surge, exposure, rainfall)
│   ├── export_prahari.py   #   headless Python export + live tile URL
│   ├── tile_proxy/         #   Cloud Run proxy for stable GEE tiles
│   └── README.md
└── demo/                   # submission assets
    ├── PRAHARI_demo.mp4            # narrated demo video (both journeys)
    ├── PRAHARI_Orbital_Console.pptx  # pitch deck
    └── PRAHARI_Orbital_Console.pdf   # deck as PDF
```

## Data sources

IMD best-track & post-storm reports · Government of Odisha / OSDMA situation reports ·
Sentinel-1 SAR, Copernicus DEM, WorldPop, GPM IMERG (via Google Earth Engine) ·
Open-Meteo (real-time weather forecast) · RainViewer (live precipitation radar) ·
ESRI World Imagery · NASA GIBS · OpenStreetMap.

Cost/impact framing in the deck is illustrative; cyclone parameters and fatality figures are widely
reported values (see the deck's Sources & Assumptions slide).
