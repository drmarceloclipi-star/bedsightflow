import { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './infra/firebase/config';
import { ThemeProvider } from './shared/theme/ThemeContext';

const MobileLayout = lazy(() => import('./components/MobileLayout'));
const TvLayout = lazy(() => import('./components/TvLayout'));
const MobileDashboard = lazy(() => import('./features/mobile/pages/MobileDashboard'));
const BedDetails = lazy(() => import('./features/mobile/pages/BedDetails'));
const TvDashboard = lazy(() => import('./features/tv/pages/TvDashboard'));
const LoginScreen = lazy(() => import('./features/auth/LoginScreen'));
const AdminRouter = lazy(() => import('./features/admin/AdminRouter'));
const MobileAdminRouter = lazy(() => import('./features/mobile-admin/MobileAdminRouter'));

const FallbackLoader = () => (
  <div className="h-screen flex items-center justify-center bg-app">
    <div className="animate-pulse text-muted font-bold tracking-widest text-xs">CARREGANDO...</div>
  </div>
);

import { ADMIN_EMAILS } from './config/admins';

/** Detects phones and tablets via User-Agent (runs once, client-side only). */
const isMobileDevice = (): boolean =>
  /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.email ? ADMIN_EMAILS.includes(user.email.toLowerCase()) : false;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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
            <Route path="/login" element={user ? <Navigate to={isAdmin ? (isMobileDevice() ? "/mobile-admin" : "/admin") : "/mobile"} replace /> : <LoginScreen />} />

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

            {/* Mobile Routes */}
            <Route
              path="/mobile"
              element={user ? <MobileLayout /> : <Navigate to="/login" replace />}
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

            <Route path="/" element={<Navigate to={isAdmin ? (isMobileDevice() ? "/mobile-admin" : "/admin") : "/mobile"} replace />} />
          </Routes>
        </Suspense>
      </Router>
    </ThemeProvider>
  );
}

export default App;
