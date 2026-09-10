// ManajemenUser.jsx
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, EyeOff, Pencil, Plus, Search, Trash2, UserRound, X } from 'lucide-react';
import api from '../api';
import DataTable from '../components/DataTable';

const emptyForm = { name: '', email: '', password: '', role: 'admin' };
const PAGE_SIZE = 8;

export default function ManajemenUser() {
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // State untuk hide/show password
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (error) {
      alert('Gagal memuat user: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadUsers = async () => {
      try {
        setLoading(true);
        const response = await api.get('/users');
        if (isMounted) setUsers(response.data);
      } catch (error) {
        alert('Gagal memuat user: ' + (error.response?.data?.error || error.message));
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadUsers();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) => {
      const searchable = `${user.name || user.nama || ''} ${user.email || ''} ${user.role || ''}`.toLowerCase();
      return searchable.includes(query);
    });
  }, [searchTerm, users]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedUsers = filteredUsers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const payload = { ...formData };
      if (editingId && !payload.password) delete payload.password;
      if (editingId) await api.put(`/users/${editingId}`, payload);
      else await api.post('/users', payload);
      setIsModalOpen(false);
      setEditingId(null);
      setFormData(emptyForm);
      setShowPassword(false);
      fetchUsers();
    } catch (error) {
      alert('Gagal menyimpan user: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleEdit = (user) => {
    setEditingId(user.id);
    setFormData({ name: user.name || user.nama || '', email: user.email || '', password: '', role: 'admin' });
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus user ini?')) return;
    try {
      await api.delete(`/users/${id}`);
      fetchUsers();
    } catch (error) {
      alert('Gagal menghapus user: ' + (error.response?.data?.error || error.message));
    }
  };

  return (
    <div className="relative mx-auto max-w-6xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manajemen User</h1>
          <p className="text-slate-500">Kelola akun dan hak akses pengguna aplikasi.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setFormData(emptyForm);
            setShowPassword(false);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 hover:shadow"
        >
          <Plus size={16} /> Tambah User
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
                onChange={handleSearchChange}
                placeholder="Cari nama, email, atau role..."
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none ring-0 transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>
          </div>

          <DataTable headers={['Nama', 'Email', 'Role', 'Aksi']}>
            {paginatedUsers.length === 0 ? (
              <tr>
                <td colSpan="4" className="px-6 py-8 text-center text-slate-500">
                  Belum ada data user yang cocok.
                </td>
              </tr>
            ) : (
              paginatedUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/80">
                  <td className="px-6 py-4 font-medium text-slate-900">{user.name || user.nama || '-'}</td>
                  <td className="px-6 py-4 text-slate-600">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-700/10">
                      {user.role || 'admin'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleEdit(user)} title="Edit user" className="rounded-lg bg-slate-100 p-2 text-slate-600 transition hover:bg-blue-50 hover:text-blue-600">
                        <Pencil size={16} />
                      </button>
                      <button type="button" onClick={() => handleDelete(user.id)} title="Hapus user" className="rounded-lg bg-slate-100 p-2 text-slate-600 transition hover:bg-red-50 hover:text-red-600">
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
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft size={16} /> Sebelumnya
            </button>
            <div className="text-sm font-medium text-slate-500">
              Halaman <span className="text-slate-900">{safePage}</span> dari {totalPages}
            </div>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={safePage === totalPages}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Selanjutnya <ChevronRight size={16} />
            </button>
          </div>
        </>
      )}

      {/* MODAL REDESIGN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/5">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-5 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <UserRound size={20} />
                </div>
                <h2 className="text-xl font-bold text-slate-800">{editingId ? 'Edit Data User' : 'Tambah User Baru'}</h2>
              </div>
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="rounded-full bg-slate-200/50 p-2 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>
            
            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Nama Lengkap</label>
                <input
                  required
                  placeholder="Masukkan nama"
                  value={formData.name}
                  onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                />
              </div>
              
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Alamat Email</label>
                <input
                  required
                  type="email"
                  placeholder="contoh@email.com"
                  value={formData.email}
                  onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                />
              </div>
              
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  {editingId ? 'Password Baru (Opsional)' : 'Password'}
                </label>
                <div className="relative">
                  <input
                    required={!editingId}
                    type={showPassword ? 'text' : 'password'}
                    placeholder={editingId ? 'Kosongkan jika tidak diubah' : 'Masukkan password kuat'}
                    value={formData.password}
                    onChange={(event) => setFormData({ ...formData, password: event.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-4 pr-12 text-sm text-slate-800 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 outline-none transition-colors hover:text-slate-600 focus:ring-2 focus:ring-blue-500/20"
                    title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Role Akses</label>
                <select 
                  value={formData.role} 
                  onChange={(event) => setFormData({ ...formData, role: event.target.value })} 
                  className="w-full cursor-pointer rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                >
                  <option value="admin">Admin</option>
                </select>
              </div>
              
              {/* Modal Footer / Actions */}
              <div className="mt-8 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md hover:shadow-blue-600/20 active:scale-95"
                >
                  {editingId ? 'Simpan Perubahan' : 'Simpan User'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}