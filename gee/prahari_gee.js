/**
 * PRAHARI — Google Earth Engine analysis for Cyclone Fani / Puri (Odisha, India)
 * ---------------------------------------------------------------------------
 * Paste this whole file into the GEE Code Editor: https://code.earthengine.google.com
 * It derives REAL satellite layers (no mock data):
 *   1. Sentinel-1 SAR flood extent  (pre- vs post-Fani backscatter change)
 *   2. Copernicus DEM low-elevation coastal surge-exposure zone
 *   3. WorldPop population exposed inside the flood mask
 *   4. GPM IMERG rainfall accumulation over the event window
 *
 * Outputs:
 *   - Map layers you can inspect in the Code Editor
 *   - A printed XYZ tile URL you can paste into the PRAHARI console
 *     (layer dock -> right-click the "GEE" button -> paste the URL)
 *   - Export tasks that write GeoJSON to Google Drive so you can replace the
 *     synthetic fixtures in prahari_data.js with real GEE-derived polygons.
 *
 * Cyclone Fani landfall: ~2019-05-03 03:00 UTC near Puri (19.80N, 85.83E).
 */

// ---- Area of interest: Puri coastal belt --------------------------------
var puri = ee.Geometry.Point([85.83, 19.80]);
var aoi = ee.Geometry.Rectangle([85.40, 19.55, 86.25, 20.10]);
Map.centerObject(aoi, 10);

// ---- Event windows ------------------------------------------------------
var preStart  = '2019-04-01', preEnd  = '2019-04-26';   // calm baseline
var postStart = '2019-05-03', postEnd = '2019-05-10';   // during/after landfall

// =========================================================================
// 1. SENTINEL-1 SAR FLOOD EXTENT
// =========================================================================
var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(aoi)
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
  .select('VV');

// Speckle-reduced median composites before and after the storm.
function smooth(img) { return img.focal_median(50, 'circle', 'meters').copyProperties(img); }
var before = s1.filterDate(preStart,  preEnd ).map(smooth).median().clip(aoi);
var after  = s1.filterDate(postStart, postEnd).map(smooth).median().clip(aoi);

// Change ratio: open water is smooth => backscatter drops sharply after flooding.
var ratio = after.divide(before);
var floodRaw = ratio.lt(0.72)          // >~1.4 dB drop
  .and(after.lt(-16));                  // absolute low-backscatter gate

// Remove permanent water bodies (JRC Global Surface Water).
var permWater = ee.Image('JRC/GSW1_4/GlobalSurfaceWater')
  .select('occurrence').gt(50).unmask(0);
var flood = floodRaw.updateMask(permWater.not()).selfMask().rename('flood');

Map.addLayer(flood, {palette: ['#ec4899']}, '1 · SAR flood extent');

// =========================================================================
// 2. DEM LOW-ELEVATION SURGE-EXPOSURE ZONE
// =========================================================================
var dem = ee.ImageCollection('COPERNICUS/DEM/GLO30').select('DEM').mosaic().clip(aoi);
// Coastal land within storm-surge reach (<= 5 m above sea level).
var surgeZone = dem.lte(5).selfMask().rename('surge_zone');
Map.addLayer(dem, {min: 0, max: 30, palette: ['#0c4a6e','#38bdf8','#fde68a','#b45309']}, '2a · Elevation (m)', false);
Map.addLayer(surgeZone, {palette: ['#f97316']}, '2b · Surge-exposure zone (<=5m)');

// =========================================================================
// 3. WORLDPOP POPULATION EXPOSED IN FLOOD MASK
// =========================================================================
var pop = ee.ImageCollection('WorldPop/GP/100m/pop')
  .filter(ee.Filter.eq('country', 'IND'))
  .filterDate('2019-01-01', '2020-01-01').mosaic().clip(aoi);
var popExposed = pop.updateMask(flood);
Map.addLayer(popExposed, {min: 0, max: 40, palette: ['#fef3c7','#f59e0b','#b91c1c']}, '3 · Population exposed to flood');

var exposedCount = popExposed.reduceRegion({
  reducer: ee.Reducer.sum(), geometry: aoi, scale: 100, maxPixels: 1e9
}).get('population');
print('Estimated population in SAR flood mask:', exposedCount);

// =========================================================================
// 4. GPM IMERG RAINFALL ACCUMULATION
// =========================================================================
var gpm = ee.ImageCollection('NASA/GPM_L3/IMERG_V07')
  .filterDate(postStart, postEnd).select('precipitation');
// half-hourly mm/hr -> total mm over the window
var rainTotal = gpm.sum().multiply(0.5).clip(aoi).rename('rain_mm');
Map.addLayer(rainTotal, {min: 0, max: 300, palette: ['#e0f2fe','#38bdf8','#1d4ed8','#312e81']}, '4 · Rain accumulation (mm)', false);

// =========================================================================
// 5. LIVE TILE URL FOR THE PRAHARI CONSOLE
// =========================================================================
// A combined visualization the console can stream as a raster overlay.
var overlay = ee.ImageCollection([
  surgeZone.visualize({palette: ['#f97316'], opacity: 0.5}),
  flood.visualize({palette: ['#ec4899'], opacity: 0.85})
]).mosaic();

overlay.getMapId({}, function(mapid) {
  // urlFormat is an XYZ template: .../tiles/{z}/{x}/{y}
  print('>>> GEE tile URL — paste into PRAHARI console (right-click the GEE button):');
  print(mapid.urlFormat);
});
// NOTE: Code Editor tile URLs are session-scoped and expire. For a stable/public
// URL use the Python script (export_prahari.py) or deploy tile_proxy/ (service account).

// =========================================================================
// 6. EXPORT REAL GEOJSON (Path A — replace the synthetic fixtures)
// =========================================================================
// Vectorize the flood mask to polygons for prahari_data.js -> floodZones.
var floodVectors = flood.reduceToVectors({
  geometry: aoi, scale: 30, geometryType: 'polygon',
  eightConnected: true, maxPixels: 1e9, labelProperty: 'flood'
});
Export.table.toDrive({
  collection: floodVectors,
  description: 'prahari_flood_zones_gee',
  fileFormat: 'GeoJSON'
});

// Surge zone polygons.
var surgeVectors = surgeZone.reduceToVectors({
  geometry: aoi, scale: 30, geometryType: 'polygon',
  eightConnected: true, maxPixels: 1e9, labelProperty: 'surge'
});
Export.table.toDrive({
  collection: surgeVectors,
  description: 'prahari_surge_zone_gee',
  fileFormat: 'GeoJSON'
});

print('Run the two Export tasks (Tasks tab) to download real GeoJSON for prahari_data.js.');
