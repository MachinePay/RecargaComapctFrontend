// Historico de operacao de um carregador, paginado no servidor, com filtro
// por categoria. A primeira pagina se atualiza sozinha.
import { useCallback, useEffect, useState } from "react";

import api from "../api/axios";
import usePolling from "../hooks/usePolling";
import Badge from "./Badge";
import Paginacao from "./Paginacao";
import { formatarDataHora, formatarValor } from "../utils/formatos";

const CATEGORIAS = {
  PAGAMENTO: "ok",
  SESSAO: "aviso",
  DISPOSITIVO: "neutro",
  TESTE: "neutro",
};

export default function HistoricoCarregador({ carregadorId }) {
  const [categoria, setCategoria] = useState("");
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState(null);

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get(`/admin/carregadores/${encodeURIComponent(carregadorId)}/historico`, {
        params: { categoria: categoria || undefined, pagina, por_pagina: 50 },
      });
      setDados(data);
    } catch {
      // Toast global
    }
  }, [carregadorId, categoria, pagina]);

  // Filtro ou pagina mudou: busca de novo (espera um instante enquanto digita a data).
  useEffect(() => {
    const timer = window.setTimeout(carregar, 250);
    return () => window.clearTimeout(timer);
  }, [carregar]);

  usePolling(carregar, 10000, pagina === 1);

  return (
    <div>
      <div className="flex flex-wrap gap-1 pb-2">
        {[["", "Tudo"], ...Object.keys(CATEGORIAS).map((c) => [c, c.charAt(0) + c.slice(1).toLowerCase()])].map(([valor, texto]) => (
          <button
            key={valor}
            type="button"
            onClick={() => {
              setCategoria(valor);
              setPagina(1);
            }}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              categoria === valor ? "bg-[var(--color-text)] text-white" : "bg-[var(--color-bg-muted)] text-[var(--color-text-soft)] hover:text-[var(--color-text)]"
            }`}
          >
            {texto}
          </button>
        ))}
      </div>
      <ul className="text-sm">
        {(dados?.itens || []).map((h, i) => (
          <li key={`${h.created_at}-${i}`} className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] py-2">
            <span className="w-[110px] shrink-0 tabular-nums text-xs text-[var(--color-text-soft)]">{formatarDataHora(h.created_at)}</span>
            <Badge tom={CATEGORIAS[h.categoria]}>{h.categoria}</Badge>
            <span className={`min-w-0 flex-1 ${/ALERTA|FALHOU|ATENCAO/.test(h.descricao) ? "font-semibold text-[var(--color-error)]" : ""}`}>{h.descricao}</span>
            {h.valor ? <span className="font-semibold">{formatarValor(h.valor)}</span> : null}
          </li>
        ))}
        {dados && dados.total === 0 ? <li className="py-6 text-center text-[var(--color-text-soft)]">Nada registrado.</li> : null}
      </ul>
      <Paginacao dados={dados} onPagina={setPagina} />
    </div>
  );
}
