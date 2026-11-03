import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { obterCarregador, mensagemErroTotem } from "../../api/totemApi";
import Button from "../../components/Button";
import { totemConfig } from "../../utils/totemConfig";

const campoClasse =
  "w-full rounded-[20px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:shadow-[0_0_0_4px_rgba(31,122,76,0.10)]";

/** Configuracao do tablet: abre segurando o logo do totem por 5 s + PIN. */
export default function TotemConfig() {
  const navigate = useNavigate();
  const [liberado, setLiberado] = useState(false);
  const [pin, setPin] = useState("");
  const [erroPin, setErroPin] = useState("");

  const [chave, setChave] = useState(totemConfig.chave);
  const [carregadorId, setCarregadorId] = useState(totemConfig.carregadorId);
  const [novoPin, setNovoPin] = useState("");
  const [teste, setTeste] = useState(null);
  const [testando, setTestando] = useState(false);

  const entrar = (event) => {
    event.preventDefault();
    if (totemConfig.pinConfere(pin)) {
      setLiberado(true);
    } else {
      setErroPin("PIN incorreto");
      setPin("");
    }
  };

  const testar = async () => {
    setTestando(true);
    setTeste(null);
    // Testa com o que foi digitado, sem salvar ainda.
    const anterior = totemConfig.chave;
    localStorage.setItem("totem.chave", chave.trim());
    try {
      const carregador = await obterCarregador(carregadorId.trim());
      setTeste({
        ok: carregador.online,
        texto: carregador.online
          ? `${carregador.nome} online ✔ (conector: ${carregador.status_conector || "-"}, ${carregador.pacotes.length} pacotes)`
          : `${carregador.nome} está sem conexão com o servidor`,
      });
    } catch (error) {
      setTeste({ ok: false, texto: mensagemErroTotem(error, "Não foi possível conectar ao servidor") });
    } finally {
      localStorage.setItem("totem.chave", anterior);
      setTestando(false);
    }
  };

  const salvar = async (event) => {
    event.preventDefault();
    if (novoPin && novoPin.length < 4) {
      setTeste({ ok: false, texto: "O PIN precisa de no mínimo 4 dígitos" });
      return;
    }
    totemConfig.salvar({ chave, carregadorId });
    if (novoPin) totemConfig.trocarPin(novoPin);
    // Tela cheia precisa de um toque do usuario; aproveita o clique em salvar.
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      // navegador sem suporte: segue sem tela cheia
    }
    navigate("/totem", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-start justify-center bg-white p-6 sm:items-center">
      <div className="w-full max-w-lg">
        <img src="/logoCompactpay.jpeg" alt="CompactPay" className="mx-auto h-16 w-16 rounded-2xl object-cover" />
        <h1 className="mt-4 text-center text-3xl font-extrabold tracking-[-0.04em] text-[var(--color-text)]">
          Configurar tablet
        </h1>

        {!liberado ? (
          <form onSubmit={entrar} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">PIN do administrador</span>
              <input
                className={campoClasse}
                type="password"
                inputMode="numeric"
                autoFocus
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setErroPin("");
                }}
              />
            </label>
            {erroPin ? <div className="text-sm font-semibold text-[var(--color-error)]">{erroPin}</div> : null}
            <div className="flex gap-3">
              <button type="button" className="pill-button flex-1 px-5 py-3 font-semibold" onClick={() => navigate("/totem")}>
                Voltar
              </button>
              <Button type="submit" className="flex-1 justify-center">
                Entrar
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={salvar} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">Chave do tablet</span>
              <input
                className={campoClasse}
                value={chave}
                onChange={(e) => setChave(e.target.value)}
                placeholder="evt_... (gerada no painel em Tablets do totem)"
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">ID do carregador</span>
              <input
                className={campoClasse}
                value={carregadorId}
                onChange={(e) => setCarregadorId(e.target.value)}
                placeholder="CP-BANCADA"
                required
              />
            </label>

            <button
              type="button"
              className="pill-button w-full px-5 py-3 font-semibold"
              onClick={testar}
              disabled={testando || !chave || !carregadorId}
            >
              {testando ? "Testando…" : "Testar carregador"}
            </button>
            {teste ? (
              <div className={`text-sm font-semibold ${teste.ok ? "text-[var(--color-primary)]" : "text-[var(--color-error)]"}`}>
                {teste.texto}
              </div>
            ) : null}

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">Novo PIN (deixe vazio para manter)</span>
              <input
                className={campoClasse}
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={novoPin}
                onChange={(e) => setNovoPin(e.target.value)}
              />
            </label>

            <div className="flex gap-3 pt-2">
              <button type="button" className="pill-button flex-1 px-5 py-3 font-semibold" onClick={() => navigate("/totem")}>
                Voltar
              </button>
              <Button type="submit" className="flex-1 justify-center">
                Salvar
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
