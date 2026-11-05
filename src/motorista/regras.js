// Regras de tela do app do motorista (status, relogio, formatos).
import { useEffect, useState } from "react";
import { formatarValor } from "../utils/formatos";

export const SITUACOES = {
  livre: { texto: "Livre agora", curto: "Livre", cor: "var(--mt-livre)", ordem: 0 },
  reservado: { texto: "Alguem esta pagando", curto: "Reservado", cor: "var(--mt-reservado)", ordem: 1 },
  ocupado: { texto: "Em uso", curto: "Em uso", cor: "var(--mt-ocupado)", ordem: 2 },
  defeito: { texto: "Em manutencao", curto: "Manutencao", cor: "var(--mt-defeito)", ordem: 3 },
  offline: { texto: "Sem conexao", curto: "Offline", cor: "var(--mt-offline)", ordem: 4 },
};

// Relogio da tela: re-renderiza a cada intervalo para as contagens regressivas.
export function useAgora(intervalo = 1000) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setAgora(Date.now()), intervalo);
    return () => window.clearInterval(timer);
  }, [intervalo]);
  return agora;
}

// Segundos que faltam, descontando o tempo desde que o servidor respondeu.
export function restante(segundos, recebidoEm, agora) {
  if (segundos == null) return null;
  return Math.max(0, Math.round(segundos - (agora - recebidoEm) / 1000));
}

export function duracao(segundos) {
  if (segundos == null) return "";
  const minutos = Math.ceil(segundos / 60);
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

// agora vem do useAgora (render puro, sem Date.now aqui dentro).
export function horaDaqui(segundos, agora) {
  return new Date(agora + segundos * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export const formatarKm = (km) =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${km.toLocaleString("pt-BR", { maximumFractionDigits: km < 10 ? 1 : 0 })} km`;

export const precoHora = (c) => (c.preco_hora ? `${formatarValor(c.preco_hora)}/h` : "Sem preco");

// Texto do status com a previsao de liberar ("Em uso · libera em 23 min").
export function textoSituacao(c, segundos) {
  if (c.situacao === "ocupado") {
    if (c.status_recarga === "encerrando" || segundos === 0) return "Em uso · liberando agora";
    if (segundos != null) return `Em uso · libera em ~${duracao(segundos)}`;
    return "Em uso · carro conectado";
  }
  return SITUACOES[c.situacao]?.texto || c.situacao;
}
