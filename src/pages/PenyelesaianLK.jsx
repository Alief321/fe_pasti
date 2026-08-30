import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle, FileSpreadsheet, Link as LinkIcon, Plus, Trash2, UploadCloud } from 'lucide-react';
import api from '../api';
import { isAuthenticated } from '../auth';

export default function PenyelesaianLK() {
  const authenticated = isAuthenticated();
  const [lks, setLks] = useState([]);
  const [surveiList, setSurveiList] = useState([]);
  const [inputMode, setInputMode] = useState('upload');
  const [selectedSurveiId, setSelectedSurveiId] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [fileInput, setFileInput] = useState(null);
  const [isInjecting, setIsInjecting] = useState(false);
  const [message, setMessage] = useState(null);

  const fetchData = async () => {
    try {
      const requests = [api.get('/penyelesaian')];
      if (authenticated) requests.push(api.get('/survei'));
      const [lkResponse, surveyResponse] = await Promise.all(requests);
      setLks(lkResponse.data);
      if (surveyResponse) setSurveiList(surveyResponse.data);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Gagal memuat data LK.' });
    }
  };

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        const requests = [api.get('/penyelesaian')];
        if (authenticated) requests.push(api.get('/survei'));
        const [lkResponse, surveyResponse] = await Promise.all(requests);
        if (!mounted) return;
        setLks(lkResponse.data);
        if (surveyResponse) setSurveiList(surveyResponse.data);
      } catch (error) {
        if (mounted) setMessage({ type: 'error', text: error.response?.data?.error || 'Gagal memuat data LK.' });
      }
    };
    loadData();
    return () => {
      mounted = false;
    };
  }, [authenticated]);

  const surveyGroups = useMemo(() => {
    const groups = new Map();
    lks.forEach((lk) => {
      const id = lk.id_survei || lk.daftar_survei?.id || 'tanpa-survei';
      const group = groups.get(id) || { id, name: lk.daftar_survei?.nama_survei || surveiList.find((survey) => survey.id === id)?.nama_survei || 'Survei Tidak Dikenal', items: [] };
      group.items.push(lk);
      groups.set(id, group);
    });
    return [...groups.values()];
  }, [lks, surveiList]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedSurveiId) return alert('Silakan pilih survei terlebih dahulu!');
    setIsInjecting(true);
    setMessage(null);
    try {
      let spreadsheetId;
      let spreadsheetUrl;
      if (inputMode === 'link') {
        const response = await api.post('/sheets/inject-columns', { spreadsheetUrl: linkInput });
        spreadsheetId = response.data.spreadsheetId;
        spreadsheetUrl = linkInput;
      } else {
        if (!fileInput) throw new Error('Pilih file Excel terlebih dahulu!');
        const formData = new FormData();
        formData.append('file', fileInput);
        formData.append('id_survei', selectedSurveiId);
        const response = await api.post('/sheets/upload-excel', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        spreadsheetId = response.data.spreadsheetId;
        spreadsheetUrl = response.data.webViewLink || response.data.spreadsheetUrl;
      }
      await api.post('/penyelesaian', { id_survei: selectedSurveiId, link_spreadsheet_anomali: spreadsheetUrl, spreadsheet_id: spreadsheetId, uploaded_by: 'Admin' });
      setMessage({ type: 'success', text: 'LK berhasil ditambahkan ke survei.' });
      setSelectedSurveiId('');
      setLinkInput('');
      setFileInput(null);
      fetchData();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || error.message });
    } finally {
      setIsInjecting(false);
    }
  };

  const handleEdit = async (lk) => {
    const link = window.prompt('Masukkan link Spreadsheet baru:', lk.link_spreadsheet_anomali || '');
    if (!link || link === lk.link_spreadsheet_anomali) return;
    try {
      await api.put(`/penyelesaian/${lk.id}`, { link_spreadsheet_anomali: link });
      fetchData();
    } catch (error) {
      alert('Gagal memperbarui LK: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus hubungan LK ini?')) return;
    try {
      await api.delete(`/penyelesaian/${id}`);
      fetchData();
    } catch (error) {
      alert('Gagal menghapus LK: ' + (error.response?.data?.error || error.message));
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">Workspace monitoring</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Penyelesaian LK</h1>
          <p className="mt-2 text-slate-500">Satu survei dapat menggabungkan banyak LK dalam satu alur kerja.</p>
        </div>
        <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-lg">
          <p className="text-xs uppercase tracking-wider text-slate-400">Total survei</p>
          <p className="mt-1 text-3xl font-bold">{surveyGroups.length}</p>
        </div>
      </header>

      {authenticated && (
        <section className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 bg-blue-50/60 px-6 py-5">
            <Plus className="text-blue-600" size={20} />
            <div>
              <h2 className="font-bold text-slate-900">Tambah LK ke survei</h2>
              <p className="text-sm text-slate-500">LK baru otomatis masuk ke grup survei yang dipilih.</p>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="block  px-6 py-5 ">
            <label className="text-sm font-medium text-slate-700">
              Survei
              <select required value={selectedSurveiId} onChange={(event) => setSelectedSurveiId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-normal">
                <option value="" disabled>
                  Pilih survei
                </option>
                {surveiList.map((survey) => (
                  <option key={survey.id} value={survey.id}>
                    {survey.nama_survei}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex rounded-xl bg-slate-100 p-1 text-sm">
              <button type="button" onClick={() => setInputMode('upload')} className={`flex-1 rounded-lg px-3 py-2 ${inputMode === 'upload' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>
                <UploadCloud size={16} className="mr-1 inline" />
                Upload Excel
              </button>
              <button type="button" onClick={() => setInputMode('link')} className={`flex-1 rounded-lg px-3 py-2 ${inputMode === 'link' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>
                <LinkIcon size={16} className="mr-1 inline" />
                Link Spreadsheet
              </button>
            </div>
            {inputMode === 'upload' ? (
              <input required type="file" accept=".xlsx,.xls" onChange={(event) => setFileInput(event.target.files[0])} className="rounded-xl border border-dashed border-slate-300 p-2 text-sm" />
            ) : (
              <input required type="url" placeholder="https://docs.google.com/spreadsheets/d/..." value={linkInput} onChange={(event) => setLinkInput(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
            )}
            <button disabled={isInjecting} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 lg:col-span-3">
              {isInjecting ? 'Memproses...' : 'Tambahkan ke survei'}
            </button>
          </form>
          {message && (
            <div className={`mx-6 mb-6 flex items-center gap-2 rounded-xl border p-3 text-sm ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
              {message.type === 'success' ? <CheckCircle size={17} /> : <AlertTriangle size={17} />}
              {message.text}
            </div>
          )}
        </section>
      )}

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {surveyGroups.map((group) => (
          <article key={group.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <FileSpreadsheet size={24} />
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{group.items.length} LK</span>
            </div>
            <h2 className="mt-5 line-clamp-2 text-lg font-bold text-slate-900">{group.name}</h2>
            <p className="mt-2 text-sm text-slate-500">Gabungan LK siap dipantau dalam satu tampilan.</p>
            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
              <Link to={`/penyelesaian/survei/${group.id}`} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                Buka LK gabungan →
              </Link>
              {authenticated && (
                <div className="flex gap-1">
                  {group.items.map((item) => (
                    <span key={item.id} className="flex gap-1">
                      <button type="button" onClick={() => handleEdit(item)} className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200">
                        Edit
                      </button>
                      <button type="button" onClick={() => handleDelete(item.id)} title="Hapus LK" className="rounded-lg bg-red-50 p-2 text-red-600 hover:bg-red-100">
                        <Trash2 size={15} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </article>
        ))}
      </section>
      {surveyGroups.length === 0 && <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">Belum ada LK yang terhubung.</div>}
    </div>
  );
}
