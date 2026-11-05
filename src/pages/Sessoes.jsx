import { useCallback, useState } from "react";

import api from "../api/axios";
import { useAuth } from "../context/useAuth";
import usePolling from "../hooks/usePolling";
import Cabecalho from "../components/Cabecalho";
import TabelaSessoes from "../components/TabelaSessoes";
import { confirmar } from "../utils/confirmar";
import { estornarRecarga } from "../utils/estornar";

export default function Sessoes() {
  const { isAdmin } = useAuth();
  const [sessoes, setSessoes] = useState([]);

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/sessoes", { params: { limite: 200 } });
      setSessoes(data);
    } catch {
      // Toast global
    }
  }, []);

  usePolling(carregar, 5000, true, { imediato: true });

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

  return (
    <div className="space-y-5 p-2 sm:p-4">
      <Cabecalho etiqueta="Operacao" titulo="Recargas" descricao="Ultimas 200 recargas de todos os carregadores." />
      <div className="app-panel p-2">
        <TabelaSessoes
          sessoes={sessoes}
          onEncerrar={isAdmin ? encerrar : undefined}
          onEstornar={isAdmin ? async (s) => (await estornarRecarga(s)) && carregar() : undefined}
        />
      </div>
    </div>
  );
}
