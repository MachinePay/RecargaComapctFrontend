// Aba Conta do motorista: entrar/criar conta ou ver a conta e sair.
import { Link } from "react-router-dom";
import { History, LogOut, ShieldCheck, Smartphone } from "lucide-react";
import AvisoInstalar from "./AvisoInstalar";
import FormConta from "./FormConta";
import { mascaraCelular, sairDaConta, useConta } from "./conta";
import { Logo, NavMotorista } from "./ui";

const VANTAGENS = [
  { icone: History, texto: "Seu historico de recargas em qualquer celular" },
  { icone: Smartphone, texto: "Trocou de celular? Entre e esta tudo la" },
  { icone: ShieldCheck, texto: "Opcional: da para pagar sem conta" },
];

export default function PaginaConta() {
  const conta = useConta();
  const motorista = conta?.motorista;

  return (
    <div className="mt-app">
      <div className="mx-auto max-w-[480px] px-4 pb-32 pt-4">
        <header className="flex items-center justify-between">
          <Logo />
        </header>

        {motorista ? (
          <section className="mt-entrar mt-8">
            <div className="flex items-center gap-4">
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-[22px] bg-[var(--mt-accent)] text-[26px] font-extrabold text-[var(--mt-accent-ink)]">
                {motorista.nome.trim()[0]?.toUpperCase()}
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-[26px] font-extrabold leading-tight tracking-[-0.03em]">Ola, {motorista.nome.split(" ")[0]}!</h1>
                <p className="mt-num text-[15px] font-semibold text-[var(--mt-text-soft)]">{mascaraCelular(motorista.telefone)}</p>
              </div>
            </div>

            <Link to="/app/historico" className="mt-card mt-6 flex items-center gap-3 p-4">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--mt-accent)]/15 text-[var(--mt-accent)]">
                <History size={20} />
              </span>
              <span className="flex-1">
                <span className="block text-[15px] font-extrabold">Minhas recargas</span>
                <span className="block text-[12.5px] font-semibold text-[var(--mt-text-soft)]">Energia, valores e tempo de todas as recargas</span>
              </span>
            </Link>

            <AvisoInstalar className="mt-3" />

            <button type="button" onClick={sairDaConta} className="mt-btn mt-btn--fantasma mt-6 w-full py-3.5 text-[15px]">
              <LogOut size={17} /> Sair da conta
            </button>
          </section>
        ) : (
          <section className="mt-entrar mt-8">
            <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.04em]">Entre na sua conta</h1>
            <p className="mt-1.5 text-[14px] font-semibold text-[var(--mt-text-soft)]">So o seu celular e uma senha.</p>
            <ul className="mt-5 space-y-2">
              {VANTAGENS.map((v) => (
                <li key={v.texto} className="flex items-center gap-2.5 text-[13.5px] font-semibold text-[var(--mt-text-soft)]">
                  <v.icone size={17} className="shrink-0 text-[var(--mt-accent)]" /> {v.texto}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <FormConta />
            </div>
          </section>
        )}

        <p className="mt-10 text-center text-[12.5px] font-semibold text-[var(--mt-text-faint)]">
          E dono de carregador?{" "}
          <Link to="/login" className="text-[var(--mt-text-soft)] underline underline-offset-4">
            Acesse o painel
          </Link>
        </p>
      </div>
      <NavMotorista />
    </div>
  );
}
