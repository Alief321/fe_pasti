import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)]">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-600">Akun</p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">Lupa password</h1>
        <p className="mt-2 text-sm text-slate-600">Masukkan email Anda untuk menerima link reset password.</p>

        {submitted ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            Link reset password telah dikirim ke <span className="font-semibold">{email}</span>.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
                required
              />
            </div>

            <button type="submit" className="w-full rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700">
              Kirim link reset
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-sm text-slate-600">
          Kembali ke{' '}
          <Link to="/login" className="font-medium text-sky-600 hover:text-sky-700">
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}
