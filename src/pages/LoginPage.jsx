import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import api from '../api';
import { getAuthToken, setAuthToken } from '../auth';

export default function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const token = getAuthToken();
  const redirectPath = location.state?.from || '/';

  if (token) {
    return <Navigate to={redirectPath} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setError('Email dan password harus diisi.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      const response = await api.post('/auth/login', {
        email,
        password,
      });

      const token = response?.data?.token || response?.data?.accessToken || response?.data?.jwt;

      if (!token) {
        throw new Error('Respons login tidak mengembalikan token.');
      }

      setAuthToken(token);
      navigate(redirectPath, { replace: true });
    } catch (loginError) {
      const message = loginError?.response?.data?.message || loginError?.response?.data?.error || loginError?.message || 'Login gagal.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)]">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-sky-500 to-indigo-600 text-xl font-bold text-white shadow-lg shadow-sky-500/30">P</div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-600">PASTI</p>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">Masuk ke dashboard</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nama@domain.com"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-100"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-100"
            />
          </div>

          {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Masuk...' : 'Masuk'}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm">
          <Link to="/forgot-password" className="font-medium text-sky-600 hover:text-sky-700">
            Lupa password?
          </Link>
          <Link to="/reset-password" className="font-medium text-slate-600 hover:text-slate-800">
            Reset password
          </Link>
        </div>
      </div>
    </div>
  );
}
