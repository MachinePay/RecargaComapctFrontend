import axios from "axios";

function normalizeApiBaseUrl(value) {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return "/api/v1";
  const semBarra = trimmedValue.replace(/\/+$/, "");
  // Esquecer o /api/v1 no VITE_API_URL da Vercel da 404 em tudo; completa aqui.
  return semBarra.endsWith("/api/v1") ? semBarra : `${semBarra}/api/v1`;
}

export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_URL);
const listeners = [];

export function addApiErrorListener(fn) {
  listeners.push(fn);
  return () => {
    const index = listeners.indexOf(fn);
    if (index >= 0) listeners.splice(index, 1);
  };
}

function notifyApiError(payload) {
  listeners.forEach((fn) => fn(payload));
}

function redirectToLogin() {
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const loginPath = currentPath.startsWith("/login")
    ? "/login"
    : `/login?redirect=${encodeURIComponent(currentPath)}`;
  window.location.assign(loginPath);
}

function normalizeDetail(detail) {
  if (!detail) return "";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => item?.msg || item?.message || JSON.stringify(item))
      .filter(Boolean)
      .join(" ");
  }
  return detail.message || detail.error || JSON.stringify(detail);
}

export function getApiErrorMessage(error, fallback = "Erro inesperado. Tente novamente.") {
  if (error?.compactpayMessage) return error.compactpayMessage;

  const status = error?.response?.status;
  const data = error?.response?.data;
  const detail = normalizeDetail(data?.detail || data?.message || data?.error || data);

  if (status === 400) return detail || "Confira os dados informados e tente novamente.";
  if (status === 401) return "Chave de acesso invalida. Entre novamente.";
  if (status === 404) return detail || "Registro nao encontrado.";
  if (status === 409) return detail || "Esta operacao conflita com dados ja cadastrados.";
  if (status === 422) return detail || "Algum campo obrigatorio esta ausente ou invalido.";
  if (status === 504) return detail || "O carregador nao respondeu a tempo.";
  if (status >= 500) {
    return detail ? `Falha no servidor (${status}): ${detail}` : `Falha no servidor (${status}). Tente novamente.`;
  }
  if (detail) return detail;

  if (error?.code === "ECONNABORTED") {
    return "A requisicao demorou demais para responder. Tente novamente.";
  }
  if (error?.message === "Network Error" || !error?.response) {
    return "Nao foi possivel conectar ao backend. Verifique se a API esta online e se o dominio esta liberado no CORS.";
  }

  return fallback;
}

// Painel: autentica pela chave de admin (X-Admin-Key) guardada no login.
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const adminKey = localStorage.getItem("adminKey");
  if (adminKey) {
    config.headers["X-Admin-Key"] = adminKey;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = getApiErrorMessage(error);
    error.compactpayMessage = message;

    if (error.response?.status === 401 && !error.config?.silencioso) {
      localStorage.removeItem("adminKey");
      redirectToLogin();
    }

    if (!error.config?.silencioso) {
      notifyApiError({
        message,
        status: error.response?.status,
        type: "error",
        title: error.response?.status ? `Erro ${error.response.status}` : "Falha de conexao",
      });
    }
    return Promise.reject(error);
  },
);

export default api;
