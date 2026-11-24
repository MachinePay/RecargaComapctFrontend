// Carteira do motorista: saldo e extrato (o que entrou e saiu, recarga a recarga).
import { useCallback, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, Info, LoaderCircle, Wallet } from "lucide-react";
import usePolling from "../hooks/usePolling";
import { formatarValor } from "../utils/formatos";
import { apiPublica, mensagemErro } from "./servicos";
import { useConta } from "./conta";
import { Logo, NavMotorista } from "./ui";

const TIPOS = {
  reserva: "Usado numa recarga",
  sobra: "Sobra de recarga",
  devolucao: "Devolvido",
  ajuste: "Ajuste do atendimento",
};

const data = (valor) => (valor ? new Date(`${String(valor).replace(" ", "T")}Z`) : null);

export default function PaginaCarteira() {
  const conta = useConta();
  const [dados, setDados] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    try {
      const { data: resposta } = await apiPublica.get("/carteira", { params: { pagina } });
      setDados(resposta);
      setErro("");
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }, [pagina]);

  usePolling(carregar, 15000, Boolean(conta), { imediato: true });

  if (!conta) return <Navigate to="/app/conta" replace />;

  return (
    <div className="mt-app">
      <div className="mx-auto max-w-[480px] px-4 pb-32 pt-4">
        <header className="flex items-center justify-between">
          <Logo />
          <Link to="/app/conta" className="mt-btn mt-btn--fantasma h-10 px-3.5 text-[13px]">
            <ChevronLeft size={15} /> Conta
          </Link>
        </header>

        <section className="mt-entrar mt-6 rounded-[28px] border border-[var(--mt-border)] bg-[linear-gradient(160deg,#14241d,#0c1512)] p-5">
          <p className="flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-[0.14em] text-[var(--mt-text-soft)]">
            <Wallet size={15} className="text-[var(--mt-accent)]" /> Sua carteira
          </p>
          <p className="mt-num mt-brilho mt-2 text-[48px] font-bold leading-none text-[var(--mt-accent)]">
            {dados ? formatarValor(dados.saldo) : <LoaderCircle size={28} className="animate-spin" />}
          </p>
          <p className="mt-3 flex gap-2 text-[12.5px] font-semibold leading-snug text-[var(--mt-text-soft)]">
            <Info size={15} className="mt-0.5 shrink-0 text-[var(--mt-accent)]" />
            <span>
              Quando a recarga termina, cobramos so a energia que o carro usou. O que sobra fica aqui e e' usado sozinho na proxima recarga, em
              qualquer carregador. O saldo nao e' sacado.
            </span>
          </p>
        </section>

        {erro && <p className="mt-4 text-center text-[13px] font-semibold text-[var(--mt-defeito)]">{erro}</p>}

        <h2 className="mt-7 text-[13px] font-extrabold uppercase tracking-[0.12em] text-[var(--mt-text-soft)]">Extrato</h2>
        <ul className="mt-3 space-y-2">
          {dados?.itens.map((m) => {
            const entrou = m.valor > 0;
            const quando = data(m.created_at);
            return (
              <li key={m.id} className="mt-card flex items-center gap-3 p-3.5">
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${
                    entrou ? "bg-[var(--mt-accent)]/15 text-[var(--mt-accent)]" : "bg-[var(--mt-surface-soft)] text-[var(--mt-text-soft)]"
                  }`}
                >
                  {entrou ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-extrabold">{TIPOS[m.tipo] || m.tipo}</span>
                  <span className="block truncate text-[12px] font-semibold text-[var(--mt-text-soft)]">
                    {quando ? quando.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}
                    {m.cobranca_id ? ` · recarga #${m.cobranca_id}` : ""}
                  </span>
                </span>
                <span className="text-right">
                  <span className={`mt-num block text-[15px] font-bold ${entrou ? "text-[var(--mt-accent)]" : ""}`}>
                    {entrou ? "+" : "-"} {formatarValor(Math.abs(m.valor))}
                  </span>
                  <span className="block text-[11px] font-semibold text-[var(--mt-text-faint)]">saldo {formatarValor(m.saldo_apos)}</span>
                </span>
              </li>
            );
          })}
          {dados && dados.itens.length === 0 && (
            <li className="mt-card p-5 text-center text-[13px] font-semibold text-[var(--mt-text-soft)]">
              Ainda nada por aqui. A sobra das suas recargas aparece aqui.
            </li>
          )}
        </ul>

        {dados && dados.paginas > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <button type="button" onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina <= 1} className="mt-btn mt-btn--fantasma px-4 py-2 text-[13px]">
              Anteriores
            </button>
            <span className="text-[12px] font-bold text-[var(--mt-text-soft)]">
              {pagina} de {dados.paginas}
            </span>
            <button
              type="button"
              onClick={() => setPagina((p) => Math.min(dados.paginas, p + 1))}
              disabled={pagina >= dados.paginas}
              className="mt-btn mt-btn--fantasma px-4 py-2 text-[13px]"
            >
              Mais antigos
            </button>
          </div>
        )}
      </div>
      <NavMotorista />
    </div>
  );
}
