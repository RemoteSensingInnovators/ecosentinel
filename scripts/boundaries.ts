// Qashqadaryo tumanlari chegarasini (FAO GAUL 2015) soddalashtirilgan GeoJSON sifatida saqlaydi.
// Natija: public/districts.geojson. Ishga tushirish: npm run boundaries
import { writeFileSync, mkdirSync } from "node:fs";
import { initEE, evaluate, ee } from "../lib/server/ee";
import { districts } from "../lib/server/composites";
import { DISTRICT_NAMES } from "../lib/layers";

async function main() {
  await initEE();
  const fc = districts().map((f: any) =>
    ee.Feature(f.geometry().simplify(150), { id: f.get("ADM2_NAME"), area_km2: f.geometry().area(100).divide(1e6) }),
  );
  const gj = await evaluate<any>(fc);
  const round = (c: any): any => (typeof c[0] === "number" ? [+c[0].toFixed(4), +c[1].toFixed(4)] : c.map(round));
  gj.features = gj.features.map((f: any) => ({
    type: "Feature",
    properties: { id: f.properties.id, name: DISTRICT_NAMES[f.properties.id] ?? f.properties.id, area_km2: Math.round(f.properties.area_km2) },
    geometry: { type: f.geometry.type, coordinates: round(f.geometry.coordinates) },
  }));
  delete gj.columns;
  mkdirSync("public", { recursive: true });
  writeFileSync("public/districts.geojson", JSON.stringify(gj));
  console.log("tumanlar:", gj.features.length);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
