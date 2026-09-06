import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Search, Table2 } from 'lucide-react';
import api from '../api';

function getSources(payload) {
  const wrappedData = payload?.data && !Array.isArray(payload.data) ? payload.data : null;
  const sourceList = payload?.sources || wrappedData?.sources || payload?.sheets || wrappedData?.sheets || payload?.worksheets || wrappedData?.worksheets;
  const rawRows = payload?.rows || wrappedData?.rows || wrappedData?.data;
  const data = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : Array.isArray(rawRows) ? [{ headers: payload.headers || wrappedData?.headers, rows: rawRows }] : sourceList || (payload ? [payload] : []);
  const sources = sourceList || data;

  const looksLikeSource = (source) => source && (Array.isArray(source.rows) || Array.isArray(source.data) || Array.isArray(source.headers) || source.sheetName || source.sheet || source.sourceKey);
  const normalizedSources = sources.length && sources.every(looksLikeSource) ? sources : [{ rows: sources }];

  return normalizedSources.map((source, index) => {
    const rows = Array.isArray(source.rows) ? source.rows : Array.isArray(source.data) ? source.data : [];
    const headers = Array.isArray(source.headers) && source.headers.length > 0 ? source.headers : Object.keys(rows.find((row) => row && typeof row === 'object') || {});
    return {
      id: source.sourceKey || source.id || index,
      label: source.label || source.nama_lk || payload?.nama_lk || `LK ${index + 1}`,
      sheetName: source.sheetName || source.sheet || 'Sheet1',
      headers,
      rows,
    };
  });
}

export default function PenyelesaianPublic() {
  const token = window.location.pathname.split('/').filter(Boolean).pop() || '';
  const [payload, setPayload] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/public/penyelesaian/${encodeURIComponent(token)}`)
      .then((response) => setPayload(response.data))
      .catch((requestError) => setError(requestError.response?.data?.error || 'Link tidak valid atau sudah tidak tersedia.'))
      .finally(() => setLoading(false));
  }, [token]);

  const sources = useMemo(() => getSources(payload), [payload]);
  const headers = useMemo(() => [...new Set(sources.flatMap((source) => source.headers))], [sources]);
  const rows = useMemo(
    () => sources.flatMap((source) => source.rows.map((row) => ({ ...row, _source: `${source.label} / ${source.sheetName}` }))).filter((row) => !searchTerm || Object.values(row).join(' ').toLowerCase().includes(searchTerm.toLowerCase())),
    [searchTerm, sources],
  );

  if (loading) return <main className="mx-auto max-w-7xl p-6 text-slate-500">Memuat data publik...</main>;
  if (error)
    return (
      <main className="mx-auto flex max-w-xl items-center gap-3 p-6 text-rose-700">
        <AlertTriangle size={20} />
        {error}
      </main>
    );

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">Tampilan publik</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{payload?.surveyName || payload?.nama_survei || 'Data Penyelesaian LK'}</h1>
        <p className="mt-1 text-sm text-slate-500">Data ini dibagikan untuk dilihat tanpa login.</p>
      </header>
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <Table2 size={18} className="text-blue-600" />
        <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Cari data..." className="w-full border-0 text-sm outline-none" />
        <span className="text-xs text-slate-500">{rows.length} data</span>
      </div>
      <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-900 text-white">
            <tr>
              {headers.map((header) => (
                <th key={header} className="whitespace-nowrap px-4 py-3">
                  {header}
                </th>
              ))}
              <th className="whitespace-nowrap px-4 py-3">Sumber</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <tr key={row.id || index} className="hover:bg-blue-50">
                {headers.map((header) => (
                  <td key={`${index}-${header}`} className="px-4 py-3 align-top">
                    {String(row[header] ?? '-')}
                  </td>
                ))}
                <td className="px-4 py-3 text-xs text-slate-500">{row._source}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="p-10 text-center text-slate-500">Tidak ada data.</p>}
      </div>
    </main>
  );
}
