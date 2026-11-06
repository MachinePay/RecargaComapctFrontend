import { useEffect, useState } from "react";
import { Ban, Check, Copy, Gift, MessageCircle, Plus } from "lucide-react";

import api from "../api/axios";
import { useAuth } from "../context/useAuth";
import useAtrasado from "../hooks/useAtrasado";
import useListaPaginada from "../hooks/useListaPaginada";
import CampoBusca from "../components/CampoBusca";
import Paginacao from "../components/Paginacao";
import Badge from "../components/Badge";
import Button from "../components/Button";
import Cabecalho from "../components/Cabecalho";
import Modal from "../components/Modal";
import { confirmar } from "../utils/confirmar";
import { campoClasse } from "../utils/estilos";
import { formatarDataHora, formatarMinutos } from "../utils/formatos";

const SITUACAO = {
  ativo: { texto: "Ativo", tom: "ok" },
  esgotado: { texto: "Usado", tom: "neutro" },
  vencido: { texto: "Vencido", tom: "aviso" },
  cancelado: { texto: "Cancelado", tom: "erro" },
};

const TEMPOS = [15, 30, 60, 120];
// Validade: some o link depois disso.
const VALIDADES = [
  ["", "Sem prazo"],
  ["60", "1 hora"],
  ["1440", "24 horas"],
  ["10080", "7 dias"],
  ["data", "Escolher data"],
];

const formVazio = { nome: "", minutos: 30, usos_max: 1, validade: "1440", data: "", carregadores: [] };

const linkDo = (v) => `${window.location.origin}/v/${v.codigo}`;

// Validade escolhida -> data ISO (null = sem prazo). Chamado so ao salvar.
function expiraEm({ validade, data }) {
  if (validade === "data") return data ? new Date(data).toISOString() : null;
  return validade ? new Date(Date.now() + Number(validade) * 60000).toISOString() : null;
}

export default function Vouchers() {
  const { isAdmin } = useAuth();
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState("");
  const { dados, itens: lista, setPagina, recarregar: carregar } = useListaPaginada("/admin/vouchers", { busca: useAtrasado(busca), situacao });
  const [carregadores, setCarregadores] = useState([]);
  const [form, setForm] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [copiado, setCopiado] = useState(null);

  // O servidor ja filtra: cliente recebe so os vouchers e carregadores dele.
  useEffect(() => {
    api
      .get("/admin/carregadores/opcoes")
      .then(({ data }) => setCarregadores(data))
      .catch(() => {});
  }, []);

  const salvar = async (event) => {
    event.preventDefault();
    if (!form.carregadores.length) return;
    setSalvando(true);
    const expira = expiraEm(form);
    try {
      const { data } = await api.post("/admin/vouchers", {
        nome: form.nome,
        minutos: Number(form.minutos),
        usos_max: Number(form.usos_max),
        expira_em: expira,
        carregadores: form.carregadores,
      });
      setForm(null);
      await carregar();
      copiar(data);
    } catch {
      // Toast global
    } finally {
      setSalvando(false);
    }
  };

  const copiar = async (v) => {
    try {
      await navigator.clipboard.writeText(linkDo(v));
      setCopiado(v.id);
      window.setTimeout(() => setCopiado((atual) => (atual === v.id ? null : atual)), 2500);
    } catch {
      window.prompt("Copie o link do voucher:", linkDo(v));
    }
  };

  const cancelar = async (v) => {
    const ok = await confirmar({
      titulo: `Cancelar o voucher "${v.nome}"?`,
      texto: "O link para de funcionar na hora. Recarga que ja comecou continua.",
      confirmarTexto: "Cancelar voucher",
      perigoso: true,
    });
    if (!ok) return;
    try {
      await api.post(`/admin/vouchers/${v.id}/cancelar`);
      carregar();
    } catch {
      // Toast global
    }
  };

  const alternarCarregador = (id) =>
    setForm({ ...form, carregadores: form.carregadores.includes(id) ? form.carregadores.filter((c) => c !== id) : [...form.carregadores, id] });

  return (
    <div className="space-y-5 p-2 sm:p-4">
      <Cabecalho
        etiqueta="Cortesia"
        titulo="Vouchers"
        descricao={
          isAdmin
            ? "Link de recarga gratis: a pessoa abre, escolhe um dos carregadores liberados e carrega o tempo do voucher."
            : "Link de recarga gratis nos seus carregadores: a pessoa abre, escolhe o carregador e carrega o tempo do voucher."
        }
        acoes={
          <Button onClick={() => setForm({ ...formVazio, carregadores: carregadores.length === 1 ? [carregadores[0].id_hardware] : [] })}>
            <Plus size={18} /> Novo voucher
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <CampoBusca valor={busca} onMudar={setBusca} placeholder="Buscar pelo nome ou codigo do voucher..." />
        <select className="rounded-full border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm outline-none" value={situacao} onChange={(e) => setSituacao(e.target.value)}>
          <option value="">Todas as situacoes</option>
          <option value="validos">Validos (ativos e usados)</option>
          <option value="vencidos">Vencidos</option>
          <option value="cancelados">Cancelados</option>
        </select>
      </div>

      <div className="app-panel overflow-x-auto p-2">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-soft)]">
            <tr>
              <th className="px-4 py-3">Voucher</th>
              <th className="px-4 py-3">Usos</th>
              <th className="px-4 py-3">Carregadores</th>
              <th className="px-4 py-3">Vence</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {lista.map((v) => {
              const s = SITUACAO[v.situacao] || SITUACAO.ativo;
              const ativo = v.situacao === "ativo";
              return (
                <tr key={v.id} className="border-t border-[var(--color-border)] hover:bg-white/70">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--color-text)]">{v.nome}</span>
                      <Badge tom={s.tom}>{s.texto}</Badge>
                    </div>
                    <div className="text-xs text-[var(--color-text-soft)]">
                      {formatarMinutos(v.minutos)} gratis{v.criado_por ? ` · por ${v.criado_por}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold tabular-nums">
                    {v.usos}/{v.usos_max}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text)]">{v.carregadores.map((c) => c.nome).join(", ")}</td>
                  <td className="px-4 py-3 text-[var(--color-text-soft)]">{v.expira_em ? formatarDataHora(v.expira_em) : "Sem prazo"}</td>
                  <td className="px-4 py-3">
                    {ativo ? (
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => copiar(v)} className="pill-button inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold">
                          {copiado === v.id ? <Check size={14} /> : <Copy size={14} />} {copiado === v.id ? "Copiado" : "Copiar link"}
                        </button>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(`Voucher de recarga: ${formatarMinutos(v.minutos)} gratis. Abra e escolha o carregador: ${linkDo(v)}`)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="pill-button inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
                        >
                          <MessageCircle size={14} /> WhatsApp
                        </a>
                        <button
                          type="button"
                          onClick={() => cancelar(v)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-semibold hover:border-rose-300 hover:bg-rose-50"
                        >
                          <Ban size={14} /> Cancelar
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {lista.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-[var(--color-text-soft)]">
                  <Gift size={28} className="mx-auto mb-2" />
                  {busca || situacao ? "Nenhum voucher com esse filtro." : "Nenhum voucher ainda. Crie um e mande o link para quem vai carregar."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <Paginacao dados={dados} onPagina={setPagina} />
      </div>

      <Modal open={Boolean(form)} onClose={() => setForm(null)}>
        {form ? (
          <form onSubmit={salvar} className="space-y-4">
            <h2 className="text-3xl font-extrabold tracking-[-0.04em] text-[var(--color-text)]">Novo voucher</h2>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Para quem / motivo</span>
              <input
                className={campoClasse}
                placeholder="Ex.: Cortesia Joao"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                required
                maxLength={80}
              />
            </label>

            <div>
              <span className="mb-2 block text-sm font-semibold">Tempo de recarga</span>
              <div className="flex flex-wrap items-center gap-2">
                {TEMPOS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setForm({ ...form, minutos: m })}
                    className={`rounded-full border-2 px-4 py-2 text-sm font-bold ${
                      Number(form.minutos) === m ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]" : "border-[var(--color-border)] bg-white"
                    }`}
                  >
                    {formatarMinutos(m)}
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  max={1440}
                  className="w-24 rounded-[12px] border border-[var(--color-border)] px-3 py-2 text-center font-bold tabular-nums"
                  value={form.minutos}
                  onChange={(e) => setForm({ ...form, minutos: e.target.value })}
                  required
                />
                <span className="text-sm font-semibold text-[var(--color-text-soft)]">min</span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Quantas recargas</span>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  className={campoClasse}
                  value={form.usos_max}
                  onChange={(e) => setForm({ ...form, usos_max: e.target.value })}
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Link some depois de</span>
                <select className={campoClasse} value={form.validade} onChange={(e) => setForm({ ...form, validade: e.target.value })}>
                  {VALIDADES.map(([valor, texto]) => (
                    <option key={valor} value={valor}>
                      {texto}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {form.validade === "data" ? (
              <input
                type="datetime-local"
                className={campoClasse}
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
                required
              />
            ) : null}

            <div>
              <span className="mb-2 block text-sm font-semibold">Vale nos carregadores</span>
              <div className="max-h-56 space-y-2 overflow-y-auto">
                {carregadores.map((c) => {
                  const marcado = form.carregadores.includes(c.id_hardware);
                  return (
                    <button
                      key={c.id_hardware}
                      type="button"
                      onClick={() => alternarCarregador(c.id_hardware)}
                      className={`flex w-full items-center justify-between rounded-[16px] border-2 px-4 py-2.5 text-left ${
                        marcado ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]" : "border-[var(--color-border)] bg-white"
                      }`}
                    >
                      <span>
                        <span className="block font-bold text-[var(--color-text)]">{c.nome_local}</span>
                        <span className="block text-xs text-[var(--color-text-soft)]">
                          {[c.id_hardware, isAdmin ? c.cliente_nome : null].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      {marcado ? <Check size={18} className="text-[var(--color-primary-strong)]" /> : null}
                    </button>
                  );
                })}
                {carregadores.length === 0 ? <p className="text-sm text-[var(--color-text-soft)]">Nenhum carregador cadastrado.</p> : null}
              </div>
              {!form.carregadores.length ? <p className="mt-1 text-xs font-semibold text-[var(--color-warning)]">Escolha pelo menos um carregador.</p> : null}
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" className="pill-button flex-1 px-5 py-3 font-semibold" onClick={() => setForm(null)}>
                Cancelar
              </button>
              <Button type="submit" className="flex-1 justify-center" disabled={salvando || !form.carregadores.length}>
                {salvando ? "Criando..." : "Criar e copiar link"}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
