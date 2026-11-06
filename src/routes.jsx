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
const Usuarios = lazy(() => import("./pages/Usuarios"));
const Quedas = lazy(() => import("./pages/Quedas"));
const Saude = lazy(() => import("./pages/Saude"));
const AoVivo = lazy(() => import("./pages/AoVivo"));
const Vouchers = lazy(() => import("./pages/Vouchers"));
const Login = lazy(() => import("./pages/Login"));
const NotFound = lazy(() => import("./pages/NotFound"));
// App do motorista (publico, sem login): QR code do carregador, mapa e historico.
const PaginaMapa = lazy(() => import("./motorista/PaginaMapa"));
const PaginaCarregar = lazy(() => import("./motorista/PaginaCarregar"));
const EntradaQr = lazy(() => import("./motorista/PaginaCarregar").then((m) => ({ default: m.EntradaQr })));
const PaginaRecarga = lazy(() => import("./motorista/PaginaRecarga"));
const PaginaHistorico = lazy(() => import("./motorista/PaginaHistorico"));
const PaginaConta = lazy(() => import("./motorista/PaginaConta"));
const PaginaVoucher = lazy(() => import("./motorista/PaginaVoucher"));

function PrivateRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  return user ? children : <Navigate to="/login" replace state={{ from: location }} />;
}

// Pagina so de administrador: usuario de cliente volta para o dashboard.
function AdminPage({ children }) {
  const { isAdmin } = useAuth();
  return <PrivatePage>{isAdmin ? children : <Navigate to="/dashboard" replace />}</PrivatePage>;
}

// Raiz do site: quem esta logado no painel vai para o dashboard; o resto
// (motorista, app instalado) cai no mapa.
function Inicio() {
  const { user } = useAuth();
  return <Navigate to={user ? "/dashboard" : "/app"} replace />;
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

          <Route path="/c/:carregadorId" element={<EntradaQr />} />
          <Route path="/app" element={<PaginaMapa />} />
          <Route path="/app/carregar" element={<PaginaCarregar />} />
          <Route path="/app/recarga/:cobrancaId" element={<PaginaRecarga />} />
          <Route path="/app/historico" element={<PaginaHistorico />} />
          <Route path="/app/conta" element={<PaginaConta />} />
          <Route path="/v/:codigo" element={<PaginaVoucher />} />

          <Route path="/" element={<Inicio />} />
          <Route path="/dashboard" element={<PrivatePage><Dashboard /></PrivatePage>} />
          <Route path="/carregadores" element={<PrivatePage><Carregadores /></PrivatePage>} />
          <Route path="/carregadores/:carregadorId" element={<PrivatePage><CarregadorDetalhe /></PrivatePage>} />
          <Route path="/sessoes" element={<PrivatePage><Sessoes /></PrivatePage>} />
          <Route path="/diagnostico" element={<AdminPage><Diagnostico /></AdminPage>} />
          <Route path="/clientes" element={<AdminPage><Clientes /></AdminPage>} />
          <Route path="/mapa" element={<PrivatePage><Mapa /></PrivatePage>} />
          <Route path="/gestao" element={<PrivatePage><Gestao /></PrivatePage>} />
          <Route path="/whatsapp" element={<AdminPage><Whatsapp /></AdminPage>} />
          <Route path="/usuarios" element={<AdminPage><Usuarios /></AdminPage>} />
          <Route path="/quedas" element={<PrivatePage><Quedas /></PrivatePage>} />
          <Route path="/saude" element={<PrivatePage><Saude /></PrivatePage>} />
          <Route path="/ao-vivo" element={<PrivatePage><AoVivo /></PrivatePage>} />
          <Route path="/vouchers" element={<PrivatePage><Vouchers /></PrivatePage>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
