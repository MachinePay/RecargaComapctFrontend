import { useCallback, useEffect, useState } from "react";

import api from "../api/axios";
import usePolling from "./usePolling";

// Lista paginada no servidor ({ itens, total, pagina, paginas, por_pagina }).
// Filtro novo volta para a pagina 1; a pagina aberta se atualiza sozinha.
export default function useListaPaginada(url, filtros, { porPagina = 25, intervalo = 30000 } = {}) {
  const chave = JSON.stringify(filtros);
  const [pagina, setPagina] = useState(1);
  const [chaveAnterior, setChaveAnterior] = useState(chave);
  const [dados, setDados] = useState(null);

  if (chave !== chaveAnterior) {
    setChaveAnterior(chave);
    setPagina(1);
  }

  const carregar = useCallback(async () => {
    // Filtro vazio nao vai na URL.
    const params = Object.fromEntries(Object.entries(JSON.parse(chave)).filter(([, v]) => v !== "" && v != null && v !== false));
    try {
      const { data } = await api.get(url, { params: { ...params, pagina, por_pagina: porPagina } });
      setDados(data);
    } catch {
      // Toast global
    }
  }, [url, chave, pagina, porPagina]);

  useEffect(() => {
    const timer = window.setTimeout(carregar, 0);
    return () => window.clearTimeout(timer);
  }, [carregar]);

  usePolling(carregar, intervalo);

  return { dados, itens: dados?.itens || [], setPagina, recarregar: carregar };
}
