import api from "../api/axios";
import { confirmar } from "./confirmar";
import { formatarValor } from "./formatos";

// Devolve o pagamento de uma recarga encerrada (botao Estornar das Recargas).
export async function estornarRecarga(sessao) {
  const ok = await confirmar({
    titulo: `Estornar ${formatarValor(sessao.valor)} da recarga #${sessao.id}?`,
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
