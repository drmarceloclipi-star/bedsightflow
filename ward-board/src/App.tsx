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

const FallbackLoader = () => (
  <div className="h-screen flex items-center justify-center bg-app">
    <div className="animate-pulse text-muted font-bold tracking-widest text-xs">CARREGANDO...</div>
  </div>
);

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const ADMIN_EMAILS = ['drmarceloclipi@gmail.com', 'admin@lean.com'];
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
            <Route path="/login" element={user ? <Navigate to={isAdmin ? "/admin" : "/mobile"} replace /> : <LoginScreen />} />

            {/* Admin Routes — global with unit selector */}
            <Route
              path="/admin/*"
              element={isAdmin ? <AdminRouter /> : <Navigate to="/login" replace />}
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

            <Route path="/" element={<Navigate to={isAdmin ? "/admin" : "/mobile"} replace />} />
          </Routes>
        </Suspense>
      </Router>
    </ThemeProvider>
  );
}

export default App;
