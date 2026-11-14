import React, { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { BrandWordmark } from '@/components/brand/BrandWordmark';
import { AppShell } from '@/components/layout/AppShell';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { SensorDiagnosticsPage } from '@/features/diagnostics/SensorDiagnosticsPage';
import { IbmImpactPage } from '@/features/ibm/IbmImpactPage';
import { ParcelDetailPage } from '@/features/parcels/ParcelDetailPage';
import { ParcelsListPage } from '@/features/parcels/ParcelsListPage';
import { PassportDetailPage } from '@/features/passports/PassportDetailPage';
import { PassportsListPage } from '@/features/passports/PassportsListPage';
import { VerifyPassportPage } from '@/features/passports/VerifyPassportPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { NewVisitPage } from '@/features/visits/NewVisitPage';
import { applyThemeToDom, ensureSeedData, useAppStore } from '@/lib/db';

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-app-canvas flex items-center justify-center p-6 text-center">
          <div className="card-duo p-6 max-w-sm space-y-4">
            <BrandWordmark size="md" />
            <h1 className="font-display font-extrabold text-xl text-app-ink">
              Recuperación automática lista
            </h1>
            <p className="text-xs text-app-muted">
              Ocurrió un inconveniente temporal en la vista. Tus datos en el teléfono están a salvo.
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false });
                window.location.href = '/inicio';
              }}
              className="w-full py-3 btn-duo-primary text-xs"
            >
              Volver al inicio
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/entrar" replace />;
  }
  return children;
};

export const App: React.FC = () => {
  const [ready, setReady] = useState(false);
  const themeMode = useAppStore((s) => s.themeMode);

  useEffect(() => {
    applyThemeToDom(themeMode);
  }, [themeMode]);

  useEffect(() => {
    ensureSeedData()
      .catch(() => {})
      .finally(() => {
        setReady(true);
      });
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen bg-app-canvas flex flex-col items-center justify-center p-6 text-center space-y-4">
        <BrandWordmark size="lg" animated showSubtitle />
      </div>
    );
  }

  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/entrar" element={<LoginPage />} />
          <Route path="/verificar" element={<VerifyPassportPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/inicio" replace />} />
            <Route path="inicio" element={<DashboardPage />} />
            <Route path="parcelas" element={<ParcelsListPage />} />
            <Route path="parcelas/:id" element={<ParcelDetailPage />} />
            <Route path="visitas/nueva" element={<NewVisitPage />} />
            <Route path="visitas/nueva/:parcelId" element={<NewVisitPage />} />
            <Route path="pasaportes" element={<PassportsListPage />} />
            <Route path="pasaportes/:id" element={<PassportDetailPage />} />
            <Route path="evaluacion" element={<IbmImpactPage />} />
            <Route path="ibm" element={<Navigate to="/evaluacion" replace />} />
            <Route path="diagnostico" element={<SensorDiagnosticsPage />} />
            <Route path="ajustes" element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/inicio" replace />} />
        </Routes>
      </BrowserRouter>
    </AppErrorBoundary>
  );
};
