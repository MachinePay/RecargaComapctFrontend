// Pagamento com cartao no app: o formulario e' do Mercado Pago (Card Payment
// Brick). O numero do cartao vai direto para o Mercado Pago, que devolve um
// token; o servidor so recebe o token e cobra.
import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Lock, X } from "lucide-react";
import { formatarValor } from "../utils/formatos";

const SDK_URL = "https://sdk.mercadopago.com/js/v2";
let carregandoSdk = null;

function carregarSdk() {
  if (window.MercadoPago) return Promise.resolve();
  if (!carregandoSdk) {
    carregandoSdk = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SDK_URL;
      script.onload = resolve;
      script.onerror = () => {
        carregandoSdk = null;
        reject(new Error("Nao foi possivel abrir o pagamento com cartao. Confira a internet."));
      };
      document.head.appendChild(script);
    });
  }
  return carregandoSdk;
}

// simulado: bancada (MP_SIMULADO) sem formulario de verdade.
export default function PagarCartao({ publicKey, valor, simulado, onPagar, onFechar }) {
  const [erro, setErro] = useState("");
  const [abrindo, setAbrindo] = useState(!simulado);
  const [enviando, setEnviando] = useState(false);
  // O formulario do MP e' criado uma vez; a funcao de pagar vem sempre da ultima renderizacao.
  const pagarRef = useRef(onPagar);
  useEffect(() => {
    pagarRef.current = onPagar;
  }, [onPagar]);

  useEffect(() => {
    if (simulado) return undefined;
    let brick;
    let cancelado = false;
    carregarSdk()
      .then(() => {
        if (cancelado) return null;
        const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
        return mp.bricks().create("cardPayment", "mt-cartao-brick", {
          initialization: { amount: valor },
          customization: {
            visual: { style: { theme: "dark" } },
            paymentMethods: { maxInstallments: 1 },
          },
          callbacks: {
            onReady: () => setAbrindo(false),
            onError: () => setErro("Confira os dados do cartao."),
            onSubmit: async (dados) => {
              setErro("");
              try {
                await pagarRef.current(dados);
              } catch (e) {
                setErro(e.message);
                throw e; // o formulario do MP libera o botao de novo
              }
            },
          },
        });
      })
      .then((criado) => {
        brick = criado;
      })
      .catch((e) => {
        setErro(e.message);
        setAbrindo(false);
      });
    return () => {
      cancelado = true;
      brick?.unmount?.();
    };
  }, [publicKey, valor, simulado]);

  const pagarSimulado = async () => {
    setEnviando(true);
    setErro("");
    try {
      await pagarRef.current({ token: "simulado", payment_method_id: "credit_card" });
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-end bg-black/60 backdrop-blur-sm" onClick={onFechar}>
      <div
        className="mt-entrar mx-auto max-h-[94dvh] w-full max-w-[480px] overflow-y-auto rounded-t-[28px] border border-[var(--mt-border)] bg-[var(--mt-surface-strong)] px-5 pt-5"
        style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[20px] font-extrabold leading-tight tracking-[-0.02em]">Pagar {formatarValor(valor)} no cartao</p>
            <p className="mt-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--mt-text-soft)]">
              <Lock size={13} /> Os dados do cartao vao direto para o Mercado Pago.
            </p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="mt-btn mt-btn--fantasma h-9 w-9 shrink-0">
            <X size={17} />
          </button>
        </div>

        {erro && (
          <p className="mt-4 rounded-2xl border border-[var(--mt-defeito)]/40 bg-[var(--mt-defeito)]/10 px-3 py-2.5 text-center text-[13px] font-semibold text-[var(--mt-defeito)]">
            {erro}
          </p>
        )}

        {simulado ? (
          <button type="button" onClick={pagarSimulado} disabled={enviando} className="mt-btn mt-btn--primario mt-5 w-full py-3.5">
            {enviando ? <LoaderCircle size={18} className="animate-spin" /> : null}
            Teste: aprovar cartao sem cobrar
          </button>
        ) : (
          <>
            {abrindo && (
              <p className="mt-6 flex items-center justify-center gap-2 text-[13px] font-semibold text-[var(--mt-text-soft)]">
                <LoaderCircle size={16} className="animate-spin" /> Abrindo o pagamento...
              </p>
            )}
            <div id="mt-cartao-brick" className="mt-4" />
          </>
        )}
      </div>
    </div>
  );
}
