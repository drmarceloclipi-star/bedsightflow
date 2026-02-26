import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './shared/theme/ThemeContext';
import MobileLayout from './components/MobileLayout';
import TvLayout from './components/TvLayout';
import MobileDashboard from './features/mobile/pages/MobileDashboard';
import BedDetails from './features/mobile/pages/BedDetails';
import TvDashboard from './features/tv/pages/TvDashboard';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/mobile" replace />} />

          {/* Mobile Routes */}
          <Route path="/mobile" element={<MobileLayout />}>
            <Route index element={<MobileDashboard />} />
            <Route path="bed/:id" element={<BedDetails />} />
          </Route>

          {/* TV Routes - Kiosk display */}
          <Route path="/tv" element={<TvLayout />}>
            <Route index element={<TvDashboard />} />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
