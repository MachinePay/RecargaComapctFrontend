import { useCallback, useState } from "react";
import { CircleCheck, Pencil, Plus, TriangleAlert } from "lucide-react";

import api from "../api/axios";
import usePolling from "../hooks/usePolling";
import Badge from "../components/Badge";
import Button from "../components/Button";
import Cabecalho from "../components/Cabecalho";
import Modal from "../components/Modal";
import { campoClasse } from "../utils/estilos";

const formVazio = {
  nome_empresa: "",
  email_contato: "",
  telefone: "",
  documento: "",
  endereco_rua: "",
  endereco_numero: "",
  endereco_cidade: "",
  endereco_estado: "",
  mp_access_token: "",
  ativo: true,
};

function Campo({ rotulo, dica, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">{rotulo}</span>
      {children}
      {dica ? <span className="mt-1 block text-xs text-[var(--color-text-soft)]">{dica}</span> : null}
    </label>
  );
}

export default function Clientes() {
  const [lista, setLista] = useState([]);
  // null = fechado; sem id = novo; com id = editando.
  const [form, setForm] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/clientes");
      setLista(data);
    } catch {
      // Toast global
    }
  }, []);

  usePolling(carregar, 15000, true, { imediato: true });

  const abrirEdicao = (cliente) =>
    setForm({
      ...formVazio,
      ...Object.fromEntries(Object.entries(cliente).map(([k, v]) => [k, v ?? ""])),
      mp_access_token: "",
    });

  const salvar = async (event) => {
    event.preventDefault();
    setSalvando(true);
    const { id, mp_access_token: token, ...resto } = form;
    const corpo = {
      nome_empresa: resto.nome_empresa,
      email_contato: resto.email_contato || null,
      telefone: resto.telefone || null,
      documento: resto.documento || null,
      endereco_rua: resto.endereco_rua || null,
      endereco_numero: resto.endereco_numero || null,
      endereco_cidade: resto.endereco_cidade || null,
      endereco_estado: resto.endereco_estado || null,
      ativo: resto.ativo,
      // Token so vai quando digitado: o salvo nunca volta do servidor.
      ...(token.trim() ? { mp_access_token: token.trim() } : {}),
    };
    try {
      if (id) await api.patch(`/admin/clientes/${id}`, corpo);
      else await api.post("/admin/clientes", corpo);
      setForm(null);
      carregar();
    } catch {
      // Toast global (token recusado aparece aqui)
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-5 p-2 sm:p-4">
      <Cabecalho
        etiqueta="Cadastro"
        titulo="Clientes"
        descricao="Donos dos carregadores. Cada um usa a propria conta do Mercado Pago, igual a CompactPay."
        acoes={
          <Button onClick={() => setForm({ ...formVazio })}>
            <Plus size={18} /> Novo cliente
          </Button>
        }
      />

      <div className="app-panel overflow-x-auto p-2">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-soft)]">
            <tr>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Mercado Pago</th>
              <th className="px-4 py-3">Endereco da loja</th>
              <th className="px-4 py-3">Carregadores</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.id} className="border-t border-[var(--color-border)] hover:bg-white/70">
                <td className="px-4 py-3">
                  <div className="font-bold text-[var(--color-text)]">{c.nome_empresa}</div>
                  <div className="text-xs text-[var(--color-text-soft)]">{[c.email_contato, c.telefone].filter(Boolean).join(" · ") || "-"}</div>
                </td>
                <td className="px-4 py-3">
                  {c.tem_token_mp ? (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-success)]">
                      <CircleCheck size={16} /> Conta {c.mp_user_id}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-warning)]">
                      <TriangleAlert size={16} /> Sem token
                    </span>
                  )}
                  {c.token_mp_prefixo ? <div className="font-mono text-xs text-[var(--color-text-soft)]">{c.token_mp_prefixo}…</div> : null}
                </td>
                <td className="px-4 py-3 text-[var(--color-text-soft)]">
                  {[c.endereco_rua && `${c.endereco_rua}, ${c.endereco_numero || "s/n"}`, c.endereco_cidade, c.endereco_estado].filter(Boolean).join(" · ") ||
                    "Padrao do servidor"}
                </td>
                <td className="px-4 py-3">
                  <Badge tom={c.carregadores ? "ok" : "neutro"}>{c.carregadores}</Badge>
                  {!c.ativo ? <Badge tom="erro">Inativo</Badge> : null}
                </td>
                <td className="px-4 py-3 text-right">
                  <button type="button" onClick={() => abrirEdicao(c)} className="pill-button inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold">
                    <Pencil size={14} /> Editar
                  </button>
                </td>
              </tr>
            ))}
            {lista.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-text-soft)]">
                  Nenhum cliente cadastrado. Cadastre o dono do carregador com o token do Mercado Pago dele.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal open={Boolean(form)} onClose={() => setForm(null)}>
        {form ? (
          <form onSubmit={salvar} className="space-y-4">
            <h2 className="text-3xl font-extrabold tracking-[-0.04em] text-[var(--color-text)]">{form.id ? "Editar cliente" : "Novo cliente"}</h2>
            <Campo rotulo="Nome da empresa">
              <input className={campoClasse} value={form.nome_empresa} onChange={(e) => setForm({ ...form, nome_empresa: e.target.value })} required />
            </Campo>
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo rotulo="E-mail">
                <input className={campoClasse} type="email" value={form.email_contato} onChange={(e) => setForm({ ...form, email_contato: e.target.value })} />
              </Campo>
              <Campo rotulo="Telefone">
                <input className={campoClasse} value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
              </Campo>
              <Campo rotulo="CPF / CNPJ">
                <input className={campoClasse} value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} />
              </Campo>
            </div>

            <div className="rounded-[22px] bg-[var(--color-bg-muted)] p-4">
              <div className="mb-3 font-bold text-[var(--color-text)]">Mercado Pago</div>
              <Campo
                rotulo="Access Token de producao"
                dica={
                  form.id && form.tem_token_mp
                    ? "Ja configurado. Deixe vazio para manter; preencha so para trocar."
                    : "Mercado Pago > Suas integracoes > sua aplicacao > Credenciais de producao > Access Token (comeca com APP_USR-). O sistema confere o token antes de salvar."
                }
              >
                <input
                  className={`${campoClasse} font-mono`}
                  type="password"
                  autoComplete="off"
                  placeholder={form.id && form.tem_token_mp ? "••••••••••••" : "APP_USR-..."}
                  value={form.mp_access_token}
                  onChange={(e) => setForm({ ...form, mp_access_token: e.target.value })}
                />
              </Campo>
            </div>

            <div className="rounded-[22px] bg-[var(--color-bg-muted)] p-4">
              <div className="mb-1 font-bold text-[var(--color-text)]">Endereco da loja</div>
              <p className="mb-3 text-xs text-[var(--color-text-soft)]">Vai na loja criada no Mercado Pago para cada carregador. Estado por extenso (ex.: Sao Paulo).</p>
              <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                <Campo rotulo="Rua">
                  <input className={campoClasse} value={form.endereco_rua} onChange={(e) => setForm({ ...form, endereco_rua: e.target.value })} />
                </Campo>
                <Campo rotulo="Numero">
                  <input className={campoClasse} value={form.endereco_numero} onChange={(e) => setForm({ ...form, endereco_numero: e.target.value })} />
                </Campo>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Campo rotulo="Cidade">
                  <input className={campoClasse} value={form.endereco_cidade} onChange={(e) => setForm({ ...form, endereco_cidade: e.target.value })} />
                </Campo>
                <Campo rotulo="Estado">
                  <input className={campoClasse} value={form.endereco_estado} onChange={(e) => setForm({ ...form, endereco_estado: e.target.value })} placeholder="Sao Paulo" />
                </Campo>
              </div>
            </div>

            {form.id ? (
              <label className="flex items-center gap-3 text-sm font-semibold">
                <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
                Ativo (desmarcado: os carregadores dele deixam de usar este token)
              </label>
            ) : null}

            <div className="flex gap-3 pt-2">
              <button type="button" className="pill-button flex-1 px-5 py-3 font-semibold" onClick={() => setForm(null)}>
                Cancelar
              </button>
              <Button type="submit" className="flex-1 justify-center" disabled={salvando}>
                {salvando ? "Conferindo o token..." : "Salvar"}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
