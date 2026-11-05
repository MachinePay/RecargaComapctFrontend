// Historico do motorista: recargas pagas por este celular e os totais.
import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BatteryCharging, ChevronRight, Gauge, Leaf, Receipt, Zap } from "lucide-react";
import usePolling from "../hooks/usePolling";
import { formatarValor } from "../utils/formatos";
import { apiPublica, dispositivo, mensagemErro } from "./servicos";
import { duracao } from "./regras";
import { Esqueleto, Logo, NavMotorista } from "./ui";

// Estimativas para a tela ficar mais "palpavel" (marcadas com ~):
// carro eletrico medio roda ~6,5 km por kWh; carro a gasolina emite ~0,13 kg de CO2 por km.
const KM_POR_KWH = 6.5;
const CO2_KG_POR_KM = 0.13;

const ATIVAS = ["aguardando_inicio", "aguardando_carro", "carregando", "encerrando"];

const numero = (valor, casas = 0) => Number(valor || 0).toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: 0 });

// O backend grava em UTC sem fuso.
const data = (valor) => (valor ? new Date(`${String(valor).replace(" ", "T")}Z`) : null);

function situacaoDaRecarga(r) {
  if (r.estornada) return { texto: "Devolvido", cor: "var(--mt-text-soft)" };
  const s = r.sessao?.status;
  if (ATIVAS.includes(s)) return { texto: "Em andamento", cor: "var(--mt-accent)" };
  if (s === "falhou") return { texto: "Nao comecou", cor: "var(--mt-defeito)" };
  return { texto: "Concluida", cor: "var(--mt-cyan)" };
}

export default function PaginaHistorico() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    try {
      const resposta = await apiPublica.get("/historico", { params: { dispositivo: dispositivo() } });
      setDados(resposta.data);
      setErro("");
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }, []);

  usePolling(carregar, 15000, true, { imediato: true });

  const meses = useMemo(() => {
    const grupos = [];
    for (const r of dados?.recargas || []) {
      const quando = data(r.pago_em || r.criada_em);
      const chave = quando.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      let grupo = grupos.find((g) => g.chave === chave);
      if (!grupo) {
        grupo = { chave, itens: [], valor: 0 };
        grupos.push(grupo);
      }
      grupo.itens.push({ ...r, quando });
      if (!r.estornada) grupo.valor += r.valor;
    }
    return grupos;
  }, [dados]);

  const totais = dados?.totais;
  const km = (totais?.kwh || 0) * KM_POR_KWH;

  return (
    <div className="mt-app">
      <div className="mx-auto max-w-[560px] px-4 pb-32 pt-4">
        <header className="flex items-center justify-between">
          <Logo />
        </header>

        <h1 className="mt-7 text-[30px] font-extrabold leading-tight tracking-[-0.04em]">Suas recargas</h1>
        <p className="mt-1 text-[13px] font-semibold text-[var(--mt-text-soft)]">Tudo o que voce carregou pagando por este celular.</p>

        {erro && (
          <p className="mt-4 rounded-2xl border border-[var(--mt-defeito)]/40 bg-[var(--mt-defeito)]/10 px-3 py-2.5 text-[13px] font-semibold text-[var(--mt-defeito)]">{erro}</p>
        )}

        {!dados && !erro && (
          <div className="mt-6 space-y-3">
            <Esqueleto className="h-44" />
            <Esqueleto className="h-20" />
            <Esqueleto className="h-20" />
          </div>
        )}

        {dados && (
          <>
            <section className="mt-entrar relative mt-6 overflow-hidden rounded-[28px] border border-[var(--mt-accent)]/25 bg-[linear-gradient(150deg,#163325_0%,#0d1a15_55%,#0b1513_100%)] p-5">
              <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-[var(--mt-accent)]/20 blur-3xl" />
              <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--mt-accent)]">
                <Zap size={13} fill="currentColor" /> Energia abastecida
              </p>
              <p className="mt-num mt-2 text-[56px] font-bold leading-none">
                {numero(totais.kwh, 1)}
                <span className="ml-1.5 text-[22px] text-[var(--mt-text-soft)]">kWh</span>
              </p>
              <p className="mt-2 text-[13px] font-semibold text-[var(--mt-text-soft)]">
                ~{numero(km)} km rodados com energia limpa
              </p>
              <div className="mt-5 grid grid-cols-3 gap-2">
                <Numero icone={<BatteryCharging size={14} />} titulo="Recargas" valor={numero(totais.recargas)} />
                <Numero icone={<Receipt size={14} />} titulo="Investido" valor={formatarValor(totais.valor)} />
                <Numero icone={<Gauge size={14} />} titulo="Tempo" valor={duracao(totais.minutos * 60) || "0 min"} />
              </div>
              {totais.kwh > 0 && (
                <p className="mt-4 flex items-center gap-2 rounded-2xl bg-white/5 px-3 py-2 text-[12.5px] font-semibold text-[var(--mt-text-soft)]">
                  <Leaf size={15} className="shrink-0 text-[var(--mt-accent)]" />
                  ~{numero(km * CO2_KG_POR_KM)} kg de CO₂ a menos que um carro a gasolina
                  {totais.valor > 0 && km > 0 ? ` · ${formatarValor(totais.valor / km)}/km` : ""}
                </p>
              )}
            </section>

            {!dados.recargas.length && (
              <div className="mt-entrar mt-8 rounded-[24px] border border-dashed border-[var(--mt-border-strong)] px-5 py-10 text-center">
                <BatteryCharging size={36} className="mx-auto text-[var(--mt-text-faint)]" />
                <p className="mt-3 text-[16px] font-extrabold">Nenhuma recarga ainda</p>
                <p className="mt-1 text-[13px] font-semibold text-[var(--mt-text-soft)]">Leia o QR code de um carregador para fazer a primeira.</p>
                <Link to="/app" className="mt-btn mt-btn--primario mt-5 px-6 py-3">
                  Ver carregadores
                </Link>
              </div>
            )}

            {meses.map((mes) => (
              <section key={mes.chave} className="mt-7">
                <div className="mb-2.5 flex items-baseline justify-between px-1">
                  <h2 className="text-[13px] font-extrabold uppercase tracking-[0.12em] text-[var(--mt-text-soft)]">{mes.chave}</h2>
                  <span className="mt-num text-[13px] font-bold text-[var(--mt-text-soft)]">{formatarValor(mes.valor)}</span>
                </div>
                <ul className="space-y-2.5">
                  {mes.itens.map((r) => (
                    <li key={r.id}>
                      <ItemRecarga r={r} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <p className="mt-8 text-center text-[12px] font-semibold text-[var(--mt-text-faint)]">
              O historico fica guardado neste celular e navegador. Se limpar os dados do navegador, ele recomeca.
            </p>
          </>
        )}
      </div>
      <NavMotorista />
    </div>
  );
}

function Numero({ icone, titulo, valor }) {
  return (
    <div className="rounded-2xl bg-black/20 px-3 py-2.5">
      <p className="flex items-center gap-1 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-[var(--mt-text-faint)]">
        {icone} {titulo}
      </p>
      <p className="mt-num mt-1 truncate text-[17px] font-bold">{valor}</p>
    </div>
  );
}

function ItemRecarga({ r }) {
  const s = situacaoDaRecarga(r);
  return (
    <Link to={`/app/recarga/${r.id}`} className="mt-card flex items-center gap-3 p-3.5 transition active:scale-[0.99]">
      <span className="grid w-12 shrink-0 place-items-center rounded-2xl bg-[var(--mt-surface-soft)] py-2 text-center leading-none">
        <span className="mt-num text-[19px] font-bold">{r.quando.getDate()}</span>
        <span className="mt-0.5 text-[10px] font-extrabold uppercase text-[var(--mt-text-soft)]">
          {r.quando.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-extrabold">{r.carregador_nome}</span>
        <span className="mt-0.5 block text-[12.5px] font-semibold text-[var(--mt-text-soft)]">
          {r.quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {duracao(r.minutos * 60)} ·{" "}
          {numero(r.sessao?.energia_kwh, 2)} kWh
        </span>
        <span className="mt-1 inline-flex items-center gap-1.5 text-[11.5px] font-extrabold" style={{ color: s.cor }}>
          <span className="mt-ponto" /> {s.texto}
        </span>
      </span>
      <span className="text-right">
        <span className={`mt-num block text-[16px] font-bold ${r.estornada ? "text-[var(--mt-text-faint)] line-through" : ""}`}>{formatarValor(r.valor)}</span>
        <ChevronRight size={16} className="ml-auto mt-1 text-[var(--mt-text-faint)]" />
      </span>
    </Link>
  );
}
