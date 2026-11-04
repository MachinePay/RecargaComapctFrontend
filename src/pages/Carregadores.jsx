import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import Swal from "sweetalert2";

import api from "../api/axios";
import usePolling from "../hooks/usePolling";
import Badge from "../components/Badge";
import Button from "../components/Button";
import Cabecalho from "../components/Cabecalho";
import Modal from "../components/Modal";
import { campoClasse } from "../utils/estilos";
import { formatarDataHora } from "../utils/formatos";

const formVazio = { id_hardware: "", nome_local: "", connector_id: 1, mp_terminal_id: "", gerar_senha_ocpp: false };

export default function Carregadores() {
  const navigate = useNavigate();
  const [lista, setLista] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(formVazio);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/carregadores");
      setLista(data);
    } catch {
      // Toast global
    }
  }, []);

  usePolling(carregar, 10000, true, { imediato: true });

  const salvar = async (event) => {
    event.preventDefault();
    setSalvando(true);
    try {
      const { data } = await api.post("/admin/carregadores", {
        ...form,
        connector_id: Number(form.connector_id) || 1,
        mp_terminal_id: form.mp_terminal_id || null,
      });
      setModal(false);
      setForm(formVazio);
      carregar();
      await Swal.fire({
        icon: "success",
        title: "Carregador cadastrado",
        html: `
          <p>No app do fabricante, configure o OCPP 1.6J com o Charge Point ID <b>${data.id_hardware}</b>.</p>
          <p style="margin-top:8px">O endereco exato e os testes de conexao estao na tela <b>Diagnostico</b>.</p>
          ${data.senha_ocpp ? `<p><b>Senha OCPP:</b> <code>${data.senha_ocpp}</code><br/><small>Anote agora: ela nao aparece de novo.</small></p>` : ""}
        `,
        confirmButtonColor: "#1f7a4c",
      });
    } catch {
      // Toast global
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-5 p-2 sm:p-4">
      <Cabecalho
        etiqueta="Cadastro"
        titulo="Carregadores"
        descricao="Cada wallbox se conecta ao servidor pelo OCPP com o ID cadastrado aqui."
        acoes={
          <Button onClick={() => setModal(true)}>
            <Plus size={18} /> Novo carregador
          </Button>
        }
      />

      <div className="app-panel overflow-x-auto p-2">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-soft)]">
            <tr>
              <th className="px-4 py-3">Carregador</th>
              <th className="px-4 py-3">Conexao</th>
              <th className="px-4 py-3">Conector</th>
              <th className="px-4 py-3">Modelo</th>
              <th className="px-4 py-3">Ultimo sinal</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((c) => (
              <tr
                key={c.id_hardware}
                onClick={() => navigate(`/carregadores/${encodeURIComponent(c.id_hardware)}`)}
                className="cursor-pointer border-t border-[var(--color-border)] hover:bg-white/70"
              >
                <td className="px-4 py-3">
                  <Link to={`/carregadores/${encodeURIComponent(c.id_hardware)}`} className="font-bold text-[var(--color-primary-strong)]">
                    {c.nome_local}
                  </Link>
                  <div className="text-xs text-[var(--color-text-soft)]">{c.id_hardware}</div>
                </td>
                <td className="px-4 py-3">
                  <Badge tom={c.online ? "ok" : "erro"}>{c.online ? "Online" : "Offline"}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge tom={c.erro_conector ? "erro" : "neutro"}>{c.status_conector || "-"}</Badge>
                </td>
                <td className="px-4 py-3 text-[var(--color-text-soft)]">
                  {[c.vendor, c.modelo].filter(Boolean).join(" ") || "-"}
                  {c.firmware_version ? <div className="text-xs">fw {c.firmware_version}</div> : null}
                </td>
                <td className="px-4 py-3 text-[var(--color-text-soft)]">{formatarDataHora(c.ultimo_sinal)}</td>
              </tr>
            ))}
            {lista.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-text-soft)]">
                  Nenhum carregador cadastrado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)}>
        <form onSubmit={salvar} className="space-y-4">
          <h2 className="text-3xl font-extrabold tracking-[-0.04em] text-[var(--color-text)]">Novo carregador</h2>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">ID do carregador (Charge Point ID)</span>
            <input
              className={campoClasse}
              value={form.id_hardware}
              onChange={(e) => setForm({ ...form, id_hardware: e.target.value.trim() })}
              placeholder="CP-BANCADA"
              pattern="[A-Za-z0-9_\-.]+"
              title="Letras, numeros, traco, ponto e sublinhado"
              required
            />
            <span className="mt-1 block text-xs text-[var(--color-text-soft)]">
              Tem que ser igual ao configurado no carregador. Se nao souber, ligue o carregador apontando para o servidor e veja no log qual ID ele usa.
            </span>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Nome do local</span>
            <input className={campoClasse} value={form.nome_local} onChange={(e) => setForm({ ...form, nome_local: e.target.value })} required />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Conector</span>
              <input className={campoClasse} type="number" min={1} value={form.connector_id} onChange={(e) => setForm({ ...form, connector_id: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Point (terminal_id do MP)</span>
              <input className={campoClasse} value={form.mp_terminal_id} onChange={(e) => setForm({ ...form, mp_terminal_id: e.target.value })} placeholder="opcional em modo simulado" />
            </label>
          </div>
          <label className="flex items-center gap-3 text-sm font-semibold">
            <input type="checkbox" checked={form.gerar_senha_ocpp} onChange={(e) => setForm({ ...form, gerar_senha_ocpp: e.target.checked })} />
            Gerar senha OCPP (recomendado em producao)
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" className="pill-button flex-1 px-5 py-3 font-semibold" onClick={() => setModal(false)}>
              Cancelar
            </button>
            <Button type="submit" className="flex-1 justify-center" disabled={salvando}>
              {salvando ? "Salvando..." : "Cadastrar"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
