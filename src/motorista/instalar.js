// Instalar o app do motorista na tela inicial.
// Android/Chrome: guarda o evento beforeinstallprompt e mostra o pedido do
// proprio celular quando a pessoa toca em Instalar. iPhone: o Safari nao deixa
// o site pedir; a tela ensina Compartilhar -> Adicionar a Tela de Inicio.
import { useSyncExternalStore } from "react";

const CHAVE_DISPENSADO = "mtInstalarDispensado";
// Fechou o aviso: volta depois de alguns dias.
const DIAS_SEM_AVISO = 4;

let pedido = null;
let instalado = false;
const ouvintes = new Set();
const avisar = () => ouvintes.forEach((fn) => fn());

if (typeof window !== "undefined") {
  // Registrado no import: o Chrome pode mandar o evento antes da tela montar.
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    pedido = e;
    avisar();
  });
  window.addEventListener("appinstalled", () => {
    instalado = true;
    pedido = null;
    avisar();
  });
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw-motorista.js", { scope: "/app" }).catch(() => {});
  }
}

const ua = () => navigator.userAgent || "";
// iPad novo se apresenta como Mac; o toque denuncia.
const ehIos = () => /iPhone|iPad|iPod/i.test(ua()) || (/Macintosh/.test(ua()) && navigator.maxTouchPoints > 1);
// No iPhone so o Safari adiciona na tela de inicio de verdade.
const ehIosForaDoSafari = () => ehIos() && /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua());
const jaAbertoComoApp = () => window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;

function dispensadoRecente() {
  try {
    const quando = Number(localStorage.getItem(CHAVE_DISPENSADO) || 0);
    return Date.now() - quando < DIAS_SEM_AVISO * 24 * 3600 * 1000;
  } catch {
    return false;
  }
}

let dispensadoAgora = false;

export function dispensarAviso() {
  dispensadoAgora = true;
  try {
    localStorage.setItem(CHAVE_DISPENSADO, String(Date.now()));
  } catch {
    // sem storage: so esconde nesta visita
  }
  avisar();
}

export async function instalarAgora() {
  if (!pedido) return false;
  const evento = pedido;
  pedido = null;
  await evento.prompt();
  const { outcome } = await evento.userChoice;
  if (outcome !== "accepted") dispensarAviso();
  else avisar();
  return outcome === "accepted";
}

// "android" (tem o pedido do Chrome), "ios", "ios-outro-navegador" ou null (nao mostra).
function modo() {
  if (instalado || dispensadoAgora || jaAbertoComoApp() || dispensadoRecente()) return null;
  if (pedido) return "android";
  if (ehIosForaDoSafari()) return "ios-outro-navegador";
  if (ehIos()) return "ios";
  return null;
}

function assinar(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

export const useModoInstalar = () => useSyncExternalStore(assinar, modo, () => null);
