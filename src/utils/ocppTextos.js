// Traduz as mensagens OCPP para frases que da para ler sem conhecer o protocolo.

export const STATUS_CONECTOR = {
  Available: "Livre",
  Preparing: "Preparando (cabo conectado, esperando liberar)",
  Charging: "Carregando",
  SuspendedEV: "Pausado pelo carro",
  SuspendedEVSE: "Pausado pelo carregador",
  Finishing: "Finalizando",
  Reserved: "Reservado",
  Unavailable: "Indisponivel",
  Faulted: "Com defeito",
};

export const RESPOSTAS_OCPP = {
  Accepted: "aceito",
  Rejected: "recusado",
  NotSupported: "nao suportado",
  NotImplemented: "nao implementado",
  Unlocked: "destravado",
  UnlockFailed: "nao conseguiu destravar",
  RebootRequired: "precisa reiniciar",
  Scheduled: "agendado",
};

const ACOES_SERVIDOR = {
  RemoteStartTransaction: "Servidor mandou LIGAR a recarga",
  RemoteStopTransaction: "Servidor mandou DESLIGAR a recarga",
  GetConfiguration: "Servidor pediu as configuracoes",
  ChangeConfiguration: "Servidor mudou uma configuracao",
  TriggerMessage: "Servidor pediu uma mensagem agora",
  Reset: "Servidor mandou reiniciar",
  UnlockConnector: "Servidor mandou destravar o cabo",
};

export const TIPOS_CONEXAO = ["tentativa", "aceita", "recusada", "desconectou", "http"];
export const TIPOS_DO_CARREGADOR = ["recebida", "resposta_recebida"];
export const TIPOS_DO_SERVIDOR = ["enviada", "resposta_enviada"];

export function lerBruto(evento) {
  if (!evento?.bruto) return null;
  try {
    return JSON.parse(evento.bruto);
  } catch {
    return null;
  }
}

function payloadDe(evento) {
  const msg = lerBruto(evento);
  if (!Array.isArray(msg)) return {};
  // CALL = [2, id, acao, payload]; CALLRESULT = [3, id, payload]
  const payload = msg[0] === 2 ? msg[3] : msg[2];
  return payload && typeof payload === "object" ? payload : {};
}

function energiaDe(payload) {
  for (const leitura of payload.meterValue || []) {
    for (const valor of leitura.sampledValue || []) {
      if (!valor.measurand || valor.measurand === "Energy.Active.Import.Register") {
        const wh = Number(valor.value) * (valor.unit === "kWh" ? 1000 : 1);
        if (!Number.isNaN(wh)) return `${(wh / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kWh no medidor`;
      }
    }
  }
  return "";
}

// Frase principal de cada linha do log ao vivo.
export function descreverEvento(evento) {
  const p = payloadDe(evento);
  const acao = evento.acao;

  if (evento.tipo === "recebida") {
    if (acao === "BootNotification") {
      const partes = [p.chargePointVendor, p.chargePointModel].filter(Boolean).join(" ");
      return `Carregador se apresentou${partes ? `: ${partes}` : ""}${p.firmwareVersion ? ` (firmware ${p.firmwareVersion})` : ""}`;
    }
    if (acao === "Heartbeat") return "Sinal de vida (Heartbeat)";
    if (acao === "StatusNotification") {
      const erro = p.errorCode && p.errorCode !== "NoError" ? ` · erro ${p.errorCode}` : "";
      return `Conector ${p.connectorId ?? "?"}: ${STATUS_CONECTOR[p.status] || p.status}${erro}`;
    }
    if (acao === "StartTransaction") return `Recarga comecou (tag ${p.idTag || "?"})`;
    if (acao === "StopTransaction") return `Recarga parou${p.reason ? ` (motivo: ${p.reason})` : ""}`;
    if (acao === "MeterValues") return `Medicao de energia${energiaDe(p) ? `: ${energiaDe(p)}` : ""}`;
    if (acao === "Authorize") return `Cartao aproximado: ${p.idTag || "?"}`;
    return evento.resumo;
  }

  if (evento.tipo === "resposta_recebida" && p.status) {
    return `Carregador respondeu ${acao}: ${RESPOSTAS_OCPP[p.status] || p.status}`;
  }
  if (evento.tipo === "enviada" && evento.nivel !== "erro" && ACOES_SERVIDOR[acao]) {
    return ACOES_SERVIDOR[acao];
  }
  if (evento.tipo === "resposta_enviada" && acao === "BootNotification" && p.status) {
    return `Servidor aceitou a apresentacao (${p.status})`;
  }
  return evento.resumo;
}

export function direcaoEvento(evento) {
  if (TIPOS_DO_CARREGADOR.includes(evento.tipo)) return "carregador";
  if (TIPOS_DO_SERVIDOR.includes(evento.tipo)) return "servidor";
  return "conexao";
}

// Resultado de um teste rapido em linguagem simples.
export function interpretarResposta(resposta) {
  const status = resposta?.status;
  if (!status) return { estado: "ok", titulo: "O carregador respondeu" };
  if (status === "Accepted" || status === "Unlocked") return { estado: "ok", titulo: `Aceito pelo carregador (${status})` };
  if (status === "NotImplemented" || status === "NotSupported") {
    return { estado: "aviso", titulo: "O carregador nao suporta este comando", explicacao: "Nao e' defeito: esse firmware simplesmente nao implementa isso." };
  }
  return { estado: "erro", titulo: `O carregador respondeu: ${RESPOSTAS_OCPP[status] || status}` };
}
