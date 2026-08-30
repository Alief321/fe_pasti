import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('idle');

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!password || !confirmPassword) {
      setStatus('error');
      return;
    }

    if (password !== confirmPassword) {
      setStatus('mismatch');
      return;
    }

    setStatus('success');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)]">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-600">Akun</p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">Reset password</h1>
        <p className="mt-2 text-sm text-slate-600">{token ? 'Buat password baru untuk melanjutkan.' : 'Masukkan password baru Anda.'}</p>

        {status === 'success' ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">Password berhasil direset. Silakan masuk kembali.</div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                Password baru
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Masukkan password baru"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-100"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-slate-700">
                Konfirmasi password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Ulangi password baru"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-100"
              />
            </div>

            {status === 'error' && <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">Password harus diisi.</div>}

            {status === 'mismatch' && <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">Konfirmasi password tidak cocok.</div>}

            <button type="submit" className="w-full rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700">
              Simpan password baru
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-sm text-slate-600">
          Sudah ingat password?{' '}
          <Link to="/login" className="font-medium text-sky-600 hover:text-sky-700">
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}
