import { useEffect, useRef } from "react";

// Atualizacao automatica das telas que so consulta o servidor com a aba
// visivel. Antes cada tela usava um setInterval direto, que continuava
// batendo nos endpoints mais pesados com a aba minimizada ou em segundo plano.
// Ao voltar para a aba, atualiza na hora se ja passou o intervalo, para nunca
// mostrar dado velho.
// imediato: tambem roda assim que liga (carga inicial da tela).
export default function usePolling(callback, intervalMs, enabled = true, { imediato = false } = {}) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return undefined;
    if (imediato) callbackRef.current();
    if (!intervalMs) return undefined;

    let timer = null;
    let lastRun = Date.now();

    const tick = () => {
      lastRun = Date.now();
      callbackRef.current();
    };
    const start = () => {
      if (timer === null) timer = window.setInterval(tick, intervalMs);
    };
    const stop = () => {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    };
    const handleVisibility = () => {
      if (document.hidden) {
        stop();
        return;
      }
      if (Date.now() - lastRun >= intervalMs) tick();
      start();
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [intervalMs, enabled, imediato]);
}
