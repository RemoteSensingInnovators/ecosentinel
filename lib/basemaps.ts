// Kalitsiz ishlaydigan asos xaritalar (Esri, OpenStreetMap, OpenTopoMap)
export type Basemap = "dark" | "light" | "satellite" | "topo" | "osm" | "relief";

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";
export const BASEMAPS: Record<Basemap, { label: string; url: string; labels?: string; attr: string; maxZoom: number; preview: string }> = {
  dark: {
    label: "Tungi",
    url: `${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    labels: `${ESRI}/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
    attr: "© Esri", maxZoom: 16,
    preview: `${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/7/49/87`,
  },
  light: {
    label: "Kunduzgi",
    url: `${ESRI}/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    labels: `${ESRI}/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
    attr: "© Esri", maxZoom: 16,
    preview: `${ESRI}/Canvas/World_Light_Gray_Base/MapServer/tile/7/49/87`,
  },
  satellite: {
    label: "Sun’iy yo‘ldosh",
    url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
    labels: `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`,
    attr: "© Esri, Maxar, Earthstar Geographics", maxZoom: 18,
    preview: `${ESRI}/World_Imagery/MapServer/tile/7/49/87`,
  },
  topo: {
    label: "Topografik",
    url: `${ESRI}/World_Topo_Map/MapServer/tile/{z}/{y}/{x}`,
    attr: "© Esri", maxZoom: 18,
    preview: `${ESRI}/World_Topo_Map/MapServer/tile/7/49/87`,
  },
  osm: {
    label: "OpenStreetMap",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attr: "© OpenStreetMap", maxZoom: 19,
    preview: "https://tile.openstreetmap.org/7/87/49.png",
  },
  relief: {
    label: "Relyef",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attr: "© OpenStreetMap · © OpenTopoMap (CC-BY-SA)", maxZoom: 17,
    preview: "https://a.tile.opentopomap.org/7/87/49.png",
  },
};
