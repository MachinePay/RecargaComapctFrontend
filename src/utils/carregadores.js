// Regras de tela dos carregadores (status, conexao, busca, ordem e localizacao),
// no mesmo jeito da lista de maquinas da CompactPay.
import { STATUS_CONECTOR } from "./ocppTextos";

// Ordem de problema primeiro (igual o sort de status da CompactPay).
export const STATUS_CARREGADOR = {
  offline: { texto: "Offline", ordem: 0, cor: "#b64545" },
  defeito: { texto: "Com defeito", ordem: 1, cor: "#b7791f" },
  carregando: { texto: "Carregando", ordem: 2, cor: "#2563eb" },
  online: { texto: "Livre", ordem: 3, cor: "#1f7a4c" },
};

export function statusCarregador(c) {
  if (!c.online) return "offline";
  if (c.erro_conector || c.status_conector === "Faulted") return "defeito";
  if (c.sessao_ativa) return "carregando";
  return "online";
}

// O OCPP nao manda o sinal do Wi-Fi. A qualidade aqui sai das quedas de hoje
// (cada reconexao conta uma) e de quanto tempo faz o ultimo sinal.
export function qualidadeConexao(c) {
  if (!c.online) return { qualidade: null, texto: "Sem conexao", cor: "text-slate-400", barra: "bg-slate-300", largura: "20%" };
  const quedas = c.quedas_hoje || 0;
  if (quedas === 0) return { qualidade: 100, texto: "Estavel", cor: "text-emerald-700", barra: "bg-emerald-500", largura: "100%" };
  if (quedas <= 2) return { qualidade: 60, texto: "Oscilou", cor: "text-amber-700", barra: "bg-amber-400", largura: "60%" };
  return { qualidade: 25, texto: "Instavel", cor: "text-rose-700", barra: "bg-rose-500", largura: "25%" };
}

export function textoConector(c) {
  if (!c.status_conector) return "-";
  return STATUS_CONECTOR[c.status_conector]?.split(" (")[0] || c.status_conector;
}

const semAcento = (texto) =>
  String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Todas as palavras precisam aparecer em algum campo (sem acento).
export function combinaBusca(c, busca) {
  const palavras = semAcento(busca).split(/\s+/).filter(Boolean);
  if (!palavras.length) return true;
  const alvo = semAcento(
    [c.id_hardware, c.nome_local, c.cliente_nome, c.endereco, c.ip, c.modelo, c.vendor, c.firmware_version].filter(Boolean).join(" "),
  );
  return palavras.every((p) => alvo.includes(p));
}

// Numero e data comecam do maior; texto e status comecam do menor.
export const COLUNAS_ORDEM = {
  carregador: { valor: (c) => semAcento(c.nome_local), primeiro: "asc" },
  status: { valor: (c) => STATUS_CARREGADOR[statusCarregador(c)].ordem, primeiro: "asc" },
  conexao: { valor: (c) => (c.online ? 1000 - (c.quedas_hoje || 0) : null), primeiro: "desc" },
  cliente: { valor: (c) => semAcento(c.cliente_nome) || null, primeiro: "asc" },
  hoje: { valor: (c) => c.faturamento_hoje || 0, primeiro: "desc" },
  sinal: { valor: (c) => c.ultimo_sinal || null, primeiro: "desc" },
};

export function ordenar(lista, ordem) {
  if (!ordem) return lista;
  const coluna = COLUNAS_ORDEM[ordem.coluna];
  return [...lista].sort((a, b) => {
    const va = coluna.valor(a);
    const vb = coluna.valor(b);
    // Vazio sempre por ultimo.
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    const comparacao = va < vb ? -1 : va > vb ? 1 : 0;
    return ordem.direcao === "asc" ? comparacao : -comparacao;
  });
}

// Primeiro clique: direcao natural da coluna; segundo: contraria; terceiro: sem ordem.
export function proximaOrdem(atual, coluna) {
  const primeiro = COLUNAS_ORDEM[coluna].primeiro;
  if (!atual || atual.coluna !== coluna) return { coluna, direcao: primeiro };
  if (atual.direcao === primeiro) return { coluna, direcao: primeiro === "asc" ? "desc" : "asc" };
  return null;
}

// "-23.55, -46.63", link do Google Maps (@lat,lng / q=lat,lng / !3dlat!4dlng).
export function lerCoordenadas(texto) {
  const t = String(texto || "").trim();
  const padroes = [
    /@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /[?&](?:q|query|ll)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /^(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)$/,
  ];
  for (const padrao of padroes) {
    const m = t.match(padrao);
    if (m) {
      const latitude = Number(m[1]);
      const longitude = Number(m[2]);
      if (Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) return { latitude, longitude };
    }
  }
  return null;
}
