// Pecas de tela do app do motorista (selo de status, logo, navegacao).
import { NavLink } from "react-router-dom";
import { History, Map, Zap } from "lucide-react";
import { SITUACOES } from "./regras";
import "./motorista.css";

export function SeloSituacao({ situacao, children, className = "" }) {
  const s = SITUACOES[situacao] || SITUACOES.offline;
  return (
    <span className={`mt-chip ${className}`} style={{ color: s.cor, borderColor: `color-mix(in srgb, ${s.cor} 35%, transparent)` }}>
      <span className={`mt-ponto ${situacao === "livre" ? "mt-ponto--vivo" : ""}`} />
      {children || s.curto}
    </span>
  );
}

export function Logo({ className = "" }) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[var(--mt-accent)] text-[var(--mt-accent-ink)] shadow-[0_8px_24px_rgba(68,224,138,0.35)]">
        <Zap size={18} strokeWidth={2.6} fill="currentColor" />
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-extrabold tracking-[-0.02em]">CompactRecarga</span>
        <span className="block text-[11px] font-semibold text-[var(--mt-text-soft)]">Recarga de carro eletrico</span>
      </span>
    </span>
  );
}

export function NavMotorista() {
  const classe = ({ isActive }) => (isActive ? "ativo" : "");
  return (
    <nav className="mt-nav mt-glass">
      <NavLink to="/app" end className={classe}>
        <Map size={18} /> Mapa
      </NavLink>
      <NavLink to="/app/historico" className={classe}>
        <History size={18} /> Historico
      </NavLink>
    </nav>
  );
}

export function Esqueleto({ className = "" }) {
  return <div className={`mt-esqueleto ${className}`} />;
}
