import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <section className="app-panel max-w-xl rounded-[30px] p-8 text-center">
        <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--color-text-soft)]">404</div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-[var(--color-text)]">Pagina nao encontrada</h1>
        <Link to="/dashboard" className="pill-button pill-button--primary mt-6 inline-flex px-5 py-3 font-semibold">
          Voltar ao painel
        </Link>
      </section>
    </div>
  );
}
