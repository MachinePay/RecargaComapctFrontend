import { useCallback, useEffect, useState } from "react";

import AuthContext from "./AuthContextCore";

// O backend do carregador ainda nao tem usuarios: o painel entra com a
// ADMIN_API_KEY. Quando for integrado a CompactPay, troca por JWT aqui.
export function AuthProvider({ children }) {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem("adminKey"));

  const login = useCallback((chave) => {
    localStorage.setItem("adminKey", chave);
    setAdminKey(chave);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("adminKey");
    setAdminKey(null);
  }, []);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === "adminKey") setAdminKey(localStorage.getItem("adminKey"));
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return (
    <AuthContext.Provider value={{ user: adminKey ? { role: "admin" } : null, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
