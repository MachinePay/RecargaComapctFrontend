// Pecas visuais dos carregadores, no mesmo desenho da CompactPay
// (MachineStatusBadge, WifiSignal, SummaryCard, InfoPill).
import { ArrowDown, ArrowUp, ArrowUpDown, BatteryCharging, CircleCheck, CircleX, TriangleAlert, Wifi, WifiOff } from "lucide-react";

import { STATUS_CARREGADOR, qualidadeConexao } from "../utils/carregadores";

const TONS_STATUS = {
  online: { classe: "bg-[var(--color-primary-soft)] text-[var(--color-success)]", Icone: CircleCheck },
  carregando: { classe: "bg-blue-50 text-blue-700", Icone: BatteryCharging },
  defeito: { classe: "bg-amber-50 text-[var(--color-warning)]", Icone: TriangleAlert },
  offline: { classe: "bg-rose-50 text-[var(--color-error)]", Icone: CircleX },
};

export function StatusCarregador({ status }) {
  const { classe, Icone } = TONS_STATUS[status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${classe}`}>
      <Icone size={14} />
      {STATUS_CARREGADOR[status].texto}
    </span>
  );
}

export function BarraConexao({ carregador, compacto = false }) {
  const meta = qualidadeConexao(carregador);
  const Icone = carregador.online ? Wifi : WifiOff;
  return (
    <div className="min-w-0">
      <div className={`flex items-center gap-1.5 text-xs font-bold ${meta.cor}`}>
        <Icone size={compacto ? 14 : 16} className="shrink-0" />
        <span className="truncate">{meta.texto}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full transition-all ${meta.barra}`} style={{ width: meta.largura }} />
      </div>
    </div>
  );
}

export function CartaoResumo({ rotulo, valor, ajuda, Icone, destaque = false }) {
  return (
    <div
      className={`rounded-[24px] p-4 ${
        destaque
          ? "bg-[linear-gradient(135deg,#1f7a4c_0%,#145233_100%)] text-white shadow-[0_16px_40px_rgba(31,122,76,0.28)]"
          : "app-panel"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`text-xs font-semibold uppercase tracking-[0.14em] ${destaque ? "text-white/75" : "text-[var(--color-text-soft)]"}`}>{rotulo}</div>
        {Icone ? (
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${destaque ? "bg-white/15" : "bg-[var(--color-bg-muted)] text-[var(--color-primary-strong)]"}`}>
            <Icone size={18} />
          </div>
        ) : null}
      </div>
      <div className={`mt-1 text-3xl font-extrabold tracking-[-0.03em] ${destaque ? "" : "text-[var(--color-text)]"}`}>{valor}</div>
      {ajuda ? <div className={`mt-0.5 text-xs ${destaque ? "text-white/75" : "text-[var(--color-text-soft)]"}`}>{ajuda}</div> : null}
    </div>
  );
}

export function InfoPill({ rotulo, children }) {
  return (
    <div className="min-w-0 rounded-[14px] bg-[var(--color-bg-muted)] px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-soft)]">{rotulo}</div>
      <div className="truncate font-semibold text-[var(--color-text)]">{children}</div>
    </div>
  );
}

export function CabecalhoOrdenavel({ coluna, ordem, onOrdenar, children, className = "" }) {
  const ativa = ordem?.coluna === coluna;
  const Icone = !ativa ? ArrowUpDown : ordem.direcao === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={`px-3 py-2.5 ${className}`}>
      <button type="button" onClick={() => onOrdenar(coluna)} className="inline-flex items-center gap-1 uppercase hover:text-[var(--color-text)]">
        {children}
        <Icone size={12} className={ativa ? "" : "opacity-40"} />
      </button>
    </th>
  );
}
