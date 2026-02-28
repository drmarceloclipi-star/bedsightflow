import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './shared/theme/ThemeContext';
import { useAuthStatus } from './hooks/useAuthStatus';
import { isMobileDevice } from './utils/device';

const EditorLayout = lazy(() => import('./components/EditorLayout'));
const TvLayout = lazy(() => import('./components/TvLayout'));
const MobileDashboard = lazy(() => import('./features/editor/pages/MobileDashboard'));
const BedDetails = lazy(() => import('./features/editor/pages/BedDetails'));
const TvDashboard = lazy(() => import('./features/tv/pages/TvDashboard'));
const LoginScreen = lazy(() => import('./features/auth/LoginScreen'));
const AdminRouter = lazy(() => import('./features/admin/AdminRouter'));
const MobileAdminRouter = lazy(() => import('./features/mobile-admin/MobileAdminRouter'));

const FallbackLoader = () => (
  <div className="h-screen flex items-center justify-center bg-app">
    <div className="animate-pulse text-muted font-bold tracking-widest text-xs">CARREGANDO...</div>
  </div>
);

function App() {
  const { user, isAdmin, loading } = useAuthStatus();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-app">
        <div className="animate-pulse text-muted font-bold tracking-widest text-xs">CARREGANDO...</div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <Router>
        <Suspense fallback={<FallbackLoader />}>
          <Routes>
            <Route path="/login" element={user ? <Navigate to={isAdmin ? (isMobileDevice() ? "/mobile-admin" : "/admin") : "/editor"} replace /> : <LoginScreen />} />

            {/* Admin Routes — global with unit selector */}
            {/* On mobile devices, redirect to the mobile-optimised admin */}
            <Route
              path="/admin/*"
              element={
                isAdmin
                  ? isMobileDevice()
                    ? <Navigate to="/mobile-admin" replace />
                    : <AdminRouter />
                  : <Navigate to="/login" replace />
              }
            />

            {/* Mobile Admin Routes — mobile-optimised admin panel */}
            <Route
              path="/mobile-admin/*"
              element={isAdmin ? <MobileAdminRouter /> : <Navigate to="/login" replace />}
            />

            {/* Editor Routes */}
            <Route
              path="/editor"
              element={user ? <EditorLayout /> : <Navigate to="/login" replace />}
            >
              <Route index element={<MobileDashboard />} />
              <Route path="bed/:id" element={<BedDetails />} />
            </Route>

            {/* TV Routes - Kiosk display */}
            <Route
              path="/tv"
              element={user ? <TvLayout /> : <Navigate to="/login" replace />}
            >
              <Route index element={<TvDashboard />} />
            </Route>

            <Route path="/" element={<Navigate to={isAdmin ? (isMobileDevice() ? "/mobile-admin" : "/admin") : "/editor"} replace />} />
          </Routes>
        </Suspense>
      </Router>
    </ThemeProvider>
  );
}

export default App;
