// Recargas paginadas no servidor (/admin/recargas) com filtros. Usada na tela
// Recargas (todos os carregadores) e na pagina de um carregador.
// So a pagina aberta vem do servidor; a primeira pagina se atualiza sozinha
// (recarga nova aparece), as outras ficam paradas.
import { useCallback, useEffect, useState } from "react";
import dayjs from "dayjs";

import api from "../api/axios";
import { useAuth } from "../context/useAuth";
import usePolling from "../hooks/usePolling";
import Paginacao from "./Paginacao";
import TabelaSessoes from "./TabelaSessoes";
import { confirmar } from "../utils/confirmar";
import { estornarRecarga } from "../utils/estornar";

const PERIODOS = [
  ["hoje", "Hoje"],
  ["7d", "7 dias"],
  ["30d", "30 dias"],
  ["tudo", "Tudo"],
  ["datas", "Datas"],
];

const STATUS = [
  ["", "Todos os status"],
  ["ativas", "Em andamento"],
  ["finalizada", "Finalizadas"],
  ["falhou", "Falharam"],
];

const ORIGENS = [
  ["", "Todas as origens"],
  ["caixa", "Maquininha Mercado Pago"],
  ["sumup", "SumUp"],
  ["pix", "Pix (app)"],
  ["voucher", "Voucher"],
  ["point", "Point"],
  ["teste", "Teste"],
  ["simulado", "Simulado"],
];

const filtrosIniciais = { periodo: "30d", de: "", ate: "", status: "", origem: "", carregador: "", estornadas: false };

function datasDoPeriodo({ periodo, de, ate }) {
  const hoje = dayjs().format("YYYY-MM-DD");
  if (periodo === "hoje") return { de: hoje, ate: hoje };
  if (periodo === "7d") return { de: dayjs().subtract(6, "day").format("YYYY-MM-DD"), ate: hoje };
  if (periodo === "30d") return { de: dayjs().subtract(29, "day").format("YYYY-MM-DD"), ate: hoje };
  if (periodo === "datas") return { de: de || undefined, ate: ate || undefined };
  return {};
}

const seletor = "h-9 rounded-full border border-[var(--color-border)] bg-white px-3 text-sm font-semibold text-[var(--color-text)]";

export default function ListaRecargas({ carregadorId, porPagina = 25, onTotal }) {
  const { isAdmin } = useAuth();
  const [filtros, setFiltros] = useState(filtrosIniciais);
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState(null);
  const [carregadores, setCarregadores] = useState([]);

  // Lista de carregadores so na tela geral (no carregador o filtro ja e' fixo).
  useEffect(() => {
    if (carregadorId) return;
    api
      .get("/admin/carregadores")
      .then(({ data }) => setCarregadores(data))
      .catch(() => {});
  }, [carregadorId]);

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/recargas", {
        params: {
          ...datasDoPeriodo(filtros),
          carregador_id: carregadorId || filtros.carregador || undefined,
          status: filtros.status || undefined,
          origem: filtros.origem || undefined,
          estornadas: filtros.estornadas || undefined,
          pagina,
          por_pagina: porPagina,
        },
      });
      setDados(data);
      onTotal?.(data.total);
    } catch {
      // Toast global
    }
  }, [filtros, pagina, porPagina, carregadorId, onTotal]);

  // Filtro ou pagina mudou: busca de novo (espera um instante enquanto digita a data).
  useEffect(() => {
    const timer = window.setTimeout(carregar, 250);
    return () => window.clearTimeout(timer);
  }, [carregar]);

  usePolling(carregar, 10000, pagina === 1);

  const mudar = (campo, valor) => {
    setFiltros((atual) => ({ ...atual, [campo]: valor }));
    setPagina(1);
  };

  const encerrar = async (sessao) => {
    const ok = await confirmar({
      titulo: `Encerrar a recarga #${sessao.id}?`,
      texto: "O carregador desliga agora. O tempo que sobrou nao e' devolvido.",
      confirmarTexto: "Encerrar",
      perigoso: true,
    });
    if (!ok) return;
    try {
      await api.post(`/admin/sessoes/${sessao.id}/encerrar`);
      carregar();
    } catch {
      // Toast global
    }
  };

  const mexeu = JSON.stringify(filtros) !== JSON.stringify(filtrosIniciais);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-2 pb-3">
        <div className="flex flex-wrap gap-1 rounded-full bg-[var(--color-bg-muted)] p-1">
          {PERIODOS.map(([valor, texto]) => (
            <button
              key={valor}
              type="button"
              onClick={() => mudar("periodo", valor)}
              className={`rounded-full px-3 py-1 text-sm font-semibold transition ${
                filtros.periodo === valor ? "bg-white text-[var(--color-text)] shadow-sm" : "text-[var(--color-text-soft)] hover:text-[var(--color-text)]"
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
        {filtros.periodo === "datas" ? (
          <>
            <input type="date" className={seletor} value={filtros.de} onChange={(e) => mudar("de", e.target.value)} aria-label="De" />
            <input type="date" className={seletor} value={filtros.ate} onChange={(e) => mudar("ate", e.target.value)} aria-label="Ate" />
          </>
        ) : null}
        {!carregadorId ? (
          <select className={seletor} value={filtros.carregador} onChange={(e) => mudar("carregador", e.target.value)}>
            <option value="">Todos os carregadores</option>
            {carregadores.map((c) => (
              <option key={c.id_hardware} value={c.id_hardware}>
                {c.nome_local}
              </option>
            ))}
          </select>
        ) : null}
        <select className={seletor} value={filtros.status} onChange={(e) => mudar("status", e.target.value)}>
          {STATUS.map(([valor, texto]) => (
            <option key={valor} value={valor}>
              {texto}
            </option>
          ))}
        </select>
        <select className={seletor} value={filtros.origem} onChange={(e) => mudar("origem", e.target.value)}>
          {ORIGENS.map(([valor, texto]) => (
            <option key={valor} value={valor}>
              {texto}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 px-1 text-sm font-semibold text-[var(--color-text-soft)]">
          <input type="checkbox" checked={filtros.estornadas} onChange={(e) => mudar("estornadas", e.target.checked)} />
          So estornadas
        </label>
        {mexeu ? (
          <button
            type="button"
            onClick={() => {
              setFiltros(filtrosIniciais);
              setPagina(1);
            }}
            className="text-sm font-semibold text-[var(--color-primary-strong)] hover:underline"
          >
            Limpar filtros
          </button>
        ) : null}
      </div>

      {dados ? (
        <>
          <TabelaSessoes
            sessoes={dados.itens}
            mostrarCarregador={!carregadorId}
            onEncerrar={isAdmin ? encerrar : undefined}
            onEstornar={isAdmin ? async (s) => (await estornarRecarga(s)) && carregar() : undefined}
          />
          <Paginacao dados={dados} onPagina={setPagina} />
        </>
      ) : (
        <p className="py-6 text-center text-sm text-[var(--color-text-soft)]">Carregando...</p>
      )}
    </div>
  );
}
