// Compra de energia (carregador por kWh). A tela mostra a conta inteira antes
// de pagar, para Pix e para cartao. Pix: reserva maior e a sobra volta no
// proprio Pix. Cartao: nao tem devolucao, entao a reserva e' pequena (95%) e
// nada volta. Conta no app e' opcional.
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, Info, LoaderCircle, QrCode } from "lucide-react";
import { formatarValor } from "../utils/formatos";
import { apiPublica, dispositivo, lembrarRecarga, mensagemErro } from "./servicos";
import { duracao, formatarKwhCurto, horaDaqui } from "./regras";
import PagarCartao from "./PagarCartao";

export default function CompraKwh({ c, agora, onAtualizar }) {
  const navigate = useNavigate();
  const [kwh, setKwh] = useState(() => Math.min(Math.max(20, c.kwh_min), c.kwh_max));
  const [previa, setPrevia] = useState(null);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState("");
  const [cartaoAberto, setCartaoAberto] = useState(false);

  // A conta muda com os kWh: pergunta ao servidor (ele refaz igual na hora de pagar).
  useEffect(() => {
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
  }, [c.id, kwh]);

  const pagar = useCallback(
    async (metodo, cartao) => {
      const { data } = await apiPublica.post("/recarga", {
        carregador_id: c.id,
        kwh,
        metodo,
        dispositivo: dispositivo(),
        a_pagar: previa?.[metodo]?.a_pagar,
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

  const porcentagem = ((kwh - c.kwh_min) / Math.max(1, c.kwh_max - c.kwh_min)) * 100;
  const potenciaKw = c.potencia_media_kw || null;
  const segundosPrevistos = potenciaKw ? (kwh / potenciaKw) * 3600 : null;
  const pronto = previa && previa.kwh === kwh;
  const pix = previa?.pix;
  const cartao = previa?.cartao;

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

      {/* A conta de cada forma de pagamento, para nao ter surpresa. */}
      <section className="mt-entrar mt-4 space-y-3">
        <p className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-[var(--mt-text-soft)]">
          Energia: {previa ? formatarValor(previa.custo_energia) : "..."} ({formatarKwhCurto(kwh)} a {formatarValor(c.preco_kwh)})
        </p>
        <Opcao
          titulo="Pix"
          icone={<QrCode size={18} />}
          conta={pix}
          texto="Voce paga a energia + uma reserva. No fim cobramos so o que o carro usou e devolvemos a sobra no seu Pix na hora."
        />
        {c.aceita_cartao && (
          <Opcao
            titulo="Cartao"
            icone={<CreditCard size={18} />}
            conta={cartao}
            texto="O cartao nao tem devolucao, entao a reserva e' bem pequena. O valor pago fica todo para a recarga, mesmo que o carro encha antes."
          />
        )}
        {!previa && (
          <p className="flex items-center gap-2 text-[13px] font-semibold text-[var(--mt-text-soft)]">
            <LoaderCircle size={15} className="animate-spin" /> Calculando...
          </p>
        )}
      </section>

      {erro && (
        <p className="mt-4 rounded-2xl border border-[var(--mt-defeito)]/40 bg-[var(--mt-defeito)]/10 px-3 py-2.5 text-center text-[13px] font-semibold text-[var(--mt-defeito)]">
          {erro}
        </p>
      )}

      <div className="sticky bottom-0 mt-auto space-y-2.5 pt-5" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {(
          <>
            <button type="button" onClick={() => pagarCom("pix")} disabled={!pronto || Boolean(enviando)} className="mt-btn mt-btn--primario w-full py-4 text-[17px]">
              {enviando === "pix" ? <LoaderCircle size={20} className="animate-spin" /> : <QrCode size={20} />}
              {pronto ? `Pagar ${formatarValor(pix.a_pagar)} com Pix` : "Calculando..."}
            </button>
            {c.aceita_cartao && (
              <button type="button" onClick={() => setCartaoAberto(true)} disabled={!pronto || Boolean(enviando)} className="mt-btn mt-btn--fantasma w-full py-3.5 text-[15px]">
                <CreditCard size={18} /> {pronto ? `Pagar ${formatarValor(cartao.a_pagar)} com cartao` : "Calculando..."}
              </button>
            )}
          </>
        )}
      </div>

      {cartaoAberto && pronto && (
        <PagarCartao
          publicKey={c.mp_public_key}
          simulado={!c.mp_public_key}
          valor={cartao.a_pagar}
          onPagar={pagarCartao}
          onFechar={() => setCartaoAberto(false)}
        />
      )}
    </>
  );
}

function Opcao({ titulo, icone, conta, texto }) {
  return (
    <div className="rounded-[22px] border border-[var(--mt-border)] bg-[var(--mt-surface-soft)] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[15px] font-extrabold">
          <span className="text-[var(--mt-accent)]">{icone}</span> {titulo}
        </span>
        <span className="mt-num text-[22px] font-bold">{conta ? formatarValor(conta.a_pagar) : "..."}</span>
      </div>
      {conta && (
        <dl className="mt-2 space-y-1 text-[13px] font-semibold">
          <Linha rotulo="Energia" valor={formatarValor(conta.custo_energia)} />
          <Linha rotulo="Reserva" valor={formatarValor(conta.reserva)} fraco />
          <Linha rotulo={conta.devolve_sobra ? "Sobra" : "Devolucao"} valor={conta.devolve_sobra ? "volta no Pix" : "nao tem"} verde={conta.devolve_sobra} fraco={!conta.devolve_sobra} />
        </dl>
      )}
      <p className="mt-2 flex gap-2 text-[12px] font-semibold leading-snug text-[var(--mt-text-soft)]">
        <Info size={14} className="mt-0.5 shrink-0 text-[var(--mt-accent)]" />
        <span>{texto}</span>
      </p>
    </div>
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
