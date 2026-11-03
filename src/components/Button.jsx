export default function Button({ children, className = "", ...props }) {
  return (
    <button
      className={`pill-button pill-button--primary inline-flex items-center gap-2 px-5 py-3 font-semibold ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
