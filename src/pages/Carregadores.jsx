import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BatteryCharging, Map, MapPin, PlugZap, Plus, Search, Stethoscope, Wallet } from "lucide-react";
import Swal from "sweetalert2";

import api from "../api/axios";
import usePolling from "../hooks/usePolling";
import Button from "../components/Button";
import Cabecalho from "../components/Cabecalho";
import LoadingSpinner from "../components/LoadingSpinner";
import Modal from "../components/Modal";
import { BarraConexao, CabecalhoOrdenavel, CartaoResumo, InfoPill, StatusCarregador } from "../components/CarregadorUi";
import { STATUS_CARREGADOR, combinaBusca, ordenar, proximaOrdem, statusCarregador, textoConector } from "../utils/carregadores";
import { campoClasse } from "../utils/estilos";
import { formatarDataHora, formatarKwh, formatarRelogio, formatarValor } from "../utils/formatos";

const formVazio = { id_hardware: "", nome_local: "", cliente_id: "", connector_id: 1, gerar_senha_ocpp: false };

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
  const [lista, setLista] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [busca, setBusca] = useState("");
  const [clienteFiltro, setClienteFiltro] = useState("");
  const [chip, setChip] = useState("todos");
  const [ordem, setOrdem] = useState({ coluna: "status", direcao: "asc" });
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(formVazio);
  const [salvando, setSalvando] = useState(false);

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

  const salvar = async (event) => {
    event.preventDefault();
    setSalvando(true);
    try {
      const { data } = await api.post("/admin/carregadores", {
        ...form,
        connector_id: Number(form.connector_id) || 1,
        cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
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
            <Button onClick={() => setModal(true)}>
              <Plus size={18} /> Novo carregador
            </Button>
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
                    {c.preco_valor ? `${formatarValor(c.preco_valor)} = ${c.preco_minutos} min` : "Sem preco"}
                    {c.mp_pos_id ? " · caixa ok" : ""}
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
                    <Link
                      to={`/diagnostico?carregador=${encodeURIComponent(c.id_hardware)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="pill-button inline-flex h-8 w-8 items-center justify-center"
                      title="Diagnostico"
                    >
                      <Stethoscope size={15} />
                    </Link>
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
            <span className="mb-2 block text-sm font-semibold">ID do carregador (Charge Point ID)</span>
            <input
              className={campoClasse}
              value={form.id_hardware}
              onChange={(e) => setForm({ ...form, id_hardware: e.target.value.trim() })}
              placeholder="GD1B751602"
              pattern="[A-Za-z0-9_\-.]+"
              title="Letras, numeros, traco, ponto e sublinhado"
              required
            />
            <span className="mt-1 block text-xs text-[var(--color-text-soft)]">
              Igual ao do app do fabricante. Se nao souber, aponte o carregador para o servidor: o ID aparece no Diagnostico.
            </span>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Nome do local</span>
            <input className={campoClasse} value={form.nome_local} onChange={(e) => setForm({ ...form, nome_local: e.target.value })} required />
          </label>
          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Cliente (dono)</span>
              <select className={campoClasse} value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}>
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
              <input className={campoClasse} type="number" min={1} value={form.connector_id} onChange={(e) => setForm({ ...form, connector_id: e.target.value })} />
            </label>
          </div>
          <label className="flex items-center gap-3 text-sm font-semibold">
            <input type="checkbox" checked={form.gerar_senha_ocpp} onChange={(e) => setForm({ ...form, gerar_senha_ocpp: e.target.checked })} />
            Gerar senha OCPP (so se o app do carregador tiver campo de senha)
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" className="pill-button flex-1 px-5 py-3 font-semibold" onClick={() => setModal(false)}>
              Cancelar
            </button>
            <Button type="submit" className="flex-1 justify-center" disabled={salvando}>
              {salvando ? "Salvando..." : "Cadastrar"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
