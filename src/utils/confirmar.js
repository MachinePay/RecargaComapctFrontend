import Swal from "sweetalert2";

// Confirmacao padrao do painel (SweetAlert2) no lugar do window.confirm.
// Resolve true se a pessoa confirmar.
export async function confirmar({
  titulo,
  texto,
  confirmarTexto = "Confirmar",
  cancelarTexto = "Cancelar",
  perigoso = false,
}) {
  const resultado = await Swal.fire({
    title: titulo,
    text: texto,
    icon: perigoso ? "warning" : "question",
    showCancelButton: true,
    confirmButtonText: confirmarTexto,
    cancelButtonText: cancelarTexto,
    reverseButtons: true,
    focusCancel: perigoso,
    confirmButtonColor: perigoso ? "#b64545" : "#1f7a4c",
    cancelButtonColor: "#6b7c72",
  });
  return resultado.isConfirmed;
}
