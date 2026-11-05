// Tela principal do motorista: mapa com todos os carregadores, status ao vivo,
// quando cada um libera, distancia/tempo de carro e o mais perto livre.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BatteryCharging, ChevronRight, Clock, Crosshair, LoaderCircle, LocateFixed, MapPin, Navigation, QrCode, Route, X, Zap } from "lucide-react";
import usePolling from "../hooks/usePolling";
import AvisoInstalar from "./AvisoInstalar";
import MapaMotorista from "./MapaMotorista";
import {
  apiPublica,
  dispositivo,
  esquecerRecarga,
  lembrarLocalizacao,
  linkGoogleMaps,
  linkWaze,
  localizacaoLigada,
  mensagemErro,
  recargasAtivas,
  rotasAte,
  distanciaKm,
} from "./servicos";
import { SITUACOES, duracao, formatarKm, horaDaqui, precoHora, restante, textoSituacao, useAgora } from "./regras";
import { Esqueleto, Logo, NavMotorista, SeloSituacao } from "./ui";

const STATUS_ATIVOS = ["aguardando_inicio", "aguardando_carro", "carregando", "encerrando"];
// Recalcula as rotas so quando a pessoa andou isso (o OSRM e' publico).
const RECALCULAR_ROTAS_KM = 0.3;

function emAndamento(cobranca) {
  if (cobranca.status === "aguardando_pagamento") return true;
  return cobranca.status === "aprovada" && STATUS_ATIVOS.includes(cobranca.sessao?.status);
}

export default function PaginaMapa() {
  const agora = useAgora();
  const [carregadores, setCarregadores] = useState(null);
  const [recebidoEm, setRecebidoEm] = useState(0);
  const [erro, setErro] = useState("");
  const [ativas, setAtivas] = useState([]);
  const [selecionado, setSelecionado] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const [folhaAberta, setFolhaAberta] = useState(false);
  const [enquadrar, setEnquadrar] = useState(0);
  const [usuario, setUsuario] = useState(null);
  // desligada | buscando | ok | negada | erro. Ja deixou antes: comeca buscando.
  const [estadoLocal, setEstadoLocal] = useState(() => (localizacaoLigada() ? "buscando" : "desligada"));
  const [rotas, setRotas] = useState({});
  const vigiaRef = useRef(null);
  const ultimaRotaRef = useRef(null);
  const primeiraPosicaoRef = useRef(true);

  const carregar = useCallback(async () => {
    try {
      const { data } = await apiPublica.get("/carregadores");
      setCarregadores(data);
      setRecebidoEm(Date.now());
      setErro("");
    } catch (e) {
      setErro(mensagemErro(e));
    }
    const ids = recargasAtivas();
    if (!ids.length) {
      setAtivas([]);
      return;
    }
    const respostas = await Promise.all(
      ids.map((id) =>
        apiPublica
          .get(`/cobrancas/${id}`, { params: { dispositivo: dispositivo() } })
          .then((r) => r.data)
          .catch((e) => (e.response?.status === 404 ? { id, sumiu: true } : null)),
      ),
    );
    respostas.forEach((c) => {
      if (c && (c.sumiu || !emAndamento(c))) esquecerRecarga(c.id);
    });
    setAtivas(respostas.filter((c) => c && !c.sumiu && emAndamento(c)).map((c) => ({ ...c, recebidoEm: Date.now() })));
  }, []);

  usePolling(carregar, 10000, true, { imediato: true });

  // ---- Localizacao --------------------------------------------------------
  // So os callbacks do GPS mudam o estado (o efeito de abrir a tela chama isto).
  const vigiar = useCallback(() => {
    if (!navigator.geolocation || vigiaRef.current != null) return;
    vigiaRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setUsuario({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, precisao: pos.coords.accuracy });
        setEstadoLocal("ok");
        lembrarLocalizacao(true);
        if (primeiraPosicaoRef.current) {
          primeiraPosicaoRef.current = false;
          setEnquadrar((n) => n + 1);
        }
      },
      (e) => {
        setEstadoLocal(e.code === 1 ? "negada" : "erro");
        if (e.code === 1) lembrarLocalizacao(false);
        navigator.geolocation.clearWatch(vigiaRef.current);
        vigiaRef.current = null;
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
    );
  }, []);

  const ligarLocalizacao = useCallback(() => {
    if (!navigator.geolocation) {
      setEstadoLocal("erro");
      return;
    }
    if (vigiaRef.current != null) {
      setEnquadrar((n) => n + 1);
      return;
    }
    setEstadoLocal("buscando");
    vigiar();
  }, [vigiar]);

  useEffect(() => {
    // Ja deixou antes: liga sozinho (o navegador nao pergunta de novo).
    if (localizacaoLigada()) vigiar();
    return () => {
      if (vigiaRef.current != null) navigator.geolocation.clearWatch(vigiaRef.current);
    };
  }, [vigiar]);

  const idsComLocal = useMemo(
    () => (carregadores || []).filter((c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude)).map((c) => c.id).join("|"),
    [carregadores],
  );

  useEffect(() => {
    if (!usuario || !carregadores?.length) return;
    const ultima = ultimaRotaRef.current;
    if (ultima && ultima.ids === idsComLocal && distanciaKm(ultima, usuario) < RECALCULAR_ROTAS_KM) return;
    ultimaRotaRef.current = { ...usuario, ids: idsComLocal };
    let vivo = true;
    rotasAte(usuario, carregadores).then((r) => {
      if (vivo) setRotas(r);
    });
    return () => {
      vivo = false;
    };
    // carregadores entra pelo idsComLocal: o status muda a cada 10 s, as posicoes nao.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, idsComLocal]);

  // ---- Lista --------------------------------------------------------------
  const lista = useMemo(() => {
    const todos = (carregadores || []).map((c) => ({
      ...c,
      rota: rotas[c.id] || null,
      segundos: restante(c.segundos_para_liberar, recebidoEm, agora),
    }));
    return todos.sort((a, b) => {
      if (a.rota && b.rota) return a.rota.minutos - b.rota.minutos || a.rota.km - b.rota.km;
      if (a.rota || b.rota) return a.rota ? -1 : 1;
      return (SITUACOES[a.situacao]?.ordem ?? 9) - (SITUACOES[b.situacao]?.ordem ?? 9) || a.nome.localeCompare(b.nome);
    });
  }, [carregadores, rotas, recebidoEm, agora]);

  const maisPerto = useMemo(() => lista.find((c) => c.rota && c.situacao === "livre") || null, [lista]);
  const visiveis = filtro === "livres" ? lista.filter((c) => c.situacao === "livre") : lista;
  const contagem = useMemo(() => {
    const livres = lista.filter((c) => c.situacao === "livre").length;
    return { livres, emUso: lista.filter((c) => c.situacao === "ocupado" || c.situacao === "reservado").length };
  }, [lista]);
  const atual = selecionado ? lista.find((c) => c.id === selecionado) : null;

  const pontos = useMemo(
    () =>
      lista.map((c) => ({
        id: c.id,
        latitude: c.latitude,
        longitude: c.longitude,
        situacao: c.situacao,
        maisPerto: maisPerto?.id === c.id,
        // So o minuto cheio: o pino nao precisa redesenhar a cada segundo.
        chip: c.situacao === "ocupado" && c.segundos != null ? (c.segundos > 0 ? duracao(Math.ceil(c.segundos / 60) * 60) : "agora") : null,
      })),
    [lista, maisPerto],
  );
  // Evita redesenhar os pinos a cada segundo quando nada mudou.
  const assinaturaPontos = JSON.stringify(pontos);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pontosEstaveis = useMemo(() => pontos, [assinaturaPontos]);

  const selecionar = useCallback((id) => {
    setSelecionado(id);
    if (id) setFolhaAberta(false);
  }, []);

  const margemBaixo = typeof window !== "undefined" && window.innerWidth < 1024 ? Math.round(window.innerHeight * 0.46) : 0;

  return (
    <div className="mt-app relative h-[100dvh] overflow-hidden">
      <MapaMotorista
        pontos={pontosEstaveis}
        usuario={usuario}
        selecionado={selecionado}
        onSelecionar={selecionar}
        enquadrar={enquadrar}
        margemBaixo={margemBaixo}
      />

      {/* Topo */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="mt-glass pointer-events-auto rounded-[22px] px-3 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
          <Logo />
        </div>
        <div className="pointer-events-auto flex flex-col items-end gap-2 lg:mt-[64px]">
          <button
            type="button"
            onClick={ligarLocalizacao}
            aria-label="Minha localizacao"
            className={`mt-glass grid h-12 w-12 place-items-center rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.45)] ${estadoLocal === "ok" ? "text-[var(--mt-usuario)]" : "text-[var(--mt-text)]"}`}
          >
            {estadoLocal === "buscando" ? <LoaderCircle size={20} className="animate-spin" /> : estadoLocal === "ok" ? <LocateFixed size={20} /> : <Crosshair size={20} />}
          </button>
        </div>
      </header>

      {/* Lista / detalhe */}
      <section
        className="mt-folha mt-glass shadow-[0_-20px_60px_rgba(0,0,0,0.55)]"
        style={{ maxHeight: folhaAberta ? "86dvh" : atual ? "64dvh" : "48dvh" }}
      >
        <button type="button" className="w-full shrink-0 lg:hidden" onClick={() => setFolhaAberta((v) => !v)} aria-label="Abrir ou fechar a lista">
          <div className="mt-folha__alca" />
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-2 lg:pt-4">
          {ativas.map((c) => (
            <CartaoRecargaAtiva key={c.id} cobranca={c} agora={agora} />
          ))}

          {atual ? (
            <DetalheCarregador c={atual} agora={agora} maisPerto={maisPerto?.id === atual.id} onFechar={() => setSelecionado(null)} />
          ) : (
            <>
              <div className="flex items-end justify-between gap-3 pt-1">
                <div>
                  <h1 className="text-[22px] font-extrabold tracking-[-0.03em]">Carregadores</h1>
                  <p className="text-[13px] font-semibold text-[var(--mt-text-soft)]">
                    {carregadores == null ? (
                      "Carregando..."
                    ) : (
                      <>
                        <span className="text-[var(--mt-livre)]">{contagem.livres} livres</span> · {contagem.emUso} em uso · {lista.length} no total
                      </>
                    )}
                  </p>
                </div>
                <div className="flex rounded-full border border-[var(--mt-border)] bg-[var(--mt-surface-soft)] p-1 text-[12px] font-bold">
                  {[
                    ["todos", "Todos"],
                    ["livres", "Livres"],
                  ].map(([valor, texto]) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => setFiltro(valor)}
                      className={`rounded-full px-3 py-1.5 transition ${filtro === valor ? "bg-[var(--mt-text)] text-[var(--mt-bg)]" : "text-[var(--mt-text-soft)]"}`}
                    >
                      {texto}
                    </button>
                  ))}
                </div>
              </div>

              {erro && <p className="mt-3 rounded-2xl border border-[var(--mt-defeito)]/40 bg-[var(--mt-defeito)]/10 px-3 py-2 text-[13px] font-semibold text-[var(--mt-defeito)]">{erro}</p>}

              <AvisoLocalizacao estado={estadoLocal} onLigar={ligarLocalizacao} />

              <AvisoInstalar className="mt-3" />

              {maisPerto && filtro === "todos" && <CartaoMaisPerto c={maisPerto} onAbrir={() => selecionar(maisPerto.id)} />}

              <ul className="mt-3 space-y-2.5">
                {carregadores == null &&
                  [0, 1, 2].map((i) => (
                    <li key={i}>
                      <Esqueleto className="h-[92px]" />
                    </li>
                  ))}
                {carregadores != null && !visiveis.length && (
                  <li className="mt-card px-4 py-6 text-center text-[14px] font-semibold text-[var(--mt-text-soft)]">
                    {filtro === "livres" ? "Nenhum carregador livre agora. Veja quando os outros liberam em Todos." : "Nenhum carregador cadastrado ainda."}
                  </li>
                )}
                {visiveis.map((c) => (
                  <li key={c.id}>
                    <LinhaCarregador c={c} calculando={Boolean(usuario) && !c.rota} onAbrir={() => selecionar(c.id)} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      <NavMotorista />
    </div>
  );
}

function AvisoLocalizacao({ estado, onLigar }) {
  if (estado === "ok") return null;
  if (estado === "negada") {
    return (
      <p className="mt-3 rounded-2xl border border-[var(--mt-border)] bg-[var(--mt-surface-soft)] px-3 py-2.5 text-[13px] font-semibold text-[var(--mt-text-soft)]">
        A localizacao esta bloqueada. Libere nas configuracoes do navegador para ver a distancia ate cada carregador.
      </p>
    );
  }
  return (
    <button
      type="button"
      onClick={onLigar}
      className="mt-3 flex w-full items-center gap-3 rounded-[20px] border border-[var(--mt-usuario)]/30 bg-[var(--mt-usuario)]/10 px-4 py-3 text-left"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--mt-usuario)] text-white">
        {estado === "buscando" ? <LoaderCircle size={18} className="animate-spin" /> : <LocateFixed size={18} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-extrabold">{estado === "buscando" ? "Procurando voce..." : "Ver o mais perto de mim"}</span>
        <span className="block text-[12px] font-semibold text-[var(--mt-text-soft)]">
          {estado === "erro" ? "Nao deu para achar sua localizacao. Toque para tentar de novo." : "Ative a localizacao para ver distancia e tempo ate cada carregador."}
        </span>
      </span>
      <ChevronRight size={18} className="text-[var(--mt-text-soft)]" />
    </button>
  );
}

function CartaoMaisPerto({ c, onAbrir }) {
  return (
    <div className="mt-entrar mt-3 overflow-hidden rounded-[22px] border border-[var(--mt-accent)]/35 bg-[linear-gradient(135deg,rgba(68,224,138,0.18),rgba(56,214,240,0.06))] p-4">
      <button type="button" onClick={onAbrir} className="block w-full text-left">
        <span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--mt-accent)]">
          <Zap size={13} fill="currentColor" /> Mais perto livre
        </span>
        <span className="mt-1 block truncate text-[18px] font-extrabold tracking-[-0.02em]">{c.nome}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-semibold text-[var(--mt-text-soft)]">
          <span className="mt-num text-[22px] font-bold text-[var(--mt-text)]">{c.rota.minutos} min</span>
          <span>{formatarKm(c.rota.km)} de carro</span>
          <span>· {precoHora(c)}</span>
        </span>
      </button>
      <a href={linkWaze(c)} target="_blank" rel="noopener noreferrer" className="mt-btn mt-btn--waze mt-3 w-full py-3 text-[15px]">
        <Navigation size={18} fill="currentColor" /> Ir agora com Waze
      </a>
    </div>
  );
}

function LinhaCarregador({ c, calculando, onAbrir }) {
  const cor = SITUACOES[c.situacao]?.cor;
  return (
    <div className="mt-card flex items-stretch gap-3 p-3 transition active:scale-[0.99]">
      <button type="button" onClick={onAbrir} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl"
          style={{ background: `color-mix(in srgb, ${cor} 16%, transparent)`, color: cor }}
        >
          {c.situacao === "ocupado" ? <BatteryCharging size={22} /> : <Zap size={22} fill={c.situacao === "livre" ? "currentColor" : "none"} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-extrabold tracking-[-0.01em]">{c.nome}</span>
          <span className="mt-0.5 block truncate text-[12.5px] font-bold" style={{ color: cor }}>
            {textoSituacao(c, c.segundos)}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2.5 text-[12px] font-semibold text-[var(--mt-text-soft)]">
            {c.rota ? (
              <span className="flex items-center gap-1 text-[var(--mt-text)]">
                <Route size={13} /> {c.rota.minutos} min · {formatarKm(c.rota.km)}
              </span>
            ) : calculando ? (
              <span className="flex items-center gap-1">
                <LoaderCircle size={12} className="animate-spin" /> calculando rota
              </span>
            ) : null}
            <span>{precoHora(c)}</span>
          </span>
        </span>
      </button>
      {Number.isFinite(c.latitude) && (
        <a
          href={linkWaze(c)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Ir para ${c.nome} com Waze`}
          className="mt-btn mt-btn--waze w-12 shrink-0 self-center rounded-2xl py-3"
        >
          <Navigation size={18} fill="currentColor" />
        </a>
      )}
    </div>
  );
}

function DetalheCarregador({ c, agora, maisPerto, onFechar }) {
  const cor = SITUACOES[c.situacao]?.cor;
  return (
    <div className="mt-entrar pt-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <SeloSituacao situacao={c.situacao} />
            {maisPerto && (
              <span className="mt-chip text-[var(--mt-accent)]">
                <Zap size={12} fill="currentColor" /> Mais perto
              </span>
            )}
          </div>
          <h2 className="mt-2 text-[24px] font-extrabold leading-tight tracking-[-0.03em]">{c.nome}</h2>
          {c.endereco && (
            <p className="mt-1 flex items-start gap-1.5 text-[13px] font-semibold text-[var(--mt-text-soft)]">
              <MapPin size={14} className="mt-0.5 shrink-0" /> {c.endereco}
            </p>
          )}
        </div>
        <button type="button" onClick={onFechar} aria-label="Fechar" className="mt-btn mt-btn--fantasma h-10 w-10 shrink-0">
          <X size={18} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Indicador titulo="De carro" valor={c.rota ? `${c.rota.minutos} min` : "--"} detalhe={c.rota ? formatarKm(c.rota.km) : "ative a localizacao"} />
        <Indicador titulo="Preco" valor={c.preco_hora ? c.preco_hora.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "--"} detalhe="por hora" />
        <Indicador
          titulo={c.situacao === "ocupado" ? "Libera em" : "Status"}
          valor={c.situacao === "ocupado" ? (c.segundos != null ? duracao(c.segundos) : "--") : SITUACOES[c.situacao]?.curto}
          detalhe={c.situacao === "ocupado" && c.segundos ? `as ~${horaDaqui(c.segundos, agora)}` : " "}
          cor={cor}
        />
      </div>

      {c.situacao === "ocupado" && (
        <p className="mt-3 flex items-start gap-2 rounded-2xl bg-[var(--mt-ocupado)]/10 px-3 py-2.5 text-[13px] font-semibold text-[var(--mt-ocupado)]">
          <Clock size={16} className="mt-0.5 shrink-0" />
          {c.segundos != null
            ? "Previsao pelo tempo que a pessoa pagou. Pode liberar antes se ela tirar o carro."
            : "Tem um carro conectado. A previsao aparece assim que a recarga comecar."}
        </p>
      )}
      {c.situacao === "livre" && (
        <p className="mt-3 flex items-start gap-2 rounded-2xl bg-[var(--mt-accent)]/10 px-3 py-2.5 text-[13px] font-semibold text-[var(--mt-accent)]">
          <QrCode size={16} className="mt-0.5 shrink-0" />
          Chegando la, leia o QR code do carregador para escolher o tempo e pagar com Pix.
        </p>
      )}

      {Number.isFinite(c.latitude) ? (
        <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
          <a href={linkWaze(c)} target="_blank" rel="noopener noreferrer" className="mt-btn mt-btn--waze py-3.5 text-[16px]">
            <Navigation size={19} fill="currentColor" /> Ir com Waze
          </a>
          <a href={linkGoogleMaps(c)} target="_blank" rel="noopener noreferrer" className="mt-btn mt-btn--fantasma px-4 py-3.5 text-[14px]">
            Google Maps
          </a>
        </div>
      ) : (
        <p className="mt-4 text-[13px] font-semibold text-[var(--mt-text-soft)]">Este carregador ainda nao tem a localizacao no mapa.</p>
      )}
    </div>
  );
}

function Indicador({ titulo, valor, detalhe, cor }) {
  return (
    <div className="rounded-2xl border border-[var(--mt-border)] bg-[var(--mt-surface-soft)] px-3 py-2.5">
      <p className="text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-[var(--mt-text-faint)]">{titulo}</p>
      <p className="mt-num mt-1 truncate text-[18px] font-bold" style={cor ? { color: cor } : undefined}>
        {valor}
      </p>
      <p className="truncate text-[11px] font-semibold text-[var(--mt-text-soft)]">{detalhe}</p>
    </div>
  );
}

function CartaoRecargaAtiva({ cobranca, agora }) {
  const sessao = cobranca.sessao;
  const segundos = restante(sessao?.segundos_restantes, cobranca.recebidoEm, agora);
  let texto = "Aguardando o seu Pix";
  if (sessao?.status === "carregando") texto = segundos != null ? `Carregando · faltam ${duracao(segundos)}` : "Esperando o carro puxar energia";
  else if (sessao?.status === "aguardando_carro") texto = "Conecte o cabo no carro";
  else if (sessao?.status === "aguardando_inicio") texto = "Liberando o carregador";
  else if (sessao?.status === "encerrando") texto = "Finalizando a recarga";
  return (
    <Link
      to={`/app/recarga/${cobranca.id}`}
      className="mt-entrar mb-3 flex items-center gap-3 rounded-[22px] bg-[var(--mt-accent)] p-3.5 text-[var(--mt-accent-ink)] shadow-[0_14px_40px_rgba(68,224,138,0.3)]"
    >
      <span className="mt-raio grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--mt-accent-ink)] text-[var(--mt-accent)]">
        <BatteryCharging size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-extrabold uppercase tracking-[0.12em] opacity-70">Sua recarga · {cobranca.carregador_nome}</span>
        <span className="block truncate text-[16px] font-extrabold">{texto}</span>
      </span>
      <ChevronRight size={20} />
    </Link>
  );
}
