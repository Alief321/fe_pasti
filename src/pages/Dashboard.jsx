import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, CheckCircle, Users, CalendarRange } from 'lucide-react';
import api from '../api';
import { isAuthenticated } from '../auth';
import { Link } from 'react-router-dom';

const defaultSummary = {
  stats: {
    total_survei: 0,
    total_anomali: 0,
    total_penyelesaian: 0,
    total_users: 0,
  },
  survei_terbaru: [],
  ringkasan_per_survei: [],
};

const formatNumber = (value) => Number(value || 0).toLocaleString('id-ID');

const getMonthLabel = (dateString) => {
  if (!dateString) return 'Tanpa tanggal';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Tanpa tanggal';
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(date);
};

const getMonthKey = (dateString) => {
  if (!dateString) return 'all';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'all';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

function Dashboard() {
  const [summary, setSummary] = useState(defaultSummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  const [selectedSurvey, setSelectedSurvey] = useState('ALL');

  useEffect(() => {
    if (!isAuthenticated()) {
      return undefined;
    }

    const loadDashboard = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await api.get('/dashboard/summary');
        setSummary(response.data || defaultSummary);
      } catch (requestError) {
        setError(requestError.response?.data?.error || 'Gagal memuat data dashboard.');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const months = useMemo(() => {
    const unique = new Set((summary.ringkasan_per_survei || []).map((item) => getMonthKey(item.created_at)).filter((month) => month !== 'all'));
    return [...unique].sort((a, b) => b.localeCompare(a));
  }, [summary.ringkasan_per_survei]);

  const surveyOptions = useMemo(() => {
    return (summary.ringkasan_per_survei || []).map((item) => ({
      id: item.id,
      name: item.nama_survei,
    }));
  }, [summary.ringkasan_per_survei]);

  const filteredSurveyRows = useMemo(() => {
    return (summary.ringkasan_per_survei || []).filter((item) => {
      const matchesMonth = selectedMonth === 'ALL' || getMonthKey(item.created_at) === selectedMonth;
      const matchesSurvey = selectedSurvey === 'ALL' || String(item.id) === String(selectedSurvey);
      return matchesMonth && matchesSurvey;
    });
  }, [selectedMonth, selectedSurvey, summary.ringkasan_per_survei]);

  const chartData = useMemo(() => {
    return [...filteredSurveyRows].sort((a, b) => Number(b.total_anomali || 0) + Number(b.total_penyelesaian || 0) - (Number(a.total_anomali || 0) + Number(a.total_penyelesaian || 0))).slice(0, 8);
  }, [filteredSurveyRows]);

  const totalAnomaliFiltered = chartData.reduce((sum, item) => sum + Number(item.total_anomali || 0), 0);
  const totalPenyelesaianFiltered = chartData.reduce((sum, item) => sum + Number(item.total_penyelesaian || 0), 0);

  const topStatCards = [
    {
      title: 'Total Survei',
      value: formatNumber(selectedMonth === 'ALL' && selectedSurvey === 'ALL' ? summary.stats.total_survei : filteredSurveyRows.length),
      icon: <Activity className="text-blue-500" size={22} />,
      trend: 'Jumlah survei aktif',
    },
    {
      title: 'Total Anomali',
      value: formatNumber(selectedMonth === 'ALL' && selectedSurvey === 'ALL' ? summary.stats.total_anomali : totalAnomaliFiltered),
      icon: <AlertTriangle className="text-amber-500" size={22} />,
      trend: 'Total SQL anomali tersimpan',
    },
    {
      title: 'Total Penyelesaian',
      value: formatNumber(selectedMonth === 'ALL' && selectedSurvey === 'ALL' ? summary.stats.total_penyelesaian : totalPenyelesaianFiltered),
      icon: <CheckCircle className="text-emerald-500" size={22} />,
      trend: 'Jumlah LK penyelesaian',
    },
    { title: 'Total User', value: formatNumber(summary.stats.total_users), icon: <Users className="text-violet-500" size={22} />, trend: 'Akun yang aktif' },
  ];

  const dataTable = [...filteredSurveyRows].sort((a, b) => {
    const scoreA = Number(a.total_anomali || 0) + Number(a.total_penyelesaian || 0);
    const scoreB = Number(b.total_anomali || 0) + Number(b.total_penyelesaian || 0);
    return scoreB - scoreA;
  });

  if (!isAuthenticated()) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-3xl bg-slate-900 p-8 text-white shadow-xl sm:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-300">PASTI</p>
          <h1 className="mt-3 max-w-2xl text-3xl font-bold sm:text-4xl">Platform pemantauan anomali dan penyelesaian LK</h1>
          <p className="mt-4 max-w-2xl leading-7 text-slate-300">PASTI membantu tim mengelola survei, meninjau anomali, menggabungkan LK, dan memantau status penyelesaian dalam satu tempat.</p>
        </header>
        <section className="grid gap-4 md:grid-cols-3">
          {[
            ['Pantau penyelesaian', 'Lihat daftar LK dan link publik yang tersedia.'],
            ['Gabungkan data', 'Satukan LK berdasarkan kolom yang saling berpasangan.'],
            ['Bagikan hasil', 'Berikan akses baca melalui link publik tanpa login.'],
          ].map(([title, description]) => (
            <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-bold text-slate-900">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
            </article>
          ))}
        </section>
      </div>
    );
  }

  if (loading) {
    return <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">Memuat dashboard...</div>;
  }

  if (error) {
    return <div className="mx-auto max-w-7xl rounded-2xl border border-red-200 bg-red-50 p-8 text-red-700 shadow-sm">{error}</div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Dashboard Admin</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Ringkasan anomali dan penyelesaian</h1>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
          <CalendarRange size={14} />
          {selectedMonth === 'ALL' ? 'Semua bulan' : getMonthLabel(`${selectedMonth}-01T00:00:00Z`)}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {topStatCards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex  items-center gap-3 w-full ">
          <label className="w-1/2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Filter bulan
            <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800">
              <option value="ALL">Semua bulan</option>
              {months.map((month) => (
                <option key={month} value={month}>
                  {getMonthLabel(`${month}-01T00:00:00Z`)}
                </option>
              ))}
            </select>
          </label>

          <label className=" w-1/2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Filter survei
            <select value={selectedSurvey} onChange={(event) => setSelectedSurvey(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800">
              <option value="ALL">Semua survei</option>
              {surveyOptions.map((survey) => (
                <option key={survey.id} value={survey.id}>
                  {survey.name}
                </option>
              ))}
            </select>
          </label>
          {/* 
          <div className="min-w-45 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Jenis anomali
            <div className="mt-2 text-sm font-medium normal-case text-slate-600">Belum tersedia di endpoint</div>
          </div> */}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Jumlah SQL anomali tersimpan per survei" subtitle="Bar chart">
          <BarChart data={chartData.map((item) => ({ label: item.nama_survei, value: Number(item.total_anomali || 0) }))} />
        </ChartCard>

        <ChartCard title="Jumlah LK penyelesaian per survei" subtitle="Line chart">
          <LineChart data={chartData.map((item) => ({ label: item.nama_survei, value: Number(item.total_penyelesaian || 0) }))} />
        </ChartCard>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Ringkasan survei</h2>
            <p className="text-sm text-slate-500">Urut dari yang paling aktif</p>
          </div>
          {/* <div className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">{completionRate.toFixed(1)}% selesai</div> */}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="px-4 py-3 font-semibold">Nama Survei</th>
                <th className="px-4 py-3 font-semibold">Total SQL Anomali</th>
                <th className="px-4 py-3 font-semibold">Total LK Penyelesaian</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {dataTable.map((row) => {
                return (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-800">{row.nama_survei}</div>
                      <div className="text-xs text-slate-500">{row.created_at ? new Date(row.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</div>
                    </td>
                    <td className="px-4 py-4">{formatNumber(row.total_anomali)}</td>
                    <td className="px-4 py-4">{formatNumber(row.total_penyelesaian)}</td>
                    <td className="px-4 py-4">
                      <Link to={`/penyelesaian/survei/${row.id}`} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                        Lihat survei
                        <ArrowRight size={14} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Survei terbaru</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {(summary.survei_terbaru || []).slice(0, 5).map((survei) => (
            <div key={survei.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <div className="font-semibold text-slate-800">{survei.nama_survei}</div>
              <div className="text-xs text-slate-500">{new Date(survei.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ title, value, icon, trend }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">{icon}</div>
      </div>
      <p className="mt-4 text-sm text-slate-400">{trend}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function BarChart({ data }) {
  if (!data.length) {
    return <div className="flex h-56 items-center justify-center text-sm text-slate-500">Belum ada data untuk ditampilkan.</div>;
  }

  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="flex h-56 items-end gap-3 overflow-x-auto pb-2">
      {data.map((item) => (
        <div key={item.label} className="flex min-w-17.5 flex-1 flex-col items-center justify-end gap-2">
          <span className="text-[11px] font-medium text-slate-500">{item.value}</span>
          <div className="w-full rounded-t-xl bg-linear-to-t from-blue-600 to-blue-400" style={{ height: `${(item.value / maxValue) * 100}%`, minHeight: item.value > 0 ? 20 : 0 }} />
          <span className="max-w-20 text-center text-[10px] text-slate-500">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function LineChart({ data }) {
  if (!data.length) {
    return <div className="flex h-56 items-center justify-center text-sm text-slate-500">Belum ada data untuk ditampilkan.</div>;
  }

  const width = 420;
  const height = 220;
  const padding = 24;
  const maxValue = Math.max(...data.map((item) => item.value), 1);

  const points = data
    .map((item, index) => {
      const x = padding + (index * (width - padding * 2)) / Math.max(data.length - 1, 1);
      const y = height - padding - (item.value / maxValue) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full">
      <defs>
        <linearGradient id="line-success" x1="0" x2="1">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((step) => {
        const y = padding + (step * (height - padding * 2)) / 3;
        return <line key={step} x1={padding} x2={width - padding} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="5 5" />;
      })}
      <polyline fill="none" stroke="url(#line-success)" strokeWidth="3" points={points} />
      {data.map((item, index) => {
        const x = padding + (index * (width - padding * 2)) / Math.max(data.length - 1, 1);
        const y = height - padding - (item.value / maxValue) * (height - padding * 2);
        return (
          <g key={`${item.label}-${index}`}>
            <circle cx={x} cy={y} r="4" fill="#10b981" />
            <text x={x} y={height - 6} textAnchor="middle" fontSize="10" fill="#64748b">
              {item.label.slice(0, 4)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default Dashboard;
