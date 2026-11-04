import { useCallback, useState } from "react";
import { Check, CircleCheck, Pencil, Plus, TriangleAlert } from "lucide-react";

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
  cliente_mercado_pago: true,
  cliente_sumup: false,
  mp_access_token: "",
  mp_public_key: "",
  mp_client_id: "",
  mp_client_secret: "",
  sumup_api_key: "",
  ativo: true,
};

// Bancos que existem por enquanto (os mesmos que a CompactPay tem prontos).
const BANCOS = [
  { chave: "cliente_mercado_pago", nome: "Mercado Pago", ajuda: "Maquininha vinculada a loja/caixa do carregador" },
  { chave: "cliente_sumup", nome: "SumUp", ajuda: "Maquininha SumUp pareada pela API" },
];

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
      mp_client_secret: "",
      sumup_api_key: "",
    });

  const salvar = async (event) => {
    event.preventDefault();
    setSalvando(true);
    const { id, mp_access_token: token, mp_client_secret: segredo, sumup_api_key: chaveSumup, ...resto } = form;
    if (!resto.cliente_mercado_pago && !resto.cliente_sumup) {
      setSalvando(false);
      return;
    }
    const corpo = {
      nome_empresa: resto.nome_empresa,
      email_contato: resto.email_contato || null,
      telefone: resto.telefone || null,
      documento: resto.documento || null,
      ativo: resto.ativo,
      cliente_mercado_pago: resto.cliente_mercado_pago,
      cliente_sumup: resto.cliente_sumup,
      // Credencial so vai quando digitada: a salva nunca volta do servidor.
      ...(resto.cliente_mercado_pago && token.trim() ? { mp_access_token: token.trim() } : {}),
      ...(resto.cliente_mercado_pago
        ? { mp_public_key: resto.mp_public_key.trim() || null, mp_client_id: resto.mp_client_id.trim() || null }
        : {}),
      ...(resto.cliente_mercado_pago && segredo.trim() ? { mp_client_secret: segredo.trim() } : {}),
      ...(resto.cliente_sumup && chaveSumup.trim() ? { sumup_api_key: chaveSumup.trim() } : {}),
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
        descricao="Donos dos carregadores. Cada um usa a propria conta do banco (Mercado Pago ou SumUp), igual a CompactPay."
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
              <th className="px-4 py-3">Bancos</th>
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
                <td className="space-y-1 px-4 py-3">
                  {c.cliente_mercado_pago ? (
                    <div className={`flex items-center gap-1.5 text-sm font-semibold ${c.tem_token_mp ? "text-[var(--color-success)]" : "text-[var(--color-warning)]"}`}>
                      {c.tem_token_mp ? <CircleCheck size={15} /> : <TriangleAlert size={15} />}
                      Mercado Pago {c.tem_token_mp ? <span className="font-normal text-[var(--color-text-soft)]">· conta {c.mp_user_id}</span> : "· sem token"}
                    </div>
                  ) : null}
                  {c.cliente_sumup ? (
                    <div className={`flex items-center gap-1.5 text-sm font-semibold ${c.tem_sumup ? "text-[var(--color-success)]" : "text-[var(--color-warning)]"}`}>
                      {c.tem_sumup ? <CircleCheck size={15} /> : <TriangleAlert size={15} />}
                      SumUp {c.tem_sumup ? <span className="font-normal text-[var(--color-text-soft)]">· {c.sumup_merchant_code}</span> : "· sem API key"}
                    </div>
                  ) : null}
                  {!c.cliente_mercado_pago && !c.cliente_sumup ? <span className="text-sm text-[var(--color-text-soft)]">Nenhum banco</span> : null}
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
                <td colSpan={4} className="px-4 py-8 text-center text-[var(--color-text-soft)]">
                  Nenhum cliente cadastrado. Cadastre o dono do carregador com as credenciais do banco dele.
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

            <div>
              <div className="mb-2 text-sm font-semibold">Bancos que este cliente usa</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {BANCOS.map((banco) => {
                  const ligado = Boolean(form[banco.chave]);
                  return (
                    <button
                      key={banco.chave}
                      type="button"
                      onClick={() => setForm({ ...form, [banco.chave]: !ligado })}
                      className={`flex items-start gap-3 rounded-[18px] border-2 p-3 text-left transition ${
                        ligado ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]" : "border-[var(--color-border)] bg-white"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
                          ligado ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-slate-300"
                        }`}
                      >
                        {ligado ? <Check size={14} /> : null}
                      </span>
                      <span>
                        <span className="block font-bold text-[var(--color-text)]">{banco.nome}</span>
                        <span className="block text-xs text-[var(--color-text-soft)]">{banco.ajuda}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {!form.cliente_mercado_pago && !form.cliente_sumup ? (
                <p className="mt-2 text-xs text-[var(--color-error)]">Escolha pelo menos um banco.</p>
              ) : null}
            </div>

            {form.cliente_mercado_pago ? (
              <div className="rounded-[22px] bg-[var(--color-bg-muted)] p-4">
                <Campo
                  rotulo="Mercado Pago · Access Token de producao"
                  dica={
                    form.id && form.tem_token_mp
                      ? "Ja configurado. Deixe vazio para manter; preencha so para trocar."
                      : "Suas integracoes > sua aplicacao > Credenciais de producao (comeca com APP_USR-). Conferido antes de salvar."
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
                <div className="mt-4 border-t border-[var(--color-border)] pt-3">
                  <div className="text-sm font-semibold text-[var(--color-text)]">
                    Outras credenciais <span className="font-normal text-[var(--color-text-soft)]">(opcional, ficam guardadas para usar depois)</span>
                  </div>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <Campo rotulo="Public Key">
                      <input
                        className={`${campoClasse} py-2 font-mono text-sm`}
                        autoComplete="off"
                        placeholder="APP_USR-..."
                        value={form.mp_public_key}
                        onChange={(e) => setForm({ ...form, mp_public_key: e.target.value })}
                      />
                    </Campo>
                    <Campo rotulo="Client ID">
                      <input
                        className={`${campoClasse} py-2 font-mono text-sm`}
                        autoComplete="off"
                        value={form.mp_client_id}
                        onChange={(e) => setForm({ ...form, mp_client_id: e.target.value })}
                      />
                    </Campo>
                  </div>
                  <div className="mt-3">
                    <Campo rotulo="Client Secret" dica={form.id && form.tem_client_secret ? "Ja configurado. Deixe vazio para manter." : "Usado no \"Conectar Mercado Pago\" (OAuth), quando ativarmos."}>
                      <input
                        className={`${campoClasse} py-2 font-mono text-sm`}
                        type="password"
                        autoComplete="off"
                        placeholder={form.id && form.tem_client_secret ? "••••••••••••" : ""}
                        value={form.mp_client_secret}
                        onChange={(e) => setForm({ ...form, mp_client_secret: e.target.value })}
                      />
                    </Campo>
                  </div>
                </div>
              </div>
            ) : null}

            {form.cliente_sumup ? (
              <div className="rounded-[22px] bg-[var(--color-bg-muted)] p-4">
                <Campo
                  rotulo="SumUp · API key"
                  dica={
                    form.id && form.tem_sumup
                      ? `Ja configurada (merchant ${form.sumup_merchant_code}). Deixe vazio para manter.`
                      : "Painel SumUp > Desenvolvedores > API keys (comeca com sup_sk_). O merchant code e' descoberto sozinho."
                  }
                >
                  <input
                    className={`${campoClasse} font-mono`}
                    type="password"
                    autoComplete="off"
                    placeholder={form.id && form.tem_sumup ? "••••••••••••" : "sup_sk_..."}
                    value={form.sumup_api_key}
                    onChange={(e) => setForm({ ...form, sumup_api_key: e.target.value })}
                  />
                </Campo>
              </div>
            ) : null}

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
                {salvando ? "Conferindo as credenciais..." : "Salvar"}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
