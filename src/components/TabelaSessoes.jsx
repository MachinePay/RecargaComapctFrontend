import { Link } from "react-router-dom";

import Badge from "./Badge";
import { MOTIVOS_FIM, STATUS_SESSAO, formatarDataHora, formatarKwh, formatarValor } from "../utils/formatos";

const ATIVAS = ["aguardando_inicio", "aguardando_carro", "carregando", "encerrando"];

export default function TabelaSessoes({ sessoes, mostrarCarregador = true, onEncerrar, onEstornar }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-soft)]">
          <tr>
            <th className="px-4 py-3">#</th>
            {mostrarCarregador ? <th className="px-4 py-3">Carregador</th> : null}
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Tempo pago</th>
            <th className="px-4 py-3">Valor</th>
            <th className="px-4 py-3">Inicio</th>
            <th className="px-4 py-3">Fim</th>
            <th className="px-4 py-3">Energia</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {sessoes.map((s) => {
            const status = STATUS_SESSAO[s.status] || { texto: s.status, tom: "neutro" };
            return (
              <tr key={s.id} className="border-t border-[var(--color-border)] align-top hover:bg-white/70">
                <td className="px-4 py-3 font-semibold">{s.id}</td>
                {mostrarCarregador ? (
                  <td className="px-4 py-3">
                    <Link to={`/carregadores/${encodeURIComponent(s.carregador_id)}`} className="font-semibold text-[var(--color-primary-strong)]">
                      {s.carregador_id}
                    </Link>
                  </td>
                ) : null}
                <td className="px-4 py-3">
                  <Badge tom={status.tom}>{status.texto}</Badge>
                  {s.motivo_fim ? (
                    <div className="mt-1 text-xs text-[var(--color-text-soft)]">{MOTIVOS_FIM[s.motivo_fim] || s.motivo_fim}</div>
                  ) : null}
                </td>
                <td className="px-4 py-3">{s.minutos_pagos ? `${s.minutos_pagos} min` : "Livre (RFID)"}</td>
                <td className="px-4 py-3">
                  {s.valor != null ? formatarValor(s.valor) : "-"}
                  <div className="text-xs text-[var(--color-text-soft)]">{s.metodo || s.origem || ""}</div>
                  {s.estornada ? <Badge tom="aviso">Estornado</Badge> : null}
                  {s.estorno_erro ? <Badge tom="erro">Estorno falhou</Badge> : null}
                </td>
                <td className="px-4 py-3 text-[var(--color-text-soft)]">{formatarDataHora(s.inicio || s.created_at)}</td>
                <td className="px-4 py-3 text-[var(--color-text-soft)]">{formatarDataHora(s.fim_real || s.fim_previsto)}</td>
                <td className="px-4 py-3">{formatarKwh(s.energia_kwh)}</td>
                <td className="px-4 py-3 text-right">
                  {onEncerrar && ATIVAS.includes(s.status) ? (
                    <button
                      type="button"
                      onClick={() => onEncerrar(s)}
                      className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-[var(--color-error)] hover:bg-rose-100"
                    >
                      Encerrar
                    </button>
                  ) : null}
                  {onEstornar && !ATIVAS.includes(s.status) && s.valor > 0 && !s.estornada ? (
                    <button
                      type="button"
                      onClick={() => onEstornar(s)}
                      className="rounded-full border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:border-amber-300 hover:bg-amber-50"
                    >
                      Estornar
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
          {sessoes.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-[var(--color-text-soft)]">
                Nenhuma recarga ainda.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
