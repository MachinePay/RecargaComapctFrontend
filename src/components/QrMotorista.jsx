// QR code que vai colado no carregador: abre o app do motorista direto na
// tela de escolher o tempo e pagar com Pix (/c/<id>).
import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Copy, Download, ExternalLink, TriangleAlert } from "lucide-react";

const linkDoQr = (idHardware) => `${window.location.origin}/c/${encodeURIComponent(idHardware)}`;

// Cartaz pronto para imprimir: titulo, QR grande e o nome do carregador.
function desenharCartaz(qr, nome) {
  const largura = 1200;
  const altura = 1650;
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#070d0b";
  ctx.fillRect(0, 0, largura, altura);
  ctx.fillStyle = "#44e08a";
  ctx.font = "800 54px 'Plus Jakarta Sans', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("⚡ RECARREGUE AQUI", largura / 2, 150);
  ctx.fillStyle = "#eaf6ef";
  ctx.font = "700 40px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("Aponte a camera, escolha o tempo e pague com Pix", largura / 2, 225);
  const lado = 860;
  const x = (largura - lado) / 2;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(x - 50, 300, lado + 100, lado + 100, 48);
  ctx.fill();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qr, x, 350, lado, lado);
  ctx.fillStyle = "#eaf6ef";
  ctx.font = "800 64px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText(nome.length > 28 ? `${nome.slice(0, 27)}…` : nome, largura / 2, 1400);
  ctx.fillStyle = "#93a89d";
  ctx.font = "600 34px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("CompactRecarga · veja todos os carregadores no mapa", largura / 2, 1480);
  return canvas;
}

export default function QrMotorista({ carregador }) {
  const qrRef = useRef(null);
  const [copiado, setCopiado] = useState(false);
  const link = linkDoQr(carregador.id_hardware);

  const baixar = () => {
    const canvas = desenharCartaz(qrRef.current, carregador.nome_local);
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `qr-${carregador.id_hardware}.png`;
    a.click();
  };

  const copiar = async () => {
    await navigator.clipboard?.writeText(link);
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 2000);
  };

  const avisos = [];
  if (!carregador.preco_valor || !carregador.preco_minutos) avisos.push("Sem regra de preco: o motorista nao consegue pagar.");
  if ((carregador.banco_pagamento || "mercado_pago") === "mercado_pago" && !carregador.tem_token_mp) avisos.push("Sem token do Mercado Pago: o Pix nao e' gerado.");
  if (carregador.latitude == null) avisos.push("Sem localizacao: nao aparece no mapa do motorista.");

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="shrink-0 self-center rounded-[20px] border border-[var(--color-border)] bg-white p-3">
        <QRCodeCanvas ref={qrRef} value={link} size={600} level="M" marginSize={2} style={{ width: 150, height: 150 }} />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <p className="text-sm text-[var(--color-text-soft)]">
          Cole no carregador. O motorista le com a camera, escolhe o tempo e paga com Pix; a carga libera sozinha quando o banco confirma.
        </p>
        <p className="truncate rounded-xl bg-[var(--color-bg-muted)] px-3 py-2 font-mono text-xs">{link}</p>
        {avisos.map((aviso) => (
          <p key={aviso} className="flex items-start gap-1.5 text-sm font-semibold text-[var(--color-warning)]">
            <TriangleAlert size={15} className="mt-0.5 shrink-0" /> {aviso}
          </p>
        ))}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={baixar} className="pill-button pill-button--primary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold">
            <Download size={16} /> Baixar cartaz para imprimir
          </button>
          <button type="button" onClick={copiar} className="pill-button inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold">
            <Copy size={16} /> {copiado ? "Copiado!" : "Copiar link"}
          </button>
          <a href={link} target="_blank" rel="noopener noreferrer" className="pill-button inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold">
            <ExternalLink size={16} /> Abrir como motorista
          </a>
        </div>
      </div>
    </div>
  );
}
