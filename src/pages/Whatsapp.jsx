import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { CircleCheck, CircleX, LoaderCircle, MessageCircle, QrCode, RotateCcw, Send, TriangleAlert } from "lucide-react";

import api from "../api/axios";
import usePolling from "../hooks/usePolling";
import Badge from "../components/Badge";
import Button from "../components/Button";
import Cabecalho from "../components/Cabecalho";
import LoadingSpinner from "../components/LoadingSpinner";
import { campoClasse } from "../utils/estilos";
import { formatarDataHora } from "../utils/formatos";

const TIPOS = [
  ["offline", "Sem sinal"],
  ["lembrete", "Lembrete"],
  ["voltou", "Voltou"],
  ["resumo", "Resumo diario"],
];

const ESTADOS = {
  open: { texto: "Conectado", tom: "ok", Icone: CircleCheck },
  connecting: { texto: "Aguardando o QR code", tom: "aviso", Icone: LoaderCircle },
  close: { texto: "Desconectado", tom: "erro", Icone: CircleX },
  inexistente: { texto: "Instancia ainda nao criada", tom: "aviso", Icone: TriangleAlert },
  erro: { texto: "Erro na Evolution API", tom: "erro", Icone: CircleX },
};

function Painel({ titulo, subtitulo, acoes, children }) {
  return (
    <section className="app-panel p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-extrabold tracking-[-0.02em] text-[var(--color-text)]">{titulo}</h2>
          {subtitulo ? <p className="mt-0.5 text-xs text-[var(--color-text-soft)]">{subtitulo}</p> : null}
        </div>
        {acoes}
      </div>
      {children}
    </section>
  );
}

function Chave({ ligado, onClick, rotulo, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={rotulo}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40 ${ligado ? "bg-[var(--color-primary)]" : "bg-slate-300"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${ligado ? "left-[22px]" : "left-0.5"}`} />
      <span className="sr-only">{rotulo}</span>
    </button>
  );
}

export default function Whatsapp() {
  const [dados, setDados] = useState(null);
  const [conexaoForm, setConexaoForm] = useState(null);
  const [envioForm, setEnvioForm] = useState(null);
  const [mensagens, setMensagens] = useState(null);
  const [aba, setAba] = useState("offline");
  const [qr, setQr] = useState(null);
  const [ocupado, setOcupado] = useState("");
  const [aviso, setAviso] = useState("");

  const carregar = useCallback(async () => {
    try {
      setDados((await api.get("/admin/whatsapp", { silencioso: true })).data);
    } catch {
      setDados((atual) => atual);
    }
  }, []);

  // Enquanto o QR esta na tela, confere a conexao mais rapido.
  usePolling(carregar, qr ? 4000 : 20000, true, { imediato: true });

  if (!dados) return <LoadingSpinner className="min-h-[60vh]" />;

  const { config, conexao, clientes, envios } = dados;
  const estado = ESTADOS[conexao.estado] || (conexao.configurado ? { texto: conexao.estado || "?", tom: "neutro", Icone: TriangleAlert } : null);
  const conexaoAtual = conexaoForm ?? { evolution_url: config.evolution_url || "", api_key: "", instancia: config.instancia || "" };
  const envioAtual = envioForm ?? {
    minutos_offline: config.minutos_offline,
    lembrete_horas: config.lembrete_horas,
    resumo_horario: config.resumo_horario,
  };
  const mensagensAtuais = mensagens ?? config.mensagens;
  const qrAberto = qr && conexao.estado !== "open";

  const executar = async (chave, acao, sucesso) => {
    setOcupado(chave);
    setAviso("");
    try {
      const resposta = await acao();
      if (resposta?.data?.config) setDados(resposta.data);
      if (sucesso) setAviso(sucesso);
      return resposta;
    } catch {
      return null; // Toast global
    } finally {
      setOcupado("");
    }
  };

  const salvarConexao = async (event) => {
    event.preventDefault();
    const r = await executar("conexao", () => api.put("/admin/whatsapp/config", conexaoAtual), "Conexao salva.");
    if (r) setConexaoForm(null);
  };

  const conectar = async () => {
    const r = await executar("conectar", () => api.post("/admin/whatsapp/conectar"));
    if (r) {
      setQr(r.data);
      carregar();
    }
  };

  const salvarEnvio = async (event) => {
    event.preventDefault();
    const r = await executar(
      "envio",
      () =>
        api.put("/admin/whatsapp/config", {
          minutos_offline: Number(envioAtual.minutos_offline),
          lembrete_horas: Number(envioAtual.lembrete_horas),
          resumo_horario: envioAtual.resumo_horario,
        }),
      "Tempos salvos.",
    );
    if (r) setEnvioForm(null);
  };

  const ligarEnvio = () => executar("ativo", () => api.put("/admin/whatsapp/config", { ativo: !config.ativo }));

  const salvarCliente = (cliente, mudanca) =>
    executar(`cliente-${cliente.id}`, () =>
      api.put(`/admin/whatsapp/clientes/${cliente.id}`, {
        ativo: cliente.ativo,
        recebe_lembrete: cliente.recebe_lembrete,
        recebe_voltou: cliente.recebe_voltou,
        resumo_diario: cliente.resumo_diario,
        resumo_horario: cliente.resumo_horario || null,
        ...mudanca,
      }),
    );

  const salvarMensagens = async () => {
    const corpo = Object.fromEntries(TIPOS.map(([tipo]) => [`mensagem_${tipo}`, mensagensAtuais[tipo]]));
    const r = await executar("mensagens", () => api.put("/admin/whatsapp/config", corpo), "Mensagens salvas.");
    if (r) setMensagens(null);
  };

  const inserirVariavel = (variavel) => setMensagens({ ...mensagensAtuais, [aba]: `${mensagensAtuais[aba]}{${variavel}}` });

  return (
    <div className="space-y-4 p-2 sm:p-4">
      <Cabecalho
        etiqueta="Avisos"
        titulo="WhatsApp"
        descricao="Avisos automaticos para o dono do carregador: sem sinal, lembrete, voltou e resumo do dia (Evolution API, igual a CompactPay)."
      />

      {aviso ? <div className="rounded-[18px] bg-[var(--color-primary-soft)] px-4 py-2 text-sm font-semibold text-[var(--color-primary-strong)]">{aviso}</div> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Painel
          titulo="Conexao"
          subtitulo="Servidor da Evolution API e o numero que envia as mensagens."
          acoes={estado ? <Badge tom={estado.tom}>{estado.texto}</Badge> : <Badge tom="neutro">Nao configurado</Badge>}
        >
          <form onSubmit={salvarConexao} className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">URL da Evolution API</span>
              <input className={`${campoClasse} py-2`} placeholder="https://evolution.seudominio.com" value={conexaoAtual.evolution_url} onChange={(e) => setConexaoForm({ ...conexaoAtual, evolution_url: e.target.value })} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">API key</span>
                <input
                  className={`${campoClasse} py-2 font-mono`}
                  type="password"
                  autoComplete="off"
                  placeholder={config.api_key_mascarada || "apikey"}
                  value={conexaoAtual.api_key}
                  onChange={(e) => setConexaoForm({ ...conexaoAtual, api_key: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Instancia</span>
                <input className={`${campoClasse} py-2`} placeholder="compactrecarga" value={conexaoAtual.instancia} onChange={(e) => setConexaoForm({ ...conexaoAtual, instancia: e.target.value })} />
              </label>
            </div>
            {conexao.erro ? <p className="text-sm text-[var(--color-error)]">{conexao.erro}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" className="px-4 py-2 text-sm" disabled={conexaoForm === null || ocupado === "conexao"}>
                Salvar conexao
              </Button>
              <button
                type="button"
                onClick={conectar}
                disabled={!conexao.configurado || conexao.estado === "open" || ocupado === "conectar"}
                className="pill-button inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold disabled:opacity-45"
              >
                <QrCode size={16} /> {conexao.estado === "open" ? "Numero conectado" : "Conectar numero"}
              </button>
            </div>
          </form>
          {qrAberto ? (
            <div className="mt-4 flex flex-wrap items-center gap-4 rounded-[18px] bg-[var(--color-bg-muted)] p-4">
              {qr.qr_base64 ? <img src={qr.qr_base64} alt="QR code do WhatsApp" className="h-48 w-48 rounded-xl bg-white p-2" /> : null}
              <div className="text-sm text-[var(--color-text)]">
                <div className="font-bold">No celular do numero que vai enviar:</div>
                <div className="mt-1 text-[var(--color-text-soft)]">WhatsApp &gt; Aparelhos conectados &gt; Conectar aparelho, e leia o QR code.</div>
                {qr.pairing_code ? <div className="mt-2">Ou use o codigo: <b className="font-mono">{qr.pairing_code}</b></div> : null}
                <div className="mt-2 text-xs text-[var(--color-text-soft)]">A tela atualiza sozinha quando conectar.</div>
              </div>
            </div>
          ) : null}
        </Painel>

        <Painel
          titulo="Envio automatico"
          subtitulo={config.ultimo_ciclo_em ? `Ultima verificacao ${formatarDataHora(config.ultimo_ciclo_em)}: ${config.ultimo_ciclo_status}` : "Verifica a cada minuto."}
          acoes={
            <div className="flex items-center gap-2 text-sm font-semibold">
              {config.ativo ? "Ligado" : "Desligado"}
              <Chave ligado={config.ativo} onClick={ligarEnvio} rotulo="Ligar envio automatico" disabled={ocupado === "ativo"} />
            </div>
          }
        >
          <form onSubmit={salvarEnvio} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Avisar depois de (min) sem sinal</span>
                <input className={`${campoClasse} py-2`} type="number" min={5} max={1440} value={envioAtual.minutos_offline} onChange={(e) => setEnvioForm({ ...envioAtual, minutos_offline: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Lembrete a cada (h, 0 = nunca)</span>
                <input className={`${campoClasse} py-2`} type="number" min={0} max={168} value={envioAtual.lembrete_horas} onChange={(e) => setEnvioForm({ ...envioAtual, lembrete_horas: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Resumo diario as</span>
                <input className={`${campoClasse} py-2`} type="time" value={envioAtual.resumo_horario} onChange={(e) => setEnvioForm({ ...envioAtual, resumo_horario: e.target.value })} />
              </label>
            </div>
            <Button type="submit" className="px-4 py-2 text-sm" disabled={envioForm === null || ocupado === "envio"}>
              Salvar tempos
            </Button>
            <p className="text-xs text-[var(--color-text-soft)]">
              Carregador que ja estava offline quando o envio foi ligado nao gera aviso. Os do mesmo cliente que caem juntos vao numa mensagem so.
            </p>
          </form>
        </Painel>
      </div>

      <Painel titulo="Quem recebe" subtitulo="O numero e' o telefone do cadastro do cliente (pode ter mais de um, separados por virgula).">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-soft)]">
              <tr>
                <th className="px-2 py-2">Cliente</th>
                <th className="px-2 py-2 text-center">Sem sinal</th>
                <th className="px-2 py-2 text-center">Lembrete</th>
                <th className="px-2 py-2 text-center">Voltou</th>
                <th className="px-2 py-2 text-center">Resumo</th>
                <th className="px-2 py-2">Horario</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => {
                const semTelefone = c.telefones_validos.length === 0;
                const ocupadoAqui = ocupado === `cliente-${c.id}`;
                return (
                  <tr key={c.id} className="border-t border-[var(--color-border)]">
                    <td className="px-2 py-2.5">
                      <div className="font-bold text-[var(--color-text)]">{c.nome_empresa}</div>
                      {semTelefone ? (
                        <Link to="/clientes" className="text-xs font-semibold text-[var(--color-warning)]">
                          Sem telefone valido · cadastrar
                        </Link>
                      ) : (
                        <div className="text-xs text-[var(--color-text-soft)]">{c.telefones_validos.map((t) => `+${t}`).join(", ")}</div>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <div className="flex justify-center">
                        <Chave ligado={c.ativo} rotulo="Aviso de sem sinal" disabled={ocupadoAqui} onClick={() => salvarCliente(c, { ativo: !c.ativo })} />
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <div className="flex justify-center">
                        <Chave ligado={c.recebe_lembrete} rotulo="Lembrete" disabled={ocupadoAqui || !c.ativo} onClick={() => salvarCliente(c, { recebe_lembrete: !c.recebe_lembrete })} />
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <div className="flex justify-center">
                        <Chave ligado={c.recebe_voltou} rotulo="Voltou" disabled={ocupadoAqui || !c.ativo} onClick={() => salvarCliente(c, { recebe_voltou: !c.recebe_voltou })} />
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <div className="flex justify-center">
                        <Chave ligado={c.resumo_diario} rotulo="Resumo diario" disabled={ocupadoAqui} onClick={() => salvarCliente(c, { resumo_diario: !c.resumo_diario })} />
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <input
                        type="time"
                        className="rounded-full border border-[var(--color-border)] bg-white px-3 py-1 text-sm disabled:opacity-40"
                        disabled={!c.resumo_diario || ocupadoAqui}
                        defaultValue={c.resumo_horario || ""}
                        placeholder={config.resumo_horario}
                        onBlur={(e) => e.target.value !== (c.resumo_horario || "") && salvarCliente(c, { resumo_horario: e.target.value || null })}
                      />
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={semTelefone || conexao.estado !== "open" || ocupado === `teste-${c.id}`}
                          onClick={() => executar(`teste-${c.id}`, () => api.post(`/admin/whatsapp/clientes/${c.id}/teste`), `Teste enviado para ${c.nome_empresa}.`).then(carregar)}
                          className="pill-button inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                        >
                          <Send size={13} /> Teste
                        </button>
                        <button
                          type="button"
                          disabled={semTelefone || conexao.estado !== "open" || ocupado === `resumo-${c.id}`}
                          onClick={() => executar(`resumo-${c.id}`, () => api.post(`/admin/whatsapp/clientes/${c.id}/resumo`), `Resumo de hoje enviado para ${c.nome_empresa}.`).then(carregar)}
                          className="pill-button inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                        >
                          <MessageCircle size={13} /> Resumo agora
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {clientes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-8 text-center text-[var(--color-text-soft)]">
                    Nenhum cliente cadastrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Painel>

      <Painel
        titulo="Mensagens"
        subtitulo="Clique numa variavel para inserir. Ela e' trocada pelo valor real na hora de enviar."
        acoes={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMensagens({ ...mensagensAtuais, [aba]: config.padroes[aba] })}
              className="pill-button inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
            >
              <RotateCcw size={13} /> Texto padrao
            </button>
            <Button onClick={salvarMensagens} className="px-4 py-1.5 text-xs" disabled={mensagens === null || ocupado === "mensagens"}>
              Salvar mensagens
            </Button>
          </div>
        }
      >
        <div className="mb-3 flex flex-wrap gap-1">
          {TIPOS.map(([tipo, texto]) => (
            <button
              key={tipo}
              type="button"
              onClick={() => setAba(tipo)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${aba === tipo ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-bg-muted)] text-[var(--color-text-soft)]"}`}
            >
              {texto}
            </button>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <textarea
              className={`${campoClasse} min-h-[200px] font-mono text-sm`}
              value={mensagensAtuais[aba]}
              onChange={(e) => setMensagens({ ...mensagensAtuais, [aba]: e.target.value })}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {config.variaveis[aba].map((v) => (
                <button key={v} type="button" onClick={() => inserirVariavel(v)} className="rounded-full bg-[var(--color-bg-muted)] px-2.5 py-1 font-mono text-xs text-[var(--color-primary-strong)] hover:bg-[var(--color-primary-soft)]">
                  {`{${v}}`}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-[18px] bg-[#e7ddd3] p-4">
            <div className="ml-auto max-w-[320px] whitespace-pre-wrap rounded-[14px] rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-sm text-[#111b21] shadow-sm">
              {mensagensAtuais[aba].replace(/\*(.+?)\*/g, "$1")}
            </div>
            <div className="mt-2 text-right text-[11px] text-[#54656f]">Previa (as variaveis aparecem preenchidas no envio)</div>
          </div>
        </div>
      </Painel>

      <Painel titulo="Ultimos envios">
        <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full text-left text-sm">
            <tbody>
              {envios.map((e) => (
                <tr key={e.id} className="border-t border-[var(--color-border)] align-top first:border-0">
                  <td className="w-[110px] px-2 py-2 text-xs tabular-nums text-[var(--color-text-soft)]">{formatarDataHora(e.created_at)}</td>
                  <td className="px-2 py-2">
                    <Badge tom={e.status === "enviado" ? "ok" : "erro"}>{TIPOS.find(([t]) => t === e.tipo)?.[1] || e.tipo}</Badge>
                  </td>
                  <td className="px-2 py-2">
                    <div className="font-semibold text-[var(--color-text)]">{e.cliente || "-"}</div>
                    <div className="text-xs text-[var(--color-text-soft)]">+{e.telefone}</div>
                  </td>
                  <td className="px-2 py-2 text-xs text-[var(--color-text-soft)]">
                    {e.status === "erro" ? <span className="font-semibold text-[var(--color-error)]">{e.erro}</span> : <span className="line-clamp-2 whitespace-pre-wrap">{e.mensagem}</span>}
                  </td>
                </tr>
              ))}
              {envios.length === 0 ? (
                <tr>
                  <td className="px-2 py-6 text-center text-[var(--color-text-soft)]">Nenhuma mensagem enviada ainda.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Painel>
    </div>
  );
}
