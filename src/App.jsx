import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { PanelLeftOpen, Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import { isAuthenticated } from './auth';
import Dashboard from './pages/Dashboard';
import DaftarSurvei from './pages/DaftarSurvei';
import DaftarAnomali from './pages/DaftarAnomali';
import PenyelesaianLK from './pages/PenyelesaianLK';
import PenyelesaianDetail from './pages/PenyelesaianDetail';
import SQLQueryBuilder from './pages/SQLQueryBuilder';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import LogoutPage from './pages/LogoutPage';
import ManajemenUser from './pages/ManajemenUser';

function ProtectedRoute({ children }) {
  const location = useLocation();

  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return children;
}

function AppLayout() {
  // Secara default, collapse sidebar di perangkat mobile (lebar < 768px)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  
  const location = useLocation();
  const authenticated = isAuthenticated();
  const isAuthRoute = ['/login', '/forgot-password', '/reset-password', '/logout'].includes(location.pathname);

  // Tutup sidebar secara otomatis di mobile setiap kali rute berubah (saat link diklik)
  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsSidebarCollapsed(true);
    }
  }, [location.pathname]);

  if (isAuthRoute) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/logout" element={<LogoutPage />} />
        <Route path="/penyelesaian" element={<Navigate to="/login" replace />} />
        <Route path="/penyelesaian/survei/:surveiId" element={<Navigate to="/login" replace />} />
        <Route path="/penyelesaian/:spreadsheetId" element={<PenyelesaianDetail />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_30%),linear-gradient(135deg,#f8fbff_0%,#f3f6ff_45%,#eef4ff_100%)] text-slate-800 relative">
      
      {/* Backdrop overlay untuk mobile: Muncul jika sidebar terbuka */}
      {!isSidebarCollapsed && (
        <div 
          className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm transition-opacity md:hidden"
          onClick={() => setIsSidebarCollapsed(true)}
          aria-hidden="true"
        />
      )}

      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        onToggle={() => setIsSidebarCollapsed((prev) => !prev)} 
        isAuthenticated={authenticated} 
      />
      
      <main className="relative flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 w-full">
        {/* Tombol Buka Sidebar: Ditampilkan selalu di mobile, tetapi hanya tampil di desktop jika collapsed */}
        <button
          type="button"
          onClick={() => setIsSidebarCollapsed(false)}
          className={`fixed left-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 text-slate-700 shadow-lg backdrop-blur transition-all ${!isSidebarCollapsed ? 'hidden md:hidden' : 'flex md:flex'}`}
          aria-label="Buka sidebar"
        >
          <PanelLeftOpen size={18} className="hidden md:block" />
          <Menu size={18} className="block md:hidden" />
        </button>

        <div className="mx-auto max-w-7xl pt-12 md:pt-0">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/penyelesaian" element={<ProtectedRoute><PenyelesaianLK /></ProtectedRoute>} />
            <Route path="/penyelesaian/survei/:surveiId" element={<ProtectedRoute><PenyelesaianDetail /></ProtectedRoute>} />
            <Route path="/penyelesaian/:spreadsheetId" element={<PenyelesaianDetail />} />
            <Route path="/survei" element={<ProtectedRoute><DaftarSurvei /></ProtectedRoute>} />
            <Route path="/anomali" element={<ProtectedRoute><DaftarAnomali /></ProtectedRoute>} />
            <Route path="/query-builder" element={<ProtectedRoute><SQLQueryBuilder /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><ManajemenUser /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppLayout />
    </Router>
  );
}

export default App;