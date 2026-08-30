import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setAuthToken } from '../auth';

export default function LogoutPage() {
  const navigate = useNavigate();

  useEffect(() => {
    setAuthToken(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10 text-slate-600">
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm shadow-sm">Keluar dari aplikasi...</div>
    </div>
  );
}
