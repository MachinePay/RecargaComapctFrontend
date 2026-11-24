// Aba Conta do motorista: entrar/criar conta ou ver a conta e sair.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { History, LogOut, ShieldCheck, Smartphone, Wallet } from "lucide-react";
import { formatarValor } from "../utils/formatos";
import AvisoInstalar from "./AvisoInstalar";
import FormConta from "./FormConta";
import { atualizarMotorista, mascaraCelular, sairDaConta, useConta } from "./conta";
import { apiPublica, conferirConta, mensagemErro } from "./servicos";
import { Logo, NavMotorista } from "./ui";

const VANTAGENS = [
  { icone: History, texto: "Seu historico de recargas em qualquer celular" },
  { icone: Smartphone, texto: "Trocou de celular? Entre e esta tudo la" },
  { icone: ShieldCheck, texto: "Opcional: da para pagar sem conta" },
];

export default function PaginaConta() {
  const conta = useConta();
  const motorista = conta?.motorista;
  // Saldo da carteira atualizado ao abrir a tela.
  useEffect(() => {
    conferirConta(true);
  }, []);

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
                {motorista.email && <p className="truncate text-[13px] font-semibold text-[var(--mt-text-faint)]">{motorista.email}</p>}
              </div>
            </div>

            {!motorista.email && <CadastrarEmail />}

            {motorista.saldo > 0 && (
            <Link to="/app/carteira" className="mt-card mt-6 flex items-center gap-3 p-4">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--mt-accent)]/15 text-[var(--mt-accent)]">
                <Wallet size={20} />
              </span>
              <span className="flex-1">
                <span className="block text-[15px] font-extrabold">Saldo antigo: {formatarValor(motorista.saldo)}</span>
                <span className="block text-[12.5px] font-semibold text-[var(--mt-text-soft)]">
                  A carteira foi desativada. Fale com o atendimento para receber de volta.
                </span>
              </span>
            </Link>
            )}

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
            <p className="mt-1.5 text-[14px] font-semibold text-[var(--mt-text-soft)]">Entre com o celular ou o e-mail e a sua senha.</p>
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


// Conta antiga (so celular): cadastra o e-mail para tambem entrar com ele.
function CadastrarEmail() {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const salvar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setErro("");
    try {
      const { data } = await apiPublica.patch("/eu", { email });
      atualizarMotorista(data);
    } catch (falha) {
      setErro(mensagemErro(falha));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={salvar} className="mt-card mt-6 space-y-2.5 p-4">
      <p className="text-[15px] font-extrabold">Cadastre seu e-mail</p>
      <p className="text-[12.5px] font-semibold text-[var(--mt-text-soft)]">Assim voce tambem entra com o e-mail, alem do celular.</p>
      <input
        className="w-full rounded-2xl border border-[var(--mt-border-strong)] bg-[var(--mt-surface-soft)] px-4 py-3 text-[16px] font-semibold outline-none focus:border-[var(--mt-accent)]"
        type="email"
        placeholder="Seu e-mail"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      {erro && <p className="text-[13px] font-semibold text-[var(--mt-defeito)]">{erro}</p>}
      <button type="submit" disabled={enviando} className="mt-btn mt-btn--primario w-full py-3">
        {enviando ? "Salvando..." : "Salvar e-mail"}
      </button>
    </form>
  );
}
