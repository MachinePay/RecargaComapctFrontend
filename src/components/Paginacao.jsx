import { ChevronLeft, ChevronRight } from "lucide-react";

// Rodape das listas paginadas no servidor ({ total, pagina, paginas, por_pagina }).
export default function Paginacao({ dados, onPagina, carregando = false }) {
  if (!dados || dados.total === 0) return null;
  const { total, pagina, paginas, por_pagina: porPagina } = dados;
  const de = (pagina - 1) * porPagina + 1;
  const ate = Math.min(total, pagina * porPagina);
  const botao = "pill-button inline-flex h-9 items-center gap-1 px-3 text-sm font-semibold disabled:opacity-40";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-2 pt-3 text-sm text-[var(--color-text-soft)]">
      <span className="tabular-nums">
        {de}–{ate} de {total.toLocaleString("pt-BR")}
      </span>
      <div className="flex items-center gap-2">
        <button type="button" className={botao} disabled={pagina <= 1 || carregando} onClick={() => onPagina(pagina - 1)}>
          <ChevronLeft size={16} /> Anterior
        </button>
        <span className="tabular-nums font-semibold text-[var(--color-text)]">
          {pagina}/{paginas}
        </span>
        <button type="button" className={botao} disabled={pagina >= paginas || carregando} onClick={() => onPagina(pagina + 1)}>
          Proxima <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
