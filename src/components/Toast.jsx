import { useEffect } from "react";

export default function Toast({
  message,
  type = "error",
  title,
  requestId,
  onClose,
}) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, type === "error" ? 7000 : 4000);
    return () => clearTimeout(timer);
  }, [message, onClose, type]);

  if (!message) return null;

  const isError = type === "error";
  const isWarning = type === "warning";
  const tone = isError
    ? "border-red-200 bg-red-50 text-red-950"
    : isWarning
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : "border-emerald-200 bg-emerald-50 text-emerald-950";
  const iconTone = isError
    ? "bg-red-100 text-red-700"
    : isWarning
      ? "bg-amber-100 text-amber-800"
      : "bg-emerald-100 text-emerald-700";
  const label =
    title ||
    (isError
      ? "Nao foi possivel concluir"
      : isWarning
        ? "Ainda sem confirmacao"
        : "Tudo certo");

  return (
    <div
      className={`fixed right-4 top-5 z-50 w-[calc(100vw-2rem)] max-w-md rounded-lg border px-4 py-3 shadow-xl ${tone}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${iconTone}`}
        >
          {isError ? "!" : isWarning ? "..." : "OK"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">{label}</div>
          <div className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed opacity-90">
            {message}
          </div>
          {requestId ? (
            <div className="mt-2 break-all text-xs font-semibold opacity-70">
              Request ID: {requestId}
            </div>
          ) : null}
        </div>
        <button
          className="shrink-0 rounded-full px-2 text-xl leading-none opacity-60 hover:opacity-100"
          onClick={onClose}
          aria-label="Fechar aviso"
        >
          x
        </button>
      </div>
    </div>
  );
}
