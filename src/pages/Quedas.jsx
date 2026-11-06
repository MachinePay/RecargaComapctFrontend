import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, WifiOff } from "lucide-react";
import dayjs from "dayjs";

import api from "../api/axios";
import Cabecalho from "../components/Cabecalho";
import LoadingSpinner from "../components/LoadingSpinner";
import { CartaoResumo } from "../components/CarregadorUi";
import { formatarDataHora } from "../utils/formatos";

const PERIODOS = [
  ["hoje", "Hoje"],
  ["7d", "7 dias"],
  ["30d", "30 dias"],
  ["mes", "Este mes"],
];

function duracao(minutos) {
  const m = Math.round(minutos);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h${String(m % 60).padStart(2, "0")}` : `${Math.floor(h / 24)}d ${h % 24}h`;
}

export default function Quedas() {
  const [periodo, setPeriodo] = useState("7d");
  const [carregadorId, setCarregadorId] = useState("");
  const [carregadores, setCarregadores] = useState([]);
  const [dados, setDados] = useState(null);

  useEffect(() => {
    api
      .get("/admin/carregadores/opcoes")
      .then(({ data }) => setCarregadores(data))
      .catch(() => {});
  }, []);

  const carregar = useCallback(async () => {
    try {
      const params = { periodo, ...(carregadorId ? { carregador_id: carregadorId } : {}) };
      setDados((await api.get("/admin/quedas", { params })).data);
    } catch {
      // Toast global
    }
  }, [periodo, carregadorId]);

  useEffect(() => {
    let cancelado = false;
    Promise.resolve().then(() => !cancelado && carregar());
    return () => {
      cancelado = true;
    };
  }, [carregar]);

  const quedas = dados?.quedas || [];
  const totalMin = quedas.reduce((t, q) => t + q.duracao_min, 0);
  const agora = quedas.filter((q) => q.em_andamento).length;
  const maxQuedas = Math.max(1, ...(dados?.por_carregador || []).map((c) => c.quedas));

  return (
    <div className="space-y-4 p-2 sm:p-4">
      <Cabecalho etiqueta="Operacao" titulo="Historico de quedas" descricao="Quando cada carregador perdeu a conexao com o servidor e por quanto tempo ficou fora." />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-full bg-white p-1 shadow-sm">
          {PERIODOS.map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setPeriodo(valor)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${periodo === valor ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-soft)]"}`}
            >
              {rotulo}
            </button>
          ))}
        </div>
        <select className="rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-sm outline-none" value={carregadorId} onChange={(e) => setCarregadorId(e.target.value)}>
          <option value="">Todos os carregadores</option>
          {carregadores.map((c) => (
            <option key={c.id_hardware} value={c.id_hardware}>
              {c.nome_local}
            </option>
          ))}
        </select>
      </div>

      {!dados ? (
        <LoadingSpinner className="min-h-[40vh]" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <CartaoResumo rotulo="Quedas" valor={quedas.length} ajuda={`${dayjs(dados.periodo.inicio).format("DD/MM")} a ${dayjs(dados.periodo.fim).format("DD/MM")}`} Icone={WifiOff} destaque />
            <CartaoResumo rotulo="Tempo fora" valor={duracao(totalMin)} ajuda="somando todas" Icone={Clock} />
            <CartaoResumo rotulo="Fora agora" valor={agora} ajuda={agora ? "ainda sem conexao" : "todos conectados"} Icone={WifiOff} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
            <section className="app-panel p-4 sm:p-5">
              <h2 className="mb-3 text-lg font-extrabold text-[var(--color-text)]">Por carregador</h2>
              <ul className="space-y-3">
                {dados.por_carregador.map((c) => (
                  <li key={c.carregador_id}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <Link to={`/carregadores/${encodeURIComponent(c.carregador_id)}`} className="font-semibold text-[var(--color-primary-strong)]">
                        {c.nome_local}
                      </Link>
                      <span className={c.quedas ? "font-bold text-[var(--color-error)]" : "text-[var(--color-text-soft)]"}>
                        {c.quedas} queda(s) {c.quedas ? `· ${duracao(c.minutos_fora)} fora` : ""}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--color-bg-muted)]">
                      <div className="h-full rounded-full bg-[#b64545]" style={{ width: `${(100 * c.quedas) / maxQuedas}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="app-panel p-4 sm:p-5">
              <h2 className="mb-3 text-lg font-extrabold text-[var(--color-text)]">Cada queda</h2>
              <div className="max-h-[520px] overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-soft)]">
                    <tr>
                      <th className="px-2 py-2">Carregador</th>
                      <th className="px-2 py-2">Caiu</th>
                      <th className="px-2 py-2">Voltou</th>
                      <th className="px-2 py-2 text-right">Ficou fora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quedas.map((q, i) => (
                      <tr key={`${q.carregador_id}-${i}`} className="border-t border-[var(--color-border)]">
                        <td className="px-2 py-2 font-semibold text-[var(--color-text)]">{q.nome_local}</td>
                        <td className="px-2 py-2 tabular-nums text-[var(--color-text-soft)]">{formatarDataHora(q.inicio)}</td>
                        <td className="px-2 py-2 tabular-nums">
                          {q.em_andamento ? <span className="font-bold text-[var(--color-error)]">Ainda fora</span> : <span className="text-[var(--color-text-soft)]">{formatarDataHora(q.fim)}</span>}
                        </td>
                        <td className="px-2 py-2 text-right font-semibold">{duracao(q.duracao_min)}</td>
                      </tr>
                    ))}
                    {quedas.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-2 py-8 text-center text-[var(--color-text-soft)]">
                          Nenhuma queda no periodo.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-[var(--color-text-soft)]">Quando o servidor reinicia (deploy), todos caem juntos por alguns segundos e isso aparece aqui.</p>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
