import { Search } from "lucide-react";

// Busca das listas (o servidor filtra; use com useAtrasado).
export default function CampoBusca({ valor, onMudar, placeholder = "Buscar..." }) {
  return (
    <label className="relative min-w-[220px] flex-1">
      <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-soft)]" />
      <input
        className="w-full rounded-full border border-[var(--color-border)] bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[var(--color-primary)]"
        placeholder={placeholder}
        value={valor}
        onChange={(e) => onMudar(e.target.value)}
      />
    </label>
  );
}
