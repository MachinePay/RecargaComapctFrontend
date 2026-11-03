const TONS = {
  ok: "bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]",
  aviso: "bg-amber-50 text-amber-800",
  erro: "bg-rose-50 text-[var(--color-error)]",
  neutro: "bg-[var(--color-bg-muted)] text-[var(--color-text-soft)]",
};

export default function Badge({ tom = "neutro", children }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${TONS[tom] || TONS.neutro}`}>
      {children}
    </span>
  );
}
