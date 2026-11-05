// Conta do motorista (opcional). "Manter conectado" guarda no localStorage;
// sem isso fica no sessionStorage e some quando o navegador/app fecha.
import { useSyncExternalStore } from "react";

const CHAVE = "mtConta";
const ouvintes = new Set();
let cache;

function ler() {
  try {
    const bruto = localStorage.getItem(CHAVE) || sessionStorage.getItem(CHAVE);
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}

export function contaAtual() {
  if (cache === undefined) cache = ler();
  return cache;
}

function avisar() {
  ouvintes.forEach((fn) => fn());
}

// resposta: { token, motorista } de /publico/conta ou /publico/entrar.
export function guardarConta(resposta, manter) {
  cache = { token: resposta.token, motorista: resposta.motorista };
  try {
    localStorage.removeItem(CHAVE);
    sessionStorage.removeItem(CHAVE);
    (manter ? localStorage : sessionStorage).setItem(CHAVE, JSON.stringify(cache));
  } catch {
    // sem storage: vale so enquanto a pagina estiver aberta
  }
  avisar();
}

export function sairDaConta() {
  cache = null;
  try {
    localStorage.removeItem(CHAVE);
    sessionStorage.removeItem(CHAVE);
  } catch {
    // nada guardado
  }
  avisar();
}

function assinar(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

export const useConta = () => useSyncExternalStore(assinar, contaAtual, () => null);

// Celular como a pessoa digita: (11) 98765-4321.
export function mascaraCelular(valor) {
  const d = String(valor || "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
