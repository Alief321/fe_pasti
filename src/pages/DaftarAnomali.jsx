// frontend/src/pages/DaftarAnomali.jsx
import { useState, useEffect, useMemo } from 'react';
import { Database, Play, Plus, X, Pencil, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../api';
import DataTable from '../components/DataTable';
import UploadDropzone from '../components/UploadDropzone';

const PAGE_SIZE = 8;

function formatSql(sql) {
  const normalized = String(sql || '')
    .replace(/\r\n?/g, '\n')
    .trim();
  if (!normalized) return '';
  return normalized.endsWith(';') ? normalized : `${normalized};`;
}

async function readZipSqlFiles(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const endOfCentralDirectory = 0x06054b50;
  const centralDirectoryEntry = 0x02014b50;
  const localFileHeader = 0x04034b50;
  let directoryOffset = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset -= 1) {
    if (view.getUint32(offset, true) === endOfCentralDirectory) {
      directoryOffset = view.getUint32(offset + 16, true);
      break;
    }
  }
  if (directoryOffset < 0) throw new Error('ZIP tidak valid.');

  const sqlFiles = [];
  let offset = directoryOffset;
  while (offset + 46 <= bytes.length && view.getUint32(offset, true) === centralDirectoryEntry) {
    const compressionMethod = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const fileName = new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + fileNameLength));
    offset += 46 + fileNameLength + extraLength + commentLength;
    if (!fileName.toLowerCase().endsWith('.sql') || fileName.endsWith('/')) continue;
    if (view.getUint32(localOffset, true) !== localFileHeader) throw new Error(`ZIP entry tidak valid: ${fileName}`);
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const compressed = bytes.slice(localOffset + 30 + localNameLength + localExtraLength, localOffset + 30 + localNameLength + localExtraLength + compressedSize);
    let content;
    if (compressionMethod === 0) content = compressed;
    else if (compressionMethod === 8) content = new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    else throw new Error(`Kompresi ZIP tidak didukung: ${fileName}`);
    sqlFiles.push({ name: fileName, content: new TextDecoder().decode(content) });
  }
  if (!sqlFiles.length) throw new Error('ZIP tidak berisi file .sql.');
  return sqlFiles;
}

async function readSqlInput(fileList) {
  const files = [...fileList];
  const sqlFiles = [];
  for (const file of files) {
    if (file.name.toLowerCase().endsWith('.zip')) sqlFiles.push(...(await readZipSqlFiles(file)));
    else sqlFiles.push({ name: file.name, content: await file.text() });
  }
  return sqlFiles.map(({ name, content }) => `-- ${name}\n${formatSql(content)}`).join('\n\n');
}

export default function DaftarAnomali() {
  const [anomaliList, setAnomaliList] = useState([]);
  const [surveiList, setSurveiList] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sqlFileLoading, setSqlFileLoading] = useState(false);
  const [sqlFiles, setSqlFiles] = useState([]);
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

  async function fetchData() {
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
  }

  // --- FUNGSI TAMBAHAN UNTUK RESET STATE MODAL ---
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ id_survei: '', jenis_anomali: '', sql_query: '' });
    setSqlFiles([]);
  };

  const handleTambah = () => {
    setEditingId(null);
    setFormData({ id_survei: '', jenis_anomali: '', sql_query: '' });
    setSqlFiles([]);
    setIsModalOpen(true);
  };
  // ------------------------------------------------

  const handleSimpanAnomali = async (e) => {
    e.preventDefault();
    try {
      if (editingId) await api.put(`/anomali/${editingId}`, formData);
      else await api.post('/anomali', formData);
      
      handleCloseModal(); // Gunakan fungsi reset yang sudah dibuat
      fetchData(); // Refresh tabel
    } catch (error) {
      alert('Gagal menyimpan anomali: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleSqlFile = async (files) => { // 1. Ubah parameter event menjadi files
      if (!files?.length) return;
      setSqlFileLoading(true);
      try {
        const sqlQuery = await readSqlInput(files);
        setSqlFiles([...files]);
        setFormData((current) => ({ ...current, sql_query: sqlQuery }));
      } catch (error) {
        alert(`Gagal membaca file SQL: ${error.message}`);
      } finally {
        setSqlFileLoading(false);
        // 2. Hapus baris event.target.value = ''; karena memicu error (event is undefined)
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
      } catch {
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
        {/* Ubah onClick menjadi handleTambah */}
        <button onClick={handleTambah} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
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
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setCurrentPage(1);
                }}
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
              {/* Ubah onClick menjadi handleCloseModal */}
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-700">
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
                  <UploadDropzone
                    accept=".sql,.zip,application/sql,application/zip"
                    multiple
                    files={sqlFiles}
                    onFiles={handleSqlFile}
                    title={sqlFileLoading ? 'Membaca file SQL...' : 'Pilih file SQL atau ZIP'}
                    description="Tarik file .sql atau ZIP berisi kumpulan .sql ke sini"
                    className="mb-2"
                  />
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
              {/* Ubah onClick menjadi handleCloseModal */}
              <button type="button" onClick={handleCloseModal} className="px-6 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition">
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