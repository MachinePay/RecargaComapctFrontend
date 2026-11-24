import { useCallback, useEffect, useState } from "react";
import { Wallet } from "lucide-react";

import api from "../api/axios";
import useAtrasado from "../hooks/useAtrasado";
import useListaPaginada from "../hooks/useListaPaginada";
import CampoBusca from "../components/CampoBusca";
import Paginacao from "../components/Paginacao";
import Badge from "../components/Badge";
import Button from "../components/Button";
import Cabecalho from "../components/Cabecalho";
import Modal from "../components/Modal";
import { campoClasse } from "../utils/estilos";
import { formatarDataHora, formatarValor } from "../utils/formatos";

const TIPOS = {
  reserva: "Usado numa recarga",
  sobra: "Sobra de recarga",
  devolucao: "Devolvido (recarga nao aconteceu)",
  ajuste: "Ajuste manual",
};

// Contas do app do motorista e a carteira de cada um (saldo, extrato, ajuste).
export default function Motoristas() {
  const [busca, setBusca] = useState("");
  const [comSaldo, setComSaldo] = useState(false);
  const { dados, itens: lista, setPagina, recarregar } = useListaPaginada("/admin/motoristas", { busca: useAtrasado(busca), com_saldo: comSaldo });
  const [aberto, setAberto] = useState(null);

  return (
    <div className="space-y-5 p-2 sm:p-4">
      <Cabecalho
        etiqueta="App do motorista"
        titulo="Motoristas"
        descricao="Contas do app e a carteira de cada um. Nos carregadores por kWh, o que o motorista paga pelo app e nao usa fica na carteira e paga a proxima recarga."
      />

      <div className="flex flex-wrap items-center gap-2">
        <CampoBusca valor={busca} onMudar={setBusca} placeholder="Buscar por nome, celular ou e-mail..." />
        <label className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm">
          <input type="checkbox" checked={comSaldo} onChange={(e) => setComSaldo(e.target.checked)} />
          So com saldo
        </label>
      </div>

      <div className="app-panel overflow-x-auto p-2">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-soft)]">
            <tr>
              <th className="px-4 py-3">Motorista</th>
              <th className="px-4 py-3">Saldo</th>
              <th className="px-4 py-3">Ultimo login</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {lista.map((m) => (
              <tr key={m.id} className="border-t border-[var(--color-border)] hover:bg-white/70">
                <td className="px-4 py-3">
                  <div className="font-bold text-[var(--color-text)]">{m.nome}</div>
                  <div className="text-xs text-[var(--color-text-soft)]">
                    {m.telefone}
                    {m.email ? ` · ${m.email}` : ""}
                  </div>
                  {!m.ativo ? <Badge tom="erro">Desativado</Badge> : null}
                </td>
                <td className="px-4 py-3 font-bold tabular-nums">{formatarValor(m.saldo)}</td>
                <td className="px-4 py-3 text-[var(--color-text-soft)]">{formatarDataHora(m.ultimo_login)}</td>
                <td className="px-4 py-3 text-right">
                  <button type="button" onClick={() => setAberto(m)} className="pill-button inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold">
                    <Wallet size={14} /> Carteira
                  </button>
                </td>
              </tr>
            ))}
            {lista.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[var(--color-text-soft)]">
                  {busca || comSaldo ? "Nenhum motorista com esse filtro." : "Nenhum motorista criou conta no app ainda."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <Paginacao dados={dados} onPagina={setPagina} />
      </div>

      <Modal open={Boolean(aberto)} onClose={() => setAberto(null)}>
        {aberto ? <CarteiraMotorista motorista={aberto} onMudou={recarregar} /> : null}
      </Modal>
    </div>
  );
}

function CarteiraMotorista({ motorista, onMudou }) {
  const [dados, setDados] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [ajuste, setAjuste] = useState({ valor: "", motivo: "" });
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get(`/admin/motoristas/${motorista.id}/carteira`, { params: { pagina } });
      setDados(data);
    } catch {
      // Toast global
    }
  }, [motorista.id, pagina]);

  useEffect(() => {
    const timer = window.setTimeout(carregar, 0);
    return () => window.clearTimeout(timer);
  }, [carregar]);

  const ajustar = async (event) => {
    event.preventDefault();
    setSalvando(true);
    try {
      await api.post(`/admin/motoristas/${motorista.id}/ajuste`, {
        valor: Number(String(ajuste.valor).replace(",", ".")),
        motivo: ajuste.motivo,
      });
      setAjuste({ valor: "", motivo: "" });
      carregar();
      onMudou();
    } catch {
      // Toast global
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-lg font-extrabold text-[var(--color-text)]">{motorista.nome}</div>
        <div className="text-sm text-[var(--color-text-soft)]">
          Saldo: <b>{formatarValor(dados?.motorista.saldo ?? motorista.saldo)}</b>
        </div>
      </div>

      <form onSubmit={ajustar} className="flex flex-wrap items-end gap-2 rounded-[16px] bg-[var(--color-bg-muted)] p-3">
        <label className="w-[120px]">
          <span className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Valor (R$)</span>
          <input
            className={`${campoClasse} py-2`}
            inputMode="decimal"
            placeholder="10 ou -10"
            value={ajuste.valor}
            onChange={(e) => setAjuste({ ...ajuste, valor: e.target.value })}
            required
          />
        </label>
        <label className="min-w-[180px] flex-1">
          <span className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Motivo (aparece no extrato)</span>
          <input
            className={`${campoClasse} py-2`}
            placeholder="Ex.: recarga com problema"
            value={ajuste.motivo}
            onChange={(e) => setAjuste({ ...ajuste, motivo: e.target.value })}
            required
            minLength={3}
          />
        </label>
        <Button type="submit" className="px-4 py-2 text-sm" disabled={salvando}>
          {salvando ? "Salvando..." : "Ajustar saldo"}
        </Button>
        <p className="w-full text-xs text-[var(--color-text-soft)]">Positivo coloca saldo; negativo tira. O motorista ve o ajuste no extrato do app.</p>
      </form>

      <div className="max-h-[50vh] overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-soft)]">
            <tr>
              <th className="px-2 py-2">Quando</th>
              <th className="px-2 py-2">O que</th>
              <th className="px-2 py-2 text-right">Valor</th>
              <th className="px-2 py-2 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {dados?.itens.map((m) => (
              <tr key={m.id} className="border-t border-[var(--color-border)] align-top">
                <td className="px-2 py-2 text-[var(--color-text-soft)]">{formatarDataHora(m.created_at)}</td>
                <td className="px-2 py-2">
                  <div className="font-semibold">{TIPOS[m.tipo] || m.tipo}</div>
                  <div className="text-xs text-[var(--color-text-soft)]">{m.descricao}</div>
                </td>
                <td className={`px-2 py-2 text-right font-bold tabular-nums ${m.valor > 0 ? "text-[var(--color-success)]" : ""}`}>
                  {m.valor > 0 ? "+" : ""}
                  {formatarValor(m.valor)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-[var(--color-text-soft)]">{formatarValor(m.saldo_apos)}</td>
              </tr>
            ))}
            {dados && dados.itens.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-2 py-6 text-center text-[var(--color-text-soft)]">
                  Sem movimentos ainda.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {dados && dados.paginas > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <button type="button" className="pill-button px-3 py-1.5" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
            Mais novos
          </button>
          <span className="text-[var(--color-text-soft)]">
            {pagina} de {dados.paginas}
          </span>
          <button type="button" className="pill-button px-3 py-1.5" disabled={pagina >= dados.paginas} onClick={() => setPagina((p) => p + 1)}>
            Mais antigos
          </button>
        </div>
      ) : null}
    </div>
  );
}
