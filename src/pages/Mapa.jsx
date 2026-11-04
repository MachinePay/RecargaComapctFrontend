import { useCallback, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Layers, Search } from "lucide-react";

import api from "../api/axios";
import usePolling from "../hooks/usePolling";
import Cabecalho from "../components/Cabecalho";
import LoadingSpinner from "../components/LoadingSpinner";
import MapaLeaflet from "../components/MapaLeaflet";
import { StatusCarregador } from "../components/CarregadorUi";
import { STATUS_CARREGADOR, combinaBusca, statusCarregador, textoConector } from "../utils/carregadores";
import { formatarDataHora, formatarRelogio, formatarValor } from "../utils/formatos";

const ESTILO_SALVO = "mapa.estilo";

function lerEstilo() {
  try {
    return localStorage.getItem(ESTILO_SALVO) || "rua";
  } catch {
    return "rua";
  }
}

const escapar = (texto) =>
  String(texto ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

function popupHtml(c) {
  const status = STATUS_CARREGADOR[statusCarregador(c)];
  const sessao = c.sessao_ativa;
  return `
    <div style="font:13px/1.45 system-ui,sans-serif;min-width:200px">
      <div style="font-weight:800;font-size:14px">${escapar(c.nome_local)}</div>
      <div style="color:#70806f">${escapar(c.id_hardware)}${c.cliente_nome ? ` · ${escapar(c.cliente_nome)}` : ""}</div>
      ${c.endereco ? `<div style="margin-top:4px">${escapar(c.endereco)}</div>` : ""}
      <div style="margin-top:6px"><span style="color:${status.cor}">●</span> <b>${status.texto}</b> · ${escapar(textoConector(c))}</div>
      ${sessao && sessao.segundos_restantes != null ? `<div>Recarga #${sessao.id}: <b>${formatarRelogio(sessao.segundos_restantes)}</b> restantes</div>` : ""}
      <div>Hoje: <b>${formatarValor(c.faturamento_hoje)}</b> · ${c.recargas_hoje || 0} recarga(s)</div>
      <div style="color:#70806f">Ultimo sinal ${formatarDataHora(c.ultimo_sinal)}</div>
      <a href="/carregadores/${encodeURIComponent(c.id_hardware)}" style="display:inline-block;margin-top:8px;font-weight:700;color:#1f7a4c">Abrir carregador →</a>
    </div>`;
}

export default function Mapa() {
  const [params, setParams] = useSearchParams();
  const [lista, setLista] = useState(null);
  const [estilo, setEstilo] = useState(lerEstilo);
  const [busca, setBusca] = useState("");
  const foco = params.get("carregador") || "";

  const carregar = useCallback(async () => {
    try {
      setLista((await api.get("/admin/carregadores")).data);
    } catch {
      setLista((atual) => atual || []);
    }
  }, []);

  usePolling(carregar, 30000, true, { imediato: true });

  if (lista === null) return <LoadingSpinner className="min-h-[60vh]" />;

  const comLocal = lista.filter((c) => c.latitude != null && c.longitude != null);
  const semLocal = lista.filter((c) => c.latitude == null || c.longitude == null);
  const pontos = comLocal.map((c) => ({
    id: c.id_hardware,
    latitude: c.latitude,
    longitude: c.longitude,
    cor: STATUS_CARREGADOR[statusCarregador(c)].cor,
    titulo: c.nome_local,
    subtitulo: formatarValor(c.faturamento_hoje),
    popup: popupHtml(c),
  }));
  const contagem = comLocal.reduce((acc, c) => ({ ...acc, [statusCarregador(c)]: (acc[statusCarregador(c)] || 0) + 1 }), {});
  const sugestoes = busca.trim() ? comLocal.filter((c) => combinaBusca(c, busca)).slice(0, 6) : [];

  const trocarEstilo = () => {
    const novo = estilo === "rua" ? "satelite" : "rua";
    setEstilo(novo);
    try {
      localStorage.setItem(ESTILO_SALVO, novo);
    } catch {
      // Sem storage: so nao lembra a escolha.
    }
  };

  return (
    <div className="space-y-4 p-2 sm:p-4">
      <Cabecalho etiqueta="Operacao" titulo="Mapa" descricao="Onde estao os carregadores e como estao agora. Atualiza a cada 30 segundos." />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-soft)]" />
          <input
            className="w-full rounded-full border border-[var(--color-border)] bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[var(--color-primary)]"
            placeholder="Ir para um carregador..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {sugestoes.length ? (
            <ul className="absolute left-0 right-0 top-full z-[1000] mt-1 overflow-hidden rounded-[18px] border border-[var(--color-border)] bg-white shadow-lg">
              {sugestoes.map((c) => (
                <li key={c.id_hardware}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-[var(--color-bg-muted)]"
                    onClick={() => {
                      setParams({ carregador: c.id_hardware });
                      setBusca("");
                    }}
                  >
                    <span className="truncate font-semibold">{c.nome_local}</span>
                    <StatusCarregador status={statusCarregador(c)} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <button type="button" onClick={trocarEstilo} className="pill-button inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold">
          <Layers size={16} /> {estilo === "rua" ? "Satelite" : "Ruas"}
        </button>
      </div>

      <div className="app-panel overflow-hidden rounded-[30px] p-2">
        <MapaLeaflet pontos={pontos} estilo={estilo} foco={foco} />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-soft)]">
        {Object.entries(STATUS_CARREGADOR).map(([chave, s]) => (
          <span key={chave} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-semibold">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.cor }} /> {s.texto} {contagem[chave] || 0}
          </span>
        ))}
      </div>

      {semLocal.length ? (
        <div className="app-panel p-4 text-sm">
          <div className="font-semibold text-[var(--color-text)]">{semLocal.length} carregador(es) sem localizacao</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {semLocal.map((c) => (
              <Link
                key={c.id_hardware}
                to={`/carregadores/${encodeURIComponent(c.id_hardware)}#localizacao`}
                className="rounded-full bg-[var(--color-bg-muted)] px-3 py-1.5 font-semibold text-[var(--color-primary-strong)] hover:bg-[var(--color-primary-soft)]"
              >
                {c.nome_local} · definir local
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
