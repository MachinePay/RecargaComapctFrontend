import axios from "axios";

import { API_BASE_URL } from "./axios";

// Tela do totem: autentica pela chave do tablet (X-Terminal-Key), separada do
// painel. Sem toast global nem redirecionamento para o login: o motorista nunca
// deve ver erro tecnico, a tela trata cada caso.
const totemApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 40000, // criar cobranca espera o Mercado Pago
});

totemApi.interceptors.request.use((config) => {
  const chave = localStorage.getItem("totem.chave");
  if (chave) {
    config.headers["X-Terminal-Key"] = chave;
  }
  return config;
});

export function mensagemErroTotem(error, fallback) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string" && detail) return detail;
  return fallback;
}

export const obterCarregador = (id) =>
  totemApi.get(`/carregador/carregadores/${encodeURIComponent(id)}`).then((r) => r.data);

export const criarCobranca = (carregadorId, pacoteId) =>
  totemApi.post("/carregador/cobrancas", { carregador_id: carregadorId, pacote_id: pacoteId }).then((r) => r.data);

export const obterCobranca = (id) => totemApi.get(`/carregador/cobrancas/${id}`).then((r) => r.data);

export const cancelarCobranca = (id) => totemApi.post(`/carregador/cobrancas/${id}/cancelar`).then((r) => r.data);

export const simularPagamento = (id) =>
  totemApi.post(`/carregador/cobrancas/${id}/simular-pagamento`).then((r) => r.data);

export const obterSessao = (id) => totemApi.get(`/carregador/sessoes/${id}`).then((r) => r.data);
