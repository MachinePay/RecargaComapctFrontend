import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, BatteryCharging, PlugZap, Wallet, Zap } from "lucide-react";

import api from "../api/axios";
import usePolling from "../hooks/usePolling";
import Badge from "../components/Badge";
import Cabecalho from "../components/Cabecalho";
import LoadingSpinner from "../components/LoadingSpinner";
import { STATUS_SESSAO, formatarKwh, formatarRelogio, formatarValor } from "../utils/formatos";

function Indicador({ icone, titulo, valor, detalhe, alerta }) {
  return (
    <div className="app-panel p-5">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
            alerta ? "bg-rose-50 text-[var(--color-error)]" : "bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]"
          }`}
        >
          {icone}
        </div>
        <div className="text-sm font-semibold text-[var(--color-text-soft)]">{titulo}</div>
      </div>
      <div className="mt-4 text-3xl font-extrabold tracking-[-0.03em] text-[var(--color-text)]">{valor}</div>
      {detalhe ? <div className="mt-1 text-sm text-[var(--color-text-soft)]">{detalhe}</div> : null}
    </div>
  );
}

export default function Dashboard() {
  const [resumo, setResumo] = useState(null);
  const [carregadores, setCarregadores] = useState([]);

  const carregar = useCallback(async () => {
    try {
      const [r, c] = await Promise.all([api.get("/admin/resumo"), api.get("/admin/carregadores")]);
      setResumo(r.data);
      setCarregadores(c.data);
    } catch {
      // Toast global
    }
  }, []);

  usePolling(carregar, 5000, true, { imediato: true });

  if (!resumo) return <LoadingSpinner className="min-h-[60vh]" />;

  return (
    <div className="space-y-5 p-2 sm:p-4">
      <Cabecalho etiqueta="Visao geral" titulo="Dashboard" descricao="Atualiza sozinho a cada 5 segundos." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          icone={<PlugZap size={20} />}
          titulo="Carregadores online"
          valor={`${resumo.carregadores_online} / ${resumo.carregadores_total}`}
          alerta={resumo.carregadores_online < resumo.carregadores_total}
        />
        <Indicador icone={<BatteryCharging size={20} />} titulo="Recargas agora" valor={resumo.sessoes_ativas} />
        <Indicador
          icone={<Wallet size={20} />}
          titulo="Faturamento hoje"
          valor={formatarValor(resumo.faturamento_hoje)}
          detalhe={`${resumo.vendas_hoje} vendas`}
        />
        <Indicador icone={<Zap size={20} />} titulo="Energia hoje" valor={formatarKwh(resumo.energia_hoje_kwh)} />
      </div>

      {resumo.estornos_pendentes > 0 ? (
        <div className="app-panel flex items-center gap-3 border-rose-200 bg-rose-50 p-4 text-[var(--color-error)]">
          <AlertTriangle size={20} />
          <span className="text-sm font-semibold">
            {resumo.estornos_pendentes} estorno(s) falharam e precisam ser feitos manualmente no Mercado Pago. Veja em Recargas.
          </span>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {carregadores.map((c) => {
          const sessao = c.sessao_ativa;
          const status = sessao ? STATUS_SESSAO[sessao.status] : null;
          return (
            <Link key={c.id_hardware} to={`/carregadores/${encodeURIComponent(c.id_hardware)}`} className="app-panel block p-5 transition hover:-translate-y-0.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-extrabold text-[var(--color-text)]">{c.nome_local}</div>
                  <div className="text-sm text-[var(--color-text-soft)]">{c.id_hardware}</div>
                </div>
                <Badge tom={c.online ? "ok" : "erro"}>{c.online ? "Online" : "Offline"}</Badge>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-soft)]">
                Conector: <Badge tom={c.erro_conector ? "erro" : "neutro"}>{c.status_conector || "-"}</Badge>
                {c.erro_conector ? <span className="text-[var(--color-error)]">{c.erro_conector}</span> : null}
              </div>
              {sessao ? (
                <div className="mt-4 flex items-center justify-between rounded-[20px] bg-[var(--color-bg-muted)] px-4 py-3">
                  <Badge tom={status?.tom}>{status?.texto || sessao.status}</Badge>
                  <span className="text-xl font-extrabold tabular-nums text-[var(--color-primary-strong)]">
                    {sessao.segundos_restantes != null ? formatarRelogio(sessao.segundos_restantes) : `${sessao.minutos_pagos} min`}
                  </span>
                </div>
              ) : null}
            </Link>
          );
        })}
        {carregadores.length === 0 ? (
          <div className="app-panel p-6 text-sm text-[var(--color-text-soft)]">
            Nenhum carregador cadastrado. <Link to="/carregadores" className="font-semibold text-[var(--color-primary)]">Cadastrar agora</Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
