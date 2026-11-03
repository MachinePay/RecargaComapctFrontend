import AppRoutes from "./routes";
import { AuthProvider } from "./context/AuthContext";
import "./styles/theme.css";
import "./index.css";
import { useState, useEffect } from "react";
import Toast from "./components/Toast";
import { addApiErrorListener } from "./api/axios";

export default function App() {
  const [toast, setToast] = useState({ message: "", type: "error", title: "" });

  useEffect(() => {
    const removeListener = addApiErrorListener((payload) => {
      setToast({ message: payload.message, type: payload.type || "error", title: payload.title || "Erro" });
    });
    return removeListener;
  }, []);

  return (
    <AuthProvider>
      <AppRoutes />
      <Toast
        message={toast.message}
        type={toast.type}
        title={toast.title}
        onClose={() => setToast({ message: "", type: "error", title: "" })}
      />
    </AuthProvider>
  );
}
