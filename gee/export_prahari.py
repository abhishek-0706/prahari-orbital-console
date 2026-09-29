"""
PRAHARI — headless GEE export + live tile URL (Cyclone Fani / Puri).

Runs the same analysis as prahari_gee.js but from Python, so you can:
  * print a live XYZ tile URL to paste into the PRAHARI console, and
  * export real GeoJSON to replace the synthetic fixtures in prahari_data.js.

Setup:
    pip install earthengine-api
    earthengine authenticate                 # personal account, OR
    # service account:
    #   export EE_SA=svc@project.iam.gserviceaccount.com
    #   export EE_KEY=/path/to/key.json
    #   export EE_PROJECT=your-ee-project

Run:
    python export_prahari.py
"""
import os
import ee

PROJECT = os.environ.get("EE_PROJECT")  # your Earth-Engine-enabled Cloud project

def init():
    sa, key = os.environ.get("EE_SA"), os.environ.get("EE_KEY")
    if sa and key:
        ee.Initialize(ee.ServiceAccountCredentials(sa, key), project=PROJECT)
    else:
        ee.Initialize(project=PROJECT)

def build():
    aoi = ee.Geometry.Rectangle([85.40, 19.55, 86.25, 20.10])
    pre_start, pre_end = "2019-04-01", "2019-04-26"
    post_start, post_end = "2019-05-03", "2019-05-10"

    s1 = (ee.ImageCollection("COPERNICUS/S1_GRD")
          .filterBounds(aoi)
          .filter(ee.Filter.eq("instrumentMode", "IW"))
          .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
          .select("VV"))

    def smooth(img):
        return img.focal_median(50, "circle", "meters").copyProperties(img)

    before = s1.filterDate(pre_start, pre_end).map(smooth).median().clip(aoi)
    after = s1.filterDate(post_start, post_end).map(smooth).median().clip(aoi)

    ratio = after.divide(before)
    flood_raw = ratio.lt(0.72).And(after.lt(-16))
    perm = ee.Image("JRC/GSW1_4/GlobalSurfaceWater").select("occurrence").gt(50).unmask(0)
    flood = flood_raw.updateMask(perm.Not()).selfMask().rename("flood")

    dem = ee.ImageCollection("COPERNICUS/DEM/GLO30").select("DEM").mosaic().clip(aoi)
    surge = dem.lte(5).selfMask().rename("surge_zone")

    return aoi, flood, surge

def main():
    init()
    aoi, flood, surge = build()

    overlay = ee.ImageCollection([
        surge.visualize(palette=["#f97316"], opacity=0.5),
        flood.visualize(palette=["#ec4899"], opacity=0.85),
    ]).mosaic()

    mapid = overlay.getMapId({})
    print("\n>>> GEE live tile URL (paste into PRAHARI console, right-click the GEE button):")
    print(mapid["tile_fetcher"].url_format, "\n")

    # Real GeoJSON exports (Path A) -> Google Drive, then drop into prahari_data.js
    for img, name in [(flood, "prahari_flood_zones_gee"), (surge, "prahari_surge_zone_gee")]:
        vectors = img.reduceToVectors(
            geometry=aoi, scale=30, geometryType="polygon",
            eightConnected=True, maxPixels=int(1e9),
        )
        task = ee.batch.Export.table.toDrive(
            collection=vectors, description=name, fileFormat="GeoJSON")
        task.start()
        print(f"Started export task: {name} (check https://code.earthengine.google.com Tasks)")

if __name__ == "__main__":
    main()
