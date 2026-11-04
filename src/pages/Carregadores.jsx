import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BatteryCharging, Map, MapPin, PlugZap, Plus, Search, Stethoscope, Wallet } from "lucide-react";
import Swal from "sweetalert2";

import api from "../api/axios";
import { useAuth } from "../context/useAuth";
import usePolling from "../hooks/usePolling";
import Button from "../components/Button";
import Cabecalho from "../components/Cabecalho";
import LoadingSpinner from "../components/LoadingSpinner";
import Modal from "../components/Modal";
import { BarraConexao, CabecalhoOrdenavel, CartaoResumo, InfoPill, StatusCarregador } from "../components/CarregadorUi";
import { STATUS_CARREGADOR, combinaBusca, ordenar, proximaOrdem, statusCarregador, textoConector } from "../utils/carregadores";
import { campoClasse } from "../utils/estilos";
import { formatarDataHora, formatarKwh, formatarRelogio, formatarValor } from "../utils/formatos";

const formVazio = {
  cliente_id: "",
  banco_pagamento: "",
  id_hardware: "",
  nome_local: "",
  connector_id: 1,
  sumup_reader_id: "",
  sumup_device_code: "",
  sumup_usuario: "",
  cep: "",
  numero_endereco: "",
  gerar_senha_ocpp: false,
};

const NOME_BANCO = { mercado_pago: "Mercado Pago", sumup: "SumUp" };

const CHIPS = [
  { chave: "todos", texto: "Todos" },
  { chave: "online", texto: "Livres" },
  { chave: "carregando", texto: "Carregando" },
  { chave: "defeito", texto: "Com defeito" },
  { chave: "offline", texto: "Offline" },
];

const COR_CHIP = {
  online: "text-[var(--color-success)]",
  carregando: "text-blue-700",
  defeito: "text-[var(--color-warning)]",
  offline: "text-[var(--color-error)]",
};

function Atividade({ c }) {
  const sessao = c.sessao_ativa;
  if (sessao) {
    return (
      <>
        <div className="font-bold tabular-nums text-blue-700">
          {sessao.segundos_restantes != null ? formatarRelogio(sessao.segundos_restantes) : "Aguardando carro"}
        </div>
        <div className="truncate text-[11px] text-[var(--color-text-soft)]">Recarga #{sessao.id} · {formatarKwh(sessao.energia_kwh)}</div>
      </>
    );
  }
  return (
    <>
      <div className="truncate font-semibold text-[var(--color-text)]">{textoConector(c)}</div>
      <div className="truncate text-[11px] text-[var(--color-text-soft)]">Sinal {formatarDataHora(c.ultimo_sinal)}</div>
    </>
  );
}

export default function Carregadores() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [lista, setLista] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [busca, setBusca] = useState("");
  const [clienteFiltro, setClienteFiltro] = useState("");
  const [chip, setChip] = useState("todos");
  const [ordem, setOrdem] = useState({ coluna: "status", direcao: "asc" });
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(formVazio);
  const [salvando, setSalvando] = useState(false);
  const [readers, setReaders] = useState({ carregando: false, lista: [], erro: "" });
  const [pareamento, setPareamento] = useState({ codigo: "", nome: "", enviando: false });
  const [cepAchado, setCepAchado] = useState(null);

  const carregar = useCallback(async () => {
    try {
      const [{ data }, c] = await Promise.all([api.get("/admin/carregadores"), api.get("/admin/clientes")]);
      setLista(data);
      setClientes(c.data);
    } catch {
      setLista((atual) => atual || []);
    }
  }, []);

  usePolling(carregar, 5000, true, { imediato: true });

  if (lista === null) return <LoadingSpinner className="min-h-[60vh]" />;

  const abrir = (c) => navigate(`/carregadores/${encodeURIComponent(c.id_hardware)}`);
  const ordenarPor = (coluna) => setOrdem(proximaOrdem(ordem, coluna));

  const doCliente = lista.filter((c) => (clienteFiltro ? String(c.cliente_id) === clienteFiltro : true) && combinaBusca(c, busca));
  const contagem = doCliente.reduce((acc, c) => ({ ...acc, [statusCarregador(c)]: (acc[statusCarregador(c)] || 0) + 1 }), {});
  const visiveis = ordenar(
    doCliente.filter((c) => chip === "todos" || statusCarregador(c) === chip),
    ordem,
  );
  const online = lista.filter((c) => c.online).length;
  const carregando = lista.filter((c) => c.sessao_ativa).length;
  const faturamento = lista.reduce((t, c) => t + (c.faturamento_hoje || 0), 0);
  const vendas = lista.reduce((t, c) => t + (c.vendas_hoje || 0), 0);

  const clienteEscolhido = clientes.find((c) => String(c.id) === String(form.cliente_id));
  const bancosDoCliente = clienteEscolhido?.bancos || [];

  const carregarReaders = async (clienteId) => {
    setReaders({ carregando: true, lista: [], erro: "" });
    try {
      const { data } = await api.get(`/admin/clientes/${clienteId}/sumup/readers`, { silencioso: true });
      setReaders({ carregando: false, lista: data, erro: "" });
    } catch (error) {
      setReaders({ carregando: false, lista: [], erro: error.compactpayMessage || "Nao foi possivel listar as maquininhas" });
    }
  };

  const escolherCliente = (clienteId) => {
    const cliente = clientes.find((c) => String(c.id) === clienteId);
    const banco = cliente?.bancos?.[0] || "";
    setForm({ ...form, cliente_id: clienteId, banco_pagamento: banco, sumup_reader_id: "" });
    if (banco === "sumup" && cliente?.tem_sumup) carregarReaders(clienteId);
  };

  const escolherBanco = (banco) => {
    setForm({ ...form, banco_pagamento: banco });
    if (banco === "sumup" && clienteEscolhido?.tem_sumup) carregarReaders(form.cliente_id);
  };

  const parear = async () => {
    setPareamento({ ...pareamento, enviando: true });
    try {
      const { data } = await api.post(`/admin/clientes/${form.cliente_id}/sumup/readers`, {
        pairing_code: pareamento.codigo.trim(),
        nome: pareamento.nome.trim() || form.nome_local || null,
      });
      setPareamento({ codigo: "", nome: "", enviando: false });
      await carregarReaders(form.cliente_id);
      setForm((atual) => ({ ...atual, sumup_reader_id: data.id }));
    } catch {
      setPareamento((atual) => ({ ...atual, enviando: false }));
    }
  };

  // Mostra o endereco do CEP antes de salvar (o backend busca de novo ao cadastrar).
  const conferirCep = async () => {
    const digitos = form.cep.replace(/\D/g, "");
    if (digitos.length !== 8) {
      setCepAchado(digitos ? { erro: "CEP precisa ter 8 numeros" } : null);
      return;
    }
    setCepAchado({ buscando: true });
    try {
      const { data } = await api.get(`/admin/cep/${digitos}`, { params: { numero: form.numero_endereco || undefined }, silencioso: true });
      setCepAchado(data);
    } catch (error) {
      setCepAchado({ erro: error.compactpayMessage || "CEP nao encontrado" });
    }
  };

  const abrirCadastro = () => {
    setCepAchado(null);
    const unico = clientes.length === 1 ? String(clientes[0].id) : "";
    setForm({ ...formVazio, cliente_id: unico, banco_pagamento: unico ? clientes[0].bancos?.[0] || "" : "" });
    setReaders({ carregando: false, lista: [], erro: "" });
    if (unico && clientes[0].bancos?.[0] === "sumup" && clientes[0].tem_sumup) carregarReaders(unico);
    setModal(true);
  };

  const salvar = async (event) => {
    event.preventDefault();
    setSalvando(true);
    try {
      const { data } = await api.post("/admin/carregadores", {
        ...form,
        connector_id: Number(form.connector_id) || 1,
        cliente_id: Number(form.cliente_id),
        sumup_reader_id: form.banco_pagamento === "sumup" ? form.sumup_reader_id || null : null,
        sumup_device_code: form.banco_pagamento === "sumup" ? form.sumup_device_code || null : null,
        sumup_usuario: form.banco_pagamento === "sumup" ? form.sumup_usuario || null : null,
      });
      setModal(false);
      setForm(formVazio);
      carregar();
      await Swal.fire({
        icon: "success",
        title: "Carregador cadastrado",
        html: `
          <p>No app do fabricante, configure o OCPP 1.6J com o Charge Point ID <b>${data.id_hardware}</b>.</p>
          <p style="margin-top:8px">O endereco exato e os testes de conexao estao na tela <b>Diagnostico</b>.</p>
          ${data.banco_pagamento === "mercado_pago" && data.mp_pos_id ? `<p style="margin-top:8px">Loja e caixa criados no Mercado Pago. Vincule a maquininha ao caixa <b>${data.nome_local}</b>.</p>` : ""}
          ${data.aviso_caixa ? `<p style="margin-top:8px;color:#b7791f"><b>Caixa nao criado:</b> ${data.aviso_caixa}<br/><small>Tente de novo na pagina do carregador.</small></p>` : ""}
          ${data.senha_ocpp ? `<p><b>Senha OCPP:</b> <code>${data.senha_ocpp}</code><br/><small>Anote agora: ela nao aparece de novo.</small></p>` : ""}
        `,
        confirmButtonColor: "#1f7a4c",
      });
    } catch {
      // Toast global
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-4 p-2 sm:p-4">
      <Cabecalho
        etiqueta="Operacao"
        titulo="Carregadores"
        descricao="Status ao vivo, conexao e vendas de hoje. Clique numa linha para ver tudo do carregador."
        acoes={
          <>
            <Link to="/mapa" className="pill-button inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold">
              <Map size={16} /> Mapa
            </Link>
            {isAdmin ? (
              <Button onClick={abrirCadastro}>
                <Plus size={18} /> Novo carregador
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CartaoResumo rotulo="Cadastrados" valor={lista.length} ajuda={`${lista.length - online} offline`} Icone={PlugZap} />
        <CartaoResumo rotulo="Online agora" valor={online} ajuda="Conectados ao servidor" Icone={PlugZap} destaque />
        <CartaoResumo rotulo="Carregando" valor={carregando} ajuda="Recargas em andamento" Icone={BatteryCharging} />
        <CartaoResumo rotulo="Hoje" valor={formatarValor(faturamento)} ajuda={`${vendas} venda(s)`} Icone={Wallet} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-soft)]" />
          <input
            className="w-full rounded-full border border-[var(--color-border)] bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[var(--color-primary)]"
            placeholder="Buscar por nome, ID, cliente, endereco, IP..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </label>
        <select
          className="rounded-full border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm outline-none"
          value={clienteFiltro}
          onChange={(e) => setClienteFiltro(e.target.value)}
        >
          <option value="">Todos os clientes</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome_empresa}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {CHIPS.filter((c) => c.chave === "todos" || contagem[c.chave]).map((c) => {
          const ativo = chip === c.chave;
          const total = c.chave === "todos" ? doCliente.length : contagem[c.chave];
          return (
            <button
              key={c.chave}
              type="button"
              onClick={() => setChip(ativo ? "todos" : c.chave)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                ativo ? "bg-[var(--color-primary)] text-white" : `bg-white ${COR_CHIP[c.chave] || "text-[var(--color-text-soft)]"} hover:bg-[var(--color-bg-muted)]`
              }`}
            >
              {c.texto} <span className={ativo ? "text-white/80" : "opacity-60"}>{total}</span>
            </button>
          );
        })}
        {visiveis.length !== lista.length ? (
          <span className="text-xs text-[var(--color-text-soft)]">
            {visiveis.length} de {lista.length}
          </span>
        ) : null}
      </div>

      {/* Desktop: tabela compacta */}
      <div className="app-panel hidden overflow-hidden p-0 md:block">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="bg-[var(--color-bg-muted)] text-[11px] tracking-[0.14em] text-[var(--color-text-soft)]">
            <tr>
              <CabecalhoOrdenavel coluna="carregador" ordem={ordem} onOrdenar={ordenarPor} className="w-[22%]">
                Carregador
              </CabecalhoOrdenavel>
              <CabecalhoOrdenavel coluna="status" ordem={ordem} onOrdenar={ordenarPor} className="w-[13%]">
                Status
              </CabecalhoOrdenavel>
              <CabecalhoOrdenavel coluna="conexao" ordem={ordem} onOrdenar={ordenarPor} className="w-[14%]">
                Conexao
              </CabecalhoOrdenavel>
              <th className="w-[17%] px-3 py-2.5 uppercase">Agora</th>
              <CabecalhoOrdenavel coluna="cliente" ordem={ordem} onOrdenar={ordenarPor} className="w-[16%]">
                Cliente / Local
              </CabecalhoOrdenavel>
              <CabecalhoOrdenavel coluna="hoje" ordem={ordem} onOrdenar={ordenarPor} className="w-[11%]">
                Hoje
              </CabecalhoOrdenavel>
              <th className="w-[7%] px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {visiveis.map((c) => (
              <tr key={c.id_hardware} onClick={() => abrir(c)} className="cursor-pointer border-t border-[var(--color-border)] align-top hover:bg-[var(--color-primary-soft)]/50">
                <td className="px-3 py-3">
                  <div className="truncate font-bold text-[var(--color-primary-strong)]">{c.nome_local}</div>
                  <div className="truncate font-mono text-[11px] text-[var(--color-text-soft)]">{c.id_hardware}</div>
                  <div className="truncate text-[11px] text-[var(--color-text-soft)]">
                    {[c.vendor, c.modelo, c.firmware_version && `fw ${c.firmware_version}`].filter(Boolean).join(" · ") || "Aguardando apresentacao"}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <StatusCarregador status={statusCarregador(c)} />
                  {c.erro_conector ? <div className="mt-1 truncate text-[11px] text-[var(--color-error)]">{c.erro_conector}</div> : null}
                </td>
                <td className="px-3 py-3">
                  <BarraConexao carregador={c} compacto />
                  <div className="mt-1 truncate text-[11px] text-[var(--color-text-soft)]">
                    {c.online ? `${c.quedas_hoje || 0} queda(s) hoje` : `Visto ${formatarDataHora(c.ultimo_sinal)}`}
                  </div>
                  {c.ip ? <div className="truncate font-mono text-[11px] text-[var(--color-text-soft)]">{c.ip}</div> : null}
                </td>
                <td className="px-3 py-3">
                  <Atividade c={c} />
                </td>
                <td className="px-3 py-3">
                  <div className="truncate font-semibold text-[var(--color-text)]">{c.cliente_nome || "Sem cliente"}</div>
                  <div className="truncate text-[11px] text-[var(--color-text-soft)]">{c.endereco || "Sem endereco"}</div>
                  <div className="truncate text-[11px] text-[var(--color-text-soft)]">
                    {NOME_BANCO[c.banco_pagamento] || "Mercado Pago"}
                    {c.banco_pagamento === "sumup" ? (c.sumup_reader_id || c.sumup_device_code ? " · maquininha ok" : "") : c.mp_pos_id ? " · caixa ok" : " · sem caixa"}
                    {" · "}
                    {c.preco_valor ? `${formatarValor(c.preco_valor)} = ${c.preco_minutos} min` : "sem preco"}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="font-bold text-[var(--color-text)]">{formatarValor(c.faturamento_hoje)}</div>
                  <div className="text-[11px] text-[var(--color-text-soft)]">
                    {c.recargas_hoje || 0} recarga(s) · {formatarKwh(c.energia_hoje_kwh)}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {isAdmin ? <Link
                      to={`/diagnostico?carregador=${encodeURIComponent(c.id_hardware)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="pill-button inline-flex h-8 w-8 items-center justify-center"
                      title="Diagnostico"
                    >
                      <Stethoscope size={15} />
                    </Link> : null}
                    {c.latitude != null ? (
                      <Link
                        to={`/mapa?carregador=${encodeURIComponent(c.id_hardware)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="pill-button inline-flex h-8 w-8 items-center justify-center"
                        title="Ver no mapa"
                      >
                        <MapPin size={15} />
                      </Link>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visiveis.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[var(--color-text-soft)]">
            {lista.length ? "Nenhum carregador com esse filtro." : "Nenhum carregador cadastrado ainda."}
          </div>
        ) : null}
      </div>

      {/* Celular: cartoes */}
      <div className="space-y-3 md:hidden">
        {visiveis.map((c) => (
          <button
            key={c.id_hardware}
            type="button"
            onClick={() => abrir(c)}
            className="block w-full rounded-[18px] border border-[var(--color-border)] bg-white p-4 text-left shadow-[0_8px_20px_rgba(34,61,43,0.06)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-bold text-[var(--color-text)]">{c.nome_local}</div>
                <div className="truncate font-mono text-[11px] text-[var(--color-text-soft)]">{c.id_hardware}</div>
              </div>
              <StatusCarregador status={statusCarregador(c)} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <InfoPill rotulo="Hoje">{formatarValor(c.faturamento_hoje)}</InfoPill>
              <InfoPill rotulo="Agora">
                {c.sessao_ativa?.segundos_restantes != null ? formatarRelogio(c.sessao_ativa.segundos_restantes) : textoConector(c)}
              </InfoPill>
              <InfoPill rotulo="Cliente">{c.cliente_nome || "-"}</InfoPill>
              <div className="rounded-[14px] bg-[var(--color-bg-muted)] px-3 py-2">
                <BarraConexao carregador={c} compacto />
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-[var(--color-text-soft)]">
        {Object.entries(STATUS_CARREGADOR).map(([chave, s]) => (
          <span key={chave} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: s.cor }} /> {s.texto}
          </span>
        ))}
        <span>· Conexao: o carregador nao informa o sinal do Wi-Fi; a barra mostra as quedas de hoje.</span>
      </div>

      <Modal open={modal} onClose={() => setModal(false)}>
        <form onSubmit={salvar} className="space-y-4">
          <h2 className="text-3xl font-extrabold tracking-[-0.04em] text-[var(--color-text)]">Novo carregador</h2>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Vincular ao cliente</span>
            <select className={campoClasse} value={form.cliente_id} onChange={(e) => escolherCliente(e.target.value)} required>
              <option value="">Selecione o cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome_empresa}
                </option>
              ))}
            </select>
            {clientes.length === 0 ? (
              <span className="mt-1 block text-xs text-[var(--color-warning)]">
                Cadastre o cliente primeiro em <Link to="/clientes" className="font-semibold underline">Clientes</Link>.
              </span>
            ) : null}
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Banco do carregador</span>
            <select
              className={campoClasse}
              value={form.banco_pagamento}
              onChange={(e) => escolherBanco(e.target.value)}
              required
              disabled={!form.cliente_id || bancosDoCliente.length === 0}
            >
              <option value="">{form.cliente_id ? "Selecione o banco" : "Selecione um cliente primeiro"}</option>
              {bancosDoCliente.map((banco) => (
                <option key={banco} value={banco}>
                  {NOME_BANCO[banco] || banco}
                </option>
              ))}
            </select>
            {form.cliente_id && bancosDoCliente.length === 0 ? (
              <span className="mt-1 block text-xs text-[var(--color-warning)]">Este cliente nao tem banco configurado. Edite em Clientes.</span>
            ) : null}
          </label>

          {form.banco_pagamento === "mercado_pago" ? (
            <div className="rounded-[18px] bg-[var(--color-bg-muted)] p-3 text-sm text-[var(--color-text-soft)]">
              {clienteEscolhido?.tem_token_mp
                ? "A loja e o caixa sao criados sozinhos na conta Mercado Pago do cliente. Depois e' so vincular a maquininha ao caixa."
                : "O cliente esta sem Access Token do Mercado Pago: o carregador e' cadastrado, mas o caixa so pode ser criado depois do token."}
            </div>
          ) : null}

          {form.banco_pagamento === "sumup" ? (
            <div className="space-y-3 rounded-[18px] bg-[var(--color-bg-muted)] p-3">
              {!clienteEscolhido?.tem_sumup ? (
                <p className="text-sm text-[var(--color-warning)]">O cliente esta sem a API key da SumUp. Configure em Clientes.</p>
              ) : (
                <>
                  <label className="block">
                    <span className="mb-1 flex items-center justify-between text-sm font-semibold">
                      Maquininha SumUp
                      <button type="button" onClick={() => carregarReaders(form.cliente_id)} className="text-xs font-semibold text-[var(--color-primary)]">
                        Atualizar lista
                      </button>
                    </span>
                    <select className={campoClasse} value={form.sumup_reader_id} onChange={(e) => setForm({ ...form, sumup_reader_id: e.target.value })}>
                      <option value="">{readers.carregando ? "Carregando..." : readers.lista.length ? "Selecione a maquininha" : "Nenhuma pareada ainda"}</option>
                      {readers.lista.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nome || r.id} {r.serial ? `· ${r.serial}` : ""}
                        </option>
                      ))}
                    </select>
                    {readers.erro ? <span className="mt-1 block text-xs text-[var(--color-error)]">{readers.erro}</span> : null}
                  </label>

                  <div className="rounded-[14px] border border-dashed border-[var(--color-border-strong)] bg-white p-3">
                    <div className="text-sm font-semibold text-[var(--color-text)]">Parear nova maquininha</div>
                    <p className="mt-0.5 text-xs text-[var(--color-text-soft)]">
                      Na maquininha: Conexoes &gt; Wi-Fi &gt; API &gt; Conectar. Digite o codigo que aparecer (vale 5 minutos).
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <input
                        className={`${campoClasse} w-[140px] py-2 font-mono uppercase`}
                        placeholder="Codigo"
                        value={pareamento.codigo}
                        onChange={(e) => setPareamento({ ...pareamento, codigo: e.target.value })}
                      />
                      <input
                        className={`${campoClasse} min-w-[140px] flex-1 py-2`}
                        placeholder="Nome (opcional)"
                        value={pareamento.nome}
                        onChange={(e) => setPareamento({ ...pareamento, nome: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={parear}
                        disabled={pareamento.codigo.trim().length < 4 || pareamento.enviando}
                        className="pill-button px-4 py-2 text-sm font-semibold disabled:opacity-45"
                      >
                        {pareamento.enviando ? "Pareando..." : "Parear"}
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Ou o serial da maquininha</span>
                      <input
                        className={`${campoClasse} py-2 font-mono`}
                        placeholder="Serial do recibo"
                        value={form.sumup_device_code}
                        onChange={(e) => setForm({ ...form, sumup_device_code: e.target.value })}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Operador logado nela (para o Pix)</span>
                      <input className={`${campoClasse} py-2`} placeholder="Opcional" value={form.sumup_usuario} onChange={(e) => setForm({ ...form, sumup_usuario: e.target.value })} />
                    </label>
                  </div>
                </>
              )}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_100px]">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">ID do carregador</span>
              <input
                className={`${campoClasse} font-mono`}
                value={form.id_hardware}
                onChange={(e) => setForm({ ...form, id_hardware: e.target.value.trim() })}
                placeholder="GD1B751602"
                pattern="[A-Za-z0-9_\-.]+"
                title="Letras, numeros, traco, ponto e sublinhado"
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Nome do local</span>
              <input className={campoClasse} value={form.nome_local} onChange={(e) => setForm({ ...form, nome_local: e.target.value })} required />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Conector</span>
              <input className={campoClasse} type="number" min={1} value={form.connector_id} onChange={(e) => setForm({ ...form, connector_id: e.target.value })} />
            </label>
          </div>
          <p className="-mt-2 text-xs text-[var(--color-text-soft)]">
            O ID e' o do app do fabricante (Platform Pile ID). Se nao souber, aponte o carregador para o servidor: ele aparece no Diagnostico.
          </p>

          <div className="rounded-[18px] bg-[var(--color-bg-muted)] p-3">
            <div className="text-sm font-semibold text-[var(--color-text)]">
              Endereco <span className="font-normal text-[var(--color-text-soft)]">(opcional, para aparecer no mapa)</span>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-[160px_110px_1fr]">
              <input
                className={`${campoClasse} py-2 font-mono`}
                inputMode="numeric"
                placeholder="CEP"
                value={form.cep}
                onChange={(e) => setForm({ ...form, cep: e.target.value })}
                onBlur={conferirCep}
              />
              <input
                className={`${campoClasse} py-2`}
                placeholder="Numero"
                value={form.numero_endereco}
                onChange={(e) => setForm({ ...form, numero_endereco: e.target.value })}
                onBlur={conferirCep}
              />
              <div className="flex items-center text-xs text-[var(--color-text-soft)]">
                {cepAchado?.buscando
                  ? "Buscando..."
                  : cepAchado?.erro
                    ? <span className="text-[var(--color-warning)]">{cepAchado.erro}</span>
                    : cepAchado?.endereco
                      ? <span className="text-[var(--color-text)]">{cepAchado.endereco}{cepAchado.latitude == null ? " (sem ponto no mapa)" : ""}</span>
                      : "O ponto exato pode ser ajustado depois pelo celular."}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" className="pill-button flex-1 px-5 py-3 font-semibold" onClick={() => setModal(false)}>
              Cancelar
            </button>
            <Button
              type="submit"
              className="flex-1 justify-center"
              disabled={salvando || (form.banco_pagamento === "sumup" && !form.sumup_reader_id && !form.sumup_device_code.trim())}
            >
              {salvando ? "Cadastrando..." : "Cadastrar"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
