import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BatteryCharging, PlugZap, Wallet, Zap } from "lucide-react";
import dayjs from "dayjs";

import api from "../api/axios";
import usePolling from "../hooks/usePolling";
import LoadingSpinner from "../components/LoadingSpinner";
import { CartaoResumo, StatusCarregador } from "../components/CarregadorUi";
import { statusCarregador, textoConector } from "../utils/carregadores";
import { MOTIVOS_FIM, STATUS_SESSAO, formatarHora, formatarKwh, formatarRelogio, formatarValor } from "../utils/formatos";

// Tela para deixar aberta numa TV ou monitor (igual Ao Vivo da CompactPay).
export default function AoVivo() {
  const [resumo, setResumo] = useState(null);
  const [carregadores, setCarregadores] = useState([]);
  const [sessoes, setSessoes] = useState([]);
  const [agoraMs, setAgoraMs] = useState(() => Date.now());
  const [buscadoEm, setBuscadoEm] = useState(0);

  const carregar = useCallback(async () => {
    try {
      const [r, c, s] = await Promise.all([api.get("/admin/resumo"), api.get("/admin/carregadores"), api.get("/admin/sessoes", { params: { limite: 12 } })]);
      setBuscadoEm(Date.now());
      setResumo(r.data);
      setCarregadores(c.data);
      setSessoes(s.data);
    } catch {
      // Toast global
    }
  }, []);

  usePolling(carregar, 5000, true, { imediato: true });

  // Relogio e contagem regressiva andam a cada segundo entre as buscas.
  useEffect(() => {
    const timer = window.setInterval(() => setAgoraMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!resumo) return <LoadingSpinner className="min-h-[60vh]" />;
  const decorrido = buscadoEm ? Math.max(0, Math.floor((agoraMs - buscadoEm) / 1000)) : 0;
  const ordenados = [...carregadores].sort((a, b) => Number(Boolean(b.sessao_ativa)) - Number(Boolean(a.sessao_ativa)) || a.nome_local.localeCompare(b.nome_local));

  return (
    <div className="space-y-4 p-2 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-[var(--color-text-soft)]">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--color-error)]" /> Ao vivo
          </div>
          <div className="mt-1 text-5xl font-extrabold tabular-nums tracking-[-0.04em] text-[var(--color-text)] md:text-6xl">{dayjs(agoraMs).format("HH:mm:ss")}</div>
          <div className="text-sm text-[var(--color-text-soft)]">{dayjs(agoraMs).format("dddd, DD/MM/YYYY")}</div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CartaoResumo rotulo="Faturamento hoje" valor={formatarValor(resumo.faturamento_hoje)} ajuda={`${resumo.vendas_hoje} venda(s)`} Icone={Wallet} destaque />
        <CartaoResumo rotulo="Carregando agora" valor={resumo.sessoes_ativas} ajuda="recargas em andamento" Icone={BatteryCharging} />
        <CartaoResumo rotulo="Online" valor={`${resumo.carregadores_online}/${resumo.carregadores_total}`} ajuda="carregadores conectados" Icone={PlugZap} />
        <CartaoResumo rotulo="Energia hoje" valor={formatarKwh(resumo.energia_hoje_kwh)} ajuda="entregue nos carros" Icone={Zap} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {ordenados.map((c) => {
            const sessao = c.sessao_ativa;
            const restante = sessao?.segundos_restantes != null ? Math.max(0, sessao.segundos_restantes - decorrido) : null;
            const total = sessao?.minutos_pagos ? sessao.minutos_pagos * 60 : null;
            return (
              <Link
                key={c.id_hardware}
                to={`/carregadores/${encodeURIComponent(c.id_hardware)}`}
                className={`block rounded-[24px] border p-4 transition hover:-translate-y-0.5 ${sessao ? "border-blue-200 bg-[linear-gradient(135deg,#eff6ff_0%,#dbeafe_100%)]" : "app-panel"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-extrabold text-[var(--color-text)]">{c.nome_local}</div>
                    <div className="truncate text-[11px] text-[var(--color-text-soft)]">{c.cliente_nome || c.id_hardware}</div>
                  </div>
                  <StatusCarregador status={statusCarregador(c)} />
                </div>
                {sessao ? (
                  <>
                    <div className="mt-3 text-4xl font-extrabold tabular-nums text-blue-700">{restante != null ? formatarRelogio(restante) : "--:--"}</div>
                    <div className="text-xs text-[var(--color-text-soft)]">
                      {STATUS_SESSAO[sessao.status]?.texto || sessao.status} · {formatarKwh(sessao.energia_kwh)}
                    </div>
                    {total && restante != null ? (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/70">
                        <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${Math.min(100, (100 * (total - restante)) / total)}%` }} />
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="mt-3 text-sm text-[var(--color-text-soft)]">
                    {c.online ? textoConector(c) : "Sem conexao"} · hoje {formatarValor(c.faturamento_hoje)}
                  </div>
                )}
              </Link>
            );
          })}
        </div>

        <section className="app-panel p-4">
          <h2 className="mb-2 text-lg font-extrabold text-[var(--color-text)]">Ultimas recargas</h2>
          <ul>
            {sessoes.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] py-2 first:border-0 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-[var(--color-text)]">{carregadores.find((c) => c.id_hardware === s.carregador_id)?.nome_local || s.carregador_id}</div>
                  <div className="truncate text-[11px] text-[var(--color-text-soft)]">
                    {formatarHora(s.inicio || s.created_at)} · {s.minutos_pagos} min · {STATUS_SESSAO[s.status]?.texto || s.status}
                    {s.motivo_fim ? ` · ${MOTIVOS_FIM[s.motivo_fim] || s.motivo_fim}` : ""}
                  </div>
                </div>
                <div className="shrink-0 font-bold text-[var(--color-text)]">{s.valor != null ? formatarValor(s.valor) : "-"}</div>
              </li>
            ))}
            {sessoes.length === 0 ? <li className="py-6 text-center text-sm text-[var(--color-text-soft)]">Nenhuma recarga ainda.</li> : null}
          </ul>
        </section>
      </div>
    </div>
  );
}
