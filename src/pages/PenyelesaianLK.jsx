import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle, FileSpreadsheet, Link as LinkIcon, Pencil, Plus, Search, Trash2, UploadCloud } from 'lucide-react';
import api from '../api';
import { isAuthenticated } from '../auth';
import { normalizeHeader } from '../utils/lkMerge';
import UploadDropzone from '../components/UploadDropzone';

const STANDARD_COLUMNS = ['Status Penyelesaian', 'Tanggal Selesai', 'Catatan'];

function hasStandardCounterpart(headers, target) {
  return headers.some((header) => {
    const value = normalizeHeader(header);
    if (target === 'Status Penyelesaian') return value.includes('status') || value.includes('selesai') || value.includes('done') || value.includes('check');
    if (target === 'Tanggal Selesai') return value.includes('tanggal') || value.includes('date') || value.includes('waktu') || value.includes('selesai');
    return value.includes('catatan') || value.includes('note') || value.includes('komentar') || value.includes('keterangan') || value.includes('tindak_lanjut') || value.includes('action');
  });
}

export default function PenyelesaianLK() {
  const authenticated = isAuthenticated();
  const [lks, setLks] = useState([]);
  const [surveiList, setSurveiList] = useState([]);
  const [inputMode, setInputMode] = useState('upload');
  const [selectedSurveiId, setSelectedSurveiId] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [fileInput, setFileInput] = useState(null);
  const [mergeWithPrevious, setMergeWithPrevious] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [isInjecting, setIsInjecting] = useState(false);
  const [message, setMessage] = useState(null);
  const [nama, setNama] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [surveyFilter, setSurveyFilter] = useState('ALL');
  const [editingLk, setEditingLk] = useState(null);
  const [editForm, setEditForm] = useState({ id_survei: '', Nama: '', link_spreadsheet_anomali: '', gabung_dengan_id: '' });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

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

  const selectedSurveyLks = useMemo(() => lks.filter((lk) => String(lk.id_survei || lk.daftar_survei?.id) === String(selectedSurveiId)), [lks, selectedSurveiId]);

  const filteredSurveyGroups = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return surveyGroups
      .filter((group) => surveyFilter === 'ALL' || String(group.id) === String(surveyFilter))
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          const itemName = item.Nama || item.nama_lk || item.nama_file || item.file_name || `LK ${item.id}`;
          return !query || itemName.toLowerCase().includes(query);
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [searchTerm, surveyFilter, surveyGroups]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedSurveiId) return alert('Silakan pilih survei terlebih dahulu!');
    setIsInjecting(true);
    setMessage(null);
    try {
      let spreadsheetId;
      let spreadsheetUrl;
      if (inputMode === 'link') {
        const response = await api.post('/sheets/inject-columns', { spreadsheetUrl: linkInput, columns: [], onlyMissing: true, resolveOnly: true });
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
      const sheetResponse = await api.get(`/sheets/data/${spreadsheetId}`);
      const sheets = sheetResponse.data?.sheets || sheetResponse.data?.worksheets || (Array.isArray(sheetResponse.data?.data) ? sheetResponse.data.data : [sheetResponse.data]);
      const missingColumnsBySheet = sheets
        .map((sheet) => ({
          sheetName: sheet?.sheetName || sheet?.name || sheet?.sheet || 'Sheet1',
          columns: STANDARD_COLUMNS.filter((column) => !hasStandardCounterpart(Array.isArray(sheet?.headers) ? sheet.headers : Object.keys((sheet?.rows || sheet?.data || [])[0] || {}), column)),
        }))
        .filter((sheet) => sheet.columns.length > 0);
      if (missingColumnsBySheet.length > 0) {
        await Promise.all(missingColumnsBySheet.map(({ sheetName, columns }) => api.post('/sheets/inject-columns', { spreadsheetId, spreadsheetUrl, sheetName, columns, onlyMissing: true })));
      }
      const mergeTarget = mergeWithPrevious ? mergeTargetId : null;
      if (mergeWithPrevious && !mergeTarget) throw new Error('Pilih LK tujuan untuk penggabungan terlebih dahulu.');
      const mergeTargetIdValue = mergeTarget && Number.isFinite(Number(mergeTarget)) ? Number(mergeTarget) : mergeTarget;
      const normalizedName = nama.trim();
      await api.post('/penyelesaian', {
        id_survei: selectedSurveiId,
        link_spreadsheet_anomali: spreadsheetUrl,
        spreadsheet_id: spreadsheetId,
        Nama: normalizedName,
        nama_lk: normalizedName,
        uploaded_by: 'Admin',
        gabung_dengan_id: mergeTargetIdValue || null,
      });
      setMessage({ type: 'success', text: 'LK berhasil ditambahkan ke survei.' });
      setSelectedSurveiId('');
      setLinkInput('');
      setFileInput(null);
      setNama('');
      setMergeWithPrevious(false);
      setMergeTargetId('');
      fetchData();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || error.message });
    } finally {
      setIsInjecting(false);
    }
  };

  const openEdit = (lk) => {
    setEditingLk(lk);
    setEditForm({
      id_survei: String(lk.id_survei || lk.daftar_survei?.id || ''),
      Nama: lk.Nama || lk.nama_lk || lk.nama_file || lk.file_name || '',
      link_spreadsheet_anomali: lk.link_spreadsheet_anomali || '',
      gabung_dengan_id: lk.gabung_dengan_id ? String(lk.gabung_dengan_id) : '',
    });
  };

  const editSurveyLks = editingLk ? lks.filter((lk) => String(lk.id_survei || lk.daftar_survei?.id) === String(editForm.id_survei) && String(lk.id) !== String(editingLk.id)) : [];

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    const mergeTarget = editForm.gabung_dengan_id;
    if (!editForm.id_survei || !editForm.Nama.trim() || !editForm.link_spreadsheet_anomali.trim()) return;
    const mergeTargetIdValue = mergeTarget && Number.isFinite(Number(mergeTarget)) ? Number(mergeTarget) : mergeTarget;
    setIsSavingEdit(true);
    try {
      const normalizedName = editForm.Nama.trim();
      await api.put(`/penyelesaian/${editingLk.id}`, {
        id_survei: editForm.id_survei,
        link_spreadsheet_anomali: editForm.link_spreadsheet_anomali.trim(),
        Nama: normalizedName,
        nama_lk: normalizedName,
        gabung_dengan_id: mergeTargetIdValue || null,
      });
      setEditingLk(null);
      setMessage({ type: 'success', text: 'Data LK berhasil diperbarui.' });
      await fetchData();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Gagal memperbarui LK.' });
    } finally {
      setIsSavingEdit(false);
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

      {editingLk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <form onSubmit={handleEditSubmit} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Edit data LK</h2>
                <p className="mt-1 text-sm text-slate-500">Perbarui seluruh metadata LK dan cara penggabungannya.</p>
              </div>
              <button type="button" onClick={() => setEditingLk(null)} className="text-sm font-semibold text-slate-500 hover:text-slate-800">
                Tutup
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Survei
                <select
                  required
                  value={editForm.id_survei}
                  onChange={(event) => setEditForm((current) => ({ ...current, id_survei: event.target.value, gabung_dengan_id: '' }))}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-normal"
                >
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

              <label className="block text-sm font-medium text-slate-700">
                Nama LK
                <input
                  required
                  value={editForm.Nama}
                  onChange={(event) => setEditForm((current) => ({ ...current, Nama: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-normal"
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Link Spreadsheet
                <input
                  required
                  type="url"
                  value={editForm.link_spreadsheet_anomali}
                  onChange={(event) => setEditForm((current) => ({ ...current, link_spreadsheet_anomali: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-normal"
                />
              </label>

              <fieldset className="rounded-xl border border-slate-200 p-4">
                <legend className="px-1 text-sm font-semibold text-slate-700">Cara menampilkan LK ini</legend>
                <p className="mt-2 text-xs text-slate-500">Pilih LK tujuan. Kosongkan jika LK ini berdiri sendiri.</p>
                <select
                  value={editForm.gabung_dengan_id}
                  onChange={(event) => setEditForm((current) => ({ ...current, gabung_dengan_id: event.target.value }))}
                  className="mt-3 w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                >
                  <option value="">Tidak digabungkan</option>
                  {editSurveyLks.map((lk) => (
                    <option key={lk.id} value={lk.id}>
                      {lk.Nama || lk.nama_lk || lk.nama_file || lk.file_name || `LK ${lk.id}`}
                    </option>
                  ))}
                </select>
              </fieldset>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setEditingLk(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">
                Batal
              </button>
              <button type="submit" disabled={isSavingEdit} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                {isSavingEdit ? 'Menyimpan...' : 'Simpan perubahan'}
              </button>
            </div>
          </form>
        </div>
      )}

      <section className="sticky top-3 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg shadow-slate-200/40 backdrop-blur">
        <div className="relative min-w-60 flex-1">
          <Search size={17} className="absolute left-3 top-3 text-slate-400" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Cari nama LK..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Survei
          <select value={surveyFilter} onChange={(event) => setSurveyFilter(event.target.value)} className="mt-1 min-w-52 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-800">
            <option value="ALL">Semua survei</option>
            {surveyGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
        <span className="text-xs text-slate-500">{filteredSurveyGroups.reduce((total, group) => total + group.items.length, 0)} LK tampil</span>
      </section>

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
            <input type="text" required placeholder="Nama LK" className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-normal" value={nama} onChange={(event) => setNama(event.target.value)} />
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
              <legend className="px-1 text-sm font-semibold text-slate-700">Gabungkan ke LK</legend>
              <p className="mt-1 text-xs text-slate-500">Pilih LK tujuan secara langsung. Kosongkan jika LK ini berdiri sendiri.</p>
              <select
                value={mergeTargetId}
                onChange={(event) => {
                  setMergeTargetId(event.target.value);
                  setMergeWithPrevious(Boolean(event.target.value));
                }}
                className="mt-3 w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-normal text-slate-700"
              >
                <option value="">Tidak digabungkan</option>
                {selectedSurveyLks.map((lk) => (
                  <option key={lk.id} value={lk.id}>
                    {lk.Nama || lk.nama_lk || lk.nama_file || lk.file_name || `LK ${lk.id}`}
                  </option>
                ))}
              </select>
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

      <section className="flex flex-col w-full flex-wrap gap-6">
        {filteredSurveyGroups.map((group) => (
          <article key={group.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <FileSpreadsheet size={24} />
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{group.items.length} LK</span>
            </div>
            <h2 className="mt-5 line-clamp-2 text-lg font-bold text-slate-900">{group.name}</h2>
            <p className="mt-2 text-sm text-slate-500">Daftar LK pada survei ini:</p>
            <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3">
              {group.items.map((item, itemIndex) => (
                <div key={`${group.id}-${item.id || item.spreadsheet_id || 'lk'}-${itemIndex}`} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-semibold text-slate-700">{item.Nama || item.nama_lk || item.name || item.nama_file || `LK ${item.id}`}</span>
                  <div className="flex shrink-0 items-center gap-1">
                    <Link to={`/penyelesaian/${item.id}`} title="Buka link detail tanpa login" className="rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50">
                      Buka detail
                    </Link>
                    {authenticated && (
                      <button type="button" onClick={() => openEdit(item)} title="Edit LK" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                        <Pencil size={15} />
                      </button>
                    )}
                    {authenticated && (
                      <button type="button" onClick={() => handleDelete(item.id)} title="Hapus LK" className="rounded-lg p-2 text-rose-600 hover:bg-rose-50">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
              <Link to={`/penyelesaian/survei/${group.id}`} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                Buka LK gabungan →
              </Link>
              <span className="text-xs font-medium text-slate-400">Link detail tersedia per LK</span>
            </div>
          </article>
        ))}
      </section>
      {filteredSurveyGroups.length === 0 && <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">Tidak ada LK yang cocok dengan filter.</div>}
    </div>
  );
}
