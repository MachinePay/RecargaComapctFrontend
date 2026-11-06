// Pino do carregador e ponto "voce esta aqui", em HTML: os dois mapas (Esri
// e Google) desenham igual, com o CSS de motorista.css.
const RAIO = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4.5 13.2c-.4.5 0 1.3.6 1.3H11l-1 7.5 8.5-11.2c.4-.5 0-1.3-.6-1.3H12l1-7.5Z"/></svg>`;

const escapar = (texto) =>
  String(texto ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

// 44 x 52 px, com a ponta embaixo no meio (22, 50).
export function htmlPino({ situacao, chip, selecionado, maisPerto }) {
  return `
      <div class="mt-pin mt-pin--${situacao}${selecionado ? " is-sel" : ""}">
        <div class="mt-pin__halo"></div>
        <div class="mt-pin__corpo">${RAIO}</div>
        ${chip ? `<div class="mt-pin__chip">${escapar(chip)}</div>` : ""}
        ${maisPerto ? `<div class="mt-pin__estrela">★</div>` : ""}
      </div>`;
}

// 20 x 20 px, centro no meio.
export const HTML_VOCE = `<div class="mt-voce"></div>`;
