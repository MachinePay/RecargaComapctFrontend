import api from "../api/axios";
import { confirmar } from "./confirmar";
import { formatarValor } from "./formatos";

// Devolve o pagamento de uma recarga encerrada (botao Estornar das Recargas).
export async function estornarRecarga(sessao) {
  // Recarga por kWh que ja devolveu a sobra: estorna so o que ficou.
  const resto = (sessao.valor || 0) - (sessao.valor_devolvido || 0);
  const ok = await confirmar({
    titulo: `Estornar ${formatarValor(resto)} da recarga #${sessao.id}?`,
    texto: "O valor volta para o cliente no banco da maquininha (Mercado Pago ou SumUp). Nao da para desfazer.",
    confirmarTexto: "Estornar",
    perigoso: true,
  });
  if (!ok) return false;
  try {
    await api.post(`/admin/sessoes/${sessao.id}/estornar`);
    return true;
  } catch {
    return false; // Toast global mostra o motivo
  }
}

// Recarga por kWh em que o banco recusou devolver a sobra: tenta de novo.
export async function devolverSobra(sessao) {
  const sobra = (sessao.valor_pago ?? sessao.valor ?? 0) - (sessao.valor_consumido || 0) - (sessao.valor_devolvido || 0);
  const ok = await confirmar({
    titulo: `Devolver ${formatarValor(sobra)} da recarga #${sessao.id}?`,
    texto: "E' o que o motorista pagou e nao usou. Volta no mesmo meio de pagamento.",
    confirmarTexto: "Devolver",
  });
  if (!ok) return false;
  try {
    await api.post(`/admin/sessoes/${sessao.id}/devolver-sobra`);
    return true;
  } catch {
    return false;
  }
}
