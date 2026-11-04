import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CircleCheck, CreditCard, Pencil, Play, Plus, Stethoscope, Terminal, Trash2 } from "lucide-react";
import Swal from "sweetalert2";

import api from "../api/axios";
import usePolling from "../hooks/usePolling";
import Badge from "../components/Badge";
import Button from "../components/Button";
import Cabecalho from "../components/Cabecalho";
import LoadingSpinner from "../components/LoadingSpinner";
import Modal from "../components/Modal";
import TabelaSessoes from "../components/TabelaSessoes";
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
};

const CATEGORIAS = {
  PAGAMENTO: "ok",
  SESSAO: "aviso",
  DISPOSITIVO: "neutro",
  TESTE: "neutro",
};

function Painel({ titulo, acoes, children }) {
  return (
    <section className="app-panel p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-[var(--color-text)]">{titulo}</h2>
        {acoes}
      </div>
      {children}
    </section>
  );
}

// Mesma conta do backend (mercado_pago_caixa.minutos_por_valor).
function minutosPorValor(precoValor, precoMinutos, valor) {
  if (!precoValor || !precoMinutos || valor <= 0) return 0;
  return Math.floor((valor * precoMinutos) / precoValor + 1e-9);
}

function Info({ rotulo, children }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-soft)]">{rotulo}</div>
      <div className="mt-1 font-semibold text-[var(--color-text)]">{children}</div>
    </div>
  );
}

export default function CarregadorDetalhe() {
  const { carregadorId } = useParams();
  const base = `/admin/carregadores/${encodeURIComponent(carregadorId)}`;
  const [carregador, setCarregador] = useState(null);
  const [pacotes, setPacotes] = useState([]);
  const [sessoes, setSessoes] = useState([]);
  const [historico, setHistorico] = useState([]);

  const [novoPacote, setNovoPacote] = useState({ minutos: "", valor: "" });
  const [edicao, setEdicao] = useState(null);
  const [ocppAberto, setOcppAberto] = useState(false);
  const [ocpp, setOcpp] = useState({ acao: "GetConfiguration", payload: "{}" });
  const [ocppResposta, setOcppResposta] = useState("");
  const [ocppEnviando, setOcppEnviando] = useState(false);
  const [preco, setPreco] = useState(null);
  const [criandoCaixa, setCriandoCaixa] = useState(false);
  const [valorSimulado, setValorSimulado] = useState("10");
  const [simulacao, setSimulacao] = useState(null);
  const [clientes, setClientes] = useState([]);

  const carregar = useCallback(async () => {
    try {
      const [c, p, s, h] = await Promise.all([
        api.get(base),
        api.get(`${base}/pacotes`),
        api.get("/admin/sessoes", { params: { carregador_id: carregadorId, limite: 30 } }),
        api.get(`${base}/historico`, { params: { limite: 60 } }),
      ]);
      setCarregador(c.data);
      setPacotes(p.data);
      setSessoes(s.data);
      setHistorico(h.data);
    } catch {
      // Toast global
    }
  }, [base, carregadorId]);

  usePolling(carregar, 4000, true, { imediato: true });

  if (!carregador) return <LoadingSpinner className="min-h-[60vh]" />;

  const sessao = carregador.sessao_ativa;
  const statusSessao = sessao ? STATUS_SESSAO[sessao.status] : null;

  const adicionarPacote = async (event) => {
    event.preventDefault();
    const minutos = Number(novoPacote.minutos);
    try {
      await api.post(`${base}/pacotes`, {
        nome: formatarMinutos(minutos),
        minutos,
        valor: Number(String(novoPacote.valor).replace(",", ".")),
        ordem: pacotes.length,
      });
      setNovoPacote({ minutos: "", valor: "" });
      carregar();
    } catch {
      // Toast global
    }
  };

  const removerPacote = async (pacote) => {
    const ok = await confirmar({ titulo: `Remover o pacote de ${formatarMinutos(pacote.minutos)}?`, perigoso: true, confirmarTexto: "Remover" });
    if (!ok) return;
    try {
      await api.delete(`/admin/pacotes/${pacote.id}`);
      carregar();
    } catch {
      // Toast global
    }
  };

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

  const salvarEdicao = async (event) => {
    event.preventDefault();
    try {
      await api.patch(base, {
        nome_local: edicao.nome_local,
        mp_terminal_id: edicao.mp_terminal_id || null,
        connector_id: Number(edicao.connector_id) || 1,
        ativo: edicao.ativo,
        cliente_id: edicao.cliente_id ? Number(edicao.cliente_id) : null,
      });
      setEdicao(null);
      carregar();
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

  // Regra de preco: o formulario comeca com o que esta salvo.
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

  return (
    <div className="space-y-5 p-2 sm:p-4">
      <Link to="/carregadores" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-text-soft)] hover:text-[var(--color-text)]">
        <ArrowLeft size={16} /> Carregadores
      </Link>
      <Cabecalho
        etiqueta={carregador.id_hardware}
        titulo={carregador.nome_local}
        acoes={
          <>
            <Link
              to={`/diagnostico?carregador=${encodeURIComponent(carregador.id_hardware)}`}
              className="pill-button inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold"
            >
              <Stethoscope size={16} /> Diagnostico
            </Link>
            <button
              type="button"
              className="pill-button inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold"
              onClick={async () => {
                setEdicao({ ...carregador, mp_terminal_id: carregador.mp_terminal_id || "", cliente_id: carregador.cliente_id ?? "" });
                try {
                  setClientes((await api.get("/admin/clientes")).data);
                } catch {
                  // Toast global
                }
              }}
            >
              <Pencil size={16} /> Editar
            </button>
            <button
              type="button"
              className="pill-button inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold"
              onClick={() => setOcppAberto(true)}
              disabled={!carregador.online}
            >
              <Terminal size={16} /> Comando OCPP
            </button>
            <Button onClick={liberarTeste} disabled={!carregador.online || Boolean(sessao)}>
              <Play size={16} /> Liberar teste
            </Button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <Painel titulo="Status">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <Info rotulo="Conexao">
              <Badge tom={carregador.online ? "ok" : "erro"}>{carregador.online ? "Online" : "Offline"}</Badge>
            </Info>
            <Info rotulo="Conector">
              <Badge tom={carregador.erro_conector ? "erro" : "neutro"}>{carregador.status_conector || "-"}</Badge>
              {carregador.erro_conector ? <div className="text-xs text-[var(--color-error)]">{carregador.erro_conector}</div> : null}
            </Info>
            <Info rotulo="Ultimo sinal">{formatarDataHora(carregador.ultimo_sinal)}</Info>
            <Info rotulo="Modelo">{[carregador.vendor, carregador.modelo].filter(Boolean).join(" ") || "-"}</Info>
            <Info rotulo="Firmware">{carregador.firmware_version || "-"}</Info>
            <Info rotulo="Point (MP)">{carregador.mp_terminal_id || "Nao vinculada"}</Info>
          </div>

          {sessao ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-[22px] bg-[var(--color-bg-muted)] p-4">
              <div>
                <Badge tom={statusSessao?.tom}>{statusSessao?.texto || sessao.status}</Badge>
                <div className="mt-2 text-sm text-[var(--color-text-soft)]">
                  Recarga #{sessao.id} · {sessao.minutos_pagos ? `${sessao.minutos_pagos} min pagos` : "livre (RFID)"} ·{" "}
                  {formatarKwh(sessao.energia_kwh)}
                </div>
              </div>
              <div className="flex items-center gap-4">
                {sessao.segundos_restantes != null ? (
                  <span className="text-3xl font-extrabold tabular-nums text-[var(--color-primary-strong)]">
                    {formatarRelogio(sessao.segundos_restantes)}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => encerrar(sessao)}
                  className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-[var(--color-error)] hover:bg-rose-100"
                >
                  Encerrar agora
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-[22px] bg-[var(--color-bg-muted)] p-4 text-sm text-[var(--color-text-soft)]">
              Nenhuma recarga em andamento.
            </div>
          )}
        </Painel>

        <Painel titulo="Pacotes de tempo">
          <ul className="space-y-2">
            {pacotes.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-3">
                <span className="font-bold text-[var(--color-text)]">{formatarMinutos(p.minutos)}</span>
                <span className="flex items-center gap-3">
                  <span className="font-semibold text-[var(--color-primary-strong)]">{formatarValor(p.valor)}</span>
                  <button type="button" onClick={() => removerPacote(p)} className="text-[var(--color-text-soft)] hover:text-[var(--color-error)]" aria-label="Remover pacote">
                    <Trash2 size={16} />
                  </button>
                </span>
              </li>
            ))}
            {pacotes.length === 0 ? <li className="text-sm text-[var(--color-text-soft)]">Sem pacotes: o totem nao consegue vender.</li> : null}
          </ul>
          <form onSubmit={adicionarPacote} className="mt-4 flex flex-wrap items-end gap-2">
            <label className="min-w-[110px] flex-1">
              <span className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Minutos</span>
              <input className={campoClasse} type="number" min={1} max={1440} value={novoPacote.minutos} onChange={(e) => setNovoPacote({ ...novoPacote, minutos: e.target.value })} required />
            </label>
            <label className="min-w-[110px] flex-1">
              <span className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Valor (R$)</span>
              <input className={campoClasse} inputMode="decimal" value={novoPacote.valor} onChange={(e) => setNovoPacote({ ...novoPacote, valor: e.target.value })} placeholder="10,00" required />
            </label>
            <Button type="submit">
              <Plus size={16} /> Adicionar
            </Button>
          </form>
        </Painel>
      </div>

      <Painel
        titulo="Maquininha (caixa Mercado Pago)"
        acoes={carregador.mp_pos_id ? <Badge tom="ok">Caixa criado</Badge> : <Badge tom="aviso">Sem caixa</Badge>}
      >
        <p className="mb-4 text-sm text-[var(--color-text-soft)]">
          Igual a CompactPay: qualquer pagamento aprovado numa maquininha vinculada ao caixa deste carregador libera o tempo pela regra de
          preco. Se o carro ja estiver carregando, o tempo e&apos; somado.
        </p>
        <div className="grid gap-5 xl:grid-cols-3">
          <form onSubmit={salvarPreco} className="rounded-[22px] border border-[var(--color-border)] bg-white p-4">
            <div className="font-bold text-[var(--color-text)]">1. Regra de preco</div>
            <div className="mt-3 flex items-end gap-2">
              <label className="flex-1">
                <span className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Valor (R$)</span>
                <input className={campoClasse} inputMode="decimal" placeholder="10" value={precoForm.valor} onChange={(e) => setPreco({ ...precoForm, valor: e.target.value })} required />
              </label>
              <span className="pb-3 font-bold text-[var(--color-text-soft)]">=</span>
              <label className="flex-1">
                <span className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Minutos</span>
                <input className={campoClasse} type="number" min={1} max={1440} placeholder="20" value={precoForm.minutos} onChange={(e) => setPreco({ ...precoForm, minutos: e.target.value })} required />
              </label>
            </div>
            {precoValorNum > 0 && precoMinutosNum > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {[5, 10, 20, 50].map((v) => (
                  <span key={v} className="rounded-full bg-[var(--color-bg-muted)] px-3 py-1 text-xs font-semibold text-[var(--color-text)]">
                    {formatarValor(v)} → {formatarMinutos(minutosPorValor(precoValorNum, precoMinutosNum, v))}
                  </span>
                ))}
              </div>
            ) : null}
            <Button type="submit" className="mt-3 w-full justify-center" disabled={preco === null}>
              Salvar regra
            </Button>
          </form>

          <div className="rounded-[22px] border border-[var(--color-border)] bg-white p-4">
            <div className="font-bold text-[var(--color-text)]">2. Loja e caixa no Mercado Pago</div>
            {carregador.mp_pos_id ? (
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center gap-2 font-semibold text-[var(--color-success)]">
                  <CircleCheck size={18} /> Loja e caixa criados
                </div>
                <Info rotulo="Loja">{carregador.mp_store_id} · {carregador.mp_store_external_id}</Info>
                <Info rotulo="Caixa">{carregador.mp_pos_id} · {carregador.mp_pos_external_id}</Info>
                <p className="rounded-[14px] bg-[var(--color-bg-muted)] p-3 text-[var(--color-text-soft)]">
                  Agora vincule a maquininha a este caixa: na maquininha (ou no app Mercado Pago), escolha a loja e o caixa
                  <b> {carregador.nome_local}</b>.
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-3 text-sm text-[var(--color-text-soft)]">
                <p>Cria a loja e o caixa deste carregador na conta do Mercado Pago (igual ao cadastro de maquina da CompactPay).</p>
                {!carregador.tem_token_mp ? (
                  <p className="rounded-[14px] bg-amber-50 p-3 text-amber-900">
                    Falta a conta do Mercado Pago: cadastre o dono em Clientes, com o Access Token, e escolha o cliente em Editar.
                  </p>
                ) : null}
                <Button onClick={criarCaixa} className="w-full justify-center" disabled={!carregador.tem_token_mp || criandoCaixa}>
                  <CreditCard size={16} /> {criandoCaixa ? "Criando..." : "Criar loja e caixa"}
                </Button>
              </div>
            )}
          </div>

          <form onSubmit={simularPagamento} className="rounded-[22px] border border-[var(--color-border)] bg-white p-4">
            <div className="font-bold text-[var(--color-text)]">3. Testar sem pagar</div>
            <p className="mt-1 text-sm text-[var(--color-text-soft)]">
              Faz de conta que a maquininha aprovou este valor. Passa pela mesma regra e libera o carregador.
            </p>
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Valor pago (R$)</span>
              <input className={campoClasse} inputMode="decimal" value={valorSimulado} onChange={(e) => setValorSimulado(e.target.value)} required />
            </label>
            <Button type="submit" className="mt-3 w-full justify-center" disabled={!carregador.preco_valor || !carregador.online}>
              Simular pagamento
            </Button>
            {!carregador.preco_valor ? <p className="mt-2 text-xs text-[var(--color-text-soft)]">Salve a regra de preco primeiro.</p> : null}
            {simulacao ? (
              <div
                className={`mt-3 rounded-[14px] p-3 text-sm ${
                  simulacao.estornada ? "bg-amber-50 text-amber-900" : "bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]"
                }`}
              >
                {simulacao.estornada
                  ? `Nao liberado (${formatarValor(simulacao.valor)}): carregador ocupado comecando outra recarga. Seria estornado.`
                  : `${formatarValor(simulacao.valor)} liberou ${formatarMinutos(simulacao.minutos)}. Acompanhe no Status acima.`}
              </div>
            ) : null}
          </form>
        </div>
      </Painel>

      <Painel titulo="Recargas deste carregador">
        <TabelaSessoes sessoes={sessoes} mostrarCarregador={false} onEncerrar={encerrar} />
      </Painel>

      <Painel titulo="Historico">
        <ul className="max-h-[420px] space-y-1 overflow-y-auto text-sm">
          {historico.map((h, i) => (
            <li key={`${h.created_at}-${i}`} className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] py-2">
              <span className="w-[120px] shrink-0 tabular-nums text-[var(--color-text-soft)]">{formatarDataHora(h.created_at)}</span>
              <Badge tom={CATEGORIAS[h.categoria]}>{h.categoria}</Badge>
              <span className={`min-w-0 flex-1 ${/ALERTA|FALHOU|ATENCAO/.test(h.descricao) ? "font-semibold text-[var(--color-error)]" : ""}`}>
                {h.descricao}
              </span>
              {h.valor ? <span className="font-semibold">{formatarValor(h.valor)}</span> : null}
            </li>
          ))}
        </ul>
      </Painel>

      <Modal open={Boolean(edicao)} onClose={() => setEdicao(null)}>
        {edicao ? (
          <form onSubmit={salvarEdicao} className="space-y-4">
            <h2 className="text-3xl font-extrabold tracking-[-0.04em] text-[var(--color-text)]">Editar carregador</h2>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Nome do local</span>
              <input className={campoClasse} value={edicao.nome_local} onChange={(e) => setEdicao({ ...edicao, nome_local: e.target.value })} required />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Conector</span>
                <input className={campoClasse} type="number" min={1} value={edicao.connector_id} onChange={(e) => setEdicao({ ...edicao, connector_id: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Point (terminal_id do MP)</span>
                <input className={campoClasse} value={edicao.mp_terminal_id} onChange={(e) => setEdicao({ ...edicao, mp_terminal_id: e.target.value })} />
              </label>
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Cliente (dono)</span>
              <select className={campoClasse} value={edicao.cliente_id ?? ""} onChange={(e) => setEdicao({ ...edicao, cliente_id: e.target.value })}>
                <option value="">Sem cliente</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome_empresa}
                    {c.tem_token_mp ? "" : " (sem token MP)"}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-[var(--color-text-soft)]">
                Trocar de cliente apaga a loja e o caixa: a conta do Mercado Pago muda e e&apos; preciso criar de novo.
              </span>
            </label>
            <label className="flex items-center gap-3 text-sm font-semibold">
              <input type="checkbox" checked={edicao.ativo} onChange={(e) => setEdicao({ ...edicao, ativo: e.target.checked })} />
              Ativo (desmarcado: recusa a conexao e o totem nao vende)
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
                <option key={acao} value={acao}>{acao}</option>
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
          {ocppResposta ? (
            <pre className="max-h-[300px] overflow-auto rounded-[18px] bg-[#0f1f15] p-4 text-xs text-emerald-100">{ocppResposta}</pre>
          ) : null}
        </form>
      </Modal>
    </div>
  );
}
