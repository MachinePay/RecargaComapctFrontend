import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  CircleCheck,
  Clock,
  CreditCard,
  LocateFixed,
  MapPin,
  Pencil,
  Play,
  Stethoscope,
  Terminal,
  Trash2,
  Wallet,
  Zap,
} from "lucide-react";
import Swal from "sweetalert2";

import api from "../api/axios";
import { useAuth } from "../context/useAuth";
import usePolling from "../hooks/usePolling";
import Badge from "../components/Badge";
import Button from "../components/Button";
import LoadingSpinner from "../components/LoadingSpinner";
import MapaLeaflet from "../components/MapaLeaflet";
import Modal from "../components/Modal";
import TabelaSessoes from "../components/TabelaSessoes";
import { BarraConexao, CartaoResumo, InfoPill, StatusCarregador } from "../components/CarregadorUi";
import { STATUS_CARREGADOR, lerCoordenadas, qualidadeConexao, statusCarregador, textoConector } from "../utils/carregadores";
import { confirmar } from "../utils/confirmar";
import { campoClasse } from "../utils/estilos";
import { STATUS_SESSAO, formatarDataHora, formatarKwh, formatarMinutos, formatarRelogio, formatarValor } from "../utils/formatos";

// Chamadas OCPP uteis para diagnostico, com o payload de exemplo.
const COMANDOS_OCPP = {
  GetConfiguration: {},
  ChangeConfiguration: { key: "HeartbeatInterval", value: "60" },
  TriggerMessage: { requestedMessage: "StatusNotification", connectorId: 1 },
  UnlockConnector: { connectorId: 1 },
  Reset: { type: "Soft" },
  // Parar carga que o carregador comecou sozinho (transactionId 0 = sem StartTransaction).
  RemoteStopTransaction: { transactionId: 0 },
  ChangeAvailability: { connectorId: 1, type: "Inoperative" },
};

const CATEGORIAS = {
  PAGAMENTO: "ok",
  SESSAO: "aviso",
  DISPOSITIVO: "neutro",
  TESTE: "neutro",
};

// Mesma conta do backend (mercado_pago_caixa.minutos_por_valor).
function minutosPorValor(precoValor, precoMinutos, valor) {
  if (!precoValor || !precoMinutos || valor <= 0) return 0;
  return Math.floor((valor * precoMinutos) / precoValor + 1e-9);
}

function Painel({ titulo, acoes, children, id, className = "" }) {
  return (
    <section id={id} className={`app-panel p-4 sm:p-5 ${className}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold tracking-[-0.02em] text-[var(--color-text)]">{titulo}</h2>
        {acoes}
      </div>
      {children}
    </section>
  );
}

function desde(valor) {
  if (!valor) return "-";
  return formatarDataHora(valor);
}

export default function CarregadorDetalhe() {
  const { carregadorId } = useParams();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const base = `/admin/carregadores/${encodeURIComponent(carregadorId)}`;
  const [carregador, setCarregador] = useState(null);
  const [sessoes, setSessoes] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [aba, setAba] = useState("recargas");

  const [edicao, setEdicao] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [ocppAberto, setOcppAberto] = useState(false);
  const [ocpp, setOcpp] = useState({ acao: "GetConfiguration", payload: "{}" });
  const [ocppResposta, setOcppResposta] = useState("");
  const [ocppEnviando, setOcppEnviando] = useState(false);
  const [preco, setPreco] = useState(null);
  const [criandoCaixa, setCriandoCaixa] = useState(false);
  const [valorSimulado, setValorSimulado] = useState("10");
  const [simulacao, setSimulacao] = useState(null);
  const [local, setLocal] = useState(null);
  const [localErro, setLocalErro] = useState("");
  // Nome atual da loja/caixa no Mercado Pago (para achar no app do MP).
  const [nomesMp, setNomesMp] = useState(null);
  const [renomeando, setRenomeando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [c, s, h] = await Promise.all([
        api.get(base),
        api.get("/admin/sessoes", { params: { carregador_id: carregadorId, limite: 30 } }),
        api.get(`${base}/historico`, { params: { limite: 80 } }),
      ]);
      setCarregador(c.data);
      setSessoes(s.data);
      setHistorico(h.data);
    } catch {
      // Toast global
    }
  }, [base, carregadorId]);

  usePolling(carregar, 4000, true, { imediato: true });

  const posId = carregador?.mp_pos_id;
  useEffect(() => {
    if (!posId || !isAdmin) return undefined;
    let cancelado = false;
    api
      .get(`${base}/mercado-pago/caixa`, { silencioso: true })
      .then(({ data }) => !cancelado && setNomesMp(data))
      .catch(() => !cancelado && setNomesMp({ loja: null, caixa: null }));
    return () => {
      cancelado = true;
    };
  }, [posId, isAdmin, base]);

  if (!carregador) return <LoadingSpinner className="min-h-[60vh]" />;

  const status = statusCarregador(carregador);
  const sessao = carregador.sessao_ativa;
  const statusSessao = sessao ? STATUS_SESSAO[sessao.status] : null;
  const conexao = qualidadeConexao(carregador);

  // ---- Acoes -----------------------------------------------------------
  const encerrar = async (alvo) => {
    const ok = await confirmar({
      titulo: `Encerrar a recarga #${alvo.id}?`,
      texto: "O carregador desliga agora. O tempo que sobrou nao e' devolvido.",
      confirmarTexto: "Encerrar",
      perigoso: true,
    });
    if (!ok) return;
    try {
      await api.post(`/admin/sessoes/${alvo.id}/encerrar`);
      carregar();
    } catch {
      // Toast global
    }
  };

  const liberarTeste = async () => {
    const { value: minutos } = await Swal.fire({
      title: "Liberar recarga de teste",
      text: "Sem pagamento. Passa pelo mesmo caminho de uma venda (bom para testar com o testador Tipo 2).",
      input: "number",
      inputValue: 2,
      inputAttributes: { min: 1, max: 1440 },
      inputLabel: "Minutos",
      showCancelButton: true,
      confirmButtonText: "Liberar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#1f7a4c",
    });
    if (!minutos) return;
    try {
      await api.post(`${base}/sessao-teste`, { minutos: Number(minutos) });
      carregar();
    } catch {
      // Toast global
    }
  };

  const excluir = async () => {
    const ok = await confirmar({
      titulo: `Excluir "${carregador.nome_local}"?`,
      texto:
        "Ele some do painel e para de aceitar conexao. Se ja teve vendas, elas continuam nos relatorios. O mesmo ID pode ser cadastrado de novo depois.",
      confirmarTexto: "Excluir",
      perigoso: true,
    });
    if (!ok) return;
    try {
      await api.delete(base);
      navigate("/carregadores", { replace: true });
    } catch {
      // Toast global (ex.: recarga em andamento)
    }
  };

  const abrirEdicao = async () => {
    setEdicao({
      nome_local: carregador.nome_local,
      connector_id: carregador.connector_id,
      ativo: carregador.ativo,
      cliente_id: carregador.cliente_id ?? "",
      mp_terminal_id: carregador.mp_terminal_id || "",
    });
    try {
      setClientes((await api.get("/admin/clientes")).data);
    } catch {
      // Toast global
    }
  };

  const renomearNoMp = async () => {
    setRenomeando(true);
    try {
      const { data } = await api.post(`${base}/mercado-pago/renomear`);
      setNomesMp(data);
    } catch {
      // Toast global
    } finally {
      setRenomeando(false);
    }
  };

  const salvarEdicao = async (event) => {
    event.preventDefault();
    try {
      const { data } = await api.patch(base, {
        nome_local: edicao.nome_local,
        connector_id: Number(edicao.connector_id) || 1,
        ativo: edicao.ativo,
        cliente_id: edicao.cliente_id ? Number(edicao.cliente_id) : null,
        mp_terminal_id: (edicao.mp_terminal_id || "").trim() || null,
      });
      setEdicao(null);
      carregar();
      if (data.aviso_mp) Swal.fire({ icon: "warning", title: "Mercado Pago", text: data.aviso_mp, confirmButtonColor: "#1f7a4c" });
      else if (data.mp_pos_id && data.nome_local !== carregador.nome_local) setNomesMp({ loja: data.nome_local, caixa: data.nome_local });
    } catch {
      // Toast global
    }
  };

  const enviarOcpp = async (event) => {
    event.preventDefault();
    let payload;
    try {
      payload = JSON.parse(ocpp.payload || "{}");
    } catch {
      setOcppResposta("Payload nao e' um JSON valido.");
      return;
    }
    setOcppEnviando(true);
    setOcppResposta("");
    try {
      const { data } = await api.post(`${base}/ocpp`, { acao: ocpp.acao, payload });
      setOcppResposta(JSON.stringify(data.resposta, null, 2));
    } catch (error) {
      setOcppResposta(error.compactpayMessage || "Falhou");
    } finally {
      setOcppEnviando(false);
    }
  };

  // ---- Venda na maquininha ----------------------------------------------
  const precoForm = preco ?? { valor: carregador.preco_valor ?? "", minutos: carregador.preco_minutos ?? "" };
  const precoValorNum = Number(String(precoForm.valor).replace(",", "."));
  const precoMinutosNum = Number(precoForm.minutos);

  const salvarPreco = async (event) => {
    event.preventDefault();
    try {
      await api.patch(base, { preco_valor: precoValorNum, preco_minutos: precoMinutosNum });
      setPreco(null);
      carregar();
    } catch {
      // Toast global
    }
  };

  const criarCaixa = async () => {
    setCriandoCaixa(true);
    try {
      await api.post(`${base}/mercado-pago/caixa`);
      carregar();
    } catch {
      // Toast global
    } finally {
      setCriandoCaixa(false);
    }
  };

  const simularPagamento = async (event) => {
    event.preventDefault();
    setSimulacao(null);
    try {
      const { data } = await api.post(`${base}/simular-pagamento`, { valor: Number(String(valorSimulado).replace(",", ".")) });
      setSimulacao(data);
      carregar();
    } catch {
      // Toast global
    }
  };

  // ---- Localizacao ------------------------------------------------------
  const localForm = local ?? {
    texto: carregador.latitude != null ? `${carregador.latitude}, ${carregador.longitude}` : "",
    endereco: carregador.endereco || "",
    cep: carregador.cep || "",
    numero: "",
  };

  const buscarCep = async () => {
    const digitos = (localForm.cep || "").replace(/\D/g, "");
    if (digitos.length !== 8) {
      setLocalErro("CEP precisa ter 8 numeros.");
      return;
    }
    setLocalErro("");
    try {
      const { data } = await api.get(`/admin/cep/${digitos}`, { params: { numero: localForm.numero || undefined }, silencioso: true });
      setLocal({
        ...localForm,
        cep: data.cep,
        endereco: data.endereco,
        texto: data.latitude != null ? `${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}` : localForm.texto,
      });
      if (data.latitude == null) setLocalErro("Achei o endereco, mas nao o ponto no mapa. Marque clicando no mapa.");
      else if (data.precisao === "cidade") setLocalErro("So achei a cidade: ajuste o ponto clicando no mapa.");
    } catch (error) {
      setLocalErro(error.compactpayMessage || "CEP nao encontrado.");
    }
  };
  const coordenadas = lerCoordenadas(localForm.texto);

  const usarMinhaLocalizacao = () => {
    setLocalErro("");
    if (!navigator.geolocation) {
      setLocalErro("Este navegador nao informa a localizacao.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (pos.coords.accuracy > 150) {
          setLocalErro(`Localizacao imprecisa (${Math.round(pos.coords.accuracy)} m). Tente no celular, perto do carregador.`);
          return;
        }
        setLocal({ ...localForm, texto: `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}` });
      },
      () => setLocalErro("Permissao de localizacao negada."),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const salvarLocal = async (event) => {
    event.preventDefault();
    if (localForm.texto.trim() && !coordenadas) {
      setLocalErro("Nao entendi a localizacao. Cole \"-23.55, -46.63\" ou um link do Google Maps aberto no navegador.");
      return;
    }
    try {
      await api.patch(base, {
        cep: (localForm.cep || "").trim() || null,
        endereco: localForm.endereco.trim() || null,
        latitude: coordenadas?.latitude ?? null,
        longitude: coordenadas?.longitude ?? null,
      });
      setLocal(null);
      setLocalErro("");
      carregar();
    } catch {
      // Toast global
    }
  };

  const pontoMapa = coordenadas
    ? [{ id: carregador.id_hardware, ...coordenadas, cor: STATUS_CARREGADOR[status].cor, titulo: carregador.nome_local }]
    : [];

  return (
    <div className="space-y-4 p-2 sm:p-4">
      <Link to="/carregadores" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-text-soft)] hover:text-[var(--color-text)]">
        <ArrowLeft size={16} /> Carregadores
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-extrabold tracking-[-0.04em] text-[var(--color-text)]">{carregador.nome_local}</h1>
            <StatusCarregador status={status} />
            {!carregador.ativo ? <Badge tom="erro">Inativo</Badge> : null}
          </div>
          <div className="mt-1 text-sm text-[var(--color-text-soft)]">
            <span className="font-mono">{carregador.id_hardware}</span>
            {carregador.cliente_nome ? ` · ${carregador.cliente_nome}` : " · sem cliente"}
            {carregador.endereco ? ` · ${carregador.endereco}` : ""}
          </div>
        </div>
        {isAdmin ? (
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/diagnostico?carregador=${encodeURIComponent(carregador.id_hardware)}`}
            className="pill-button inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold"
          >
            <Stethoscope size={16} /> Diagnostico
          </Link>
          <button type="button" className="pill-button inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold" onClick={abrirEdicao}>
            <Pencil size={16} /> Editar
          </button>
          <button
            type="button"
            className="pill-button inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold"
            onClick={() => setOcppAberto(true)}
            disabled={!carregador.online}
          >
            <Terminal size={16} /> OCPP
          </button>
          <Button onClick={liberarTeste} disabled={!carregador.online || Boolean(sessao)} className="px-4 py-2 text-sm">
            <Play size={16} /> Liberar teste
          </Button>
          <button
            type="button"
            onClick={excluir}
            disabled={Boolean(sessao)}
            title={sessao ? "Encerre a recarga antes de excluir" : "Excluir carregador"}
            className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-3.5 py-2 text-sm font-semibold text-[var(--color-error)] hover:bg-rose-50 disabled:opacity-45"
          >
            <Trash2 size={16} /> Excluir
          </button>
        </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CartaoResumo rotulo="Hoje" valor={formatarValor(carregador.faturamento_hoje)} ajuda={`${carregador.vendas_hoje || 0} venda(s)`} Icone={Wallet} destaque />
        <CartaoResumo rotulo="Recargas hoje" valor={carregador.recargas_hoje || 0} ajuda={formatarKwh(carregador.energia_hoje_kwh)} Icone={Zap} />
        <CartaoResumo rotulo="Conexao" valor={conexao.texto} ajuda={`${carregador.quedas_hoje || 0} queda(s) hoje`} Icone={Activity} />
        <CartaoResumo rotulo="Ultimo sinal" valor={carregador.ultimo_sinal ? formatarDataHora(carregador.ultimo_sinal).slice(6) : "-"} ajuda={formatarDataHora(carregador.ultimo_sinal).slice(0, 5)} Icone={Clock} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <Painel titulo="Agora">
          {sessao ? (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] bg-[linear-gradient(135deg,#eff6ff_0%,#dbeafe_100%)] p-4">
              <div>
                <Badge tom={statusSessao?.tom}>{statusSessao?.texto || sessao.status}</Badge>
                <div className="mt-2 text-sm text-[var(--color-text-soft)]">
                  Recarga #{sessao.id} · {sessao.minutos_pagos ? `${formatarMinutos(sessao.minutos_pagos)} pagos` : "livre (RFID)"} · {formatarKwh(sessao.energia_kwh)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {sessao.segundos_restantes != null ? (
                  <span className="text-4xl font-extrabold tabular-nums text-blue-700">{formatarRelogio(sessao.segundos_restantes)}</span>
                ) : null}
                {isAdmin ? <button
                  type="button"
                  onClick={() => encerrar(sessao)}
                  className="rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-[var(--color-error)] hover:bg-rose-50"
                >
                  Encerrar
                </button> : null}
              </div>
            </div>
          ) : (
            <div className="rounded-[20px] bg-[var(--color-bg-muted)] px-4 py-3 text-sm text-[var(--color-text-soft)]">
              {carregador.online ? "Livre, esperando um pagamento." : "Offline: nao vende ate reconectar."}
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
            <InfoPill rotulo="Conector">
              {textoConector(carregador)}
              {carregador.erro_conector ? <span className="text-[var(--color-error)]"> · {carregador.erro_conector}</span> : null}
            </InfoPill>
            <div className="rounded-[14px] bg-[var(--color-bg-muted)] px-3 py-2">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-soft)]">Conexao</div>
              <BarraConexao carregador={carregador} compacto />
            </div>
            <InfoPill rotulo="Online desde">{desde(carregador.online_desde)}</InfoPill>
            <InfoPill rotulo="IP">{carregador.ip || "-"}</InfoPill>
            <InfoPill rotulo="Modelo">{[carregador.vendor, carregador.modelo].filter(Boolean).join(" ") || "-"}</InfoPill>
            <InfoPill rotulo="Firmware">{carregador.firmware_version || "-"}</InfoPill>
          </div>
        </Painel>

        <Painel
          titulo="Venda na maquininha"
          acoes={
            carregador.banco_pagamento === "sumup" ? (
              <Badge tom={carregador.sumup_reader_id || carregador.sumup_device_code ? "ok" : "aviso"}>SumUp</Badge>
            ) : carregador.mp_pos_id ? (
              <Badge tom="ok">Mercado Pago · caixa pronto</Badge>
            ) : (
              <Badge tom="aviso">Mercado Pago · sem caixa</Badge>
            )
          }
        >
          {!isAdmin ? (
            <div className="text-sm text-[var(--color-text)]">
              {carregador.preco_valor ? (
                <>
                  Preco: <b>{formatarValor(carregador.preco_valor)}</b> = <b>{formatarMinutos(carregador.preco_minutos)}</b>
                </>
              ) : (
                "Preco ainda nao definido."
              )}
            </div>
          ) : null}
          {isAdmin ? (
          <form onSubmit={salvarPreco} className="flex flex-wrap items-end gap-2">
            <label className="w-[110px]">
              <span className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Valor (R$)</span>
              <input className={`${campoClasse} py-2`} inputMode="decimal" placeholder="10" value={precoForm.valor} onChange={(e) => setPreco({ ...precoForm, valor: e.target.value })} required />
            </label>
            <span className="pb-2 font-bold text-[var(--color-text-soft)]">=</span>
            <label className="w-[110px]">
              <span className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Minutos</span>
              <input className={`${campoClasse} py-2`} type="number" min={1} max={1440} placeholder="20" value={precoForm.minutos} onChange={(e) => setPreco({ ...precoForm, minutos: e.target.value })} required />
            </label>
            <Button type="submit" className="px-4 py-2 text-sm" disabled={preco === null}>
              Salvar preco
            </Button>
          </form>
          ) : null}
          {precoValorNum > 0 && precoMinutosNum > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[5, 10, 20, 50].map((v) => (
                <span key={v} className="rounded-full bg-[var(--color-bg-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text)]">
                  {formatarValor(v)} → {formatarMinutos(minutosPorValor(precoValorNum, precoMinutosNum, v))}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-4 border-t border-[var(--color-border)] pt-3 text-sm">
            {carregador.banco_pagamento === "sumup" ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-semibold text-[var(--color-success)]">
                  <CircleCheck size={16} /> Maquininha SumUp {carregador.sumup_reader_id || carregador.sumup_device_code}
                </div>
                <p className="text-xs text-[var(--color-text-soft)]">
                  O servidor le as vendas da conta SumUp a cada 10 segundos e libera o tempo da venda feita nesta maquininha
                  {carregador.sumup_usuario ? ` (Pix pelo operador ${carregador.sumup_usuario})` : ""}.
                </p>
              </div>
            ) : carregador.mp_pos_id ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-semibold text-[var(--color-success)]">
                  <CircleCheck size={16} /> Loja e caixa criados no Mercado Pago
                </div>
                <div className="rounded-[12px] bg-[var(--color-bg-muted)] px-3 py-2 text-xs text-[var(--color-text)]">
                  <div>
                    Loja: <b>{nomesMp?.loja ?? "..."}</b> <span className="text-[var(--color-text-soft)]">(n. {carregador.mp_store_id})</span>
                  </div>
                  <div>
                    Caixa: <b>{nomesMp?.caixa ?? "..."}</b> <span className="text-[var(--color-text-soft)]">(n. {carregador.mp_pos_id} · {carregador.mp_pos_external_id})</span>
                  </div>
                </div>
                {isAdmin && nomesMp && (nomesMp.loja !== carregador.nome_local || nomesMp.caixa !== carregador.nome_local) ? (
                  <button
                    type="button"
                    onClick={renomearNoMp}
                    disabled={renomeando}
                    className="pill-button px-3 py-1.5 text-xs font-semibold disabled:opacity-45"
                  >
                    {renomeando ? "Renomeando..." : `Renomear para "${carregador.nome_local}" no Mercado Pago`}
                  </button>
                ) : null}
                <p className="text-xs text-[var(--color-text-soft)]">
                  No app do Mercado Pago: Seu negocio &gt; Lojas e caixas. Vincule a maquininha a esta loja e caixa; qualquer pagamento aprovado nela libera o tempo.
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[var(--color-text-soft)]">
                  {carregador.tem_token_mp ? "Crie a loja e o caixa na conta do cliente." : "Escolha um cliente com token do Mercado Pago (Editar)."}
                </span>
                <Button onClick={criarCaixa} className={`px-4 py-2 text-sm ${isAdmin ? "" : "hidden"}`} disabled={!carregador.tem_token_mp || criandoCaixa}>
                  <CreditCard size={16} /> {criandoCaixa ? "Criando..." : "Criar loja e caixa"}
                </Button>
              </div>
            )}
          </div>

          {isAdmin ? (
          <form onSubmit={simularPagamento} className="mt-3 flex flex-wrap items-end gap-2 border-t border-[var(--color-border)] pt-3">
            <label className="w-[130px]">
              <span className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Simular pagamento</span>
              <input className={`${campoClasse} py-2`} inputMode="decimal" value={valorSimulado} onChange={(e) => setValorSimulado(e.target.value)} required />
            </label>
            <button
              type="submit"
              className="pill-button px-4 py-2 text-sm font-semibold disabled:opacity-45"
              disabled={!carregador.preco_valor || !carregador.online}
              title={!carregador.preco_valor ? "Salve o preco primeiro" : !carregador.online ? "Carregador offline" : ""}
            >
              Testar sem pagar
            </button>
            {simulacao ? (
              <span className={`text-sm font-semibold ${simulacao.estornada ? "text-[var(--color-warning)]" : "text-[var(--color-success)]"}`}>
                {simulacao.estornada ? "Nao liberou (carregador ocupado)" : `${formatarValor(simulacao.valor)} liberou ${formatarMinutos(simulacao.minutos)}`}
              </span>
            ) : null}
          </form>
          ) : null}
        </Painel>
      </div>

      <Painel
        id="localizacao"
        titulo="Localizacao"
        acoes={carregador.latitude != null ? (
          <Link to={`/mapa?carregador=${encodeURIComponent(carregador.id_hardware)}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)]">
            <MapPin size={15} /> Ver no mapa geral
          </Link>
        ) : null}
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
          {isAdmin ? (
          <form onSubmit={salvarLocal} className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <label className="w-[140px]">
                <span className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">CEP</span>
                <input className={`${campoClasse} py-2 font-mono`} inputMode="numeric" placeholder="00000-000" value={localForm.cep} onChange={(e) => setLocal({ ...localForm, cep: e.target.value })} />
              </label>
              <label className="w-[100px]">
                <span className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Numero</span>
                <input className={`${campoClasse} py-2`} value={localForm.numero} onChange={(e) => setLocal({ ...localForm, numero: e.target.value })} />
              </label>
              <button type="button" onClick={buscarCep} className="pill-button px-4 py-2 text-sm font-semibold">
                Buscar pelo CEP
              </button>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Endereco (texto)</span>
              <input className={`${campoClasse} py-2`} placeholder="Rua, numero - bairro, cidade" value={localForm.endereco} onChange={(e) => setLocal({ ...localForm, endereco: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Coordenadas ou link do Google Maps</span>
              <input
                className={`${campoClasse} py-2 font-mono text-sm`}
                placeholder="-23.5505, -46.6333"
                value={localForm.texto}
                onChange={(e) => {
                  setLocal({ ...localForm, texto: e.target.value });
                  setLocalErro("");
                }}
              />
            </label>
            <p className="text-xs text-[var(--color-text-soft)]">Ou clique no mapa no ponto exato do carregador.</p>
            {localErro ? <p className="text-sm text-[var(--color-error)]">{localErro}</p> : null}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={usarMinhaLocalizacao} className="pill-button inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold">
                <LocateFixed size={16} /> Usar minha localizacao
              </button>
              <Button type="submit" className="px-4 py-2 text-sm" disabled={local === null}>
                Salvar local
              </Button>
            </div>
          </form>
          ) : (
            <div className="text-sm text-[var(--color-text-soft)]">{carregador.endereco || "Sem endereco cadastrado."}</div>
          )}
          <div className="overflow-hidden rounded-[24px] border border-[var(--color-border)]">
            <MapaLeaflet
              pontos={pontoMapa}
              className="h-[260px]"
              onClicarMapa={isAdmin ? (lat, lng) => {
                setLocal({ ...localForm, texto: `${lat.toFixed(6)}, ${lng.toFixed(6)}` });
                setLocalErro("");
              } : undefined}
            />
          </div>
        </div>
      </Painel>

      <section className="app-panel p-4 sm:p-5">
        <div className="mb-3 flex gap-2">
          {[
            ["recargas", `Recargas (${sessoes.length})`],
            ["historico", "Historico"],
          ].map(([chave, texto]) => (
            <button
              key={chave}
              type="button"
              onClick={() => setAba(chave)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                aba === chave ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-bg-muted)] text-[var(--color-text-soft)] hover:text-[var(--color-text)]"
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
        {aba === "recargas" ? (
          <TabelaSessoes sessoes={sessoes} mostrarCarregador={false} onEncerrar={isAdmin ? encerrar : undefined} />
        ) : (
          <ul className="max-h-[420px] overflow-y-auto text-sm">
            {historico.map((h, i) => (
              <li key={`${h.created_at}-${i}`} className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] py-2">
                <span className="w-[110px] shrink-0 tabular-nums text-xs text-[var(--color-text-soft)]">{formatarDataHora(h.created_at)}</span>
                <Badge tom={CATEGORIAS[h.categoria]}>{h.categoria}</Badge>
                <span className={`min-w-0 flex-1 ${/ALERTA|FALHOU|ATENCAO/.test(h.descricao) ? "font-semibold text-[var(--color-error)]" : ""}`}>{h.descricao}</span>
                {h.valor ? <span className="font-semibold">{formatarValor(h.valor)}</span> : null}
              </li>
            ))}
            {historico.length === 0 ? <li className="py-6 text-center text-[var(--color-text-soft)]">Nada registrado ainda.</li> : null}
          </ul>
        )}
      </section>

      <Modal open={Boolean(edicao)} onClose={() => setEdicao(null)}>
        {edicao ? (
          <form onSubmit={salvarEdicao} className="space-y-4">
            <h2 className="text-3xl font-extrabold tracking-[-0.04em] text-[var(--color-text)]">Editar carregador</h2>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Nome do local</span>
              <input className={campoClasse} value={edicao.nome_local} onChange={(e) => setEdicao({ ...edicao, nome_local: e.target.value })} required />
            </label>
            <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Cliente (dono)</span>
                <select className={campoClasse} value={edicao.cliente_id} onChange={(e) => setEdicao({ ...edicao, cliente_id: e.target.value })}>
                  <option value="">Sem cliente</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome_empresa}
                      {c.tem_token_mp ? "" : " (sem token MP)"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Conector</span>
                <input className={campoClasse} type="number" min={1} value={edicao.connector_id} onChange={(e) => setEdicao({ ...edicao, connector_id: e.target.value })} />
              </label>
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Maquininha Mercado Pago (opcional)</span>
              <input
                className={`${campoClasse} font-mono`}
                placeholder="Terminal/serie que aparece no Diagnostico"
                value={edicao.mp_terminal_id}
                onChange={(e) => setEdicao({ ...edicao, mp_terminal_id: e.target.value })}
              />
              <span className="mt-1 block text-xs text-[var(--color-text-soft)]">
                So se o pagamento chegar sem loja/caixa: o Diagnostico mostra o codigo da maquininha para colar aqui.
              </span>
            </label>
            <p className="text-xs text-[var(--color-text-soft)]">Trocar de cliente apaga a loja e o caixa: a conta do Mercado Pago muda e e&apos; preciso criar de novo.</p>
            <label className="flex items-center gap-3 text-sm font-semibold">
              <input type="checkbox" checked={edicao.ativo} onChange={(e) => setEdicao({ ...edicao, ativo: e.target.checked })} />
              Ativo (desmarcado: recusa a conexao e nao vende)
            </label>
            <div className="flex gap-3 pt-2">
              <button type="button" className="pill-button flex-1 px-5 py-3 font-semibold" onClick={() => setEdicao(null)}>
                Cancelar
              </button>
              <Button type="submit" className="flex-1 justify-center">
                Salvar
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal open={ocppAberto} onClose={() => setOcppAberto(false)}>
        <form onSubmit={enviarOcpp} className="space-y-4">
          <h2 className="text-3xl font-extrabold tracking-[-0.04em] text-[var(--color-text)]">Comando OCPP</h2>
          <p className="text-sm text-[var(--color-text-soft)]">Manda uma chamada direto para o carregador e mostra a resposta. Use para diagnostico.</p>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Acao</span>
            <select
              className={campoClasse}
              value={ocpp.acao}
              onChange={(e) => setOcpp({ acao: e.target.value, payload: JSON.stringify(COMANDOS_OCPP[e.target.value], null, 2) })}
            >
              {Object.keys(COMANDOS_OCPP).map((acao) => (
                <option key={acao} value={acao}>
                  {acao}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Payload (JSON)</span>
            <textarea className={`${campoClasse} font-mono text-sm`} rows={5} value={ocpp.payload} onChange={(e) => setOcpp({ ...ocpp, payload: e.target.value })} />
          </label>
          <Button type="submit" className="w-full justify-center" disabled={ocppEnviando}>
            {ocppEnviando ? "Aguardando o carregador..." : "Enviar"}
          </Button>
          {ocppResposta ? <pre className="max-h-[300px] overflow-auto rounded-[18px] bg-[#0f1f15] p-4 text-xs text-emerald-100">{ocppResposta}</pre> : null}
        </form>
      </Modal>
    </div>
  );
}
