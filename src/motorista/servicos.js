// API publica do app do motorista, celular anonimo e conta de distancia.
import axios from "axios";
import { API_BASE_URL, getApiErrorMessage } from "../api/axios";
import { contaAtual, sairDaConta } from "./conta";

// Sem os interceptors do painel (nada de redirecionar para /login). A conta do
// motorista e' opcional: logado, o token vai junto.
export const apiPublica = axios.create({ baseURL: `${API_BASE_URL}/publico`, timeout: 20000 });

apiPublica.interceptors.request.use((config) => {
  const conta = contaAtual();
  if (conta?.token) config.headers.Authorization = `Bearer ${conta.token}`;
  return config;
});

// Uma vez por abertura do app: login vencido ou conta desativada sai sozinho.
let contaConferida = false;
export function conferirConta() {
  if (contaConferida || !contaAtual()) return;
  contaConferida = true;
  apiPublica.get("/eu").catch((e) => {
    if (e.response?.status === 401) sairDaConta();
  });
}

export const mensagemErro = (erro) => getApiErrorMessage(erro, "Nao foi possivel falar com o servidor. Tente de novo.");

// ---- Celular ---------------------------------------------------------------
// Id anonimo gerado uma vez no navegador: vai em cada Pix e o historico sai por ele.
const CHAVE_DISPOSITIVO = "mtDispositivo";
const CHAVE_RECARGAS = "mtRecargasAtivas";
const CHAVE_LOCALIZACAO = "mtLocalizacao";

function lerStorage(chave) {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravarStorage(chave, valor) {
  try {
    if (valor == null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, valor);
  } catch {
    // modo anonimo sem storage: segue sem lembrar
  }
}

let dispositivoMemoria = null;

export function dispositivo() {
  let id = lerStorage(CHAVE_DISPOSITIVO) || dispositivoMemoria;
  if (!id) {
    id = (crypto.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`).replace(/[^A-Za-z0-9-]/g, "");
    gravarStorage(CHAVE_DISPOSITIVO, id);
    dispositivoMemoria = id;
  }
  return id;
}

// Recargas deste celular que ainda nao terminaram (aparecem em cima do mapa).
export function recargasAtivas() {
  try {
    return JSON.parse(lerStorage(CHAVE_RECARGAS) || "[]").filter(Number.isInteger);
  } catch {
    return [];
  }
}

export function lembrarRecarga(id) {
  gravarStorage(CHAVE_RECARGAS, JSON.stringify([id, ...recargasAtivas().filter((r) => r !== id)].slice(0, 5)));
}

export function esquecerRecarga(id) {
  gravarStorage(CHAVE_RECARGAS, JSON.stringify(recargasAtivas().filter((r) => r !== id)));
}

export const localizacaoLigada = () => lerStorage(CHAVE_LOCALIZACAO) === "1";
export const lembrarLocalizacao = (ligada) => gravarStorage(CHAVE_LOCALIZACAO, ligada ? "1" : null);

// ---- Entrada pelo QR code ---------------------------------------------------
// O carregador lido fica so em memoria: atualizar a pagina de escolher o tempo
// leva para o mapa (o link do QR some da barra de endereco).
let carregadorDoQr = null;

export const guardarCarregadorDoQr = (id) => {
  carregadorDoQr = id;
};

export const carregadorLido = () => carregadorDoQr;

// ---- Distancia e tempo ------------------------------------------------------
export function distanciaKm(a, b) {
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

// Sem rota: linha reta * 1,35 (curvas das ruas) a 28 km/h de media na cidade.
const estimativa = (km) => ({ km: km * 1.35, minutos: Math.max(1, Math.round(((km * 1.35) / 28) * 60)), aproximado: true });

/**
 * Tempo e distancia de carro ate cada carregador. Usa o OSRM publico (rota de
 * verdade); se falhar ou demorar, cai na estimativa pela linha reta.
 * Devolve { [id]: { km, minutos, aproximado } }.
 */
export async function rotasAte(origem, carregadores) {
  const destinos = carregadores.filter((c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude)).slice(0, 90);
  const resultado = Object.fromEntries(destinos.map((c) => [c.id, estimativa(distanciaKm(origem, c))]));
  if (!destinos.length) return resultado;
  const pontos = [origem, ...destinos].map((p) => `${p.longitude.toFixed(6)},${p.latitude.toFixed(6)}`).join(";");
  const controle = new AbortController();
  const tempo = setTimeout(() => controle.abort(), 6000);
  try {
    const resposta = await fetch(
      `https://router.project-osrm.org/table/v1/driving/${pontos}?sources=0&annotations=duration,distance`,
      { signal: controle.signal },
    );
    const dados = await resposta.json();
    if (dados.code !== "Ok") return resultado;
    destinos.forEach((c, i) => {
      const segundos = dados.durations?.[0]?.[i + 1];
      const metros = dados.distances?.[0]?.[i + 1];
      if (Number.isFinite(segundos) && Number.isFinite(metros)) {
        resultado[c.id] = { km: metros / 1000, minutos: Math.max(1, Math.round(segundos / 60)), aproximado: false };
      }
    });
  } catch {
    // sem internet para o OSRM: fica a estimativa
  } finally {
    clearTimeout(tempo);
  }
  return resultado;
}

export const linkWaze = (c) => `https://waze.com/ul?ll=${c.latitude},${c.longitude}&navigate=yes`;
export const linkGoogleMaps = (c) => `https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}`;
