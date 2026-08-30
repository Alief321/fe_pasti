import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2, UserRound, X } from 'lucide-react';
import api from '../api';
import DataTable from '../components/DataTable';

const emptyForm = { name: '', email: '', password: '', role: 'user' };
const PAGE_SIZE = 8;

export default function ManajemenUser() {
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
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
      fetchUsers();
    } catch (error) {
      alert('Gagal menyimpan user: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleEdit = (user) => {
    setEditingId(user.id);
    setFormData({ name: user.name || user.nama || '', email: user.email || '', password: '', role: user.role || 'user' });
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
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
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
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none ring-0 focus:border-blue-500"
              />
            </div>
            {/* <div className="text-sm text-slate-500">{filteredUsers.length} data</div> */}
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
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{user.name || user.nama || '-'}</td>
                  <td className="px-6 py-4 text-slate-600">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{user.role || 'user'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleEdit(user)} title="Edit user" className="rounded-lg bg-blue-50 p-2 text-blue-600 hover:bg-blue-100">
                        <Pencil size={16} />
                      </button>
                      <button type="button" onClick={() => handleDelete(user.id)} title="Hapus user" className="rounded-lg bg-red-50 p-2 text-red-600 hover:bg-red-100">
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

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
              <div className="flex items-center gap-2">
                <UserRound className="text-blue-600" size={20} />
                <h2 className="text-lg font-bold text-slate-800">{editingId ? 'Edit User' : 'Tambah User'}</h2>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <input
                required
                placeholder="Nama"
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
              />
              <input
                required
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
              />
              <input
                required={!editingId}
                type="password"
                placeholder={editingId ? 'Password baru (opsional)' : 'Password'}
                value={formData.password}
                onChange={(event) => setFormData({ ...formData, password: event.target.value })}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
              />
              <select value={formData.role} onChange={(event) => setFormData({ ...formData, role: event.target.value })} className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none">
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg px-4 py-2 font-medium text-slate-600 hover:bg-slate-100">
                  Batal
                </button>
                <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
