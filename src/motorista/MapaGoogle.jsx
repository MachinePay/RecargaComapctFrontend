// Mapa do motorista no Google Maps, em modo escuro. Mesmas props e mesmos
// pinos HTML do MapaMotorista (Esri), desenhados com OverlayView: assim nao
// precisa de Map ID nem de marcador avancado.
import { useEffect, useRef } from "react";
import { ESTILO_ESCURO } from "./googleMaps";
import { HTML_VOCE, htmlPino } from "./pinos";

// Classe criada uma vez, depois que o script do Google carregou.
let Marcador = null;

function classeMarcador(gm) {
  if (Marcador) return Marcador;
  Marcador = class extends gm.OverlayView {
    constructor(posicao, html, ancora, onClick) {
      super();
      this.posicao = posicao;
      this.ancora = ancora;
      this.div = document.createElement("div");
      this.div.style.position = "absolute";
      this.clicavel = Boolean(onClick);
      this.div.style.cursor = onClick ? "pointer" : "default";
      this.div.innerHTML = html;
      if (onClick) {
        this.div.addEventListener("click", (e) => {
          e.stopPropagation();
          onClick();
        });
      }
    }

    onAdd() {
      this.getPanes()[this.clicavel ? "overlayMouseTarget" : "overlayLayer"].appendChild(this.div);
      // Toque no pino nao vira clique no mapa (que fecharia a selecao).
      if (this.clicavel) gm.OverlayView.preventMapHitsAndGesturesFrom(this.div);
    }

    draw() {
      const ponto = this.getProjection()?.fromLatLngToDivPixel(this.posicao);
      if (!ponto) return;
      this.div.style.left = `${ponto.x - this.ancora[0]}px`;
      this.div.style.top = `${ponto.y - this.ancora[1]}px`;
    }

    onRemove() {
      this.div.remove();
    }

    setZ(z) {
      this.div.style.zIndex = String(z);
    }
  };
  return Marcador;
}

export default function MapaGoogle({ google: gm, pontos, usuario, selecionado, onSelecionar, enquadrar, margemBaixo = 0 }) {
  const divRef = useRef(null);
  const mapaRef = useRef(null);
  const marcadoresRef = useRef({});
  const voceRef = useRef([]);
  const assinaturaRef = useRef("");
  const selecionarRef = useRef(onSelecionar);

  useEffect(() => {
    selecionarRef.current = onSelecionar;
  }, [onSelecionar]);

  useEffect(() => {
    if (!divRef.current || mapaRef.current) return;
    const mapa = new gm.Map(divRef.current, {
      center: { lat: -15.78, lng: -47.93 },
      zoom: 4,
      styles: ESTILO_ESCURO,
      backgroundColor: "#0b1210",
      disableDefaultUI: true,
      gestureHandling: "greedy",
      clickableIcons: false,
      keyboardShortcuts: false,
    });
    mapa.addListener("click", () => selecionarRef.current?.(null));
    mapaRef.current = mapa;
  }, [gm]);

  const enquadrarTudo = (validos, comUsuario) => {
    const mapa = mapaRef.current;
    const coords = validos.map((p) => ({ lat: p.latitude, lng: p.longitude }));
    if (comUsuario) coords.push({ lat: comUsuario.latitude, lng: comUsuario.longitude });
    if (!coords.length) return;
    if (coords.length === 1) {
      mapa.setCenter(coords[0]);
      mapa.setZoom(15);
      return;
    }
    const limites = new gm.LatLngBounds();
    coords.forEach((c) => limites.extend(c));
    mapa.fitBounds(limites, { top: 90, left: 40, right: 40, bottom: margemBaixo + 40 });
    // Pontos muito juntos: nao chega perto demais.
    gm.event.addListenerOnce(mapa, "idle", () => {
      if (mapa.getZoom() > 15) mapa.setZoom(15);
    });
  };

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;
    const Classe = classeMarcador(gm);
    Object.values(marcadoresRef.current).forEach((m) => m.setMap(null));
    marcadoresRef.current = {};
    const validos = pontos.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
    for (const p of validos) {
      const marcador = new Classe(
        new gm.LatLng(p.latitude, p.longitude),
        htmlPino({ ...p, selecionado: p.id === selecionado }),
        [22, 50],
        () => selecionarRef.current?.(p.id),
      );
      marcador.setZ(p.id === selecionado ? 1000 : p.situacao === "livre" ? 100 : 1);
      marcador.setMap(mapa);
      marcadoresRef.current[p.id] = marcador;
    }
    const assinatura = validos.map((p) => p.id).join("|");
    if (assinatura !== assinaturaRef.current && validos.length) {
      assinaturaRef.current = assinatura;
      enquadrarTudo(validos, null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pontos, selecionado, gm]);

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;
    voceRef.current.forEach((item) => item.setMap(null));
    voceRef.current = [];
    if (!usuario) return;
    const posicao = new gm.LatLng(usuario.latitude, usuario.longitude);
    if (usuario.precisao && usuario.precisao < 1500) {
      voceRef.current.push(
        new gm.Circle({
          map: mapa,
          center: posicao,
          radius: usuario.precisao,
          strokeColor: "#4f8cff",
          strokeOpacity: 0.4,
          strokeWeight: 1,
          fillColor: "#4f8cff",
          fillOpacity: 0.08,
          clickable: false,
        }),
      );
    }
    const Classe = classeMarcador(gm);
    const voce = new Classe(posicao, HTML_VOCE, [10, 10], null);
    voce.setZ(2000);
    voce.setMap(mapa);
    voceRef.current.push(voce);
  }, [usuario, gm]);

  useEffect(() => {
    if (!enquadrar || !mapaRef.current) return;
    enquadrarTudo(
      pontos.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)),
      usuario,
    );
    // So quando pedem (botao de localizar), nao a cada atualizacao.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enquadrar]);

  useEffect(() => {
    const mapa = mapaRef.current;
    const marcador = selecionado ? marcadoresRef.current[selecionado] : null;
    if (!mapa || !marcador) return;
    if (mapa.getZoom() < 15) mapa.setZoom(15);
    mapa.panTo(marcador.posicao);
    // Centro deslocado para o pino nao ficar atras da lista.
    if (margemBaixo) mapa.panBy(0, margemBaixo / 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionado]);

  return <div ref={divRef} className="absolute inset-0" style={{ zIndex: 0, background: "#0b1210" }} />;
}
