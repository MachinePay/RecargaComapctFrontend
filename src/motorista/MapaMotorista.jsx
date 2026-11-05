// Mapa escuro do motorista (Leaflet puro, igual o MapaLeaflet do painel):
// pino com raio colorido pelo status, tempo para liberar no balaozinho e o
// ponto azul de "voce esta aqui".
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const FUNDO = {
  url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  opcoes: { maxZoom: 19, subdomains: "abcd", attribution: "&copy; OpenStreetMap &copy; CARTO" },
};

const RAIO = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4.5 13.2c-.4.5 0 1.3.6 1.3H11l-1 7.5 8.5-11.2c.4-.5 0-1.3-.6-1.3H12l1-7.5Z"/></svg>`;

const escapar = (texto) =>
  String(texto ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

function iconePino({ situacao, chip, selecionado, maisPerto }) {
  return L.divIcon({
    className: "",
    iconSize: [44, 52],
    iconAnchor: [22, 50],
    html: `
      <div class="mt-pin mt-pin--${situacao}${selecionado ? " is-sel" : ""}">
        <div class="mt-pin__halo"></div>
        <div class="mt-pin__corpo">${RAIO}</div>
        ${chip ? `<div class="mt-pin__chip">${escapar(chip)}</div>` : ""}
        ${maisPerto ? `<div class="mt-pin__estrela">★</div>` : ""}
      </div>`,
  });
}

const iconeVoce = L.divIcon({ className: "", iconSize: [20, 20], iconAnchor: [10, 10], html: `<div class="mt-voce"></div>` });

/**
 * pontos: [{ id, latitude, longitude, situacao, chip, maisPerto }]
 * usuario: { latitude, longitude, precisao } ou null
 * selecionado: id do carregador em destaque (o mapa voa ate ele)
 * enquadrar: muda o valor para reenquadrar tudo (botao de localizar)
 * margemBaixo: px cobertos pela lista em cima do mapa (no celular)
 */
export default function MapaMotorista({ pontos, usuario, selecionado, onSelecionar, enquadrar, margemBaixo = 0 }) {
  const divRef = useRef(null);
  const mapaRef = useRef(null);
  const camadaRef = useRef(null);
  const voceRef = useRef(null);
  const marcadoresRef = useRef({});
  const assinaturaRef = useRef("");
  const selecionarRef = useRef(onSelecionar);

  useEffect(() => {
    selecionarRef.current = onSelecionar;
  }, [onSelecionar]);

  useEffect(() => {
    if (!divRef.current || mapaRef.current) return undefined;
    const mapa = L.map(divRef.current, { zoomControl: false, attributionControl: true }).setView([-15.78, -47.93], 4);
    L.tileLayer(FUNDO.url, FUNDO.opcoes).addTo(mapa);
    camadaRef.current = L.layerGroup().addTo(mapa);
    mapa.on("click", () => selecionarRef.current?.(null));
    mapaRef.current = mapa;
    return () => {
      mapa.remove();
      mapaRef.current = null;
    };
  }, []);

  // Com a lista cobrindo a parte de baixo, o "centro" util do mapa sobe.
  const enquadrarTudo = (validos, comUsuario) => {
    const mapa = mapaRef.current;
    const coords = validos.map((p) => [p.latitude, p.longitude]);
    if (comUsuario) coords.push([comUsuario.latitude, comUsuario.longitude]);
    if (!coords.length) return;
    const margem = { paddingTopLeft: [40, 90], paddingBottomRight: [40, margemBaixo + 40], maxZoom: 15 };
    if (coords.length === 1) mapa.setView(coords[0], 15);
    else mapa.fitBounds(L.latLngBounds(coords), margem);
  };

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;
    camadaRef.current.clearLayers();
    marcadoresRef.current = {};
    const validos = pontos.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
    for (const p of validos) {
      const marcador = L.marker([p.latitude, p.longitude], {
        icon: iconePino({ ...p, selecionado: p.id === selecionado }),
        zIndexOffset: p.id === selecionado ? 1000 : p.situacao === "livre" ? 100 : 0,
      });
      marcador.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        selecionarRef.current?.(p.id);
      });
      marcador.addTo(camadaRef.current);
      marcadoresRef.current[p.id] = marcador;
    }
    const assinatura = validos.map((p) => p.id).join("|");
    if (assinatura !== assinaturaRef.current && validos.length) {
      assinaturaRef.current = assinatura;
      enquadrarTudo(validos, null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pontos, selecionado]);

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;
    voceRef.current?.remove();
    voceRef.current = null;
    if (!usuario) return;
    const grupo = L.layerGroup().addTo(mapa);
    if (usuario.precisao && usuario.precisao < 1500) {
      L.circle([usuario.latitude, usuario.longitude], {
        radius: usuario.precisao,
        color: "#4f8cff",
        weight: 1,
        opacity: 0.4,
        fillOpacity: 0.08,
        interactive: false,
      }).addTo(grupo);
    }
    L.marker([usuario.latitude, usuario.longitude], { icon: iconeVoce, interactive: false, zIndexOffset: 2000 }).addTo(grupo);
    voceRef.current = grupo;
  }, [usuario]);

  useEffect(() => {
    if (!enquadrar || !mapaRef.current) return;
    const validos = pontos.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
    enquadrarTudo(validos, usuario);
    // So quando pedem (botao de localizar), nao a cada atualizacao.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enquadrar]);

  useEffect(() => {
    const marcador = selecionado ? marcadoresRef.current[selecionado] : null;
    const mapa = mapaRef.current;
    if (!marcador || !mapa) return;
    const zoom = Math.max(mapa.getZoom(), 15);
    // Centro deslocado para o pino nao ficar escondido atras da lista.
    const ponto = mapa.project(marcador.getLatLng(), zoom).add([0, margemBaixo / 2]);
    mapa.flyTo(mapa.unproject(ponto, zoom), zoom, { duration: 0.7 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionado]);

  return <div ref={divRef} className="mt-mapa absolute inset-0" style={{ zIndex: 0 }} />;
}
