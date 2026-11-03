import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BatteryCharging, CheckCircle2, CircleAlert, Plug, PlugZap, WifiOff } from "lucide-react";

import {
  cancelarCobranca,
  criarCobranca,
  mensagemErroTotem,
  obterCarregador,
  obterCobranca,
  obterSessao,
  simularPagamento,
} from "../../api/totemApi";
import usePolling from "../../hooks/usePolling";
import { formatarKwh, formatarMinutos, formatarRelogio, formatarValor } from "../../utils/formatos";
import { totemConfig } from "../../utils/totemConfig";

const INTERVALO_STATUS_MS = 5000;
const INTERVALO_PAGAMENTO_MS = 2000;
const INTERVALO_SESSAO_MS = 3000;
const TEMPO_TELA_AVISO_MS = 5000;
const TEMPO_TELA_FIM_MS = 15000;
const TEMPO_TOQUE_ADMIN_MS = 5000;
// Telas em que o status do carregador e' reconsultado sozinho. O aviso tem o
// proprio timer de volta, e pagamento/recarga tem o proprio laco.
const TELAS_OCIOSAS = ["verificando", "sem_config", "offline", "indisponivel", "venda"];

/**
 * Tela do motorista no tablet do totem: escolhe o tempo, paga na Point ao lado
 * e acompanha a recarga. Quem liga e desliga o carregador e' o backend; se o
 * tablet recarregar a pagina no meio, ela volta para a recarga em andamento.
 */
export default function Totem() {
  const navigate = useNavigate();
  const [tela, setTela] = useState({ tipo: "verificando" });
  const [carregador, setCarregador] = useState(null);
  const [pacoteId, setPacoteId] = useState(null);
  const telaRef = useRef(tela);
  useEffect(() => {
    telaRef.current = tela;
  }, [tela]);

  // ---- Status do carregador ------------------------------------------------

  const atualizar = useCallback(async () => {
    if (!totemConfig.configurado()) {
      setTela({ tipo: "sem_config" });
      return;
    }
    let atual;
    try {
      atual = await obterCarregador(totemConfig.carregadorId);
    } catch (error) {
      setCarregador(null);
      if (error?.response?.status === 401 || error?.response?.status === 404) {
        setTela({ tipo: "sem_config", detalhe: mensagemErroTotem(error, "") });
      } else {
        setTela({ tipo: "offline" });
      }
      return;
    }
    setCarregador(atual);
    if (!atual.online) {
      setTela({ tipo: "offline" });
      return;
    }
    // Recarga em andamento (ou a pagina recarregou no meio dela): volta para ela.
    const sessaoId = atual.sessao_ativa?.id || totemConfig.sessaoAcompanhada;
    if (sessaoId) {
      setTela({ tipo: "sessao", sessaoId });
      return;
    }
    if (!atual.disponivel) {
      setTela({ tipo: "indisponivel" });
      return;
    }
    if (telaRef.current.tipo !== "venda") {
      setPacoteId(null);
      setTela({ tipo: "venda" });
    }
  }, []);


  usePolling(atualizar, INTERVALO_STATUS_MS, TELAS_OCIOSAS.includes(tela.tipo), { imediato: true });

  // Aviso que some sozinho e volta para a venda.
  useEffect(() => {
    if (tela.tipo !== "aviso" || !tela.voltarSozinho) return undefined;
    const timer = window.setTimeout(atualizar, TEMPO_TELA_AVISO_MS);
    return () => window.clearTimeout(timer);
  }, [tela, atualizar]);

  // ---- Pagamento -----------------------------------------------------------

  const pagar = async () => {
    if (!pacoteId) return;
    setTela({ tipo: "enviando" });
    try {
      const cobranca = await criarCobranca(totemConfig.carregadorId, pacoteId);
      setTela({ tipo: "pagando", cobranca });
    } catch (error) {
      // 409 = offline, em uso ou cobranca aberta: nada foi cobrado.
      setTela({
        tipo: "aviso",
        titulo: "Não foi possível iniciar o pagamento",
        texto: mensagemErroTotem(error, "Sem conexão com o servidor. Nenhum valor foi cobrado."),
        voltarSozinho: true,
      });
    }
  };

  const cobrancaId = tela.tipo === "pagando" ? tela.cobranca.id : null;
  useEffect(() => {
    if (!cobrancaId) return undefined;
    let ativo = true;
    const consultar = async () => {
      let cobranca;
      try {
        cobranca = await obterCobranca(cobrancaId);
      } catch {
        return; // tenta de novo no proximo ciclo
      }
      if (!ativo || cobranca.status === "aguardando_pagamento") return;
      if (cobranca.status === "aprovada" && cobranca.sessao) {
        totemConfig.acompanharSessao(cobranca.sessao.id);
        setTela({ tipo: "sessao", sessaoId: cobranca.sessao.id });
        return;
      }
      setTela({
        tipo: "aviso",
        titulo: "Pagamento não concluído",
        texto: "Nenhum valor foi cobrado.",
        voltarSozinho: true,
      });
    };
    const timer = window.setInterval(consultar, INTERVALO_PAGAMENTO_MS);
    return () => {
      ativo = false;
      window.clearInterval(timer);
    };
  }, [cobrancaId]);

  const [avisoCancelar, setAvisoCancelar] = useState("");
  const cancelar = async () => {
    try {
      await cancelarCobranca(cobrancaId);
      // O laco do pagamento ve "cancelada" e mostra o aviso.
    } catch {
      setAvisoCancelar("O pagamento já está em andamento na maquininha.");
      window.setTimeout(() => setAvisoCancelar(""), 4000);
    }
  };

  // ---- Recarga -------------------------------------------------------------

  const sessaoId = tela.tipo === "sessao" ? tela.sessaoId : null;
  const [sessao, setSessao] = useState(null);
  const [lidaEm, setLidaEm] = useState(0);
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    if (!sessaoId) return undefined;
    let ativo = true;
    let timerFim = null;
    const consultar = async () => {
      let atual;
      try {
        atual = await obterSessao(sessaoId);
      } catch (error) {
        if (ativo && error?.response?.status === 404) {
          totemConfig.acompanharSessao(null);
          atualizar();
        }
        return;
      }
      if (!ativo) return;
      setSessao(atual);
      setLidaEm(Date.now());
      if (["finalizada", "falhou"].includes(atual.status) && !timerFim) {
        timerFim = window.setTimeout(() => {
          totemConfig.acompanharSessao(null);
          setSessao(null);
          atualizar();
        }, TEMPO_TELA_FIM_MS);
      }
    };
    consultar();
    const timer = window.setInterval(consultar, INTERVALO_SESSAO_MS);
    // Entre uma consulta e outra o relogio anda aqui, segundo a segundo.
    const relogio = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => {
      ativo = false;
      window.clearInterval(timer);
      window.clearInterval(relogio);
      if (timerFim) window.clearTimeout(timerFim);
    };
  }, [sessaoId, atualizar]);

  // ---- Acesso de administrador -------------------------------------------

  const toqueAdmin = useRef(null);
  const iniciarToqueAdmin = () => {
    toqueAdmin.current = window.setTimeout(() => navigate("/totem/configurar"), TEMPO_TOQUE_ADMIN_MS);
  };
  const cancelarToqueAdmin = () => window.clearTimeout(toqueAdmin.current);

  // ---- Render --------------------------------------------------------------

  const pacotes = carregador?.pacotes || [];
  const pacote = pacotes.find((p) => p.id === pacoteId);
  const status = statusDoCarregador(tela, carregador);

  return (
    <div className="flex min-h-screen select-none flex-col bg-white px-6 py-8 sm:px-10">
      <div
        className="mx-auto"
        onPointerDown={iniciarToqueAdmin}
        onPointerUp={cancelarToqueAdmin}
        onPointerLeave={cancelarToqueAdmin}
        onContextMenu={(e) => e.preventDefault()}
      >
        <img src="/logoCompactpay.jpeg" alt="CompactPay" className="h-24 w-24 rounded-3xl object-cover" draggable={false} />
      </div>

      <div className="mt-3 text-center text-3xl font-extrabold tracking-[-0.03em] text-[var(--color-text)]">
        {carregador?.nome || "Recarga de veículo elétrico"}
      </div>
      <div className="mt-3 flex justify-center">
        <span className={`rounded-full px-5 py-1.5 text-base font-semibold ${status.classe}`}>{status.texto}</span>
      </div>

      <div className="mx-auto mt-8 flex w-full max-w-2xl flex-1 flex-col">
        {tela.tipo === "venda" ? (
          <Venda
            carregador={carregador}
            pacotes={pacotes}
            pacoteId={pacoteId}
            onEscolher={setPacoteId}
            onPagar={pagar}
            pacote={pacote}
          />
        ) : null}

        {tela.tipo === "verificando" ? <Aviso progresso titulo="Verificando carregador…" /> : null}
        {tela.tipo === "enviando" ? <Aviso progresso titulo="Enviando para a maquininha…" /> : null}
        {tela.tipo === "sem_config" ? (
          <Aviso
            icone={<CircleAlert size={56} />}
            titulo="Tablet não configurado"
            texto={tela.detalhe || "Peça ao responsável para vincular este tablet a um carregador."}
          />
        ) : null}
        {tela.tipo === "offline" ? (
          <Aviso
            icone={<WifiOff size={56} />}
            titulo="Carregador sem conexão"
            texto="O carregador está sem conexão no momento. Nenhum valor será cobrado."
          />
        ) : null}
        {tela.tipo === "indisponivel" ? (
          <Aviso
            icone={<CircleAlert size={56} />}
            titulo="Carregador indisponível"
            texto="Aguarde um momento. Se continuar assim, procure o responsável."
          />
        ) : null}
        {tela.tipo === "aviso" ? <Aviso icone={<CircleAlert size={56} />} titulo={tela.titulo} texto={tela.texto} /> : null}

        {tela.tipo === "pagando" ? (
          <Aviso
            progresso
            titulo="Pague na maquininha ao lado"
            texto={`${formatarMinutos(tela.cobranca.minutos)} de recarga · ${formatarValor(tela.cobranca.valor)}`}
          >
            <button
              type="button"
              onClick={cancelar}
              className="pill-button mt-8 px-10 py-4 text-xl font-bold"
            >
              Cancelar
            </button>
            {avisoCancelar ? <div className="mt-3 text-base text-[var(--color-error)]">{avisoCancelar}</div> : null}
            {tela.cobranca.origem === "simulado" ? (
              // Backend com MP_SIMULADO: este botao faz o papel da Point (bancada).
              <button
                type="button"
                onClick={() => simularPagamento(tela.cobranca.id).catch(() => {})}
                className="mt-4 text-base font-semibold text-[var(--color-primary)] underline"
              >
                Simular pagamento (teste)
              </button>
            ) : null}
          </Aviso>
        ) : null}

        {tela.tipo === "sessao" ? (
          <Recarga sessao={sessao} restantes={restantesAgora(sessao, lidaEm, agora)} />
        ) : null}
      </div>
    </div>
  );
}

function restantesAgora(sessao, lidaEm, agora) {
  if (sessao?.segundos_restantes == null) return null;
  return Math.max(0, sessao.segundos_restantes - Math.floor((agora - lidaEm) / 1000));
}

function statusDoCarregador(tela, carregador) {
  const ok = "bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]";
  const erro = "bg-rose-50 text-[var(--color-error)]";
  if (tela.tipo === "verificando") return { texto: "Verificando…", classe: ok };
  if (tela.tipo === "sem_config") return { texto: "Não configurado", classe: erro };
  if (!carregador || !carregador.online) return { texto: "Sem conexão", classe: erro };
  if (carregador.sessao_ativa || tela.tipo === "sessao") return { texto: "Em uso", classe: ok };
  if (carregador.disponivel) return { texto: "Disponível", classe: ok };
  return { texto: "Indisponível", classe: erro };
}

function Venda({ carregador, pacotes, pacoteId, onEscolher, onPagar, pacote }) {
  const caboConectado = carregador?.cabo_conectado;
  return (
    <div className="flex flex-1 flex-col">
      <ol className="rounded-[24px] bg-[var(--color-primary-soft)] px-6 py-5 text-xl leading-9 text-[var(--color-primary-strong)]">
        <li>1. Conecte o cabo no carro</li>
        <li>2. Escolha o tempo</li>
        <li>3. Pague na maquininha ao lado</li>
      </ol>

      <div
        className={`mt-5 flex items-center justify-center gap-2 text-xl font-bold ${
          caboConectado ? "text-[var(--color-primary)]" : "text-[var(--color-text-soft)]"
        }`}
      >
        {caboConectado ? <PlugZap size={26} /> : <Plug size={26} />}
        {caboConectado ? "Cabo conectado" : "Conecte o cabo no carro antes de pagar"}
      </div>

      <div className="mt-6 text-lg text-[var(--color-text-soft)]">Escolha o tempo de recarga</div>
      <div className="mt-3 grid grid-cols-2 gap-4">
        {pacotes.map((p) => {
          const ativo = p.id === pacoteId;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onEscolher(p.id)}
              className={`rounded-[24px] border-2 px-4 py-6 text-center transition ${
                ativo
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-[0_16px_30px_rgba(31,122,76,0.28)]"
                  : "border-[var(--color-primary)] bg-white text-[var(--color-primary-strong)]"
              }`}
            >
              <div className="text-3xl font-extrabold">{formatarMinutos(p.minutos)}</div>
              <div className={`mt-1 text-xl font-semibold ${ativo ? "text-white/85" : "text-[var(--color-text-soft)]"}`}>
                {formatarValor(p.valor)}
              </div>
            </button>
          );
        })}
      </div>
      {pacotes.length === 0 ? (
        <div className="mt-6 text-center text-lg text-[var(--color-text-soft)]">Nenhum pacote cadastrado.</div>
      ) : null}

      <div className="flex-1" />
      <button
        type="button"
        disabled={!pacote}
        onClick={onPagar}
        className="pill-button pill-button--primary mt-8 w-full py-6 text-2xl font-extrabold disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
      >
        {pacote ? `Pagar ${formatarValor(pacote.valor)}` : "Escolha um tempo"}
      </button>
    </div>
  );
}

function Aviso({ icone, progresso, titulo, texto, children }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      {progresso ? (
        <div className="h-20 w-20 animate-spin rounded-full border-[6px] border-[var(--color-primary-soft)] border-t-[var(--color-primary)]" />
      ) : (
        <div className="text-[var(--color-text-soft)]">{icone}</div>
      )}
      <div className="mt-6 text-3xl font-extrabold text-[var(--color-text)]">{titulo}</div>
      {texto ? <div className="mt-3 text-xl text-[var(--color-text-soft)]">{texto}</div> : null}
      {children}
    </div>
  );
}

function Recarga({ sessao, restantes }) {
  if (!sessao) return <Aviso progresso titulo="Carregando informações…" />;
  const energia = sessao.energia_kwh > 0 ? `Energia entregue: ${formatarKwh(sessao.energia_kwh)}` : "";

  if (sessao.status === "carregando") {
    const total = sessao.minutos_pagos * 60;
    const feito = total > 0 ? ((total - (restantes ?? 0)) / total) * 100 : 0;
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <BatteryCharging size={56} className="text-[var(--color-primary)]" />
        <div className="mt-4 text-8xl font-extrabold tabular-nums tracking-[-0.04em] text-[var(--color-primary-strong)] sm:text-9xl">
          {formatarRelogio(restantes ?? 0)}
        </div>
        <div className="mt-6 h-4 w-full overflow-hidden rounded-full bg-[var(--color-bg-muted)]">
          <div className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-1000" style={{ width: `${feito}%` }} />
        </div>
        <div className="mt-6 text-3xl font-extrabold text-[var(--color-text)]">Carregando</div>
        <div className="mt-2 text-xl text-[var(--color-text-soft)]">O carregador desliga sozinho quando o tempo acabar.</div>
        {energia ? <div className="mt-4 text-lg font-semibold text-[var(--color-primary-strong)]">{energia}</div> : null}
      </div>
    );
  }
  if (sessao.status === "aguardando_inicio") return <Aviso progresso titulo="Liberando o carregador…" />;
  if (sessao.status === "aguardando_carro") {
    return (
      <Aviso
        progresso
        titulo="Conecte o cabo no carro"
        texto={`Seus ${formatarMinutos(sessao.minutos_pagos)} começam a contar quando o carro começar a carregar.`}
      />
    );
  }
  if (sessao.status === "encerrando") return <Aviso progresso titulo="Finalizando a recarga…" texto={energia} />;
  if (sessao.status === "finalizada") {
    return (
      <Aviso
        icone={<CheckCircle2 size={64} className="text-[var(--color-primary)]" />}
        titulo="Recarga finalizada"
        texto={`Pode desconectar o cabo. Obrigado!${energia ? ` ${energia}` : ""}`}
      />
    );
  }
  return (
    <Aviso
      icone={<CircleAlert size={56} />}
      titulo="Não foi possível iniciar a recarga"
      texto="O valor pago será devolvido automaticamente. Se não aparecer, procure o responsável."
    />
  );
}
