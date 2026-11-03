// Configuracao do tablet do totem (fica no navegador do proprio tablet).
// O PIN so impede o motorista de mexer na configuracao; nao e' seguranca de
// verdade (a chave do tablet ja so permite vender no carregador).
const CHAVE = "totem.chave";
const CARREGADOR = "totem.carregador";
const SESSAO = "totem.sessao";
const PIN = "totem.pinHash";
const PIN_PADRAO = "0000";

function hashPin(pin) {
  // crypto.subtle nao existe em http:// fora do localhost (tablet abrindo pelo
  // IP do PC), entao um hash simples basta para nao guardar o PIN em claro.
  let h = 5381;
  for (const c of `compactpay:${pin}`) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
  return h.toString(16);
}

export const totemConfig = {
  get chave() {
    return localStorage.getItem(CHAVE) || "";
  },
  get carregadorId() {
    return localStorage.getItem(CARREGADOR) || "";
  },
  get sessaoAcompanhada() {
    const valor = Number(localStorage.getItem(SESSAO));
    return valor > 0 ? valor : null;
  },
  configurado() {
    return Boolean(this.chave && this.carregadorId);
  },
  salvar({ chave, carregadorId }) {
    localStorage.setItem(CHAVE, chave.trim());
    if (carregadorId.trim() !== this.carregadorId) localStorage.removeItem(SESSAO);
    localStorage.setItem(CARREGADOR, carregadorId.trim());
  },
  acompanharSessao(id) {
    if (id) localStorage.setItem(SESSAO, String(id));
    else localStorage.removeItem(SESSAO);
  },
  pinConfere(pin) {
    return (localStorage.getItem(PIN) || hashPin(PIN_PADRAO)) === hashPin(pin);
  },
  trocarPin(pin) {
    localStorage.setItem(PIN, hashPin(pin));
  },
};
