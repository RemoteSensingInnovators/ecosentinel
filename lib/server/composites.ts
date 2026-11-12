import { ee } from "./ee";
import { LAYERS, SEASONS, type LayerKey, type SeasonKey } from "../layers";
import { getCalib, type Calib } from "../calib";

/* eslint-disable @typescript-eslint/no-explicit-any */
type EEImage = any;
export { getCalib, displayCalib } from "../calib";

export function region() {
  return ee.FeatureCollection("FAO/GAUL/2015/level1").filter(ee.Filter.eq("ADM1_NAME", "Kashkadarya")).geometry();
}
export function districts() {
  return ee.FeatureCollection("FAO/GAUL/2015/level2").filter(ee.Filter.eq("ADM1_NAME", "Kashkadarya"));
}

function dates(year: number, season: SeasonKey) {
  const s = SEASONS[season];
  return [`${year}-${s.start}`, season === "annual" ? `${year + 1}-01-01` : `${year}-${s.end}`] as const;
}

function s5p(id: string, band: string, year: number, season: SeasonKey) {
  const [a, b] = dates(year, season);
  const col = ee.ImageCollection(id).filterDate(a, b).filterBounds(region());
  // Bulutli piksellarni chiqarib, tashqi (shovqinli) qiymatlarga chidamli mediana olinadi
  const hasCloud = !id.endsWith("L3_CO") && !id.endsWith("L3_AER_AI");
  return col
    .map((img: EEImage) => (hasCloud ? img.select(band).updateMask(img.select("cloud_fraction").lt(0.3)) : img.select(band)))
    .median();
}

function s2(year: number, season: SeasonKey) {
  const [a, b] = dates(year, season);
  const roi = region();
  const cs = ee.ImageCollection("GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED");
  return ee
    .ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
    .filterBounds(roi)
    .filterDate(a, b)
    .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 60))
    .linkCollection(cs, ["cs_cdf"])
    .map((img: EEImage) => img.updateMask(img.select("cs_cdf").gte(0.6)).select(["B3", "B4", "B8", "B11", "B12"]).divide(10000))
    .median();
}

function landsatLst(year: number, season: SeasonKey) {
  const [a, b] = dates(year, season);
  const roi = region();
  const prep = (img: EEImage) => {
    const qa = img.select("QA_PIXEL");
    // 1: dilated cloud, 3: cloud, 4: cloud shadow
    const mask = qa.bitwiseAnd(1 << 1).eq(0).and(qa.bitwiseAnd(1 << 3).eq(0)).and(qa.bitwiseAnd(1 << 4).eq(0));
    return img.select("ST_B10").multiply(0.00341802).add(149.0).subtract(273.15).updateMask(mask);
  };
  return ee
    .ImageCollection("LANDSAT/LC08/C02/T1_L2")
    .merge(ee.ImageCollection("LANDSAT/LC09/C02/T1_L2"))
    .filterBounds(roi)
    .filterDate(a, b)
    .filter(ee.Filter.lt("CLOUD_COVER", 70))
    .map(prep)
    .median();
}

function norm(img: EEImage, c: Calib | null) {
  if (!c) return img.multiply(0);
  return img.subtract(c.p2).divide(c.p98 - c.p2).clamp(0, 1);
}

/** Qatlamning xom (GEE birligidagi) bir kanalli tasviri, nomi "value" */
export function rawImage(layer: LayerKey, year: number, season: SeasonKey): EEImage {
  const roi = region();
  let img: EEImage;
  switch (layer) {
    case "no2":
      img = s5p("COPERNICUS/S5P/OFFL/L3_NO2", "tropospheric_NO2_column_number_density", year, season);
      break;
    case "so2":
      img = s5p("COPERNICUS/S5P/OFFL/L3_SO2", "SO2_column_number_density", year, season);
      break;
    case "co":
      img = s5p("COPERNICUS/S5P/OFFL/L3_CO", "CO_column_number_density", year, season);
      break;
    case "hcho":
      img = s5p("COPERNICUS/S5P/OFFL/L3_HCHO", "tropospheric_HCHO_column_number_density", year, season);
      break;
    case "aai":
      img = s5p("COPERNICUS/S5P/OFFL/L3_AER_AI", "absorbing_aerosol_index", year, season);
      break;
    case "ndvi":
      img = s2(year, season).normalizedDifference(["B8", "B4"]);
      break;
    case "ndmi":
      img = s2(year, season).normalizedDifference(["B8", "B11"]);
      break;
    case "ndsi":
      img = s2(year, season).normalizedDifference(["B11", "B12"]);
      break;
    case "mndwi":
      img = s2(year, season).normalizedDifference(["B3", "B11"]);
      break;
    case "lst":
      img = landsatLst(year, season);
      break;
    case "precip": {
      const [a, b] = dates(year, season);
      img = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY").filterDate(a, b).select("precipitation").sum();
      break;
    }
    case "lulc": {
      const [a, b] = dates(year, season);
      img = ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1").filterBounds(roi).filterDate(a, b).select("label").mode();
      break;
    }
    case "ebi": {
      const n = (k: LayerKey) => norm(rawImage(k, year, season), getCalib(k, season));
      img = n("no2").multiply(0.2)
        .add(n("aai").multiply(0.1))
        .add(n("lst").multiply(0.2))
        .add(ee.Image(1).subtract(n("ndvi")).multiply(0.2))
        .add(ee.Image(1).subtract(n("ndmi")).multiply(0.15))
        .add(n("ndsi").multiply(0.15))
        .multiply(100);
      break;
    }
  }
  return ee.Image(img).rename("value").clip(roi);
}

/** Ko'rsatish birligidagi tasvir (masalan µmol/m²) */
export function displayImage(layer: LayerKey, year: number, season: SeasonKey): EEImage {
  return rawImage(layer, year, season).multiply(LAYERS[layer].factor);
}

export function classify(img: EEImage, c: Calib) {
  return img.gt(c.p20).add(img.gt(c.p40)).add(img.gt(c.p60)).add(img.gt(c.p80)).rename("value");
}

