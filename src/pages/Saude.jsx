import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { CircleCheck, CircleX, HeartPulse, Info, TriangleAlert, WifiOff } from "lucide-react";

import api from "../api/axios";
import usePolling from "../hooks/usePolling";
import Cabecalho from "../components/Cabecalho";
import LoadingSpinner from "../components/LoadingSpinner";
import { CartaoResumo } from "../components/CarregadorUi";
import { formatarDataHora } from "../utils/formatos";

const NIVEIS = {
  critico: { Icone: CircleX, cor: "text-[var(--color-error)]", fundo: "bg-rose-50", texto: "Critico" },
  aviso: { Icone: TriangleAlert, cor: "text-[var(--color-warning)]", fundo: "bg-amber-50", texto: "Atencao" },
  info: { Icone: Info, cor: "text-sky-700", fundo: "bg-sky-50", texto: "Info" },
  ok: { Icone: CircleCheck, cor: "text-[var(--color-success)]", fundo: "bg-[var(--color-primary-soft)]", texto: "Tudo certo" },
};

export default function Saude() {
  const [dados, setDados] = useState(null);
  const [filtro, setFiltro] = useState("problemas");

  const carregar = useCallback(async () => {
    try {
      setDados((await api.get("/admin/saude")).data);
    } catch {
      // Toast global
    }
  }, []);

  usePolling(carregar, 15000, true, { imediato: true });

  if (!dados) return <LoadingSpinner className="min-h-[60vh]" />;
  const { resumo } = dados;
  const visiveis = dados.carregadores.filter((c) => (filtro === "todos" ? true : filtro === "problemas" ? c.status !== "ok" : c.status === filtro));

  return (
    <div className="space-y-4 p-2 sm:p-4">
      <Cabecalho etiqueta="Operacao" titulo="Saude dos carregadores" descricao="O que precisa de atencao em cada carregador, com o que fazer. Atualiza a cada 15 segundos." />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CartaoResumo rotulo="Online" valor={`${resumo.online}/${resumo.total}`} ajuda="conectados agora" Icone={HeartPulse} destaque />
        <CartaoResumo rotulo="Criticos" valor={resumo.critico} ajuda="offline, defeito ou estorno" Icone={CircleX} />
        <CartaoResumo rotulo="Atencao" valor={resumo.aviso} ajuda="configuracao incompleta ou instavel" Icone={TriangleAlert} />
        <CartaoResumo rotulo="Tudo certo" valor={resumo.ok} ajuda="sem pendencias" Icone={CircleCheck} />
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ["problemas", `Com pendencia (${resumo.critico + resumo.aviso})`],
          ["critico", `Criticos (${resumo.critico})`],
          ["aviso", `Atencao (${resumo.aviso})`],
          ["ok", `Tudo certo (${resumo.ok})`],
          ["todos", `Todos (${resumo.total})`],
        ].map(([chave, texto]) => (
          <button
            key={chave}
            type="button"
            onClick={() => setFiltro(chave)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${filtro === chave ? "bg-[var(--color-primary)] text-white" : "bg-white text-[var(--color-text-soft)]"}`}
          >
            {texto}
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {visiveis.map((c) => {
          const nivel = NIVEIS[c.status];
          return (
            <Link
              key={c.id_hardware}
              to={`/carregadores/${encodeURIComponent(c.id_hardware)}`}
              className="app-panel block p-4 transition hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-extrabold text-[var(--color-text)]">{c.nome_local}</div>
                  <div className="truncate text-xs text-[var(--color-text-soft)]">
                    {c.id_hardware} {c.cliente_nome ? `· ${c.cliente_nome}` : ""}
                  </div>
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${nivel.fundo} ${nivel.cor}`}>
                  <nivel.Icone size={14} /> {nivel.texto}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[var(--color-text-soft)]">
                <span className="inline-flex items-center gap-1">
                  {c.online ? <CircleCheck size={12} className="text-[var(--color-success)]" /> : <WifiOff size={12} className="text-[var(--color-error)]" />}
                  {c.online ? "Online" : `Visto ${formatarDataHora(c.ultimo_sinal)}`}
                </span>
                <span>{c.quedas_7d} queda(s) em 7 dias</span>
                {c.firmware_version ? <span>fw {c.firmware_version}</span> : null}
              </div>
              {c.alertas.length ? (
                <ul className="mt-3 space-y-1.5">
                  {c.alertas.map((a) => {
                    const n = NIVEIS[a.nivel];
                    return (
                      <li key={a.texto} className={`rounded-[12px] px-3 py-2 text-sm ${n.fundo}`}>
                        <div className={`flex items-center gap-1.5 font-semibold ${n.cor}`}>
                          <n.Icone size={14} /> {a.texto}
                        </div>
                        {a.dica ? <div className="mt-0.5 text-xs text-[var(--color-text-soft)]">{a.dica}</div> : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="mt-3 rounded-[12px] bg-[var(--color-primary-soft)] px-3 py-2 text-sm font-semibold text-[var(--color-success)]">Nenhuma pendencia.</div>
              )}
            </Link>
          );
        })}
        {visiveis.length === 0 ? <div className="app-panel p-8 text-center text-sm text-[var(--color-text-soft)] lg:col-span-2">Nada nesse filtro.</div> : null}
      </div>
    </div>
  );
}
