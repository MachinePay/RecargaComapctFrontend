import { BarChart3, BatteryCharging, Building2, HeartPulse, Home, LogOut, Map, Menu, MessageCircle, PlugZap, Radio, Stethoscope, Users, WifiOff, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/useAuth";

export default function Sidebar() {
  const { logout, user, isAdmin } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const linkClassName = ({ isActive }) =>
    `flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
      isActive
        ? "bg-[linear-gradient(135deg,var(--color-primary-soft),#f6fbf8)] text-[var(--color-primary-strong)] shadow-[0_10px_30px_rgba(31,122,76,0.12)]"
        : "text-[var(--color-text-soft)] hover:bg-white hover:text-[var(--color-text)]"
    }`;

  const closeMobile = () => setMobileOpen(false);

  // Itens de administrador ficam escondidos para usuario de cliente.
  const itens = [
    { to: "/dashboard", Icone: Home, texto: "Dashboard", end: true },
    { to: "/ao-vivo", Icone: Radio, texto: "Ao vivo" },
    { to: "/gestao", Icone: BarChart3, texto: "Gestao" },
    { to: "/carregadores", Icone: PlugZap, texto: "Carregadores" },
    { to: "/mapa", Icone: Map, texto: "Mapa" },
    { to: "/saude", Icone: HeartPulse, texto: "Saude" },
    { to: "/quedas", Icone: WifiOff, texto: "Quedas" },
    { to: "/sessoes", Icone: BatteryCharging, texto: "Recargas" },
    { to: "/clientes", Icone: Building2, texto: "Clientes", admin: true },
    { to: "/usuarios", Icone: Users, texto: "Usuarios", admin: true },
    { to: "/whatsapp", Icone: MessageCircle, texto: "WhatsApp", admin: true },
    { to: "/diagnostico", Icone: Stethoscope, texto: "Diagnostico", admin: true },
  ].filter((item) => isAdmin || !item.admin);

  const navItems = (
    <ul className="space-y-1">
      {itens.map((item) => (
        <li key={item.to}>
          <NavLink to={item.to} end={item.end} className={linkClassName} onClick={closeMobile}>
            <item.Icone size={20} /> {item.texto}
          </NavLink>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--color-border)] bg-white/95 px-3 py-2 shadow-[0_8px_24px_rgba(34,61,43,0.08)] backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link to="/dashboard" className="flex min-w-0 items-center gap-2" onClick={closeMobile}>
            <img src="/logo-simbolo.png" alt="CompactRecarga" className="h-9 w-9 rounded-xl bg-white object-contain" />
            <div className="min-w-0">
              <div className="truncate text-sm font-extrabold text-[var(--color-text)]">
                Compact<span className="text-[#2f9e5b]">Recarga</span>
              </div>
              <div className="truncate text-[11px] font-medium text-[var(--color-text-soft)]">{user?.nome || "Administrador"}</div>
            </div>
          </Link>
          <button
            type="button"
            aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border)] bg-white text-[var(--color-text)]"
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 bg-black/28 lg:hidden" onClick={closeMobile}>
          <aside
            className="absolute bottom-0 right-0 top-[58px] flex w-[min(86vw,340px)] flex-col justify-between overflow-y-auto rounded-l-[22px] border-l border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-[0_20px_70px_rgba(0,0,0,0.22)]"
            onClick={(event) => event.stopPropagation()}
          >
            <nav>
              <div className="px-2 pb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-soft)]">
                Menu
              </div>
              {navItems}
            </nav>
            <button
              onClick={logout}
              className="mt-5 flex items-center justify-center gap-2 rounded-full border border-[var(--color-border)] bg-white/90 px-4 py-3 text-sm font-semibold text-[var(--color-text)]"
            >
              <LogOut size={18} /> Sair
            </button>
          </aside>
        </div>
      ) : null}

      <aside className="app-panel hidden w-[260px] flex-col justify-between gap-3 p-4 lg:sticky lg:top-5 lg:flex lg:h-[calc(100vh-2.5rem)] lg:overflow-y-auto">
        <div className="space-y-3 lg:space-y-5">
          <Link
            to="/dashboard"
            className="block rounded-[18px] bg-[linear-gradient(135deg,#ffffff_0%,#eff5ef_100%)] p-3 soft-ring lg:rounded-[24px] lg:p-5"
          >
            <div className="flex items-center gap-3">
              <img src="/logo-simbolo.png" alt="CompactRecarga" className="h-10 w-10 rounded-2xl bg-white object-contain lg:h-12 lg:w-12" />
              <div className="min-w-0">
                <div className="truncate text-base font-extrabold text-[var(--color-primary-strong)] lg:text-lg">
                  Compact<span className="text-[#2f9e5b]">Recarga</span>
                </div>
                <div className="truncate text-xs text-[var(--color-text-soft)] lg:text-sm">Recarga de veiculos</div>
              </div>
            </div>
          </Link>

          <nav>
            <div className="hidden px-3 pb-3 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-text-soft)] lg:block">
              Menu
            </div>
            {navItems}
          </nav>

          <div className="hidden rounded-[28px] bg-[radial-gradient(circle_at_top,_rgba(52,148,92,0.35),transparent_35%),linear-gradient(145deg,#07160d_0%,#10331f_55%,#15512f_100%)] p-5 text-white shadow-[0_18px_48px_rgba(19,51,31,0.34)] lg:block">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/12">
                <PlugZap size={20} />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{user?.nome || "Administrador"}</div>
                <div className="mt-0.5 inline-flex items-center rounded-full bg-white/12 px-2.5 py-0.5 text-[11px] font-medium text-white/80">
                  {isAdmin ? (user?.porChave ? "Admin (chave)" : "Administrador") : "Cliente"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          className="flex items-center justify-center gap-2 rounded-full border border-[var(--color-border)] bg-white/90 px-4 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:border-[var(--color-error)] hover:text-[var(--color-error)] lg:mt-5 lg:py-3 lg:text-base"
        >
          <LogOut /> Sair
        </button>
      </aside>
    </>
  );
}
