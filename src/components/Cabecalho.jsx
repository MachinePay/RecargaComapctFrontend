export default function Cabecalho({ etiqueta, titulo, descricao, acoes }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--color-text-soft)]">{etiqueta}</div>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-[var(--color-text)] md:text-4xl">{titulo}</h1>
        {descricao ? <p className="mt-2 text-sm text-[var(--color-text-soft)]">{descricao}</p> : null}
      </div>
      {acoes ? <div className="flex flex-wrap gap-2">{acoes}</div> : null}
    </div>
  );
}
