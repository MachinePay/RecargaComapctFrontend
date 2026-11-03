import { useCallback, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  Circle,
  CircleCheck,
  CircleX,
  Copy,
  LoaderCircle,
  LockOpen,
  Pause,
  Play,
  Plug,
  Radio,
  RefreshCw,
  Search,
  Server,
  Settings2,
  Square,
  Trash2,
  TriangleAlert,
  Zap,
} from "lucide-react";

import api, { API_BASE_URL } from "../api/axios";
import usePolling from "../hooks/usePolling";
import Badge from "../components/Badge";
import Cabecalho from "../components/Cabecalho";
import LoadingSpinner from "../components/LoadingSpinner";
import { confirmar } from "../utils/confirmar";
import { campoClasse } from "../utils/estilos";
import { STATUS_SESSAO, formatarDataHora, formatarHora, formatarKwh, formatarRelogio } from "../utils/formatos";
import {
  STATUS_CONECTOR,
  TIPOS_CONEXAO,
  descreverEvento,
  direcaoEvento,
  interpretarResposta,
  lerBruto,
} from "../utils/ocppTextos";

dayjs.extend(utc);

const MAX_EVENTOS_TELA = 800;
const silencioso = { silencioso: true };

const ESTADOS = {
  ok: { Icone: CircleCheck, cor: "text-[var(--color-success)]", fundo: "bg-[var(--color-primary-soft)]", borda: "border-emerald-200" },
  erro: { Icone: CircleX, cor: "text-[var(--color-error)]", fundo: "bg-rose-50", borda: "border-rose-200" },
  aviso: { Icone: TriangleAlert, cor: "text-[var(--color-warning)]", fundo: "bg-amber-50", borda: "border-amber-200" },
  pendente: { Icone: Circle, cor: "text-slate-300", fundo: "bg-[var(--color-bg-muted)]", borda: "border-[var(--color-border)]" },
  rodando: { Icone: LoaderCircle, cor: "text-[var(--color-primary)] animate-spin", fundo: "bg-[var(--color-bg-muted)]", borda: "border-[var(--color-border)]" },
};

const NIVEL_COR = {
  ok: "bg-[var(--color-success)]",
  info: "bg-sky-400",
  aviso: "bg-[var(--color-warning)]",
  erro: "bg-[var(--color-error)]",
};

const FILTROS = [
  { chave: "tudo", rotulo: "Tudo" },
  { chave: "conexao", rotulo: "Conexao" },
  { chave: "mensagens", rotulo: "Mensagens" },
  { chave: "problemas", rotulo: "So problemas" },
];

// Roda o teste e mede quanto o carregador demorou para responder.
async function cronometrar(executar) {
  const inicio = performance.now();
  try {
    return { resultado: await executar(), ms: Math.round(performance.now() - inicio) };
  } catch (error) {
    error.ms = Math.round(performance.now() - inicio);
    throw error;
  }
}

// ---- Endereco que vai no app do fabricante -----------------------------

function montarEndereco(servidor, id) {
  if (/^https?:\/\//.test(API_BASE_URL)) {
    // Producao (Render): o site chama o backend pela URL completa.
    const url = new URL(API_BASE_URL);
    const seguro = url.protocol === "https:";
    const esquema = seguro ? "wss" : "ws";
    const host = url.port ? `${url.hostname}:${url.port}` : url.hostname;
    return {
      local: false,
      seguro,
      endereco: `${esquema}://${url.hostname}`,
      porta: url.port || (seguro ? "443" : "80"),
      urlCompleta: `${esquema}://${host}/ocpp/${id}`,
      alternativas: [url.hostname, `${esquema}://${host}/ocpp`],
    };
  }
  // Bancada: o backend roda no PC, na porta 8000, e o carregador na mesma rede.
  // O backend manda primeiro o IP da placa que sai para a internet (o Wi-Fi).
  const ip = servidor?.ips_locais?.[0] || "IP-DO-PC";
  return {
    local: true,
    seguro: false,
    endereco: ip,
    porta: "8000",
    urlCompleta: `ws://${ip}:8000/ocpp/${id}`,
    alternativas: [`ws://${ip}`, `ws://${ip}:8000/ocpp`],
    outrosIps: (servidor?.ips_locais || []).filter((outro) => outro !== ip),
  };
}

// ---- Pecas da tela ------------------------------------------------------

function Painel({ titulo, subtitulo, acoes, children, className = "" }) {
  return (
    <section className={`app-panel p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-[-0.02em] text-[var(--color-text)]">{titulo}</h2>
          {subtitulo ? <p className="mt-1 text-sm text-[var(--color-text-soft)]">{subtitulo}</p> : null}
        </div>
        {acoes}
      </div>
      {children}
    </section>
  );
}

function Copiar({ valor }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1500);
    } catch {
      // Sem permissao de clipboard: a pessoa copia na mao.
    }
  };
  return (
    <button
      type="button"
      onClick={copiar}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-white text-[var(--color-text-soft)] hover:text-[var(--color-primary-strong)]"
      aria-label="Copiar"
      title="Copiar"
    >
      {copiado ? <Check size={16} className="text-[var(--color-success)]" /> : <Copy size={16} />}
    </button>
  );
}

function CampoApp({ rotulo, valor, destaque = false }) {
  return (
    <div className={`flex items-center gap-3 rounded-[18px] border px-4 py-3 ${destaque ? "border-emerald-200 bg-[var(--color-primary-soft)]" : "border-[var(--color-border)] bg-white"}`}>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-soft)]">{rotulo}</div>
        <div className="mt-0.5 break-all font-mono text-base font-bold text-[var(--color-text)]">{valor}</div>
      </div>
      <Copiar valor={valor} />
    </div>
  );
}

function Passo({ numero, estado, titulo, detalhe, dica, ultimo }) {
  const { Icone, cor } = ESTADOS[estado];
  return (
    <li className="relative flex gap-4 pb-5">
      {!ultimo ? <span className="absolute left-[15px] top-9 h-[calc(100%-28px)] w-px bg-[var(--color-border-strong)]" /> : null}
      <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white">
        <Icone size={30} className={cor} strokeWidth={estado === "pendente" ? 1.5 : 2.2} />
      </div>
      <div className="min-w-0 flex-1 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-[var(--color-text-soft)]">{numero}.</span>
          <span className="font-bold text-[var(--color-text)]">{titulo}</span>
        </div>
        {detalhe ? <div className="mt-0.5 text-sm text-[var(--color-text-soft)]">{detalhe}</div> : null}
        {dica && estado !== "ok" ? (
          <div className={`mt-2 rounded-[14px] px-3 py-2 text-sm ${estado === "erro" ? "bg-rose-50 text-rose-900" : "bg-amber-50 text-amber-900"}`}>
            {dica}
          </div>
        ) : null}
      </div>
    </li>
  );
}

function Resultado({ resultado }) {
  const [aberto, setAberto] = useState(false);
  if (!resultado) return null;
  const { Icone, cor, fundo, borda } = ESTADOS[resultado.estado];
  return (
    <div className={`mt-3 rounded-[18px] border p-3 ${fundo} ${borda}`}>
      <div className="flex items-start gap-2">
        <Icone size={20} className={`mt-0.5 shrink-0 ${cor}`} />
        <div className="min-w-0 flex-1">
          <div className="font-bold text-[var(--color-text)]">{resultado.titulo}</div>
          {resultado.explicacao ? <div className="mt-0.5 text-sm text-[var(--color-text)]/80">{resultado.explicacao}</div> : null}
          <div className="mt-1 text-xs text-[var(--color-text-soft)]">
            {resultado.quando} · {resultado.ms} ms
          </div>
        </div>
      </div>
      {resultado.conteudo}
      {resultado.tecnico != null ? (
        <>
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-text-soft)] hover:text-[var(--color-text)]"
          >
            <ChevronDown size={14} className={`transition ${aberto ? "rotate-180" : ""}`} /> Resposta tecnica
          </button>
          {aberto ? (
            <pre className="mt-2 max-h-[260px] overflow-auto rounded-[14px] bg-[#0f1f15] p-3 text-xs text-emerald-100">
              {typeof resultado.tecnico === "string" ? resultado.tecnico : JSON.stringify(resultado.tecnico, null, 2)}
            </pre>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function TabelaConfiguracao({ chaves = [], desconhecidas = [] }) {
  const [busca, setBusca] = useState("");
  const filtradas = chaves.filter((c) => `${c.key} ${c.value ?? ""}`.toLowerCase().includes(busca.toLowerCase()));
  return (
    <div className="mt-3">
      <label className="relative block">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-soft)]" />
        <input className={`${campoClasse} py-2 pl-9 text-sm`} placeholder="Buscar configuracao" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </label>
      <div className="mt-2 max-h-[280px] overflow-auto rounded-[14px] border border-[var(--color-border)] bg-white">
        <table className="w-full text-left text-xs">
          <tbody>
            {filtradas.map((c) => (
              <tr key={c.key} className="border-b border-[var(--color-border)] last:border-0">
                <td className="px-3 py-2 font-mono font-semibold text-[var(--color-text)]">{c.key}</td>
                <td className="break-all px-3 py-2 font-mono text-[var(--color-text-soft)]">{String(c.value ?? "")}</td>
                <td className="px-3 py-2 text-[var(--color-text-soft)]">{c.readonly ? "so leitura" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {desconhecidas.length ? <div className="mt-2 text-xs text-[var(--color-text-soft)]">Desconhecidas: {desconhecidas.join(", ")}</div> : null}
    </div>
  );
}

function LinhaEvento({ evento }) {
  const [aberto, setAberto] = useState(false);
  const direcao = direcaoEvento(evento);
  const bruto = lerBruto(evento);
  const etiqueta =
    direcao === "carregador" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
        <ArrowDownLeft size={12} /> Carregador
      </span>
    ) : direcao === "servidor" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-800">
        <ArrowUpRight size={12} /> Servidor
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-text-soft)]">
        <Plug size={12} /> Conexao
      </span>
    );
  return (
    <li className="border-b border-[var(--color-border)] last:border-0">
      <button type="button" onClick={() => setAberto((v) => !v)} className="flex w-full items-start gap-3 px-2 py-2.5 text-left hover:bg-[var(--color-bg-muted)]/60">
        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${NIVEL_COR[evento.nivel] || NIVEL_COR.info}`} />
        <span className="w-[64px] shrink-0 pt-0.5 font-mono text-xs tabular-nums text-[var(--color-text-soft)]">{formatarHora(evento.momento)}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            {etiqueta}
            {evento.carregador_id ? <span className="font-mono text-[11px] text-[var(--color-text-soft)]">{evento.carregador_id}</span> : null}
          </span>
          <span className={`mt-0.5 block text-sm ${evento.nivel === "erro" ? "font-semibold text-[var(--color-error)]" : "text-[var(--color-text)]"}`}>
            {descreverEvento(evento)}
          </span>
        </span>
        {evento.bruto || evento.ip ? <ChevronDown size={16} className={`mt-1 shrink-0 text-[var(--color-text-soft)] transition ${aberto ? "rotate-180" : ""}`} /> : null}
      </button>
      {aberto ? (
        <div className="px-2 pb-3 pl-[88px]">
          {evento.ip ? <div className="mb-1 text-xs text-[var(--color-text-soft)]">IP de origem: {evento.ip}</div> : null}
          {evento.bruto ? (
            <pre className="max-h-[260px] overflow-auto rounded-[14px] bg-[#0f1f15] p-3 text-xs text-emerald-100">
              {bruto ? JSON.stringify(bruto, null, 2) : evento.bruto}
            </pre>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

// ---- Tela ---------------------------------------------------------------

export default function Diagnostico() {
  const [params, setParams] = useSearchParams();
  const [carregadores, setCarregadores] = useState(null);
  const [servidor, setServidor] = useState(null);
  const [servidorErro, setServidorErro] = useState("");
  const [eventos, setEventos] = useState([]);
  const [pausado, setPausado] = useState(false);
  const [filtro, setFiltro] = useState("tudo");
  const [ocultarHeartbeat, setOcultarHeartbeat] = useState(false);
  const [resultados, setResultados] = useState({});
  const [executando, setExecutando] = useState(null);
  const leitura = useRef({ carregador: null, seq: 0 });

  const selecionado = params.get("carregador") || carregadores?.find((c) => c.online)?.id_hardware || carregadores?.[0]?.id_hardware || "";
  const carregador = carregadores?.find((c) => c.id_hardware === selecionado);

  const carregarCarregadores = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/carregadores", silencioso);
      setCarregadores(data);
    } catch {
      setCarregadores((atual) => atual || []);
    }
  }, []);

  const carregarServidor = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/diagnostico/servidor", silencioso);
      setServidor(data);
      setServidorErro("");
    } catch (error) {
      setServidorErro(error.compactpayMessage || "Sem resposta do servidor");
    }
  }, []);

  const carregarEventos = useCallback(async () => {
    if (!selecionado) return;
    // Trocou de carregador: busca tudo de novo so dele.
    const trocou = leitura.current.carregador !== selecionado;
    const desde = trocou ? 0 : leitura.current.seq;
    try {
      const { data } = await api.get("/admin/diagnostico/eventos", { ...silencioso, params: { desde, carregador_id: selecionado } });
      if (trocou) {
        leitura.current = { carregador: selecionado, seq: 0 };
        setEventos(data);
      } else if (data.length) {
        setEventos((atual) => [...atual, ...data].slice(-MAX_EVENTOS_TELA));
      }
      if (data.length) leitura.current.seq = data[data.length - 1].seq;
    } catch {
      // O cartao do servidor ja mostra a falha.
    }
  }, [selecionado]);

  usePolling(carregarCarregadores, 3000, true, { imediato: true });
  usePolling(carregarServidor, 3000, true, { imediato: true });
  usePolling(carregarEventos, 2000, !pausado && Boolean(selecionado), { imediato: true });

  const escolher = (id) => setParams(id ? { carregador: id } : {});

  const limparLog = async () => {
    try {
      await api.delete("/admin/diagnostico/eventos", silencioso);
    } catch {
      // segue limpando a tela
    }
    leitura.current = { carregador: selecionado, seq: servidor?.ultimo_seq || 0 };
    setEventos([]);
  };

  const cadastrarId = async (id) => {
    try {
      await api.post("/admin/carregadores", { id_hardware: id, nome_local: `Carregador ${id}` });
      await carregarCarregadores();
      escolher(id);
    } catch {
      // Toast global
    }
  };

  if (carregadores === null) return <LoadingSpinner className="min-h-[60vh]" />;

  const naoCadastrados = (servidor?.ids_nao_cadastrados || []).filter((i) => !carregadores.some((c) => c.id_hardware === i.id));

  // ---- Checklist ----
  const tentouEsse = carregador?.online || eventos.some((e) => e.tipo === "tentativa" && e.carregador_id === selecionado);
  const recusaEsse = [...eventos].reverse().find((e) => e.tipo === "recusada" && e.carregador_id === selecionado);
  const apresentou = Boolean(carregador?.vendor || carregador?.modelo || carregador?.firmware_version);
  const idadeSinal =
    carregador?.ultimo_sinal && servidor?.hora ? dayjs.utc(servidor.hora).diff(dayjs.utc(carregador.ultimo_sinal), "second") : null;
  const sinalRecente = idadeSinal != null && idadeSinal <= (servidor?.heartbeat_intervalo || 60) * 3;

  const passos = carregador
    ? [
        {
          titulo: "Servidor no ar",
          estado: servidorErro ? "erro" : servidor ? "ok" : "rodando",
          detalhe: servidorErro ? servidorErro : servidor ? `Respondendo · versao ${servidor.versao}` : "Verificando...",
          dica: "O site nao esta falando com o backend. Confira se o servidor esta rodando (na Render: veja os Logs) e se o endereco do site esta no CORS_ALLOWED_ORIGINS.",
        },
        { titulo: "Carregador cadastrado", estado: "ok", detalhe: `ID ${carregador.id_hardware}` },
        {
          titulo: "Carregador tentou conectar",
          estado: tentouEsse ? "ok" : naoCadastrados.length ? "aviso" : "pendente",
          detalhe: tentouEsse ? "O servidor recebeu a tentativa de conexao." : "Nenhuma tentativa com este ID chegou ainda.",
          dica: naoCadastrados.length
            ? "Chegou tentativa com outro ID (aviso amarelo no topo). O ID configurado no app esta diferente do cadastrado."
            : "Confira no app do fabricante: Server Address, Port e Pile ID iguais ao quadro ao lado, Wi-Fi conectado. Depois reinicie o carregador e espere 1 minuto.",
        },
        {
          titulo: "Conexao aceita",
          estado: carregador.online ? "ok" : recusaEsse ? "erro" : "pendente",
          detalhe: carregador.online ? "Online agora." : recusaEsse ? `Recusada: ${recusaEsse.resumo}` : "Aguardando o passo anterior.",
          dica: recusaEsse ? "Corrija o motivo acima (cadastro, ativo ou senha) e reinicie o carregador." : null,
        },
        {
          titulo: "Carregador se apresentou",
          estado: apresentou ? "ok" : carregador.online ? "aviso" : "pendente",
          detalhe: apresentou
            ? [carregador.vendor, carregador.modelo, carregador.firmware_version && `firmware ${carregador.firmware_version}`].filter(Boolean).join(" · ")
            : "Primeira mensagem do OCPP (BootNotification).",
          dica: carregador.online ? "Conectou mas ainda nao mandou o BootNotification. Espere alguns segundos ou reinicie." : null,
        },
        {
          titulo: "Sinal de vida",
          estado: carregador.online && sinalRecente ? "ok" : carregador.online ? "aviso" : "pendente",
          detalhe: carregador.ultimo_sinal ? `Ultimo sinal: ${formatarDataHora(carregador.ultimo_sinal)}` : "Nenhum sinal ainda.",
          dica: carregador.online ? "Faz tempo que o carregador nao manda nada. A conexao pode estar travada." : null,
        },
        {
          titulo: "Conector",
          estado: !carregador.status_conector ? "pendente" : carregador.erro_conector || carregador.status_conector === "Faulted" ? "erro" : "ok",
          detalhe: carregador.status_conector
            ? `${STATUS_CONECTOR[carregador.status_conector] || carregador.status_conector}${carregador.erro_conector ? ` · erro ${carregador.erro_conector}` : ""}`
            : "O carregador ainda nao informou o status.",
          dica: carregador.erro_conector ? "O carregador informou defeito. Veja a tela dele e o manual." : null,
        },
      ]
    : [];
  const passosOk = passos.filter((p) => p.estado === "ok").length;

  // ---- Testes rapidos ----
  const base = `/admin/carregadores/${encodeURIComponent(selecionado)}`;
  const sessao = carregador?.sessao_ativa;

  const rodar = async (chave, executar) => {
    setExecutando(chave);
    let resultado;
    let ms;
    try {
      ({ resultado, ms } = await cronometrar(executar));
    } catch (error) {
      ms = error.ms;
      const status = error.response?.status;
      resultado =
        status === 409
          ? { estado: "erro", titulo: error.response?.data?.detail === "Carregador em uso" ? "Ja tem uma recarga em andamento" : "Carregador offline", explicacao: "O carregador precisa estar conectado (veja o checklist)." }
          : status === 504
            ? { estado: "erro", titulo: "O carregador nao respondeu em 15 segundos", explicacao: "Ele esta conectado, mas nao respondeu este comando." }
            : status === 502
              ? { estado: "erro", titulo: "O carregador respondeu com erro", explicacao: error.response?.data?.detail }
              : { estado: "erro", titulo: "Falhou", explicacao: error.compactpayMessage };
      resultado.tecnico = error.response?.data ?? null;
    }
    setResultados((atual) => ({
      ...atual,
      [chave]: { ...resultado, ms, quando: dayjs().format("HH:mm:ss") },
    }));
    setExecutando(null);
    carregarCarregadores();
  };

  const comandoOcpp = async (acao, payload) => {
    const { data } = await api.post(`${base}/ocpp`, { acao, payload }, silencioso);
    return { ...interpretarResposta(data.resposta), tecnico: data.resposta };
  };

  const conector = carregador?.connector_id || 1;
  const testes = [
    {
      chave: "config",
      Icone: Settings2,
      titulo: "Ler configuracao",
      descricao: "Pede ao carregador todas as configuracoes OCPP. Bom primeiro teste: prova que ele recebe e responde comandos.",
      precisaOnline: true,
      executar: async () => {
        const { data } = await api.post(`${base}/ocpp`, { acao: "GetConfiguration", payload: {} }, silencioso);
        const chaves = data.resposta?.configurationKey || [];
        return {
          estado: "ok",
          titulo: `O carregador respondeu com ${chaves.length} configuracoes`,
          conteudo: <TabelaConfiguracao chaves={chaves} desconhecidas={data.resposta?.unknownKey} />,
          tecnico: data.resposta,
        };
      },
    },
    {
      chave: "status",
      Icone: Radio,
      titulo: "Pedir status agora",
      descricao: "Pede para o carregador mandar o status do conector na hora. A resposta aparece no checklist e no log.",
      precisaOnline: true,
      executar: () => comandoOcpp("TriggerMessage", { requestedMessage: "StatusNotification", connectorId: conector }),
    },
    {
      chave: "liberar",
      Icone: Zap,
      titulo: "Liberar 2 min de recarga",
      descricao: "Igual a uma venda paga de 2 minutos. Sem carro: fica em \"Aguardando carro\" e falha em 3 min. Com o testador na posicao C: carrega e desliga sozinho.",
      precisaOnline: true,
      desabilitado: Boolean(sessao),
      executar: async () => {
        const { data } = await api.post(`${base}/sessao-teste`, { minutos: 2 }, silencioso);
        return {
          estado: "ok",
          titulo: `Recarga de teste #${data.id} criada`,
          explicacao: "O servidor mandou LIGAR. Acompanhe o andamento no quadro acima e no log.",
          tecnico: data,
        };
      },
    },
    {
      chave: "parar",
      Icone: Square,
      titulo: "Parar recarga",
      descricao: "Encerra a recarga em andamento agora, como se o tempo tivesse acabado.",
      desabilitado: !sessao,
      executar: async () => {
        const { data } = await api.post(`/admin/sessoes/${sessao.id}/encerrar`, null, silencioso);
        return { estado: "ok", titulo: "Pedido de parada enviado", explicacao: "O servidor mandou DESLIGAR. Confira no log a resposta do carregador.", tecnico: data };
      },
    },
    {
      chave: "destravar",
      Icone: LockOpen,
      titulo: "Destravar cabo",
      descricao: "Pede para o carregador soltar a trava do conector.",
      precisaOnline: true,
      executar: () => comandoOcpp("UnlockConnector", { connectorId: conector }),
    },
    {
      chave: "reiniciar",
      Icone: RefreshCw,
      titulo: "Reiniciar carregador",
      descricao: "Reinicio leve (Soft Reset). Ele desconecta e deve voltar sozinho em ~1 minuto.",
      precisaOnline: true,
      confirmar: { titulo: "Reiniciar o carregador?", texto: "Ele desconecta e volta sozinho. Uma recarga em andamento e' interrompida.", confirmarTexto: "Reiniciar", perigoso: true },
      executar: () => comandoOcpp("Reset", { type: "Soft" }),
    },
  ];

  const clicarTeste = async (teste) => {
    if (teste.confirmar && !(await confirmar(teste.confirmar))) return;
    rodar(teste.chave, teste.executar);
  };

  // ---- Log ----
  const eventosVisiveis = [...eventos]
    .reverse()
    .filter((e) => {
      if (ocultarHeartbeat && e.acao === "Heartbeat") return false;
      if (filtro === "conexao") return TIPOS_CONEXAO.includes(e.tipo);
      if (filtro === "mensagens") return !TIPOS_CONEXAO.includes(e.tipo);
      if (filtro === "problemas") return e.nivel === "erro" || e.nivel === "aviso";
      return true;
    });

  const endereco = carregador ? montarEndereco(servidor, carregador.id_hardware) : null;
  const statusSessao = sessao ? STATUS_SESSAO[sessao.status] : null;

  return (
    <div className="space-y-5 p-2 sm:p-4">
      <Cabecalho
        etiqueta="Testes"
        titulo="Diagnostico"
        descricao="Configure o carregador, rode os testes e veja cada mensagem trocada com o servidor, ao vivo."
        acoes={
          carregadores.length ? (
            <select className={`${campoClasse} min-w-[240px] py-2.5`} value={selecionado} onChange={(e) => escolher(e.target.value)}>
              {carregadores.map((c) => (
                <option key={c.id_hardware} value={c.id_hardware}>
                  {c.online ? "🟢" : "⚪"} {c.nome_local} ({c.id_hardware})
                </option>
              ))}
            </select>
          ) : null
        }
      />

      {/* Faixa de status do servidor */}
      <div
        className={`flex flex-wrap items-center gap-3 rounded-[22px] border px-4 py-3 text-sm ${
          servidorErro ? "border-rose-200 bg-rose-50 text-rose-900" : "border-[var(--color-border)] bg-white/80 text-[var(--color-text)]"
        }`}
      >
        <Server size={18} className={servidorErro ? "text-[var(--color-error)]" : "text-[var(--color-success)]"} />
        <span className="font-semibold">{servidorErro ? "Servidor fora do ar" : servidor ? "Servidor online" : "Conectando ao servidor..."}</span>
        <span className="text-[var(--color-text-soft)]">{servidorErro || (servidor ? `${API_BASE_URL} · versao ${servidor.versao}` : "")}</span>
        {servidor && !servidorErro ? (
          <span className="ml-auto text-[var(--color-text-soft)]">
            {servidor.conectados.length} carregador(es) conectado(s)
          </span>
        ) : null}
      </div>

      {naoCadastrados.map((item) => (
        <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <TriangleAlert size={18} className="shrink-0 text-[var(--color-warning)]" />
          <span className="min-w-0 flex-1">
            Um carregador tentou conectar com o ID <b className="font-mono">{item.id}</b>, que nao esta cadastrado ({formatarDataHora(item.momento)}
            {item.ip ? `, IP ${item.ip}` : ""}).
          </span>
          <button type="button" onClick={() => cadastrarId(item.id)} className="pill-button pill-button--primary px-4 py-2 text-sm font-semibold">
            Cadastrar com esse ID
          </button>
        </div>
      ))}

      {!carregador ? (
        <section className="app-panel p-8 text-center">
          <p className="text-[var(--color-text-soft)]">Nenhum carregador cadastrado ainda.</p>
          <Link to="/carregadores" className="pill-button pill-button--primary mt-4 inline-flex px-5 py-3 font-semibold">
            Cadastrar carregador
          </Link>
        </section>
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <Painel
              titulo="Checklist da conexao"
              subtitulo="Atualiza sozinho. Siga de cima para baixo: o primeiro item que nao estiver verde e' onde esta o problema."
              acoes={<Badge tom={passosOk === passos.length ? "ok" : "aviso"}>{passosOk}/{passos.length} ok</Badge>}
            >
              <ol>
                {passos.map((passo, i) => (
                  <Passo key={passo.titulo} numero={i + 1} {...passo} ultimo={i === passos.length - 1} />
                ))}
              </ol>
            </Painel>

            <Painel titulo="O que colocar no app do carregador" subtitulo="Tela OCPP do app (WeGoodCharger): Platform Type = OCPP Platform (1.6).">
              <div className="space-y-2">
                <CampoApp rotulo="Server Address" valor={endereco.endereco} destaque />
                <CampoApp rotulo="Server Port" valor={endereco.porta} destaque />
                <CampoApp rotulo="Platform Pile ID" valor={carregador.id_hardware} destaque />
              </div>
              <div className="mt-4 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-soft)]">Se o app pedir a URL inteira</div>
                <CampoApp rotulo="URL OCPP completa" valor={endereco.urlCompleta} />
              </div>
              <div className="mt-4 rounded-[18px] bg-[var(--color-bg-muted)] p-4 text-sm text-[var(--color-text)]">
                <div className="font-semibold">Nao conectou? Tente no Server Address, um por vez:</div>
                <ul className="mt-2 space-y-1">
                  {endereco.alternativas.map((alt) => (
                    <li key={alt} className="flex items-center justify-between gap-2">
                      <code className="break-all font-mono">{alt}</code>
                      <Copiar valor={alt} />
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[var(--color-text-soft)]">
                  Depois de cada troca: Confirm, reinicie o carregador e espere 1 minuto olhando o checklist.
                  {endereco.seguro
                    ? " Este servidor usa wss:// (conexao segura). Se o firmware nao suportar, nenhuma tentativa vai aparecer."
                    : " Na bancada o carregador precisa estar no mesmo Wi-Fi do PC, e a porta 8000 liberada no firewall."}
                </p>
                {endereco.outrosIps?.length ? (
                  <p className="mt-2 text-xs text-[var(--color-text-soft)]">Outros IPs deste PC: {endereco.outrosIps.join(", ")}</p>
                ) : null}
              </div>
            </Painel>
          </div>

          <Painel titulo="Testes rapidos" subtitulo="Cada botao manda um comando de verdade para o carregador e mostra o resultado em linguagem simples.">
            {sessao ? (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-[22px] border border-emerald-200 bg-[var(--color-primary-soft)] p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge tom={statusSessao?.tom}>{statusSessao?.texto || sessao.status}</Badge>
                    <span className="text-sm font-semibold text-[var(--color-text)]">Recarga #{sessao.id} em andamento</span>
                  </div>
                  <div className="mt-1 text-sm text-[var(--color-text-soft)]">
                    {sessao.status === "aguardando_carro" || sessao.status === "aguardando_inicio"
                      ? "Esperando o carregador comecar (precisa de carro ou testador na posicao C)."
                      : `${formatarKwh(sessao.energia_kwh)} entregues`}
                  </div>
                </div>
                {sessao.segundos_restantes != null ? (
                  <span className="text-3xl font-extrabold tabular-nums text-[var(--color-primary-strong)]">{formatarRelogio(sessao.segundos_restantes)}</span>
                ) : null}
              </div>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {testes.map((teste) => {
                const offline = teste.precisaOnline && !carregador.online;
                const bloqueado = offline || teste.desabilitado || executando !== null;
                return (
                  <div key={teste.chave} className="flex flex-col rounded-[22px] border border-[var(--color-border)] bg-white p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-bg-muted)] text-[var(--color-primary-strong)]">
                        <teste.Icone size={20} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-[var(--color-text)]">{teste.titulo}</div>
                        <div className="mt-0.5 text-sm text-[var(--color-text-soft)]">{teste.descricao}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => clicarTeste(teste)}
                      disabled={bloqueado}
                      className="pill-button pill-button--primary mt-3 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {executando === teste.chave ? (
                        <>
                          <LoaderCircle size={16} className="animate-spin" /> Aguardando o carregador...
                        </>
                      ) : offline ? (
                        "Carregador offline"
                      ) : (
                        "Rodar teste"
                      )}
                    </button>
                    <Resultado resultado={resultados[teste.chave]} />
                  </div>
                );
              })}
            </div>
          </Painel>

          <Painel
            titulo="Log ao vivo"
            subtitulo="Tudo que o carregador e o servidor trocaram, do mais novo para o mais antigo. Clique numa linha para ver a mensagem tecnica."
            acoes={
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPausado((v) => !v)}
                  className="pill-button inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
                >
                  {pausado ? <Play size={16} /> : <Pause size={16} />} {pausado ? "Continuar" : "Pausar"}
                </button>
                <button type="button" onClick={limparLog} className="pill-button inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold">
                  <Trash2 size={16} /> Limpar
                </button>
              </div>
            }
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {FILTROS.map((f) => (
                <button
                  key={f.chave}
                  type="button"
                  onClick={() => setFiltro(f.chave)}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                    filtro === f.chave ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-bg-muted)] text-[var(--color-text-soft)] hover:text-[var(--color-text)]"
                  }`}
                >
                  {f.rotulo}
                </button>
              ))}
              <label className="ml-auto flex items-center gap-2 text-sm text-[var(--color-text-soft)]">
                <input type="checkbox" checked={ocultarHeartbeat} onChange={(e) => setOcultarHeartbeat(e.target.checked)} />
                Ocultar sinais de vida
              </label>
            </div>
            <div className="mb-2 flex items-center gap-2 text-xs text-[var(--color-text-soft)]">
              <span className={`h-2 w-2 rounded-full ${pausado ? "bg-slate-300" : "animate-pulse bg-[var(--color-success)]"}`} />
              {pausado ? "Pausado" : "Atualizando a cada 2 segundos"} · {eventosVisiveis.length} evento(s)
            </div>
            {eventosVisiveis.length ? (
              <ul className="max-h-[560px] overflow-y-auto rounded-[18px] border border-[var(--color-border)] bg-white">
                {eventosVisiveis.map((evento) => (
                  <LinhaEvento key={evento.seq} evento={evento} />
                ))}
              </ul>
            ) : (
              <div className="rounded-[18px] border border-dashed border-[var(--color-border-strong)] p-8 text-center text-sm text-[var(--color-text-soft)]">
                Nada por aqui ainda. Quando o carregador tentar conectar, aparece na hora.
              </div>
            )}
          </Painel>
        </>
      )}
    </div>
  );
}
