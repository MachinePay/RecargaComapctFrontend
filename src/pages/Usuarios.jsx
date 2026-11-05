import { useCallback, useState } from "react";
import { Pencil, Plus, ShieldCheck, UserRound } from "lucide-react";

import api from "../api/axios";
import usePolling from "../hooks/usePolling";
import Badge from "../components/Badge";
import Button from "../components/Button";
import Cabecalho from "../components/Cabecalho";
import Modal from "../components/Modal";
import { campoClasse } from "../utils/estilos";
import { formatarDataHora } from "../utils/formatos";

const formVazio = { nome: "", email: "", senha: "", role: "cliente", cliente_id: "", ativo: true };

export default function Usuarios() {
  const [lista, setLista] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [form, setForm] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [u, c] = await Promise.all([api.get("/admin/usuarios"), api.get("/admin/clientes")]);
      setLista(u.data);
      setClientes(c.data);
    } catch {
      // Toast global
    }
  }, []);

  usePolling(carregar, 30000, true, { imediato: true });

  const salvar = async (event) => {
    event.preventDefault();
    setSalvando(true);
    const corpo = {
      nome: form.nome,
      email: form.email,
      role: form.role,
      cliente_id: form.role === "cliente" && form.cliente_id ? Number(form.cliente_id) : null,
      ativo: form.ativo,
      // Senha so vai quando digitada (na edicao, vazia = manter).
      ...(form.senha ? { senha: form.senha } : {}),
    };
    try {
      if (form.id) await api.patch(`/admin/usuarios/${form.id}`, corpo);
      else await api.post("/admin/usuarios", corpo);
      setForm(null);
      carregar();
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
        titulo="Usuarios"
        descricao="Quem entra no painel. Administrador ve e mexe em tudo; usuario de cliente ve so os carregadores do cliente dele."
        acoes={
          <Button onClick={() => setForm({ ...formVazio })}>
            <Plus size={18} /> Novo usuario
          </Button>
        }
      />

      <div className="app-panel overflow-x-auto p-2">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-soft)]">
            <tr>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Acesso</th>
              <th className="px-4 py-3">Ultimo login</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {lista.map((u) => (
              <tr key={u.id} className="border-t border-[var(--color-border)] hover:bg-white/70">
                <td className="px-4 py-3">
                  <div className="font-bold text-[var(--color-text)]">{u.nome}</div>
                  <div className="text-xs text-[var(--color-text-soft)]">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  {u.role === "admin" ? (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-primary-strong)]">
                      <ShieldCheck size={16} /> Administrador
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-text)]">
                      <UserRound size={16} /> {u.cliente_nome || "Cliente"}
                    </span>
                  )}
                  {!u.ativo ? <Badge tom="erro">Desativado</Badge> : null}
                </td>
                <td className="px-4 py-3 text-[var(--color-text-soft)]">{formatarDataHora(u.ultimo_login)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setForm({ ...u, senha: "", cliente_id: u.cliente_id ? String(u.cliente_id) : "" })}
                    className="pill-button inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
                  >
                    <Pencil size={14} /> Editar
                  </button>
                </td>
              </tr>
            ))}
            {lista.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[var(--color-text-soft)]">
                  Nenhum usuario ainda. Crie o primeiro administrador com e-mail e senha.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {clientes.some((c) => !c.acessos?.length) ? (
        <div className="app-panel p-4">
          <div className="text-sm font-semibold text-[var(--color-text)]">Clientes sem login no painel</div>
          <div className="mb-3 text-xs text-[var(--color-text-soft)]">Cliente e a empresa dona dos carregadores; para ela entrar no painel, crie um usuario.</div>
          <div className="flex flex-wrap gap-2">
            {clientes
              .filter((c) => !c.acessos?.length)
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setForm({ ...formVazio, nome: c.nome_empresa, email: c.email_contato || "", cliente_id: String(c.id) })}
                  className="pill-button inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
                >
                  <Plus size={14} /> Criar login para {c.nome_empresa}
                </button>
              ))}
          </div>
        </div>
      ) : null}

      <Modal open={Boolean(form)} onClose={() => setForm(null)}>
        {form ? (
          <form onSubmit={salvar} className="space-y-4">
            <h2 className="text-3xl font-extrabold tracking-[-0.04em] text-[var(--color-text)]">{form.id ? "Editar usuario" : "Novo usuario"}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Nome</span>
                <input className={campoClasse} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">E-mail</span>
                <input className={campoClasse} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </label>
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Senha</span>
              <input
                className={campoClasse}
                type="password"
                autoComplete="new-password"
                minLength={6}
                placeholder={form.id ? "Deixe vazio para manter" : "Minimo 6 caracteres"}
                value={form.senha}
                onChange={(e) => setForm({ ...form, senha: e.target.value })}
                required={!form.id}
              />
            </label>
            <div>
              <span className="mb-2 block text-sm font-semibold">Tipo de acesso</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  ["cliente", "Cliente", "Ve so os carregadores do cliente dele, sem editar."],
                  ["admin", "Administrador", "Ve e mexe em tudo, inclusive usuarios e bancos."],
                ].map(([valor, titulo, ajuda]) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => setForm({ ...form, role: valor })}
                    className={`rounded-[18px] border-2 p-3 text-left transition ${
                      form.role === valor ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]" : "border-[var(--color-border)] bg-white"
                    }`}
                  >
                    <div className="font-bold text-[var(--color-text)]">{titulo}</div>
                    <div className="text-xs text-[var(--color-text-soft)]">{ajuda}</div>
                  </button>
                ))}
              </div>
            </div>
            {form.role === "cliente" ? (
              <div className="rounded-[18px] bg-[var(--color-primary-soft)] px-4 py-3 text-sm text-[var(--color-text)]">
                {form.cliente_id
                  ? <>Dono dos carregadores: <b>{clientes.find((c) => String(c.id) === String(form.cliente_id))?.nome_empresa || form.cliente_nome || "cliente"}</b>.</>
                  : <>Ja cria o cliente <b>{form.nome || "com esse nome"}</b> (dono dos carregadores). Os bancos e credenciais voce configura em Clientes.</>}
              </div>
            ) : null}
            {form.id ? (
              <label className="flex items-center gap-3 text-sm font-semibold">
                <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
                Ativo (desmarcado: perde o acesso na hora)
              </label>
            ) : null}
            <div className="flex gap-3 pt-2">
              <button type="button" className="pill-button flex-1 px-5 py-3 font-semibold" onClick={() => setForm(null)}>
                Cancelar
              </button>
              <Button type="submit" className="flex-1 justify-center" disabled={salvando}>
                {salvando ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
