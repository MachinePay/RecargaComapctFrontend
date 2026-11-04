import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/useAuth";

import Layout from "./components/Layout";
import LoadingSpinner from "./components/LoadingSpinner";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Carregadores = lazy(() => import("./pages/Carregadores"));
const CarregadorDetalhe = lazy(() => import("./pages/CarregadorDetalhe"));
const Sessoes = lazy(() => import("./pages/Sessoes"));
const Diagnostico = lazy(() => import("./pages/Diagnostico"));
const Clientes = lazy(() => import("./pages/Clientes"));
const Mapa = lazy(() => import("./pages/Mapa"));
const Gestao = lazy(() => import("./pages/Gestao"));
const Whatsapp = lazy(() => import("./pages/Whatsapp"));
const Login = lazy(() => import("./pages/Login"));
const NotFound = lazy(() => import("./pages/NotFound"));

function PrivateRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  return user ? children : <Navigate to="/login" replace state={{ from: location }} />;
}

function RouteFallback() {
  return <LoadingSpinner className="min-h-screen" />;
}

function PrivatePage({ children }) {
  return (
    <PrivateRoute>
      <Layout>{children}</Layout>
    </PrivateRoute>
  );
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />


          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<PrivatePage><Dashboard /></PrivatePage>} />
          <Route path="/carregadores" element={<PrivatePage><Carregadores /></PrivatePage>} />
          <Route path="/carregadores/:carregadorId" element={<PrivatePage><CarregadorDetalhe /></PrivatePage>} />
          <Route path="/sessoes" element={<PrivatePage><Sessoes /></PrivatePage>} />
          <Route path="/diagnostico" element={<PrivatePage><Diagnostico /></PrivatePage>} />
          <Route path="/clientes" element={<PrivatePage><Clientes /></PrivatePage>} />
          <Route path="/mapa" element={<PrivatePage><Mapa /></PrivatePage>} />
          <Route path="/gestao" element={<PrivatePage><Gestao /></PrivatePage>} />
          <Route path="/whatsapp" element={<PrivatePage><Whatsapp /></PrivatePage>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
