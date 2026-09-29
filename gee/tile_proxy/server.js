/**
 * PRAHARI — GEE live-tile proxy (production path)
 * -----------------------------------------------
 * A static browser app cannot hold a GEE service-account key, and Code Editor
 * tile URLs expire. This tiny server authenticates with a service account,
 * computes the Fani/Puri flood+surge overlay once, and serves stable XYZ tiles.
 *
 * The PRAHARI console then uses ONE permanent URL (no expiry to manage):
 *     https://<your-cloud-run-url>/tiles/{z}/{x}/{y}
 * Paste that into the console (layer dock -> right-click the GEE button).
 *
 * Local run:
 *     npm install
 *     export EE_KEY=./service-account.json        # service-account private key
 *     export EE_PROJECT=your-ee-project
 *     node server.js
 *
 * Deploy (Cloud Run):
 *     gcloud run deploy prahari-gee-proxy --source . --allow-unauthenticated \
 *       --set-env-vars EE_PROJECT=your-ee-project \
 *       --set-secrets EE_KEY=/secrets/key.json:gee-sa-key:latest
 */
const express = require('express');
const ee = require('@google/earthengine');

const KEY = require(process.env.EE_KEY || './service-account.json');
const PROJECT = process.env.EE_PROJECT;
const PORT = process.env.PORT || 8080;
const REFRESH_MS = 6 * 60 * 60 * 1000; // refresh the mapid every 6h

let urlFormat = null; // current EE tile template: .../tiles/{z}/{x}/{y}

function buildOverlay() {
  const aoi = ee.Geometry.Rectangle([85.40, 19.55, 86.25, 20.10]);
  const s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterBounds(aoi)
    .filter(ee.Filter.eq('instrumentMode', 'IW'))
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
    .select('VV');
  const smooth = img => img.focal_median(50, 'circle', 'meters').copyProperties(img);
  const before = s1.filterDate('2019-04-01', '2019-04-26').map(smooth).median().clip(aoi);
  const after  = s1.filterDate('2019-05-03', '2019-05-10').map(smooth).median().clip(aoi);
  const perm = ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('occurrence').gt(50).unmask(0);
  const flood = after.divide(before).lt(0.72).and(after.lt(-16)).updateMask(perm.not()).selfMask();
  const dem = ee.ImageCollection('COPERNICUS/DEM/GLO30').select('DEM').mosaic().clip(aoi);
  const surge = dem.lte(5).selfMask();
  return ee.ImageCollection([
    surge.visualize({ palette: ['#f97316'], opacity: 0.5 }),
    flood.visualize({ palette: ['#ec4899'], opacity: 0.85 })
  ]).mosaic();
}

function refreshMapId() {
  return new Promise((resolve, reject) => {
    buildOverlay().getMapId({}, (map, err) => {
      if (err) return reject(err);
      urlFormat = map.urlFormat;
      console.log('[gee] refreshed tile template');
      resolve();
    });
  });
}

function start() {
  ee.data.authenticateViaPrivateKey(KEY, () => {
    ee.initialize(null, null, async () => {
      await refreshMapId();
      setInterval(() => refreshMapId().catch(console.error), REFRESH_MS);

      const app = express();
      app.use((_, res, next) => { res.set('Access-Control-Allow-Origin', '*'); next(); });
      app.get('/healthz', (_, res) => res.send('ok'));

      // Stable XYZ endpoint the PRAHARI console consumes.
      app.get('/tiles/:z/:x/:y', async (req, res) => {
        try {
          if (!urlFormat) await refreshMapId();
          const { z, x, y } = req.params;
          const eeUrl = urlFormat
            .replace('{z}', z).replace('{x}', x).replace('{y}', y);
          const upstream = await fetch(eeUrl);
          if (!upstream.ok) return res.status(upstream.status).end();
          res.set('Content-Type', upstream.headers.get('content-type') || 'image/png');
          res.set('Cache-Control', 'public, max-age=3600');
          const buf = Buffer.from(await upstream.arrayBuffer());
          res.send(buf);
        } catch (e) {
          console.error(e);
          res.status(500).end();
        }
      });

      app.listen(PORT, () => console.log(`[gee] proxy on :${PORT}  ->  /tiles/{z}/{x}/{y}`));
    }, err => { console.error(err); process.exit(1); });
  }, err => { console.error(err); process.exit(1); });
}

start();
