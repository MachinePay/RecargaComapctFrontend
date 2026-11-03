import { useCallback, useState } from "react";
import { Copy, Plus } from "lucide-react";

import api from "../api/axios";
import usePolling from "../hooks/usePolling";
import Badge from "../components/Badge";
import Button from "../components/Button";
import Cabecalho from "../components/Cabecalho";
import Modal from "../components/Modal";
import { confirmar } from "../utils/confirmar";
import { campoClasse } from "../utils/estilos";
import { formatarDataHora } from "../utils/formatos";

export default function Tablets() {
  const [lista, setLista] = useState([]);
  const [modal, setModal] = useState(false);
  const [nome, setNome] = useState("");
  const [chaveNova, setChaveNova] = useState(null);

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/terminais");
      setLista(data);
    } catch {
      // Toast global
    }
  }, []);


  usePolling(carregar, 0, true, { imediato: true });

  const criar = async (event) => {
    event.preventDefault();
    try {
      const { data } = await api.post("/admin/terminais", { nome });
      setChaveNova(data);
      setNome("");
      carregar();
    } catch {
      // Toast global
    }
  };

  const revogar = async (terminal) => {
    const ok = await confirmar({
      titulo: `Revogar "${terminal.nome}"?`,
      texto: "O tablet para de vender na hora e precisa de uma chave nova.",
      confirmarTexto: "Revogar",
      perigoso: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/admin/terminais/${terminal.id}`);
      carregar();
    } catch {
      // Toast global
    }
  };

  const fechar = () => {
    setModal(false);
    setChaveNova(null);
  };

  return (
    <div className="space-y-5 p-2 sm:p-4">
      <Cabecalho
        etiqueta="Totem"
        titulo="Tablets do totem"
        descricao="Cada tablet usa uma chave para abrir a tela /totem. A chave aparece uma vez so."
        acoes={
          <Button onClick={() => setModal(true)}>
            <Plus size={18} /> Novo tablet
          </Button>
        }
      />

      <div className="app-panel overflow-x-auto p-2">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-soft)]">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Chave</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ultimo uso</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {lista.map((t) => (
              <tr key={t.id} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-3 font-semibold">{t.nome}</td>
                <td className="px-4 py-3 font-mono text-xs">{t.chave_prefixo}…</td>
                <td className="px-4 py-3">
                  <Badge tom={t.ativo ? "ok" : "neutro"}>{t.ativo ? "Ativo" : "Revogado"}</Badge>
                </td>
                <td className="px-4 py-3 text-[var(--color-text-soft)]">{formatarDataHora(t.ultimo_uso_em)}</td>
                <td className="px-4 py-3 text-right">
                  {t.ativo ? (
                    <button
                      type="button"
                      onClick={() => revogar(t)}
                      className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-[var(--color-error)] hover:bg-rose-100"
                    >
                      Revogar
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {lista.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-text-soft)]">
                  Nenhum tablet cadastrado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={fechar}>
        {chaveNova ? (
          <div className="space-y-4">
            <h2 className="text-3xl font-extrabold tracking-[-0.04em] text-[var(--color-text)]">Chave do tablet</h2>
            <p className="text-sm text-[var(--color-text-soft)]">
              Copie agora: ela nao aparece de novo. No tablet, abra <strong>/totem</strong>, segure o logo por 5 segundos,
              digite o PIN (padrao 0000) e cole a chave.
            </p>
            <div className="flex items-center gap-2 rounded-[18px] bg-[var(--color-bg-muted)] p-4">
              <code className="min-w-0 flex-1 break-all text-sm">{chaveNova.chave}</code>
              <button
                type="button"
                className="pill-button inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold"
                onClick={() => navigator.clipboard?.writeText(chaveNova.chave)}
              >
                <Copy size={16} /> Copiar
              </button>
            </div>
            <Button onClick={fechar} className="w-full justify-center">
              Pronto
            </Button>
          </div>
        ) : (
          <form onSubmit={criar} className="space-y-4">
            <h2 className="text-3xl font-extrabold tracking-[-0.04em] text-[var(--color-text)]">Novo tablet</h2>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Nome</span>
              <input className={campoClasse} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Tablet posto Centro" required />
            </label>
            <Button type="submit" className="w-full justify-center">
              Gerar chave
            </Button>
          </form>
        )}
      </Modal>
    </div>
  );
}
