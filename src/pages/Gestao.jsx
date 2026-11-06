import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BatteryCharging, Clock, Receipt, RotateCcw, TrendingDown, TrendingUp, Trophy, Wallet, Zap } from "lucide-react";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";

import api from "../api/axios";
import Cabecalho from "../components/Cabecalho";
import LoadingSpinner from "../components/LoadingSpinner";
import { formatarKwh, formatarMinutos, formatarValor } from "../utils/formatos";

dayjs.locale("pt-br");

const PERIODOS = [
  ["hoje", "Hoje"],
  ["7d", "7 dias"],
  ["30d", "30 dias"],
  ["mes", "Este mes"],
  ["mes_anterior", "Mes passado"],
  ["personalizado", "Escolher"],
];

// Grade de horarios: segunda = 0 (igual HorariosPico da CompactPay).
const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];
// Escala sequencial de uma cor so (verde da marca), do claro ao escuro.
const ESCALA = ["#e3f1e8", "#bfe0cb", "#8fc8a6", "#5aab7f", "#2f8a5a", "#1f7a4c", "#145233"];
const VAZIO = "#f2f4f1";
const COR_BARRA = "#1f7a4c";

const METODOS = {
  pix: "Pix",
  account_money: "Saldo MP",
  credit_card: "Credito",
  debit_card: "Debito",
  prepaid_card: "Pre-pago",
  simulado: "Simulado",
  caixa: "Maquininha",
  point: "Point",
};

function corDaEscala(valor, maximo) {
  if (!valor || !maximo) return VAZIO;
  return ESCALA[Math.max(0, Math.min(ESCALA.length - 1, Math.round((valor / maximo) * (ESCALA.length - 1))))];
}

function variacao(atual, anterior) {
  if (!anterior) return null;
  return ((atual - anterior) / anterior) * 100;
}

function Cartao({ rotulo, valor, ajuda, Icone, atual, anterior, destaque = false }) {
  const v = anterior !== undefined ? variacao(atual, anterior) : null;
  return (
    <div
      className={`rounded-[24px] p-4 ${
        destaque ? "bg-[linear-gradient(135deg,#1f7a4c_0%,#145233_100%)] text-white shadow-[0_16px_40px_rgba(31,122,76,0.28)]" : "app-panel"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`text-xs font-semibold uppercase tracking-[0.14em] ${destaque ? "text-white/75" : "text-[var(--color-text-soft)]"}`}>{rotulo}</div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${destaque ? "bg-white/15" : "bg-[var(--color-bg-muted)] text-[var(--color-primary-strong)]"}`}>
          {Icone ? <Icone size={18} /> : null}
        </div>
      </div>
      <div className={`mt-1 text-3xl font-extrabold tracking-[-0.03em] ${destaque ? "" : "text-[var(--color-text)]"}`}>{valor}</div>
      <div className={`mt-0.5 flex flex-wrap items-center gap-2 text-xs ${destaque ? "text-white/80" : "text-[var(--color-text-soft)]"}`}>
        {v !== null ? (
          <span className={`inline-flex items-center gap-0.5 font-bold ${destaque ? "text-white" : v >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-error)]"}`}>
            {v >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {v >= 0 ? "+" : ""}
            {v.toFixed(0)}%
          </span>
        ) : null}
        {ajuda}
      </div>
    </div>
  );
}

function Painel({ titulo, Icone, subtitulo, children, className = "" }) {
  return (
    <section className={`app-panel p-4 sm:p-5 ${className}`}>
      <div className="mb-3">
        <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-[-0.02em] text-[var(--color-text)]">
          {Icone ? <Icone size={18} className="text-[var(--color-primary)]" /> : null}
          {titulo}
        </h2>
        {subtitulo ? <p className="mt-0.5 text-xs text-[var(--color-text-soft)]">{subtitulo}</p> : null}
      </div>
      {children}
    </section>
  );
}

function DicaDia({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-[14px] border border-[var(--color-border)] bg-white px-3 py-2 text-xs shadow-lg">
      <div className="font-bold text-[var(--color-text)]">{dayjs(d.dia).format("ddd DD/MM")}</div>
      <div className="text-[var(--color-text)]">{formatarValor(d.faturamento)}</div>
      <div className="text-[var(--color-text-soft)]">
        {d.vendas} venda(s) · {formatarKwh(d.energia_kwh)}
      </div>
    </div>
  );
}

function GradeHorarios({ grade, metrica }) {
  const [dica, setDica] = useState(null);
  const valor = (c) => (metrica === "faturamento" ? c.faturamento : c.vendas);
  const maximo = Math.max(0, ...grade.flat().map(valor));
  const porHora = Array.from({ length: 24 }, (_, h) => grade.reduce((t, dia) => t + valor(dia[h]), 0));
  const horaPico = porHora.indexOf(Math.max(...porHora));
  const porDia = grade.map((dia) => dia.reduce((t, c) => t + valor(c), 0));
  const diaPico = porDia.indexOf(Math.max(...porDia));
  const formatar = (v) => (metrica === "faturamento" ? formatarValor(v) : `${v} venda(s)`);

  return (
    <div>
      {maximo > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-[var(--color-primary-soft)] px-3 py-1 font-semibold text-[var(--color-primary-strong)]">
            Pico: {String(horaPico).padStart(2, "0")}h–{String(horaPico + 1).padStart(2, "0")}h
          </span>
          <span className="rounded-full bg-[var(--color-bg-muted)] px-3 py-1 font-semibold text-[var(--color-text)]">Melhor dia: {DIAS[diaPico]}</span>
        </div>
      ) : null}
      <div className="relative overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[36px_repeat(24,minmax(0,1fr))] gap-[2px]">
            <div />
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="text-center text-[10px] text-[var(--color-text-soft)]">
                {h % 3 === 0 ? `${h}h` : ""}
              </div>
            ))}
            {grade.map((dia, d) => (
              <div key={d} className="contents">
                <div className="pr-1 text-right text-[11px] font-semibold leading-6 text-[var(--color-text-soft)]">{DIAS[d]}</div>
                {dia.map((celula, h) => (
                  <div
                    key={h}
                    className="h-6 rounded-[4px] transition hover:ring-2 hover:ring-[var(--color-text)]"
                    style={{ background: corDaEscala(valor(celula), maximo) }}
                    onMouseEnter={() => setDica({ d, h, celula })}
                    onMouseLeave={() => setDica(null)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-text-soft)]">
        <span>
          {dica
            ? `${DIAS[dica.d]} ${String(dica.h).padStart(2, "0")}h: ${formatarValor(dica.celula.faturamento)} · ${dica.celula.vendas} venda(s)`
            : "Passe o mouse num quadrado para ver o valor."}
        </span>
        <span className="flex items-center gap-1">
          menos
          {ESCALA.map((cor) => (
            <span key={cor} className="h-3 w-4 rounded-[3px]" style={{ background: cor }} />
          ))}
          mais
        </span>
      </div>
      {maximo > 0 ? <div className="sr-only">Maior valor numa hora: {formatar(maximo)}</div> : null}
    </div>
  );
}

export default function Gestao() {
  const [clientes, setClientes] = useState([]);
  const [carregadores, setCarregadores] = useState([]);
  const [filtros, setFiltros] = useState({
    periodo: "7d",
    inicio: dayjs().subtract(6, "day").format("YYYY-MM-DD"),
    fim: dayjs().format("YYYY-MM-DD"),
    cliente_id: "",
    carregador_id: "",
    incluir_simulados: false,
  });
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [metricaGrade, setMetricaGrade] = useState("faturamento");
  const [ordemRanking, setOrdemRanking] = useState("faturamento");

  useEffect(() => {
    Promise.all([api.get("/admin/clientes/opcoes"), api.get("/admin/carregadores/opcoes")])
      .then(([c, g]) => {
        setClientes(c.data);
        setCarregadores(g.data);
      })
      .catch(() => {});
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = {
        periodo: filtros.periodo,
        incluir_simulados: filtros.incluir_simulados,
        ...(filtros.periodo === "personalizado" ? { inicio: filtros.inicio, fim: filtros.fim } : {}),
        ...(filtros.cliente_id ? { cliente_id: filtros.cliente_id } : {}),
        ...(filtros.carregador_id ? { carregador_id: filtros.carregador_id } : {}),
      };
      setDados((await api.get("/admin/relatorio", { params })).data);
    } catch {
      // Toast global
    } finally {
      setCarregando(false);
    }
  }, [filtros]);

  useEffect(() => {
    // Busca de novo sempre que um filtro muda (a tela nao tem botao "aplicar").
    let cancelado = false;
    Promise.resolve().then(() => !cancelado && carregar());
    return () => {
      cancelado = true;
    };
  }, [carregar]);

  const carregadoresDoCliente = filtros.cliente_id ? carregadores.filter((c) => String(c.cliente_id) === filtros.cliente_id) : carregadores;
  const totais = dados?.totais;
  const anterior = dados?.anterior;
  const ranking = dados ? [...dados.ranking].sort((a, b) => b[ordemRanking] - a[ordemRanking]) : [];
  const maiorRanking = Math.max(0, ...ranking.map((r) => r[ordemRanking]));
  const totalMetodos = dados ? dados.por_metodo.reduce((t, m) => t + m.valor, 0) : 0;

  return (
    <div className="space-y-4 p-2 sm:p-4">
      <Cabecalho etiqueta="Gestao" titulo="Relatorios" descricao="Faturamento, horarios de pico e ranking dos carregadores no periodo." />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-full bg-white p-1 shadow-sm">
          {PERIODOS.map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setFiltros({ ...filtros, periodo: valor })}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                filtros.periodo === valor ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-soft)] hover:text-[var(--color-text)]"
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>
        {filtros.periodo === "personalizado" ? (
          <div className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-sm shadow-sm">
            <input type="date" className="bg-transparent outline-none" value={filtros.inicio} onChange={(e) => setFiltros({ ...filtros, inicio: e.target.value })} />
            <span className="text-[var(--color-text-soft)]">até</span>
            <input type="date" className="bg-transparent outline-none" value={filtros.fim} onChange={(e) => setFiltros({ ...filtros, fim: e.target.value })} />
          </div>
        ) : null}
        <select
          className="rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-sm outline-none"
          value={filtros.cliente_id}
          onChange={(e) => setFiltros({ ...filtros, cliente_id: e.target.value, carregador_id: "" })}
        >
          <option value="">Todos os clientes</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome_empresa}
            </option>
          ))}
        </select>
        <select
          className="rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-sm outline-none"
          value={filtros.carregador_id}
          onChange={(e) => setFiltros({ ...filtros, carregador_id: e.target.value })}
        >
          <option value="">Todos os carregadores</option>
          {carregadoresDoCliente.map((c) => (
            <option key={c.id_hardware} value={c.id_hardware}>
              {c.nome_local}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm text-[var(--color-text-soft)] shadow-sm">
          <input type="checkbox" checked={filtros.incluir_simulados} onChange={(e) => setFiltros({ ...filtros, incluir_simulados: e.target.checked })} />
          Incluir testes simulados
        </label>
        {carregando ? <span className="text-xs text-[var(--color-text-soft)]">Atualizando...</span> : null}
      </div>

      {!dados ? (
        <LoadingSpinner className="min-h-[40vh]" />
      ) : (
        <>
          <div className="text-xs text-[var(--color-text-soft)]">
            {dayjs(dados.periodo.inicio).format("DD/MM/YYYY")} a {dayjs(dados.periodo.fim).format("DD/MM/YYYY")} · {dados.periodo.dias} dia(s) · a variacao compara com os{" "}
            {dados.periodo.dias} dia(s) anteriores
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Cartao rotulo="Faturamento" valor={formatarValor(totais.faturamento)} ajuda={`${totais.vendas} venda(s)`} Icone={Wallet} atual={totais.faturamento} anterior={anterior.faturamento} destaque />
            <Cartao rotulo="Ticket medio" valor={formatarValor(totais.ticket_medio)} ajuda={`${formatarMinutos(totais.minutos_vendidos)} vendidos`} Icone={Receipt} atual={totais.ticket_medio} anterior={anterior.ticket_medio} />
            <Cartao rotulo="Recargas" valor={totais.recargas} ajuda={formatarKwh(totais.energia_kwh)} Icone={BatteryCharging} atual={totais.recargas} anterior={anterior.recargas} />
            <Cartao
              rotulo="Estornos"
              valor={formatarValor(totais.estornos_valor)}
              ajuda={`${totais.estornos_qtd} estorno(s)`}
              Icone={RotateCcw}
            />
          </div>

          <Painel titulo="Faturamento por dia" Icone={Wallet} subtitulo="Passe o mouse numa barra para ver vendas e energia do dia.">
            {dados.por_dia.some((d) => d.faturamento > 0) ? (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dados.por_dia} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={dados.por_dia.length > 20 ? 2 : "20%"}>
                    <CartesianGrid vertical={false} stroke="#e7ebe5" />
                    <XAxis
                      dataKey="dia"
                      tickFormatter={(d) => dayjs(d).format(dados.por_dia.length > 10 ? "DD/MM" : "ddd DD")}
                      tick={{ fontSize: 11, fill: "#70806f" }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={12}
                    />
                    <YAxis
                      tickFormatter={(v) => `R$${v}`}
                      tick={{ fontSize: 11, fill: "#70806f" }}
                      axisLine={false}
                      tickLine={false}
                      width={56}
                    />
                    <Tooltip content={<DicaDia />} cursor={{ fill: "rgba(31,122,76,0.08)" }} />
                    <Bar dataKey="faturamento" fill={COR_BARRA} radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="rounded-[18px] border border-dashed border-[var(--color-border-strong)] p-10 text-center text-sm text-[var(--color-text-soft)]">
                Nenhuma venda no periodo.
              </div>
            )}
          </Painel>

          <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
            <Painel titulo="Horarios de pico" Icone={Clock} subtitulo="Cada quadrado e' um dia da semana × hora (horario de Brasilia). Mais escuro = mais movimento.">
              <div className="mb-3 flex gap-1">
                {[
                  ["faturamento", "Faturamento"],
                  ["vendas", "Vendas"],
                ].map(([chave, texto]) => (
                  <button
                    key={chave}
                    type="button"
                    onClick={() => setMetricaGrade(chave)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      metricaGrade === chave ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-bg-muted)] text-[var(--color-text-soft)]"
                    }`}
                  >
                    {texto}
                  </button>
                ))}
              </div>
              <GradeHorarios grade={dados.grade} metrica={metricaGrade} />
            </Painel>

            <Painel titulo="Formas de pagamento" Icone={Receipt}>
              {dados.por_metodo.length ? (
                <ul className="space-y-3">
                  {dados.por_metodo.map((m) => (
                    <li key={m.metodo}>
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="font-semibold text-[var(--color-text)]">{METODOS[m.metodo] || m.metodo}</span>
                        <span className="text-[var(--color-text)]">
                          {formatarValor(m.valor)} <span className="text-xs text-[var(--color-text-soft)]">· {m.vendas}</span>
                        </span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--color-bg-muted)]">
                        <div className="h-full rounded-full" style={{ width: `${totalMetodos ? (100 * m.valor) / totalMetodos : 0}%`, background: COR_BARRA }} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[var(--color-text-soft)]">Nenhuma venda no periodo.</p>
              )}
            </Painel>
          </div>

          <Painel titulo="Ranking de carregadores" Icone={Trophy}>
            <div className="mb-3 flex flex-wrap gap-1">
              {[
                ["faturamento", "Faturamento"],
                ["recargas", "Recargas"],
                ["energia_kwh", "Energia"],
                ["ocupacao_pct", "Ocupacao"],
                ["quedas", "Quedas"],
              ].map(([chave, texto]) => (
                <button
                  key={chave}
                  type="button"
                  onClick={() => setOrdemRanking(chave)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    ordemRanking === chave ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-bg-muted)] text-[var(--color-text-soft)]"
                  }`}
                >
                  {texto}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-soft)]">
                  <tr>
                    <th className="w-10 px-2 py-2">#</th>
                    <th className="px-2 py-2">Carregador</th>
                    <th className="w-[26%] px-2 py-2" />
                    <th className="px-2 py-2 text-right">Faturamento</th>
                    <th className="px-2 py-2 text-right">Recargas</th>
                    <th className="px-2 py-2 text-right">Energia</th>
                    <th className="px-2 py-2 text-right">Ocupacao</th>
                    <th className="px-2 py-2 text-right">Quedas</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((r, i) => (
                    <tr key={r.id_hardware} className="border-t border-[var(--color-border)]">
                      <td className="px-2 py-2.5 font-extrabold text-[var(--color-text-soft)]">{i + 1}</td>
                      <td className="px-2 py-2.5">
                        <Link to={`/carregadores/${encodeURIComponent(r.id_hardware)}`} className="font-bold text-[var(--color-primary-strong)]">
                          {r.nome_local}
                        </Link>
                        <div className="text-[11px] text-[var(--color-text-soft)]">{r.cliente_nome || r.id_hardware}</div>
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg-muted)]">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${maiorRanking ? (100 * r[ordemRanking]) / maiorRanking : 0}%`,
                              background: ordemRanking === "quedas" ? "#b64545" : COR_BARRA,
                            }}
                          />
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-right font-bold">
                        {formatarValor(r.faturamento)}
                        <div className="text-[11px] font-normal text-[var(--color-text-soft)]">{r.vendas} venda(s)</div>
                      </td>
                      <td className="px-2 py-2.5 text-right">{r.recargas}</td>
                      <td className="px-2 py-2.5 text-right">{formatarKwh(r.energia_kwh)}</td>
                      <td className="px-2 py-2.5 text-right">{r.ocupacao_pct.toLocaleString("pt-BR")}%</td>
                      <td className={`px-2 py-2.5 text-right ${r.quedas ? "font-semibold text-[var(--color-error)]" : ""}`}>{r.quedas}</td>
                    </tr>
                  ))}
                  {ranking.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-2 py-8 text-center text-[var(--color-text-soft)]">
                        Nenhum carregador.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-[var(--color-text-soft)]">
              <Zap size={11} className="inline" /> Ocupacao = tempo com recarga aberta dividido pelo tempo do periodo.
            </p>
          </Painel>
        </>
      )}
    </div>
  );
}
