import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Copy, FileSpreadsheet, Link as LinkIcon, Plus, Share2, Trash2, UploadCloud, X } from 'lucide-react';
import api from '../api';
import { isAuthenticated } from '../auth';
import UploadDropzone from '../components/UploadDropzone';

export default function PenyelesaianLK() {
  const authenticated = isAuthenticated();
  const [lks, setLks] = useState([]);
  const [surveiList, setSurveiList] = useState([]);
  const [inputMode, setInputMode] = useState('upload');
  const [selectedSurveiId, setSelectedSurveiId] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [fileInput, setFileInput] = useState(null);
  const [mergeWithPrevious, setMergeWithPrevious] = useState(true);
  const [isInjecting, setIsInjecting] = useState(false);
  const [message, setMessage] = useState(null);
  const [nama, setNama] = useState('');
  const [shareModal, setShareModal] = useState(null);
  const [shareLinks, setShareLinks] = useState([]);
  const [shareLoading, setShareLoading] = useState(false);

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
      await api.post('/penyelesaian', {
        id_survei: selectedSurveiId,
        link_spreadsheet_anomali: spreadsheetUrl,
        spreadsheet_id: spreadsheetId,
        Nama: nama,
        uploaded_by: 'Admin',
        gabung_dengan_sebelumnya: mergeWithPrevious,
      });
      setMessage({ type: 'success', text: 'LK berhasil ditambahkan ke survei.' });
      setSelectedSurveiId('');
      setLinkInput('');
      setFileInput(null);
      setMergeWithPrevious(true);
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

  const openShare = async (lk) => {
    setShareModal({ lk, error: '' });
    setShareLoading(true);
    try {
      const response = await api.get(`/penyelesaian/${lk.id}/shares`);
      setShareLinks(response.data?.shares || response.data || []);
    } catch (error) {
      setShareLinks([]);
      setShareModal((current) => ({ ...current, error: error.response?.data?.error || 'Link berbagi belum dapat dimuat.' }));
    } finally {
      setShareLoading(false);
    }
  };

  const createShare = async () => {
    if (!shareModal?.lk) return;
    setShareLoading(true);
    try {
      const response = await api.post(`/penyelesaian/${shareModal.lk.id}/share`, { permission: 'view' });
      const share = response.data?.share || response.data;
      setShareLinks((current) => [share, ...current]);
    } catch (error) {
      setShareModal((current) => ({ ...current, error: error.response?.data?.error || 'Link berbagi belum berhasil dibuat.' }));
    } finally {
      setShareLoading(false);
    }
  };

  const revokeShare = async (share) => {
    if (!window.confirm('Cabut link publik ini?')) return;
    try {
      await api.delete(`/penyelesaian/${shareModal.lk.id}/shares/${share.id}`);
      setShareLinks((current) => current.filter((item) => item.id !== share.id));
    } catch (error) {
      alert(error.response?.data?.error || 'Link belum dapat dicabut.');
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

            <label className="mt-4 text-sm font-medium text-slate-700">Nama LK </label>
            <input type="text" placeholder="Nama LK" className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-normal" value={nama} onChange={(event) => setNama(event.target.value)} />
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

            <fieldset className="mt-4 rounded-xl border border-slate-200 p-4">
              <legend className="px-1 text-sm font-semibold text-slate-700">Cara menampilkan LK ini</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className={`cursor-pointer rounded-xl border p-3 ${mergeWithPrevious ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                  <input type="radio" name="lk-merge-mode" checked={mergeWithPrevious} onChange={() => setMergeWithPrevious(true)} className="mr-2 accent-blue-600" />
                  <span className="text-sm font-semibold text-slate-800">Gabungkan dengan LK sebelumnya</span>
                  <span className="mt-1 block pl-5 text-xs text-slate-500">Data tampil dalam satu tabel gabungan.</span>
                </label>
                <label className={`cursor-pointer rounded-xl border p-3 ${!mergeWithPrevious ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                  <input type="radio" name="lk-merge-mode" checked={!mergeWithPrevious} onChange={() => setMergeWithPrevious(false)} className="mr-2 accent-blue-600" />
                  <span className="text-sm font-semibold text-slate-800">Buat LK terpisah</span>
                  <span className="mt-1 block pl-5 text-xs text-slate-500">Data tersedia di tab LK sendiri.</span>
                </label>
              </div>
            </fieldset>

            <div className="w-full flex gap-3 my-2 justify-between items-center">
              {inputMode === 'upload' ? (
                <UploadDropzone
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  files={fileInput}
                  onFiles={(files) => setFileInput(files[0])}
                  title="Pilih file Excel"
                  description="Tarik dan lepas file Excel di sini atau klik untuk memilih"
                  className="w-full"
                />
              ) : (
                <input
                  required
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={linkInput}
                  onChange={(event) => setLinkInput(event.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm w-4/5"
                />
              )}
              <button disabled={isInjecting} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 lg:col-span-3">
                {isInjecting ? 'Memproses...' : 'Tambahkan ke survei'}
              </button>
            </div>
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
                      <button type="button" onClick={() => openShare(item)} title={`Bagikan ${item.nama_lk || item.nama_file || 'LK'}`} className="rounded-lg bg-blue-50 p-2 text-blue-600 hover:bg-blue-100">
                        <Share2 size={15} />
                      </button>
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

      {shareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-bold text-slate-900">Bagikan LK</h2>
                <p className="text-xs text-slate-500">Penerima dapat melihat data tanpa login.</p>
              </div>
              <button type="button" onClick={() => setShareModal(null)} aria-label="Tutup" className="text-slate-400 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3 p-5">
              <button type="button" onClick={createShare} disabled={shareLoading} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                {shareLoading ? 'Memproses...' : 'Buat link baru'}
              </button>
              {shareModal.error && <p className="text-xs text-rose-600">{shareModal.error}</p>}
              {shareLinks.map((share) => {
                const token = share.token || share.public_token;
                const url = share.url || share.public_url || (token ? `${window.location.origin}/penyelesaian/public/${token}` : '');
                return (
                  <div key={share.id || url} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2">
                    <input readOnly value={url} className="min-w-0 flex-1 border-0 bg-transparent text-xs text-slate-600 outline-none" />
                    <button type="button" onClick={() => navigator.clipboard.writeText(url)} title="Salin link" className="rounded-md bg-slate-100 p-2 text-slate-600">
                      <Copy size={14} />
                    </button>
                    <button type="button" onClick={() => revokeShare(share)} className="text-xs text-rose-600">
                      Cabut
                    </button>
                  </div>
                );
              })}
              {!shareLoading && !shareLinks.length && <p className="text-xs text-slate-400">Belum ada link aktif.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
