import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider.tsx';
import { RequireAuth } from './auth/RequireAuth.tsx';
import { RefreshProvider } from './hooks/RefreshProvider.tsx';
import { Layout } from './components/Layout.tsx';
import { AlertsPage } from './pages/AlertsPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';
import { ServiceDetailPage } from './pages/ServiceDetailPage.tsx';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RefreshProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<Layout />}>
                <Route index element={<DashboardPage />} />
                <Route path="services/:slug" element={<ServiceDetailPage />} />
                <Route path="alerts" element={<AlertsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </RefreshProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
