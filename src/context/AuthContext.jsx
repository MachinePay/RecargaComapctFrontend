import { useCallback, useEffect, useState } from "react";

import AuthContext from "./AuthContextCore";

// Duas formas de entrar: usuario e senha (token JWT, igual CompactPay) ou a
// ADMIN_API_KEY do servidor (acesso de administrador, para o primeiro acesso).
function lerSessao() {
  try {
    const token = localStorage.getItem("authToken");
    const usuario = JSON.parse(localStorage.getItem("authUsuario") || "null");
    if (token && usuario) return usuario;
    if (localStorage.getItem("adminKey")) return { role: "admin", nome: "Administrador", porChave: true };
  } catch {
    // storage indisponivel: sem sessao
  }
  return null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(lerSessao);

  const login = useCallback((chave) => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUsuario");
    localStorage.setItem("adminKey", chave);
    setUser(lerSessao());
  }, []);

  const loginUsuario = useCallback((token, usuario) => {
    localStorage.removeItem("adminKey");
    localStorage.setItem("authToken", token);
    localStorage.setItem("authUsuario", JSON.stringify(usuario));
    setUser(lerSessao());
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("adminKey");
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUsuario");
    setUser(null);
  }, []);

  useEffect(() => {
    const handleStorage = (event) => {
      if (["adminKey", "authToken", "authUsuario"].includes(event.key)) setUser(lerSessao());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return <AuthContext.Provider value={{ user, isAdmin: user?.role === "admin", login, loginUsuario, logout }}>{children}</AuthContext.Provider>;
}
