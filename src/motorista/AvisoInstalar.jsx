// Cartao "instale o app": no Android abre o pedido do celular; no iPhone
// mostra o passo a passo do Safari (Compartilhar -> Adicionar a Tela de Inicio).
import { useState } from "react";
import { Compass, Copy, Download, Share, SquarePlus, X, Zap } from "lucide-react";
import { dispensarAviso, instalarAgora, useModoInstalar } from "./instalar";

export default function AvisoInstalar({ className = "" }) {
  const modo = useModoInstalar();
  const [passos, setPassos] = useState(false);
  const [copiado, setCopiado] = useState(false);
  if (!modo) return null;

  const acao = () => {
    if (modo === "android") instalarAgora();
    else setPassos(true);
  };

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/app`);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  };

  return (
    <>
      <div className={`mt-entrar flex items-center gap-3 rounded-[20px] border border-[var(--mt-border-strong)] bg-[var(--mt-surface-soft)] p-3 ${className}`}>
        <img src="/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-[12px]" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-extrabold leading-tight">Tenha o app na sua tela</p>
          <p className="text-[12px] font-semibold leading-snug text-[var(--mt-text-soft)]">
            {modo === "ios-outro-navegador" ? "No iPhone, abra pelo Safari para instalar." : "Ache carregador livre e pague com Pix num toque."}
          </p>
        </div>
        <button type="button" onClick={acao} className="mt-btn mt-btn--primario shrink-0 px-3.5 py-2 text-[13px]">
          {modo === "android" ? <Download size={15} /> : null}
          {modo === "android" ? "Instalar" : "Como?"}
        </button>
        <button type="button" onClick={dispensarAviso} aria-label="Agora nao" className="shrink-0 p-1 text-[var(--mt-text-faint)]">
          <X size={16} />
        </button>
      </div>

      {passos && (
        <div className="fixed inset-0 z-[2000] flex items-end bg-black/60 backdrop-blur-sm" onClick={() => setPassos(false)}>
          <div
            className="mt-entrar mx-auto w-full max-w-[480px] rounded-t-[28px] border border-[var(--mt-border)] bg-[var(--mt-surface-strong)] px-5 pt-5 text-[var(--mt-text)]"
            style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img src="/icon-192.png" alt="" className="h-12 w-12 rounded-[13px]" />
                <div>
                  <p className="text-[18px] font-extrabold tracking-[-0.02em]">Instalar no iPhone</p>
                  <p className="text-[12.5px] font-semibold text-[var(--mt-text-soft)]">Leva 10 segundos e fica igual a um app</p>
                </div>
              </div>
              <button type="button" onClick={() => setPassos(false)} aria-label="Fechar" className="mt-btn mt-btn--fantasma h-9 w-9 shrink-0">
                <X size={17} />
              </button>
            </div>

            {modo === "ios-outro-navegador" ? (
              <ol className="mt-5 space-y-3">
                <Passo n={1} icone={<Copy size={18} />} texto="Copie o link do app" detalhe={copiado ? "Link copiado!" : null}>
                  <button type="button" onClick={copiarLink} className="mt-btn mt-btn--fantasma mt-2 px-3 py-1.5 text-[12.5px]">
                    <Copy size={14} /> Copiar link
                  </button>
                </Passo>
                <Passo n={2} icone={<Compass size={18} />} texto="Abra o Safari e cole o link" detalhe="O Chrome do iPhone nao deixa adicionar na tela de inicio." />
                <Passo n={3} icone={<Share size={18} />} texto="No Safari, siga o passo a passo" detalhe="Compartilhar → Adicionar a Tela de Inicio." />
              </ol>
            ) : (
              <ol className="mt-5 space-y-3">
                <Passo n={1} icone={<Share size={18} />} texto="Toque em Compartilhar" detalhe="O quadrado com a seta para cima, na barra do Safari (embaixo no iPhone, em cima no iPad)." />
                <Passo n={2} icone={<SquarePlus size={18} />} texto="Toque em Adicionar a Tela de Inicio" detalhe="Se nao aparecer, role a lista de opcoes para baixo." />
                <Passo n={3} icone={<Zap size={18} fill="currentColor" />} texto="Toque em Adicionar" detalhe="Pronto: o icone da CompactRecarga fica na sua tela, abrindo direto no mapa." />
              </ol>
            )}

            {modo === "ios" && /iPhone|iPod/.test(navigator.userAgent) && (
              <div className="mt-5 flex flex-col items-center gap-1 text-[var(--mt-accent)]">
                <span className="text-[12px] font-extrabold">O botao Compartilhar fica aqui embaixo</span>
                <span className="mt-raio text-[22px] leading-none">↓</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Passo({ n, icone, texto, detalhe, children }) {
  return (
    <li className="flex gap-3 rounded-[18px] border border-[var(--mt-border)] bg-[var(--mt-surface-soft)] p-3">
      <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--mt-accent)]/15 text-[var(--mt-accent)]">
        {icone}
        <span className="mt-num absolute -left-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--mt-accent)] text-[11px] font-bold text-[var(--mt-accent-ink)]">{n}</span>
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-extrabold">{texto}</span>
        {detalhe && <span className="mt-0.5 block text-[12.5px] font-semibold text-[var(--mt-text-soft)]">{detalhe}</span>}
        {children}
      </span>
    </li>
  );
}
