// Mapa Leaflet puro (sem react-leaflet), como o MapaMaquinas da CompactPay:
// marcadores em divIcon (sem os PNGs padrao do Leaflet) e fundo rua/satelite.
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const ESTILOS_MAPA = {
  rua: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    opcoes: { maxZoom: 19, attribution: "&copy; OpenStreetMap" },
  },
  satelite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    opcoes: { maxZoom: 19, attribution: "Esri" },
  },
};

const escapar = (texto) =>
  String(texto ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

function iconeMarcador({ cor, titulo, subtitulo }) {
  return L.divIcon({
    className: "",
    iconSize: [0, 0],
    iconAnchor: [0, 6],
    html: `
      <div style="position:absolute;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;">
        <div style="display:flex;align-items:center;gap:6px;white-space:nowrap;background:#fff;border:2px solid ${cor};border-radius:999px;padding:3px 9px;font:700 12px/1.2 system-ui,sans-serif;color:#1e2d20;box-shadow:0 6px 16px rgba(0,0,0,.18)">
          <span style="width:8px;height:8px;border-radius:999px;background:${cor}"></span>
          ${escapar(titulo)}${subtitulo ? `<span style="font-weight:600;color:#70806f">${escapar(subtitulo)}</span>` : ""}
        </div>
        <div style="width:10px;height:10px;background:#fff;border-right:2px solid ${cor};border-bottom:2px solid ${cor};transform:rotate(45deg);margin-top:-6px"></div>
      </div>`,
  });
}

/**
 * pontos: [{ id, latitude, longitude, cor, titulo, subtitulo, popup (html) }]
 * foco: id para centralizar e abrir o popup.
 * onClicarMapa(lat, lng): para escolher a localizacao clicando.
 */
export default function MapaLeaflet({ pontos, estilo = "rua", foco, onClicarMapa, className = "h-[60vh] min-h-[380px]" }) {
  const divRef = useRef(null);
  const mapaRef = useRef(null);
  const camadaRef = useRef(null);
  const fundoRef = useRef(null);
  const marcadoresRef = useRef({});
  const assinaturaRef = useRef("");
  const cliqueRef = useRef(onClicarMapa);

  useEffect(() => {
    cliqueRef.current = onClicarMapa;
  }, [onClicarMapa]);

  // Cria o mapa uma vez (centro do Brasil).
  useEffect(() => {
    if (!divRef.current || mapaRef.current) return undefined;
    const mapa = L.map(divRef.current, { zoomControl: true }).setView([-15.78, -47.93], 4);
    camadaRef.current = L.layerGroup().addTo(mapa);
    mapa.on("click", (e) => cliqueRef.current?.(e.latlng.lat, e.latlng.lng));
    mapaRef.current = mapa;
    return () => {
      mapa.remove();
      mapaRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapaRef.current) return;
    fundoRef.current?.remove();
    const { url, opcoes } = ESTILOS_MAPA[estilo] || ESTILOS_MAPA.rua;
    fundoRef.current = L.tileLayer(url, opcoes).addTo(mapaRef.current);
    fundoRef.current.bringToBack();
  }, [estilo]);

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;
    camadaRef.current.clearLayers();
    marcadoresRef.current = {};
    const validos = pontos.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
    for (const p of validos) {
      const marcador = L.marker([p.latitude, p.longitude], { icon: iconeMarcador(p), riseOnHover: true });
      if (p.popup) marcador.bindPopup(p.popup, { offset: [0, -24], maxHeight: 320 });
      marcador.addTo(camadaRef.current);
      marcadoresRef.current[p.id] = marcador;
    }
    // So reenquadra quando muda o conjunto de pontos (nao a cada atualizacao).
    const assinatura = validos.map((p) => `${p.id}:${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`).join("|");
    if (assinatura !== assinaturaRef.current && validos.length && !foco) {
      assinaturaRef.current = assinatura;
      if (validos.length === 1) mapa.setView([validos[0].latitude, validos[0].longitude], 16);
      else mapa.fitBounds(L.latLngBounds(validos.map((p) => [p.latitude, p.longitude])), { padding: [48, 48], maxZoom: 16 });
    }
  }, [pontos, foco]);

  useEffect(() => {
    const marcador = foco ? marcadoresRef.current[foco] : null;
    if (!marcador || !mapaRef.current) return;
    mapaRef.current.flyTo(marcador.getLatLng(), 17, { duration: 0.8 });
    marcador.openPopup();
  }, [foco, pontos]);

  return <div ref={divRef} className={`w-full rounded-[24px] ${className}`} style={{ zIndex: 0 }} />;
}
