# EcoSentinel 2.0 — Qashqadaryo geoekologik monitoring

Next.js 15 + Google Earth Engine (servis akkaunt) + Leaflet. Frontend va API bitta loyihada.

## Ishga tushirish

```bash
npm install
# .env.local fayliga kalitni qo'ying (git'ga tushmaydi):
# GEE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
npm run dev        # http://localhost:3000
```

## Vercel'ga joylash

1. Loyihani GitHub'ga yuklang (`.env.local` `.gitignore`da — kalit yuklanmaydi).
2. Vercel → New Project → shu repo.
3. Settings → Environment Variables:
   - `GEE_SERVICE_ACCOUNT_KEY` — JSON kalitning to'liq matni (yoki base64 ko'rinishi).
   - (ixtiyoriy) `GEE_PROJECT` — boshqa GCP loyiha ID si.
   - (ixtiyoriy) `GEE_TILE_PROXY=1` — majburan tile proksi rejimi.
4. Deploy.

## Tile'lar haqida

Servis akkauntda `earthengine.maps.create` ruxsati bo'lmasa, ilova avtomatik ravishda
`/api/tile/...` proksisiga o'tadi (`image:computePixels` orqali, faqat hisoblash ruxsati kerak).
Tile'lar CDN'da 30 kun keshlanadi. Tezroq ishlashi uchun GCP IAM'da servis akkauntga
**Earth Engine Resource Viewer** (`roles/earthengine.viewer`) rolini bering — shunda GEE'ning
o'z tile serveri ishlatiladi.

## Skriptlar

- `npm run calibrate [season]` — 2019–2026 yillar bo'yicha yagona p2…p98 shkalalarni qayta hisoblaydi (`lib/calibration.json`).
- `npm run boundaries` — tumanlar chegarasini (`public/districts.geojson`) GEE'dan qayta oladi.

## API

| Endpoint | Tavsif |
|---|---|
| `GET /api/health` | GEE ulanishi |
| `GET /api/tiles?layer&season&year&mode[&base]` | tile URL + legenda (`mode`: continuous, classes, diff) |
| `GET /api/tile/{spec}/{z}/{x}/{y}.png` | tile proksi |
| `GET /api/stats?layer&season&year` | 14 tuman + viloyat statistikasi (o'rtacha, p10, p90) |
| `GET /api/series?layer&season[&district yoki &plant]` | 2019–2026 dinamika (viloyat, tuman yoki zavod ta’sir zonasi) |
| `GET /api/plant?id&layer&season&year` | zavoddan masofa halqalari (0–2 … 25–40 km) bo‘yicha o‘rtacha qiymat |

## Sanoat obyektlari

`lib/plants.ts` — Muborak GQIZ va Sho'rtan GKM: koordinata, chiqindilar tarqalish zonalari,
hujjatdagi sxema (`public/plants/`). Yangi obyekt qo'shish uchun shu ro'yxatga yozuv qo'shing.

- **Sho'rtan GKM** — 38.461°N, 65.798°E, sun'iy yo'ldosh suratida tasdiqlangan.
- **Muborak GQIZ** — 39.1828°N, 65.3123°E, **taxminiy** (Muborak IES yonidagi doimiy gaz mash'alasi).
  Hujjatlardagi koordinata (38°31'25"N, 66°08'30"E) ikkala zavodda ham bir xil va hech biriga to'g'ri kelmaydi.

## Ma'lumot sifati

Sentinel-5P qatlamlari: bulutli piksellar (`cloud_fraction ≥ 0.3`) chiqariladi, mavsumiy **mediana** olinadi.
TROPOMI SO₂ mahsulotida 2025-06 … 2026-02 oralig'ida viloyat sharqida nuqson bor — interfeysda ogohlantirish chiqadi.
