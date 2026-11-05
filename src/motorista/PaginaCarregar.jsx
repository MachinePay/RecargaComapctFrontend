// Entrada pelo QR code do carregador: escolher o tempo e gerar o Pix.
// O link do QR (/c/:id) so guarda o carregador em memoria e troca o endereco;
// atualizar esta tela leva para o mapa.
import { useCallback, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BatteryCharging, CircleUserRound, Clock, History, LoaderCircle, MapPin, Plug, QrCode, X, Zap } from "lucide-react";
import usePolling from "../hooks/usePolling";
import { formatarValor } from "../utils/formatos";
import { apiPublica, carregadorLido, dispositivo, guardarCarregadorDoQr, lembrarRecarga, mensagemErro } from "./servicos";
import { SITUACOES, duracao, horaDaqui, restante, textoSituacao, useAgora } from "./regras";
import { useConta } from "./conta";
import FormConta from "./FormConta";
import { Esqueleto, Logo, SeloSituacao } from "./ui";

export function EntradaQr() {
  const { carregadorId } = useParams();
  guardarCarregadorDoQr(carregadorId);
  return <Navigate to="/app/carregar" replace />;
}

const PASSOS = [
  { icone: QrCode, texto: "Pague o Pix" },
  { icone: Plug, texto: "Conecte o cabo" },
  { icone: BatteryCharging, texto: "Pronto, carregando" },
];

// Valor em reais pela regra do carregador (o servidor recalcula igual).
const valorDe = (c, minutos) => (c?.preco_valor && c?.preco_minutos ? Math.round(((minutos * c.preco_valor) / c.preco_minutos) * 100) / 100 : 0);

export default function PaginaCarregar() {
  const id = carregadorLido();
  const navigate = useNavigate();
  const agora = useAgora();
  const [c, setC] = useState(null);
  const [recebidoEm, setRecebidoEm] = useState(0);
  const [erro, setErro] = useState("");
  const [minutos, setMinutos] = useState(60);
  const [gerando, setGerando] = useState(false);
  const [erroPix, setErroPix] = useState("");
  const iniciouRef = useRef(false);
  const conta = useConta();
  // Sem login: antes de pagar pergunta se quer entrar (ou segue sem conta).
  const [perguntarConta, setPerguntarConta] = useState(false);

  const carregar = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await apiPublica.get(`/carregadores/${encodeURIComponent(id)}`);
      if (!iniciouRef.current) {
        // Primeira carga: comeca em 1 h (dentro da faixa permitida).
        iniciouRef.current = true;
        setMinutos(Math.min(Math.max(60, data.minutos_min), data.minutos_max));
      }
      setC(data);
      setRecebidoEm(Date.now());
      setErro("");
    } catch (e) {
      setErro(e.response?.status === 404 ? "Este QR code nao e' de um carregador cadastrado." : mensagemErro(e));
    }
  }, [id]);

  usePolling(carregar, 8000, Boolean(id), { imediato: true });

  if (!id) return <Navigate to="/app" replace />;

  const gerarPix = async () => {
    setGerando(true);
    setErroPix("");
    try {
      const { data } = await apiPublica.post("/pix", { carregador_id: id, minutos, dispositivo: dispositivo() });
      lembrarRecarga(data.id);
      navigate(`/app/recarga/${data.id}`, { replace: true });
    } catch (e) {
      setErroPix(mensagemErro(e));
      carregar();
    } finally {
      setGerando(false);
    }
  };

  const pagar = () => {
    if (conta) gerarPix();
    else setPerguntarConta(true);
  };

  const valor = valorDe(c, minutos);
  const livre = c?.situacao === "livre";
  const porcentagem = c ? ((minutos - c.minutos_min) / Math.max(1, c.minutos_max - c.minutos_min)) * 100 : 0;
  // Estimativa de energia so com a corrente configurada (220 V, monofasico).
  const kwhEstimado = c?.corrente_maxima_a ? (220 * c.corrente_maxima_a * minutos) / 60 / 1000 : null;

  return (
    <div className="mt-app">
      <div className="mx-auto flex min-h-[100dvh] max-w-[480px] flex-col px-4 pb-8 pt-4">
        <header className="flex items-center justify-between">
          <Logo />
          <button type="button" onClick={() => navigate("/app")} className="mt-btn mt-btn--fantasma h-10 px-3.5 text-[13px]">
            <MapPin size={15} /> Mapa
          </button>
        </header>

        {erro && !c && (
          <div className="mt-entrar mt-10 text-center">
            <p className="text-[18px] font-extrabold">{erro}</p>
            <button type="button" onClick={() => navigate("/app")} className="mt-btn mt-btn--primario mt-6 px-6 py-3">
              <ArrowLeft size={18} /> Ver carregadores no mapa
            </button>
          </div>
        )}

        {!c && !erro && (
          <div className="mt-8 space-y-3">
            <Esqueleto className="h-24" />
            <Esqueleto className="h-64" />
            <Esqueleto className="h-14" />
          </div>
        )}

        {c && (
          <>
            <section className="mt-entrar mt-6">
              <SeloSituacao situacao={c.situacao}>{textoSituacao(c, restante(c.segundos_para_liberar, recebidoEm, agora))}</SeloSituacao>
              <h1 className="mt-3 text-[30px] font-extrabold leading-[1.05] tracking-[-0.04em]">{c.nome}</h1>
              {c.endereco && <p className="mt-1.5 text-[13px] font-semibold text-[var(--mt-text-soft)]">{c.endereco}</p>}
            </section>

            {livre && c.aceita_pix ? (
              <>
                <section className="mt-entrar mt-6 rounded-[28px] border border-[var(--mt-border)] bg-[linear-gradient(160deg,#14241d,#0c1512)] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
                  <p className="text-center text-[12px] font-extrabold uppercase tracking-[0.14em] text-[var(--mt-text-soft)]">Quanto tempo de recarga?</p>
                  <div className="mt-3 text-center">
                    <p className="mt-num mt-brilho text-[64px] font-bold leading-none text-[var(--mt-accent)]">{duracao(minutos * 60)}</p>
                    <p className="mt-num mt-2 text-[28px] font-bold">{formatarValor(valor)}</p>
                    <p className="mt-1 text-[12.5px] font-semibold text-[var(--mt-text-soft)]">
                      {kwhEstimado ? `ate ~${kwhEstimado.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kWh · ` : ""}
                      termina por volta das {horaDaqui(minutos * 60, agora)}
                    </p>
                  </div>

                  <input
                    type="range"
                    min={c.minutos_min}
                    max={c.minutos_max}
                    step={5}
                    value={minutos}
                    onChange={(e) => setMinutos(Number(e.target.value))}
                    className="mt-faixa mt-6"
                    style={{ "--p": `${porcentagem}%` }}
                    aria-label="Tempo de recarga"
                  />
                  <div className="mt-1.5 flex justify-between text-[11px] font-bold text-[var(--mt-text-faint)]">
                    <span>{duracao(c.minutos_min * 60)}</span>
                    <span>{duracao(c.minutos_max * 60)}</span>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {c.opcoes.map((o) => (
                      <button
                        key={o.minutos}
                        type="button"
                        onClick={() => setMinutos(o.minutos)}
                        className={`rounded-2xl border px-2 py-2.5 text-center transition active:scale-95 ${
                          minutos === o.minutos
                            ? "border-[var(--mt-accent)] bg-[var(--mt-accent)]/15"
                            : "border-[var(--mt-border)] bg-[var(--mt-surface-soft)]"
                        }`}
                      >
                        <span className="mt-num block text-[16px] font-bold">{duracao(o.minutos * 60)}</span>
                        <span className="block text-[12px] font-semibold text-[var(--mt-text-soft)]">{formatarValor(o.valor)}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <ol className="mt-entrar mt-5 grid grid-cols-3 gap-2">
                  {PASSOS.map((passo, i) => (
                    <li key={passo.texto} className="flex flex-col items-center gap-1.5 text-center">
                      <span className="relative grid h-11 w-11 place-items-center rounded-2xl bg-[var(--mt-surface-soft)] text-[var(--mt-accent)]">
                        <passo.icone size={19} />
                        <span className="mt-num absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--mt-accent)] text-[11px] font-bold text-[var(--mt-accent-ink)]">
                          {i + 1}
                        </span>
                      </span>
                      <span className="text-[12px] font-bold text-[var(--mt-text-soft)]">{passo.texto}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[12px] font-semibold text-[var(--mt-text-faint)]">
                  <Clock size={13} /> O tempo so comeca a contar quando o carro comeca a carregar.
                </p>

                {erroPix && (
                  <p className="mt-4 rounded-2xl border border-[var(--mt-defeito)]/40 bg-[var(--mt-defeito)]/10 px-3 py-2.5 text-center text-[13px] font-semibold text-[var(--mt-defeito)]">
                    {erroPix}
                  </p>
                )}

                <div className="sticky bottom-0 mt-auto pt-5" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
                  {conta && (
                    <p className="mb-2 flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-[var(--mt-text-soft)]">
                      <CircleUserRound size={14} className="text-[var(--mt-accent)]" /> Pagando como {conta.motorista.nome.split(" ")[0]}
                    </p>
                  )}
                  <button type="button" onClick={pagar} disabled={gerando || valor < 1} className="mt-btn mt-btn--primario w-full py-4 text-[17px]">
                    {gerando ? <LoaderCircle size={20} className="animate-spin" /> : <Zap size={20} fill="currentColor" />}
                    {gerando ? "Gerando o Pix..." : `Pagar ${formatarValor(valor)} com Pix`}
                  </button>
                </div>
              </>
            ) : (
              <Indisponivel c={c} segundos={restante(c.segundos_para_liberar, recebidoEm, agora)} agora={agora} onMapa={() => navigate("/app")} />
            )}
          </>
        )}
      </div>

      {perguntarConta && (
        <PerguntaConta
          valor={valor}
          onFechar={() => setPerguntarConta(false)}
          onSeguir={() => {
            setPerguntarConta(false);
            gerarPix();
          }}
        />
      )}
    </div>
  );
}

function PerguntaConta({ valor, onFechar, onSeguir }) {
  const [entrando, setEntrando] = useState(false);
  return (
    <div className="fixed inset-0 z-[2000] flex items-end bg-black/60 backdrop-blur-sm" onClick={onFechar}>
      <div
        className="mt-entrar mx-auto max-h-[92dvh] w-full max-w-[480px] overflow-y-auto rounded-t-[28px] border border-[var(--mt-border)] bg-[var(--mt-surface-strong)] px-5 pt-5"
        style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[20px] font-extrabold leading-tight tracking-[-0.02em]">Quer entrar na sua conta?</p>
            <p className="mt-1 text-[13px] font-semibold text-[var(--mt-text-soft)]">
              Com conta, esta recarga fica salva no seu historico em qualquer celular.
            </p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="mt-btn mt-btn--fantasma h-9 w-9 shrink-0">
            <X size={17} />
          </button>
        </div>

        {entrando ? (
          <div className="mt-5">
            <FormConta onPronto={onSeguir} />
          </div>
        ) : (
          <div className="mt-5 space-y-2.5">
            <button type="button" onClick={() => setEntrando(true)} className="mt-btn mt-btn--primario w-full py-3.5 text-[16px]">
              <CircleUserRound size={18} /> Entrar ou criar conta
            </button>
            <button type="button" onClick={onSeguir} className="mt-btn mt-btn--fantasma w-full py-3.5 text-[15px]">
              Continuar sem login e pagar {formatarValor(valor)}
            </button>
            <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-[12px] font-semibold text-[var(--mt-text-faint)]">
              <History size={13} /> Sem login, o historico fica so neste celular.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Indisponivel({ c, segundos, agora, onMapa }) {
  const s = SITUACOES[c.situacao] || SITUACOES.offline;
  let titulo = s.texto;
  let texto = "Veja no mapa outro carregador livre perto de voce.";
  if (c.situacao === "livre" && !c.aceita_pix) {
    titulo = "Pagamento ainda nao liberado";
    texto = "Este carregador ainda nao esta recebendo Pix. Procure o responsavel pelo local.";
  } else if (c.situacao === "ocupado") {
    titulo = segundos != null ? `Libera em ~${duracao(segundos)}` : "Em uso agora";
    texto = segundos != null ? `Previsao: por volta das ${horaDaqui(segundos, agora)}. Esta tela atualiza sozinha.` : "Tem um carro conectado. Esta tela atualiza sozinha.";
  } else if (c.situacao === "reservado") {
    texto = "Alguem acabou de gerar um Pix aqui. Se nao pagar em alguns minutos, o carregador volta a ficar livre.";
  } else if (c.situacao === "offline") {
    texto = "O carregador perdeu a conexao com a internet. Tente de novo em instantes ou veja outro no mapa.";
  }
  return (
    <section className="mt-entrar mt-8 rounded-[28px] border p-6 text-center" style={{ borderColor: `color-mix(in srgb, ${s.cor} 35%, transparent)`, background: `color-mix(in srgb, ${s.cor} 8%, transparent)` }}>
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl" style={{ background: `color-mix(in srgb, ${s.cor} 18%, transparent)`, color: s.cor }}>
        {c.situacao === "ocupado" ? <BatteryCharging size={30} /> : <Clock size={30} />}
      </span>
      <h2 className="mt-num mt-4 text-[26px] font-bold" style={{ color: s.cor }}>
        {titulo}
      </h2>
      <p className="mt-2 text-[14px] font-semibold text-[var(--mt-text-soft)]">{texto}</p>
      <button type="button" onClick={onMapa} className="mt-btn mt-btn--primario mt-6 w-full py-3.5">
        <MapPin size={18} /> Ver carregadores livres
      </button>
    </section>
  );
}
