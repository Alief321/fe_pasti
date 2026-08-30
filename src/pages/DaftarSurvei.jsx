import { useState, useEffect, useMemo } from 'react';
import { Plus, X, ClipboardList, Pencil, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../api';
import DataTable from '../components/DataTable';

const PAGE_SIZE = 8;

export default function DaftarSurvei() {
  const [survei, setSurvei] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // State untuk kontrol Modal dan Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    nama_survei: '',
    deskripsi_survei: '',
  });

  const fetchSurvei = async () => {
    try {
      setLoading(true);
      const res = await api.get('/survei');
      setSurvei(res.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        const res = await api.get('/survei');
        if (isMounted) setSurvei(res.data);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredSurvei = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return survei;
    return survei.filter((item) => `${item.nama_survei || ''} ${item.deskripsi_survei || ''}`.toLowerCase().includes(query));
  }, [searchTerm, survei]);

  const totalPages = Math.max(1, Math.ceil(filteredSurvei.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedSurvei = filteredSurvei.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Fungsi untuk mengirim data baru ke server
  const handleTambahSurvei = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingId) await api.put(`/survei/${editingId}`, formData);
      else await api.post('/survei', formData);

      // Tutup modal dan reset form setelah berhasil
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ nama_survei: '', deskripsi_survei: '' });

      // Ambil ulang data terbaru untuk memperbarui tabel
      fetchSurvei();
    } catch (error) {
      alert('Gagal menambahkan survei: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setFormData({ nama_survei: item.nama_survei, deskripsi_survei: item.deskripsi_survei || '' });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus survei ini?')) return;
    try {
      await api.delete(`/survei/${id}`);
      fetchSurvei();
    } catch (error) {
      alert('Gagal menghapus survei: ' + (error.response?.data?.error || error.message));
    }
  };

  return (
    <div className="max-w-5xl mx-auto relative">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Daftar Survei</h1>
          <p className="text-slate-500">Kelola master data kegiatan survei / sensus.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
          <Plus size={16} /> Tambah Survei
        </button>
      </div>

      {loading ? (
        <p className="text-slate-500 animate-pulse">Memuat data...</p>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full ">
              <Search className="absolute left-3 top-3 text-slate-400" size={16} />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Cari nama atau deskripsi survei..."
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none ring-0 focus:border-blue-500"
              />
            </div>
            {/* <div className="text-sm text-slate-500">{filteredSurvei.length} data</div> */}
          </div>

          <DataTable headers={['Nama Survei', 'Deskripsi', 'Tanggal Dibuat', 'Aksi']}>
            {paginatedSurvei.length === 0 ? (
              <tr>
                <td colSpan="4" className="px-6 py-8 text-center text-slate-500">
                  Belum ada data survei yang cocok.
                </td>
              </tr>
            ) : (
              paginatedSurvei.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">{item.nama_survei}</td>
                  <td className="px-6 py-4 text-slate-600">{item.deskripsi_survei}</td>
                  <td className="px-6 py-4 text-slate-500">{new Date(item.created_at).toLocaleDateString('id-ID')}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleEdit(item)} title="Edit survei" className="rounded-lg bg-blue-50 p-2 text-blue-600 hover:bg-blue-100">
                        <Pencil size={16} />
                      </button>
                      <button type="button" onClick={() => handleDelete(item.id)} title="Hapus survei" className="rounded-lg bg-red-50 p-2 text-red-600 hover:bg-red-100">
                        <Trash2 size={16} />
                      </button>
                    </div>
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

      {/* MODAL TAMBAH SURVEI */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden transform transition-all">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <ClipboardList className="text-blue-600" size={20} />
                <h2 className="text-lg font-bold text-slate-800">{editingId ? 'Edit Survei' : 'Tambah Survei Baru'}</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 hover:bg-slate-200 p-1 rounded transition">
                <X size={20} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <div className="p-6">
              <form id="form-survei" onSubmit={handleTambahSurvei} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nama Survei <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Survei Sosial Ekonomi Nasional 2026"
                    value={formData.nama_survei}
                    onChange={(e) => setFormData({ ...formData, nama_survei: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Deskripsi Survei</label>
                  <textarea
                    rows={3}
                    placeholder="Berikan keterangan singkat mengenai survei ini..."
                    value={formData.deskripsi_survei}
                    onChange={(e) => setFormData({ ...formData, deskripsi_survei: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                  ></textarea>
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition">
                Batal
              </button>
              <button type="submit" form="form-survei" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition shadow-sm disabled:opacity-50 flex items-center">
                {isSubmitting ? 'Menyimpan...' : 'Simpan Survei'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
