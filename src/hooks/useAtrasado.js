import { useEffect, useState } from "react";

// Valor que so muda depois que a pessoa para de digitar (busca no servidor
// sem uma consulta por tecla).
export default function useAtrasado(valor, ms = 350) {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const timer = window.setTimeout(() => setAtrasado(valor), ms);
    return () => window.clearTimeout(timer);
  }, [valor, ms]);
  return atrasado;
}
