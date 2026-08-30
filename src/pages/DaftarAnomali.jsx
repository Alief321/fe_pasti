// frontend/src/pages/DaftarAnomali.jsx
import { useState, useEffect, useMemo } from 'react';
import { Database, Play, Plus, X, Pencil, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../api';
import DataTable from '../components/DataTable';

const PAGE_SIZE = 8;

export default function DaftarAnomali() {
  const [anomaliList, setAnomaliList] = useState([]);
  const [surveiList, setSurveiList] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Form State
  const [formData, setFormData] = useState({
    id_survei: '',
    jenis_anomali: '',
    sql_query: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const filteredAnomali = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return anomaliList;
    return anomaliList.filter((item) => {
      const searchable = `${item.daftar_survei?.nama_survei || ''} ${item.jenis_anomali || ''} ${item.sql_query || ''}`.toLowerCase();
      return searchable.includes(query);
    });
  }, [anomaliList, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredAnomali.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedAnomali = filteredAnomali.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch Anomali & Survei secara paralel
      const [resAnomali, resSurvei] = await Promise.all([api.get('/anomali'), api.get('/survei')]);
      setAnomaliList(resAnomali.data);
      setSurveiList(resSurvei.data);
    } catch (error) {
      console.error('Gagal mengambil data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSimpanAnomali = async (e) => {
    e.preventDefault();
    try {
      if (editingId) await api.put(`/anomali/${editingId}`, formData);
      else await api.post('/anomali', formData);
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ id_survei: '', jenis_anomali: '', sql_query: '' });
      fetchData(); // Refresh tabel
    } catch (error) {
      alert('Gagal menyimpan anomali: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setFormData({ id_survei: item.id_survei, jenis_anomali: item.jenis_anomali, sql_query: item.sql_query });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus aturan anomali ini?')) return;
    try {
      await api.delete(`/anomali/${id}`);
      fetchData();
    } catch (error) {
      alert('Gagal menghapus aturan: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleRunSQL = async (item) => {
    const query = item?.sql_query || '';

    if (query) {
      try {
        await navigator.clipboard.writeText(query);
      } catch (error) {
        const fallback = document.createElement('textarea');
        fallback.value = query;
        fallback.setAttribute('readonly', '');
        fallback.style.position = 'fixed';
        fallback.style.opacity = '0';
        document.body.appendChild(fallback);
        fallback.select();
        document.execCommand('copy');
        document.body.removeChild(fallback);
      }
    }

    window.open('https://fasih-dashboard.bps.go.id/superset/sqllab/', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="max-w-6xl mx-auto relative">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Daftar Aturan Anomali (SQL)</h1>
          <p className="text-slate-500">Kelola master query SQL untuk mendeteksi anomali pada setiap survei.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
          <Plus size={16} /> Tambah Aturan SQL
        </button>
      </div>

      {loading ? (
        <p className="text-slate-500">Memuat data...</p>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full ">
              <Search className="absolute left-3 top-3 text-slate-400" size={16} />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Cari survei, jenis anomali, atau query..."
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none ring-0 focus:border-blue-500"
              />
            </div>
            {/* <div className="text-sm text-slate-500">{filteredAnomali.length} data</div> */}
          </div>

          <DataTable headers={['Nama Survei', 'Jenis Anomali', 'Status', 'Aksi']}>
            {paginatedAnomali.length === 0 ? (
              <tr>
                <td colSpan="4" className="px-6 py-8 text-center text-slate-500">
                  Belum ada data anomali yang cocok.
                </td>
              </tr>
            ) : (
              paginatedAnomali.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{item.daftar_survei?.nama_survei || 'N/A'}</td>
                  <td className="px-6 py-4">
                    <p className="text-slate-800 font-medium">{item.jenis_anomali}</p>
                    <p className="mt-1 max-w-md truncate text-xs font-mono text-slate-400">{item.sql_query.substring(0, 80)}...</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${item.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{item.is_active ? 'Aktif' : 'Nonaktif'}</span>
                  </td>
                  <td className="px-6 py-4 flex gap-2">
                    <button onClick={() => handleRunSQL(item)} title="Jalankan SQL ini" className="rounded bg-blue-50 p-2 text-blue-600 transition hover:bg-blue-100">
                      <Play size={16} />
                    </button>
                    <button onClick={() => handleEdit(item)} title="Edit aturan" className="rounded bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => handleDelete(item.id)} title="Hapus aturan" className="rounded bg-red-50 p-2 text-red-600 transition hover:bg-red-100">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </DataTable>

          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={safePage === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft size={16} /> Sebelumnya
            </button>
            <div className="text-sm text-slate-600">
              Halaman {safePage} / {totalPages}
            </div>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={safePage === totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Selanjutnya <ChevronRight size={16} />
            </button>
          </div>
        </>
      )}

      {/* Modal / Sidebar Form Tambah Anomali */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex justify-end z-50">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col transform transition-transform">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Database className="text-blue-600" size={24} />
                <h2 className="text-xl font-bold">{editingId ? 'Edit Aturan SQL' : 'Simpan Aturan SQL Baru'}</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <form id="form-anomali" onSubmit={handleSimpanAnomali} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Pilih Survei Target</label>
                  <select
                    required
                    value={formData.id_survei}
                    onChange={(e) => setFormData({ ...formData, id_survei: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="" disabled>
                      -- Pilih Survei --
                    </option>
                    {surveiList.map((survei) => (
                      <option key={survei.id} value={survei.id}>
                        {survei.nama_survei}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nama / Jenis Anomali</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Anomali 3 (Disabilitas Tunggal)"
                    value={formData.jenis_anomali}
                    onChange={(e) => setFormData({ ...formData, jenis_anomali: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">SQL Query Rule</label>
                  <p className="text-xs text-slate-500 mb-2">Masukkan query `SELECT` lengkap yang akan menghasilkan tabel baris anomali. Pastikan kolom yang dihasilkan sesuai format standar (Kecamatan, Desa, KODE_SUB_SLS, dll).</p>
                  <textarea
                    required
                    rows={12}
                    placeholder="SELECT DISTINCT bt.level_3_name AS Kecamatan, ... FROM root_table rt ..."
                    value={formData.sql_query}
                    onChange={(e) => setFormData({ ...formData, sql_query: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-4 py-3 font-mono text-sm bg-slate-900 text-green-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    spellCheck="false"
                  ></textarea>
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition">
                Batal
              </button>
              <button type="submit" form="form-anomali" className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition shadow-sm">
                Simpan Query SQL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
