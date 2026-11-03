import { useEffect } from "react";
import { createPortal } from "react-dom";

export default function Modal({ open, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    const handle = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(14,25,17,0.46)] p-4 backdrop-blur-sm sm:items-center">
      <div className="relative my-4 max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-[30px] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,248,242,0.97))] p-6 shadow-[0_30px_80px_rgba(23,43,29,0.20)] md:p-8">
        <button
          className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-white text-[var(--color-text-soft)] transition hover:border-[var(--color-error)] hover:text-[var(--color-error)]"
          onClick={onClose}
          type="button"
        >
          ×
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
