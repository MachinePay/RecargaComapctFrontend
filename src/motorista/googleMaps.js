// Google Maps do app do motorista. A chave vem do backend (/publico/config,
// variavel GOOGLE_MAPS_KEY na Render). Sem chave, chave recusada ou script
// que nao carrega: o app fica no mapa da Esri.
import { apiPublica } from "./servicos";

let promessa = null;
const avisosFalha = new Set();

// O Google chama isto quando a chave e' recusada (dominio nao liberado,
// API desligada, sem faturamento) - as vezes depois do mapa ja montado.
if (typeof window !== "undefined") {
  window.gm_authFailure = () => {
    console.warn("[Mapa] Google Maps recusou a chave; usando o mapa da Esri.");
    avisosFalha.forEach((fn) => fn());
  };
}

export function aoFalharGoogle(fn) {
  avisosFalha.add(fn);
  return () => avisosFalha.delete(fn);
}

function carregarScript(chave) {
  return new Promise((resolve, reject) => {
    const nome = `__mtGoogleMapsPronto`;
    window[nome] = () => resolve(window.google.maps);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(chave)}&v=weekly&loading=async&language=pt-BR&region=BR&callback=${nome}`;
    script.async = true;
    script.onerror = () => reject(new Error("script do Google Maps nao carregou"));
    document.head.appendChild(script);
  });
}

/** google.maps, ou null se o app deve usar a Esri. Busca uma vez so. */
export function googleMaps() {
  if (!promessa) {
    promessa = apiPublica
      .get("/config")
      .then(({ data }) => (data.google_maps_key ? carregarScript(data.google_maps_key) : null))
      .catch(() => null);
  }
  return promessa;
}

// Estilo escuro (mesmos tons do app). Mapa sem Map ID aceita "styles".
export const ESTILO_ESCURO = [
  { elementType: "geometry", stylers: [{ color: "#111a17" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a9c93" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0b1210" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#2a3a33" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#b9cbc1" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ visibility: "on" }, { color: "#132a1f" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#24312c" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#18221e" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#2c3b35" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#35473f" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#a9bcb2" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a1418" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3d5a66" }] },
];
