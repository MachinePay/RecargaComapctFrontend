// Acompanhamento de uma recarga: Pix (QR + copia e cola) ate pagar, depois a
// liberacao, o "conecte o cabo", o tempo correndo e o resumo no fim.
// Atualizar a pagina continua aqui (a recarga e' deste celular).
import { useCallback, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { BatteryCharging, Check, CircleCheck, CircleX, Clock, Copy, History, LoaderCircle, MapPin, Plug, RotateCcw, Smartphone, Zap } from "lucide-react";
import usePolling from "../hooks/usePolling";
import { formatarKwh, formatarRelogio, formatarValor } from "../utils/formatos";
import { apiPublica, dispositivo, esquecerRecarga, guardarCarregadorDoQr, lembrarRecarga, mensagemErro } from "./servicos";
import { duracao, horaDaqui, restante, useAgora } from "./regras";
import AvisoInstalar from "./AvisoInstalar";
import { Esqueleto, Logo } from "./ui";

const MOTIVOS_MOTORISTA = {
  tempo_esgotado: "Tempo pago concluido",
  carro_desconectado: "Voce desconectou o carro",
  parado_no_carregador: "Recarga parada no carregador",
  encerrada_pelo_admin: "Encerrada pelo responsavel do local",
  carro_nao_conectado: "O carro nao foi conectado a tempo",
  carregador_nao_respondeu: "O carregador nao respondeu",
  remote_start_rejeitado: "O carregador recusou o inicio",
  carregador_ocupado: "O carregador ja estava em uso",
  carro_nao_puxou_energia: "O carro nao comecou a carregar",
};

const ATIVAS = ["aguardando_inicio", "aguardando_carro", "carregando", "encerrando"];

export default function PaginaRecarga() {
  const { cobrancaId } = useParams();
  const navigate = useNavigate();
  const agora = useAgora();
  const [cobranca, setCobranca] = useState(null);
  const [recebidoEm, setRecebidoEm] = useState(0);
  const [erro, setErro] = useState("");
  const [acao, setAcao] = useState("");

  const carregar = useCallback(async () => {
    try {
      const { data } = await apiPublica.get(`/cobrancas/${cobrancaId}`, { params: { dispositivo: dispositivo() } });
      setCobranca(data);
      setRecebidoEm(Date.now());
      setErro("");
      const ativa = data.status === "aguardando_pagamento" || (data.status === "aprovada" && ATIVAS.includes(data.sessao?.status));
      if (ativa) lembrarRecarga(data.id);
      else esquecerRecarga(data.id);
    } catch (e) {
      setErro(e.response?.status === 404 ? "Recarga nao encontrada neste celular." : mensagemErro(e));
    }
  }, [cobrancaId]);

  const terminou = cobranca && !(cobranca.status === "aguardando_pagamento" || (cobranca.status === "aprovada" && ATIVAS.includes(cobranca.sessao?.status)));

  // Pix: 3 s para a confirmacao aparecer rapido; depois 5 s. Terminou: para.
  usePolling(carregar, cobranca?.status === "aguardando_pagamento" ? 3000 : 5000, !terminou, { imediato: !cobranca });

  const executar = async (nome, caminho) => {
    setAcao(nome);
    try {
      const { data } = await apiPublica.post(caminho, null, { params: { dispositivo: dispositivo() } });
      setCobranca(data);
      setRecebidoEm(Date.now());
      return data;
    } catch (e) {
      setErro(mensagemErro(e));
      return null;
    } finally {
      setAcao("");
    }
  };

  const trocarTempo = async () => {
    const data = await executar("cancelar", `/cobrancas/${cobrancaId}/cancelar`);
    if (data) {
      esquecerRecarga(data.id);
      guardarCarregadorDoQr(data.carregador_id);
      navigate("/app/carregar", { replace: true });
    }
  };

  const gerarOutro = () => {
    guardarCarregadorDoQr(cobranca.carregador_id);
    navigate("/app/carregar", { replace: true });
  };

  return (
    <div className="mt-app">
      <div className="mx-auto flex min-h-[100dvh] max-w-[480px] flex-col px-4 pb-10 pt-4">
        <header className="flex items-center justify-between">
          <Logo />
          <Link to="/app" className="mt-btn mt-btn--fantasma h-10 px-3.5 text-[13px]">
            <MapPin size={15} /> Mapa
          </Link>
        </header>

        {erro && (
          <p className="mt-6 rounded-2xl border border-[var(--mt-defeito)]/40 bg-[var(--mt-defeito)]/10 px-3 py-2.5 text-center text-[13px] font-semibold text-[var(--mt-defeito)]">
            {erro}
          </p>
        )}

        {!cobranca && !erro && (
          <div className="mt-8 space-y-3">
            <Esqueleto className="h-16" />
            <Esqueleto className="h-80" />
          </div>
        )}

        {cobranca && (
          <>
            <p className="mt-6 text-[12px] font-extrabold uppercase tracking-[0.14em] text-[var(--mt-text-soft)]">{cobranca.carregador_nome}</p>
            {cobranca.status === "aguardando_pagamento" && (
              <TelaPix cobranca={cobranca} segundos={restante(cobranca.segundos_para_vencer, recebidoEm, agora)} acao={acao} onSimular={() => executar("simular", `/cobrancas/${cobrancaId}/simular-pagamento`)} onTrocar={trocarTempo} />
            )}
            {cobranca.status === "aprovada" && cobranca.sessao && <TelaSessao cobranca={cobranca} sessao={cobranca.sessao} recebidoEm={recebidoEm} agora={agora} />}
            {["cancelada", "expirada", "recusada"].includes(cobranca.status) && (
              <Final
                cor="var(--mt-text-soft)"
                icone={<Clock size={30} />}
                titulo={cobranca.status === "expirada" ? "O Pix venceu" : cobranca.status === "recusada" ? "Pagamento recusado" : "Pix cancelado"}
                texto="Nenhum valor foi cobrado. Se ainda estiver no carregador, gere um novo Pix."
              >
                <button type="button" onClick={gerarOutro} className="mt-btn mt-btn--primario w-full py-3.5">
                  <RotateCcw size={18} /> Gerar novo Pix
                </button>
              </Final>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TelaPix({ cobranca, segundos, acao, onSimular, onTrocar }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(cobranca.pix_copia_cola);
    } catch {
      // Navegador sem clipboard (http): seleciona num campo escondido.
      const campo = document.createElement("textarea");
      campo.value = cobranca.pix_copia_cola;
      document.body.appendChild(campo);
      campo.select();
      document.execCommand("copy");
      campo.remove();
    }
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 2500);
  };

  return (
    <section className="mt-entrar">
      <h1 className="mt-1 text-[28px] font-extrabold leading-tight tracking-[-0.04em]">Pague com Pix</h1>
      <p className="mt-1 text-[14px] font-semibold text-[var(--mt-text-soft)]">
        {duracao(cobranca.minutos * 60)} de recarga · assim que o banco confirmar, o carregador libera sozinho.
      </p>

      <div className="mt-5 rounded-[28px] bg-white p-5 text-[#0b1210] shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-[#5b6b63]">Valor</span>
          <span className="mt-num text-[30px] font-bold">{formatarValor(cobranca.valor)}</span>
        </div>
        <div className="mx-auto mt-4 w-full max-w-[260px]">
          <QRCodeSVG value={cobranca.pix_copia_cola} size={520} level="M" marginSize={0} style={{ width: "100%", height: "auto" }} />
        </div>
        <div className="mt-4 flex items-center justify-center gap-2 text-[13px] font-bold text-[#5b6b63]">
          <LoaderCircle size={15} className="animate-spin" /> Aguardando pagamento
          {segundos != null && <span className="mt-num rounded-full bg-[#eef3f0] px-2 py-0.5 text-[#0b1210]">vence em {formatarRelogio(segundos)}</span>}
        </div>
      </div>

      <button type="button" onClick={copiar} className={`mt-btn mt-4 w-full py-4 text-[16px] ${copiado ? "mt-btn--fantasma text-[var(--mt-accent)]" : "mt-btn--primario"}`}>
        {copiado ? <Check size={19} /> : <Copy size={19} />}
        {copiado ? "Codigo copiado!" : "Copiar codigo Pix (copia e cola)"}
      </button>

      <div className="mt-4 rounded-[22px] border border-[var(--mt-border)] bg-[var(--mt-surface-soft)] p-4">
        <p className="flex items-center gap-2 text-[13px] font-extrabold">
          <Smartphone size={16} className="text-[var(--mt-accent)]" /> Como pagar
        </p>
        <ol className="mt-2 space-y-1.5 text-[13px] font-semibold text-[var(--mt-text-soft)]">
          <li>1. Toque em copiar o codigo acima.</li>
          <li>2. Abra o app do seu banco e va em Pix → Pix copia e cola.</li>
          <li>3. Cole o codigo e confirme. Volte aqui: a tela atualiza sozinha.</li>
        </ol>
      </div>

      {cobranca.simulado && (
        <button type="button" onClick={onSimular} disabled={!!acao} className="mt-btn mt-btn--fantasma mt-4 w-full border-dashed py-3 text-[14px] text-[var(--mt-reservado)]">
          {acao === "simular" ? <LoaderCircle size={16} className="animate-spin" /> : <Zap size={16} />} Simular pagamento (modo teste)
        </button>
      )}

      <button type="button" onClick={onTrocar} disabled={!!acao} className="mt-4 w-full py-2 text-center text-[13px] font-bold text-[var(--mt-text-soft)] underline-offset-4 hover:underline">
        {acao === "cancelar" ? "Cancelando..." : "Trocar o tempo ou cancelar"}
      </button>
    </section>
  );
}

function Anel({ progresso, children }) {
  const raio = 120;
  const circunferencia = 2 * Math.PI * raio;
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[290px]">
      <svg viewBox="0 0 280 280" className="mt-anel h-full w-full">
        <defs>
          <linearGradient id="mt-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38d6f0" />
            <stop offset="100%" stopColor="#44e08a" />
          </linearGradient>
        </defs>
        <circle cx="140" cy="140" r={raio} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="16" />
        <circle
          cx="140"
          cy="140"
          r={raio}
          fill="none"
          stroke="url(#mt-grad)"
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={circunferencia}
          strokeDashoffset={circunferencia * (1 - Math.min(1, Math.max(0, progresso)))}
          className="mt-brilho"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

function Etapa({ icone, titulo, texto, animado }) {
  return (
    <section className="mt-entrar mt-8 text-center">
      <span className={`mx-auto grid h-24 w-24 place-items-center rounded-[32px] bg-[var(--mt-accent)]/12 text-[var(--mt-accent)] ${animado ? "mt-raio" : ""}`}>{icone}</span>
      <h1 className="mt-5 text-[28px] font-extrabold leading-tight tracking-[-0.04em]">{titulo}</h1>
      <p className="mx-auto mt-2 max-w-[340px] text-[14px] font-semibold text-[var(--mt-text-soft)]">{texto}</p>
    </section>
  );
}

function Final({ cor, icone, titulo, texto, children }) {
  return (
    <section className="mt-entrar mt-8 text-center">
      <span className="mx-auto grid h-20 w-20 place-items-center rounded-[28px]" style={{ background: `color-mix(in srgb, ${cor} 15%, transparent)`, color: cor }}>
        {icone}
      </span>
      <h1 className="mt-5 text-[28px] font-extrabold leading-tight tracking-[-0.04em]">{titulo}</h1>
      {texto && <p className="mx-auto mt-2 max-w-[360px] text-[14px] font-semibold text-[var(--mt-text-soft)]">{texto}</p>}
      <div className="mt-6 space-y-2.5">{children}</div>
    </section>
  );
}

function Resumo({ itens }) {
  return (
    <div className="mt-6 grid grid-cols-3 gap-2 text-left">
      {itens.map(([titulo, valor]) => (
        <div key={titulo} className="rounded-2xl border border-[var(--mt-border)] bg-[var(--mt-surface-soft)] px-3 py-2.5">
          <p className="text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-[var(--mt-text-faint)]">{titulo}</p>
          <p className="mt-num mt-1 truncate text-[17px] font-bold">{valor}</p>
        </div>
      ))}
    </div>
  );
}

function TelaSessao({ cobranca, sessao, recebidoEm, agora }) {
  const segundos = restante(sessao.segundos_restantes, recebidoEm, agora);
  const total = sessao.minutos_pagos * 60;

  if (sessao.status === "aguardando_inicio") {
    return <Etapa animado icone={<Zap size={44} fill="currentColor" />} titulo="Pagamento aprovado!" texto="Liberando o carregador para voce. Leva so alguns segundos." />;
  }
  if (sessao.status === "aguardando_carro") {
    return (
      <Etapa
        animado
        icone={<Plug size={44} />}
        titulo="Conecte o cabo no carro"
        texto={`Encaixe o conector no seu carro. Seus ${duracao(total)} so comecam a contar quando ele comecar a carregar.`}
      />
    );
  }
  if (sessao.status === "carregando" && segundos == null) {
    return <Etapa animado icone={<BatteryCharging size={44} />} titulo="Quase la..." texto="O carregador ja esta ligado. Esperando o carro comecar a puxar energia." />;
  }
  if (sessao.status === "carregando" || sessao.status === "encerrando") {
    const encerrando = sessao.status === "encerrando" || segundos === 0;
    return (
      <section className="mt-entrar mt-6">
        <Anel progresso={encerrando ? 1 : 1 - segundos / Math.max(1, total)}>
          <div>
            <BatteryCharging size={26} className="mt-raio mx-auto text-[var(--mt-accent)]" />
            <p className="mt-num mt-2 text-[52px] font-bold leading-none">{encerrando ? "00:00" : formatarRelogio(segundos)}</p>
            <p className="mt-2 text-[13px] font-bold text-[var(--mt-text-soft)]">{encerrando ? "Finalizando..." : `termina as ${horaDaqui(segundos, agora)}`}</p>
          </div>
        </Anel>
        <h1 className="mt-4 text-center text-[24px] font-extrabold tracking-[-0.03em]">{encerrando ? "Finalizando a recarga" : "Carregando"}</h1>
        <Resumo
          itens={[
            ["Energia", formatarKwh(sessao.energia_kwh)],
            ["Tempo pago", duracao(total)],
            ["Valor", formatarValor(cobranca.valor)],
          ]}
        />
        <p className="mt-4 text-center text-[12.5px] font-semibold text-[var(--mt-text-faint)]">
          Pode fechar esta tela. O carregador desliga sozinho no fim do tempo; para voltar aqui, abra o mapa.
        </p>
      </section>
    );
  }
  if (sessao.status === "finalizada") {
    return (
      <Final cor="var(--mt-accent)" icone={<CircleCheck size={36} />} titulo="Recarga concluida" texto={`${MOTIVOS_MOTORISTA[sessao.motivo_fim] || "Recarga encerrada"}. Ja pode desconectar o cabo.`}>
        <Resumo
          itens={[
            ["Energia", formatarKwh(sessao.energia_kwh)],
            ["Tempo", duracao(total)],
            ["Valor", formatarValor(cobranca.valor)],
          ]}
        />
        <AvisoInstalar className="mt-4 text-left" />
        <Link to="/app/historico" className="mt-btn mt-btn--primario mt-4 w-full py-3.5">
          <History size={18} /> Ver meu historico
        </Link>
        <Link to="/app" className="mt-btn mt-btn--fantasma w-full py-3.5">
          <MapPin size={18} /> Voltar ao mapa
        </Link>
      </Final>
    );
  }
  return (
    <Final
      cor="var(--mt-defeito)"
      icone={<CircleX size={36} />}
      titulo="A recarga nao comecou"
      texto={`${MOTIVOS_MOTORISTA[sessao.motivo_fim] || "Algo deu errado no carregador"}. ${
        cobranca.estornada ? `Seu Pix de ${formatarValor(cobranca.valor)} foi devolvido.` : "Seu Pix sera devolvido automaticamente."
      }`}
    >
      <Link to="/app" className="mt-btn mt-btn--primario w-full py-3.5">
        <MapPin size={18} /> Ver outros carregadores
      </Link>
    </Final>
  );
}
