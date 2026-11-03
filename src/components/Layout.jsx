import Sidebar from "./Sidebar";

export default function Layout({ children }) {
  return (
    <div className="app-shell flex min-h-screen flex-col gap-3 px-3 pb-3 pt-[76px] sm:p-3 sm:pt-[72px] lg:flex-row lg:gap-4 lg:p-5">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-visible rounded-[18px] bg-white/36 p-2 sm:p-2 lg:overflow-hidden lg:rounded-[28px]">
        {children}
      </main>
    </div>
  );
}
