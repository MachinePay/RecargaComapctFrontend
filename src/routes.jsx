import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/useAuth";

import Layout from "./components/Layout";
import LoadingSpinner from "./components/LoadingSpinner";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Carregadores = lazy(() => import("./pages/Carregadores"));
const CarregadorDetalhe = lazy(() => import("./pages/CarregadorDetalhe"));
const Sessoes = lazy(() => import("./pages/Sessoes"));
const Tablets = lazy(() => import("./pages/Tablets"));
const Diagnostico = lazy(() => import("./pages/Diagnostico"));
const Login = lazy(() => import("./pages/Login"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Totem = lazy(() => import("./pages/totem/Totem"));
const TotemConfig = lazy(() => import("./pages/totem/TotemConfig"));

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

          {/* Tela do motorista: abre no tablet do totem, sem login do painel. */}
          <Route path="/totem" element={<Totem />} />
          <Route path="/totem/configurar" element={<TotemConfig />} />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<PrivatePage><Dashboard /></PrivatePage>} />
          <Route path="/carregadores" element={<PrivatePage><Carregadores /></PrivatePage>} />
          <Route path="/carregadores/:carregadorId" element={<PrivatePage><CarregadorDetalhe /></PrivatePage>} />
          <Route path="/sessoes" element={<PrivatePage><Sessoes /></PrivatePage>} />
          <Route path="/tablets" element={<PrivatePage><Tablets /></PrivatePage>} />
          <Route path="/diagnostico" element={<PrivatePage><Diagnostico /></PrivatePage>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
