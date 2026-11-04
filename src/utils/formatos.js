import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import "dayjs/locale/pt-br";

dayjs.extend(utc);
dayjs.locale("pt-br");

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const formatarValor = (valor) => moeda.format(Number(valor || 0));

export function formatarMinutos(minutos) {
  if (minutos >= 60 && minutos % 60 === 0) return `${minutos / 60} h`;
  if (minutos > 60) return `${Math.floor(minutos / 60)} h ${minutos % 60} min`;
  return `${minutos} min`;
}

export function formatarRelogio(segundos) {
  const s = Math.max(0, Math.floor(segundos || 0));
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${m}:${ss}` : `${m}:${ss}`;
}

export const formatarKwh = (kwh) => `${Number(kwh || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kWh`;

// O backend grava UTC sem fuso; mostra no horario de Brasilia.
export function formatarDataHora(valor) {
  if (!valor) return "-";
  return dayjs.utc(valor).subtract(3, "hour").format("DD/MM HH:mm:ss");
}

export function formatarHora(valor) {
  if (!valor) return "-";
  return dayjs.utc(valor).subtract(3, "hour").format("HH:mm:ss");
}

export const STATUS_SESSAO = {
  aguardando_inicio: { texto: "Liberando", tom: "aviso" },
  aguardando_carro: { texto: "Aguardando carro", tom: "aviso" },
  carregando: { texto: "Carregando", tom: "ok" },
  encerrando: { texto: "Encerrando", tom: "aviso" },
  finalizada: { texto: "Finalizada", tom: "neutro" },
  falhou: { texto: "Falhou", tom: "erro" },
};

export const MOTIVOS_FIM = {
  tempo_esgotado: "Tempo esgotado",
  carro_desconectado: "Carro desconectado",
  parado_no_carregador: "Parado no carregador",
  encerrada_pelo_admin: "Encerrada pelo painel",
  carro_nao_conectado: "Carro nao conectado a tempo",
  carregador_nao_respondeu: "Carregador nao respondeu",
  remote_start_rejeitado: "Carregador recusou",
  carregador_ocupado: "Carregador ocupado",
  queda_de_energia: "Queda de energia",
  carregador_reiniciou: "Carregador reiniciou",
  parada_emergencia: "Parada de emergencia",
  stop_recusado_verificar: "Verificar: stop recusado",
  stop_sem_confirmacao: "Parou (sem confirmacao do carregador)",
  carro_nao_puxou_energia: "Carro nao puxou energia (estornado)",
};
