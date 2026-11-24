// Entrar / criar conta do motorista. Entra com celular OU e-mail + senha;
// a conta nova pede os dois. Usado na aba Conta e antes de pagar.
import { useState } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { guardarConta, mascaraCelular } from "./conta";
import { apiPublica, dispositivo, mensagemErro } from "./servicos";

const campo =
  "w-full rounded-2xl border border-[var(--mt-border-strong)] bg-[var(--mt-surface-soft)] px-4 py-3 text-[16px] font-semibold text-[var(--mt-text)] outline-none transition placeholder:text-[var(--mt-text-faint)] focus:border-[var(--mt-accent)]";

export default function FormConta({ onPronto, modoInicial = "entrar" }) {
  const [modo, setModo] = useState(modoInicial);
  const [nome, setNome] = useState("");
  const [celular, setCelular] = useState("");
  const [email, setEmail] = useState("");
  // Entrar: um campo so, celular ou e-mail.
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [manter, setManter] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const criando = modo === "criar";

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setErro("");
    try {
      const corpo = criando
        ? { nome, telefone: celular, email, senha, dispositivo: dispositivo() }
        : { login, senha, dispositivo: dispositivo() };
      const { data } = await apiPublica.post(criando ? "/conta" : "/entrar", corpo);
      guardarConta(data, manter);
      onPronto?.(data.motorista);
    } catch (falha) {
      setErro(mensagemErro(falha));
      if (falha.response?.status === 409 && criando) setModo("entrar");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} className="space-y-3">
      <div className="grid grid-cols-2 rounded-full border border-[var(--mt-border)] bg-[var(--mt-surface-soft)] p-1 text-[13px] font-bold">
        {[
          ["entrar", "Ja tenho conta"],
          ["criar", "Criar conta"],
        ].map(([valor, texto]) => (
          <button
            key={valor}
            type="button"
            onClick={() => {
              setModo(valor);
              setErro("");
            }}
            className={`rounded-full py-2 transition ${modo === valor ? "bg-[var(--mt-text)] text-[var(--mt-bg)]" : "text-[var(--mt-text-soft)]"}`}
          >
            {texto}
          </button>
        ))}
      </div>

      {criando && (
        <input className={campo} placeholder="Seu nome" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} required minLength={2} />
      )}
      {criando ? (
        <>
          <input
            className={campo}
            placeholder="Celular com DDD"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            value={celular}
            onChange={(e) => setCelular(mascaraCelular(e.target.value))}
            required
          />
          <input
            className={campo}
            placeholder="Seu e-mail"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </>
      ) : (
        <input
          className={campo}
          placeholder="Celular ou e-mail"
          autoComplete="username"
          autoCapitalize="none"
          value={login}
          // Comecou com numero: formata como celular; com letra, e' e-mail.
          onChange={(e) => setLogin(/^[\d(]/.test(e.target.value) && !e.target.value.includes("@") ? mascaraCelular(e.target.value) : e.target.value)}
          required
        />
      )}
      <div className="relative">
        <input
          className={`${campo} pr-12`}
          placeholder={criando ? "Crie uma senha (min. 6)" : "Senha"}
          type={verSenha ? "text" : "password"}
          autoComplete={criando ? "new-password" : "current-password"}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
          minLength={criando ? 6 : 1}
        />
        <button
          type="button"
          onClick={() => setVerSenha((v) => !v)}
          aria-label={verSenha ? "Esconder senha" : "Mostrar senha"}
          className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center text-[var(--mt-text-soft)]"
        >
          {verSenha ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 px-1 text-[13px] font-semibold text-[var(--mt-text-soft)]">
        <input type="checkbox" checked={manter} onChange={(e) => setManter(e.target.checked)} className="h-[18px] w-[18px] accent-[var(--mt-accent)]" />
        Manter conectado neste celular
      </label>

      {erro && (
        <p className="rounded-2xl border border-[var(--mt-defeito)]/40 bg-[var(--mt-defeito)]/10 px-3 py-2.5 text-[13px] font-semibold text-[var(--mt-defeito)]">{erro}</p>
      )}

      <button type="submit" disabled={enviando} className="mt-btn mt-btn--primario w-full py-3.5 text-[16px]">
        {enviando && <LoaderCircle size={18} className="animate-spin" />}
        {criando ? "Criar minha conta" : "Entrar"}
      </button>
    </form>
  );
}
