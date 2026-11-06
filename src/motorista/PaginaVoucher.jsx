// Link do voucher (/v/:codigo): recarga gratis em um dos carregadores que o
// dono liberou. Usou, segue para o acompanhamento da recarga (igual ao Pix).
// Vencido, cancelado ou ja usado, o link mostra que nao existe mais.
import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Gift, LoaderCircle, MapPin, Zap } from "lucide-react";
import usePolling from "../hooks/usePolling";
import { apiPublica, dispositivo, lembrarRecarga, mensagemErro } from "./servicos";
import { duracao, restante, textoSituacao, useAgora } from "./regras";
import { Esqueleto, Logo, SeloSituacao } from "./ui";

export default function PaginaVoucher() {
  const { codigo } = useParams();
  const navigate = useNavigate();
  const agora = useAgora();
  const [voucher, setVoucher] = useState(null);
  const [recebidoEm, setRecebidoEm] = useState(0);
  const [erro, setErro] = useState("");
  const [usando, setUsando] = useState("");

  const carregar = useCallback(async () => {
    try {
      const { data } = await apiPublica.get(`/voucher/${encodeURIComponent(codigo)}`);
      setVoucher(data);
      setRecebidoEm(Date.now());
      setErro("");
    } catch (e) {
      setVoucher(null);
      setErro(e.response?.status === 404 ? "Este voucher nao existe mais: ja foi usado, venceu ou foi cancelado." : mensagemErro(e));
    }
  }, [codigo]);

  // Status dos carregadores muda (alguem chega): atualiza a cada 10 s.
  usePolling(carregar, 10000, !usando, { imediato: true });

  const usar = async (carregadorId) => {
    setUsando(carregadorId);
    try {
      const { data } = await apiPublica.post(`/voucher/${encodeURIComponent(codigo)}/usar`, { carregador_id: carregadorId, dispositivo: dispositivo() });
      lembrarRecarga(data.id);
      navigate(`/app/recarga/${data.id}`, { replace: true });
    } catch (e) {
      setErro(mensagemErro(e));
      setUsando("");
      carregar();
    }
  };

  const vence = voucher ? restante(voucher.segundos_para_vencer, recebidoEm, agora) : null;

  return (
    <div className="mt-app">
      <div className="mx-auto flex min-h-[100dvh] max-w-[480px] flex-col px-4 pb-8 pt-4">
        <header className="flex items-center justify-between">
          <Logo />
          <button type="button" onClick={() => navigate("/app")} className="mt-btn mt-btn--fantasma h-10 px-3.5 text-[13px]">
            <MapPin size={15} /> Mapa
          </button>
        </header>

        {!voucher && !erro && (
          <div className="mt-8 space-y-3">
            <Esqueleto className="h-40" />
            <Esqueleto className="h-24" />
          </div>
        )}

        {!voucher && erro && (
          <div className="mt-entrar mt-10 text-center">
            <Gift size={40} className="mx-auto text-[var(--mt-text-soft)]" />
            <p className="mt-4 text-[18px] font-extrabold">{erro}</p>
            <button type="button" onClick={() => navigate("/app")} className="mt-btn mt-btn--primario mt-6 px-6 py-3">
              Ver carregadores no mapa
            </button>
          </div>
        )}

        {voucher && (
          <>
            <section className="mt-entrar mt-6 rounded-[28px] border border-[var(--mt-border)] bg-[linear-gradient(160deg,#14241d,#0c1512)] p-5 text-center shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
              <p className="inline-flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-[0.14em] text-[var(--mt-text-soft)]">
                <Gift size={14} /> Voucher de recarga
              </p>
              <p className="mt-num mt-brilho mt-3 text-[64px] font-bold leading-none text-[var(--mt-accent)]">{duracao(voucher.minutos * 60)}</p>
              <p className="mt-2 text-[20px] font-extrabold">Gratis · {voucher.nome}</p>
              <p className="mt-1 text-[12.5px] font-semibold text-[var(--mt-text-soft)]">
                {vence != null ? `Use em ate ${duracao(vence)}` : "Sem prazo para usar"}
                {voucher.usos_restantes > 1 ? ` · ${voucher.usos_restantes} usos restantes` : ""}
              </p>
            </section>

            {erro && <p className="mt-4 rounded-2xl bg-[rgba(255,90,90,0.12)] px-4 py-3 text-center text-[13.5px] font-bold text-[#ff8f8f]">{erro}</p>}

            <p className="mt-6 text-[13px] font-extrabold uppercase tracking-[0.12em] text-[var(--mt-text-soft)]">Escolha o carregador</p>
            <div className="mt-3 space-y-3">
              {voucher.carregadores.map((c) => {
                const livre = c.situacao === "livre";
                return (
                  <div key={c.id} className="mt-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[17px] font-extrabold leading-tight">{c.nome}</p>
                        {c.endereco && <p className="mt-1 text-[12.5px] font-semibold text-[var(--mt-text-soft)]">{c.endereco}</p>}
                      </div>
                      <SeloSituacao situacao={c.situacao}>{textoSituacao(c, restante(c.segundos_para_liberar, recebidoEm, agora))}</SeloSituacao>
                    </div>
                    <button
                      type="button"
                      disabled={!livre || Boolean(usando)}
                      onClick={() => usar(c.id)}
                      className="mt-btn mt-btn--primario mt-4 w-full py-3"
                    >
                      {usando === c.id ? <LoaderCircle size={18} className="animate-spin" /> : <Zap size={18} />}
                      {usando === c.id ? "Liberando..." : livre ? "Usar voucher aqui" : "Indisponivel agora"}
                    </button>
                  </div>
                );
              })}
              {voucher.carregadores.length === 0 && (
                <p className="text-center text-[14px] font-semibold text-[var(--mt-text-soft)]">Nenhum carregador disponivel para este voucher.</p>
              )}
            </div>
            <p className="mt-5 text-center text-[12px] font-semibold text-[var(--mt-text-soft)]">
              Chegue no carregador antes de usar: depois de liberar, conecte o cabo no carro.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
