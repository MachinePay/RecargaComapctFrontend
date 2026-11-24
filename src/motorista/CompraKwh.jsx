// Compra de energia (carregador por kWh) com a carteira do motorista.
// A tela mostra a conta inteira antes de pagar: energia, reserva, saldo
// usado e o que falta pagar. No fim da recarga cobramos so o usado e a sobra
// volta para a carteira.
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, Info, LoaderCircle, QrCode, Wallet, Zap } from "lucide-react";
import { formatarValor } from "../utils/formatos";
import { apiPublica, dispositivo, lembrarRecarga, mensagemErro } from "./servicos";
import { duracao, formatarKwhCurto, horaDaqui } from "./regras";
import { useConta } from "./conta";
import FormConta from "./FormConta";
import PagarCartao from "./PagarCartao";

export default function CompraKwh({ c, agora, onAtualizar }) {
  const conta = useConta();
  const navigate = useNavigate();
  const [kwh, setKwh] = useState(() => Math.min(Math.max(20, c.kwh_min), c.kwh_max));
  const [previa, setPrevia] = useState(null);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState("");
  const [cartaoAberto, setCartaoAberto] = useState(false);

  // A conta muda com os kWh e com o saldo: pergunta ao servidor (ele refaz igual na hora de pagar).
  useEffect(() => {
    if (!conta) return undefined;
    let ativo = true;
    const timer = window.setTimeout(async () => {
      try {
        const { data } = await apiPublica.post("/recarga/previa", { carregador_id: c.id, kwh });
        if (ativo) setPrevia(data);
      } catch (e) {
        if (ativo) setErro(mensagemErro(e));
      }
    }, 250);
    return () => {
      ativo = false;
      window.clearTimeout(timer);
    };
  }, [c.id, kwh, conta]);

  const pagar = useCallback(
    async (metodo, cartao) => {
      const { data } = await apiPublica.post("/recarga", {
        carregador_id: c.id,
        kwh,
        metodo,
        dispositivo: dispositivo(),
        a_pagar: previa?.a_pagar,
        cartao,
      });
      lembrarRecarga(data.id);
      navigate(`/app/recarga/${data.id}`, { replace: true });
    },
    [c.id, kwh, previa, navigate],
  );

  const pagarCom = async (metodo) => {
    setEnviando(metodo);
    setErro("");
    try {
      await pagar(metodo);
    } catch (e) {
      setErro(mensagemErro(e));
      onAtualizar();
    } finally {
      setEnviando("");
    }
  };

  const pagarCartao = useCallback(
    async (dados) => {
      try {
        await pagar("cartao", dados);
      } catch (e) {
        throw new Error(mensagemErro(e));
      }
    },
    [pagar],
  );

  if (!conta) {
    return (
      <section className="mt-entrar mt-6 rounded-[28px] border border-[var(--mt-border)] bg-[var(--mt-surface-soft)] p-5">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--mt-accent)]/15 text-[var(--mt-accent)]">
          <Wallet size={22} />
        </span>
        <h2 className="mt-3 text-[22px] font-extrabold leading-tight tracking-[-0.03em]">Entre para recarregar aqui</h2>
        <p className="mt-1.5 text-[13.5px] font-semibold text-[var(--mt-text-soft)]">
          Este carregador cobra pela energia que o carro usa. Voce paga antes, cobramos so o que usar, e o que sobrar fica na sua carteira
          para a proxima recarga. Por isso precisa de uma conta (so celular e senha).
        </p>
        <div className="mt-5">
          <FormConta />
        </div>
      </section>
    );
  }

  const porcentagem = ((kwh - c.kwh_min) / Math.max(1, c.kwh_max - c.kwh_min)) * 100;
  const potenciaKw = c.potencia_media_kw || null;
  const segundosPrevistos = potenciaKw ? (kwh / potenciaKw) * 3600 : null;
  const aPagar = previa?.a_pagar ?? null;
  const pronto = previa && previa.kwh === kwh;

  return (
    <>
      <section className="mt-entrar mt-6 rounded-[28px] border border-[var(--mt-border)] bg-[linear-gradient(160deg,#14241d,#0c1512)] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <p className="text-center text-[12px] font-extrabold uppercase tracking-[0.14em] text-[var(--mt-text-soft)]">Quanta energia?</p>
        <p className="mt-num mt-brilho mt-3 text-center text-[64px] font-bold leading-none text-[var(--mt-accent)]">{formatarKwhCurto(kwh)}</p>
        <p className="mt-2 text-center text-[12.5px] font-semibold text-[var(--mt-text-soft)]">{formatarValor(c.preco_kwh)} por kWh</p>
        {segundosPrevistos ? (
          <p className="mt-1 text-center text-[13px] font-bold text-[var(--mt-accent)]">
            Leva cerca de {duracao(segundosPrevistos)} · termina por volta das {horaDaqui(segundosPrevistos, agora)}
          </p>
        ) : null}

        <input
          type="range"
          min={c.kwh_min}
          max={c.kwh_max}
          step={1}
          value={kwh}
          onChange={(e) => setKwh(Number(e.target.value))}
          className="mt-faixa mt-6"
          style={{ "--p": `${porcentagem}%` }}
          aria-label="Energia da recarga"
        />
        <div className="mt-1.5 flex justify-between text-[11px] font-bold text-[var(--mt-text-faint)]">
          <span>{formatarKwhCurto(c.kwh_min)}</span>
          <span>{formatarKwhCurto(c.kwh_max)}</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {c.opcoes.map((o) => (
            <button
              key={o.kwh}
              type="button"
              onClick={() => setKwh(o.kwh)}
              className={`mt-num rounded-2xl border px-2 py-2.5 text-center text-[16px] font-bold transition active:scale-95 ${
                kwh === o.kwh ? "border-[var(--mt-accent)] bg-[var(--mt-accent)]/15" : "border-[var(--mt-border)] bg-[var(--mt-surface-soft)]"
              }`}
            >
              {formatarKwhCurto(o.kwh)}
            </button>
          ))}
        </div>
      </section>

      {/* A conta, linha por linha, para nao ter surpresa. */}
      <section className="mt-entrar mt-4 rounded-[24px] border border-[var(--mt-border)] bg-[var(--mt-surface-soft)] p-4">
        <p className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-[var(--mt-text-soft)]">Sua conta</p>
        {previa ? (
          <dl className="mt-3 space-y-2 text-[14px] font-semibold">
            <Linha rotulo={`Energia (${formatarKwhCurto(previa.kwh)})`} valor={formatarValor(previa.custo_energia)} />
            {previa.reserva > 0 && <Linha rotulo="Reserva de seguranca" valor={formatarValor(previa.reserva)} fraco />}
            <Linha rotulo="Total separado para a recarga" valor={formatarValor(previa.total)} forte />
            {previa.saldo_usado > 0 && <Linha rotulo="Saldo da carteira usado" valor={`- ${formatarValor(previa.saldo_usado)}`} verde />}
            <div className="my-1 border-t border-[var(--mt-border)]" />
            <Linha rotulo="A pagar agora" valor={formatarValor(previa.a_pagar)} forte grande />
          </dl>
        ) : (
          <p className="mt-3 flex items-center gap-2 text-[13px] font-semibold text-[var(--mt-text-soft)]">
            <LoaderCircle size={15} className="animate-spin" /> Calculando...
          </p>
        )}
        <p className="mt-3 flex gap-2 rounded-2xl bg-black/20 px-3 py-2.5 text-[12.5px] font-semibold leading-snug text-[var(--mt-text-soft)]">
          <Info size={16} className="mt-0.5 shrink-0 text-[var(--mt-accent)]" />
          <span>
            No fim da recarga cobramos so a energia que o carro usou, a {formatarValor(c.preco_kwh)} o kWh. O que sobrar volta para a sua
            carteira na hora e paga a proxima recarga. A reserva cobre o carro puxar um pouco a mais.
          </span>
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--mt-text-soft)]">
          <Wallet size={14} className="text-[var(--mt-accent)]" /> Saldo na carteira: {formatarValor(previa?.saldo ?? conta.motorista.saldo ?? 0)}
        </p>
      </section>

      {erro && (
        <p className="mt-4 rounded-2xl border border-[var(--mt-defeito)]/40 bg-[var(--mt-defeito)]/10 px-3 py-2.5 text-center text-[13px] font-semibold text-[var(--mt-defeito)]">
          {erro}
        </p>
      )}

      <div className="sticky bottom-0 mt-auto space-y-2.5 pt-5" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {pronto && aPagar === 0 ? (
          <button type="button" onClick={() => pagarCom("saldo")} disabled={Boolean(enviando)} className="mt-btn mt-btn--primario w-full py-4 text-[17px]">
            {enviando ? <LoaderCircle size={20} className="animate-spin" /> : <Zap size={20} fill="currentColor" />}
            Carregar usando {formatarValor(previa.saldo_usado)} do saldo
          </button>
        ) : (
          <>
            <button type="button" onClick={() => pagarCom("pix")} disabled={!pronto || Boolean(enviando)} className="mt-btn mt-btn--primario w-full py-4 text-[17px]">
              {enviando === "pix" ? <LoaderCircle size={20} className="animate-spin" /> : <QrCode size={20} />}
              {pronto ? `Pagar ${formatarValor(aPagar)} com Pix` : "Calculando..."}
            </button>
            {c.aceita_cartao && (
              <button type="button" onClick={() => setCartaoAberto(true)} disabled={!pronto || Boolean(enviando)} className="mt-btn mt-btn--fantasma w-full py-3.5 text-[15px]">
                <CreditCard size={18} /> {pronto ? `Pagar ${formatarValor(aPagar)} com cartao` : "Calculando..."}
              </button>
            )}
          </>
        )}
      </div>

      {cartaoAberto && pronto && (
        <PagarCartao
          publicKey={c.mp_public_key}
          simulado={!c.mp_public_key}
          valor={aPagar}
          onPagar={pagarCartao}
          onFechar={() => setCartaoAberto(false)}
        />
      )}
    </>
  );
}

function Linha({ rotulo, valor, forte, grande, fraco, verde }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={fraco ? "text-[var(--mt-text-soft)]" : forte ? "font-extrabold" : ""}>{rotulo}</dt>
      <dd
        className={`mt-num text-right ${grande ? "text-[22px] font-bold" : forte ? "font-extrabold" : ""} ${verde ? "text-[var(--mt-accent)]" : ""} ${
          fraco ? "text-[var(--mt-text-soft)]" : ""
        }`}
      >
        {valor}
      </dd>
    </div>
  );
}
