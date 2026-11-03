import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import api from "../api/axios";
import { useAuth } from "../context/useAuth";
import Button from "../components/Button";

function getSafeRedirect(search) {
  const redirect = new URLSearchParams(search).get("redirect");
  if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//")) return "";
  if (redirect.startsWith("/login")) return "";
  return redirect;
}

export default function Login() {
  const { login, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [chave, setChave] = useState("");
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);
  const redirectFromQuery = getSafeRedirect(location.search);
  const redirectFromState = location.state?.from?.pathname || "";
  const redirectTo = redirectFromQuery || redirectFromState || "/dashboard";

  useEffect(() => {
    if (user) navigate(redirectTo, { replace: true });
  }, [navigate, redirectTo, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEntrando(true);
    setErro("");
    try {
      // Confere a chave antes de guardar.
      await api.get("/admin/resumo", { headers: { "X-Admin-Key": chave }, silencioso: true });
      login(chave);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setErro(error?.response?.status === 401 ? "Chave de administrador invalida." : error.compactpayMessage);
    } finally {
      setEntrando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(219,237,224,0.95),transparent_34%),linear-gradient(145deg,#f5f6ef_0%,#edf0e8_52%,#e8ede4_100%)] p-4 md:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl gap-4 rounded-[36px] border border-white/70 bg-white/60 p-4 shadow-[0_30px_100px_rgba(44,66,49,0.14)] backdrop-blur-xl lg:grid-cols-[1.12fr_0.88fr] lg:p-5">
        <section className="relative overflow-hidden rounded-[30px] bg-[radial-gradient(circle_at_top_left,_rgba(61,154,103,0.42),transparent_36%),linear-gradient(150deg,#082313_0%,#0f3a23_44%,#145634_100%)] p-8 text-white md:p-10">
          <div className="absolute right-[-80px] top-[-40px] h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute bottom-[-90px] left-[-40px] h-64 w-64 rounded-full bg-emerald-300/10 blur-2xl" />
          <div className="relative flex h-full flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-3 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm text-white/80">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/18 font-bold">C</span>
                CompactPay Recarga
              </div>
              <h1 className="mt-10 max-w-md text-4xl font-extrabold leading-tight tracking-[-0.04em] text-white md:text-6xl">
                Recarga por tempo, sem ninguem no posto.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-white/74 md:text-lg">
                O motorista paga na maquininha, o carregador liga sozinho e desliga quando o tempo acaba.
              </p>
            </div>

            <div className="grid gap-3 pt-12 md:grid-cols-3">
              <div className="rounded-[24px] border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
                <div className="text-3xl font-bold">OCPP</div>
                <div className="mt-1 text-sm text-white/70">liga e desliga o wallbox a distancia</div>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
                <div className="text-3xl font-bold">Point</div>
                <div className="mt-1 text-sm text-white/70">credito, debito e Pix na maquininha</div>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
                <div className="text-3xl font-bold">Live</div>
                <div className="mt-1 text-sm text-white/70">recargas e energia em tempo real</div>
              </div>
            </div>
          </div>
        </section>

        <section className="app-panel flex items-center justify-center rounded-[30px] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(245,248,242,0.96))] p-6 md:p-10">
          <form onSubmit={handleSubmit} className="w-full max-w-md">
            <div className="mb-8">
              <div className="text-sm font-semibold uppercase tracking-[0.26em] text-[var(--color-text-soft)]">
                Acesso seguro
              </div>
              <h2 className="mt-3 text-4xl font-extrabold tracking-[-0.04em] text-[var(--color-text)]">Entrar no painel</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--color-text-soft)]">
                Use a chave de administrador (ADMIN_API_KEY do backend).
              </p>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">Chave de administrador</span>
              <input
                className="w-full rounded-[20px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:shadow-[0_0_0_4px_rgba(31,122,76,0.10)]"
                type="password"
                placeholder="Digite a chave"
                value={chave}
                onChange={(e) => setChave(e.target.value)}
                required
              />
            </label>
            {erro ? <div className="mt-3 text-sm font-semibold text-[var(--color-error)]">{erro}</div> : null}

            <Button type="submit" className="mt-6 w-full justify-center" disabled={entrando}>
              {entrando ? "Entrando..." : "Entrar no painel"}
            </Button>

            <div className="mt-6 rounded-[22px] bg-[var(--color-bg-muted)] px-4 py-4 text-sm leading-6 text-[var(--color-text-soft)]">
              A tela do motorista fica em <strong>/totem</strong> e nao precisa desta chave.
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
