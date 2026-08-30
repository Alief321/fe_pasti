import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpDown, CheckCircle2, Filter, Layers3, Search, Table2 } from 'lucide-react';
import api from '../api';
import { isAuthenticated } from '../auth';
import { findDefaultKey, isCompleted, mergeLkRows, normalizeHeader } from '../utils/lkMerge';

const EMPTY_FILTER_VALUE = '__EMPTY__';

const isLinkColumn = (header) => normalizeHeader(header).includes('link') || normalizeHeader(header).includes('url');
const isMetadataColumn = (header) => {
  const value = normalizeHeader(header);
  return value.includes('anomali') || value === 'pcl' || value === 'pj' || value.includes('petugas');
};

const asText = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const getComparableValue = (value) => {
  const text = asText(value).toLowerCase();
  const normalized = text.replace(/[^0-9,.-]/g, '').replace(',', '.');
  const numericValue = Number.parseFloat(normalized);
  return Number.isFinite(numericValue) ? numericValue : text;
};

const detectStatusColumns = (headers, rows) => {
  const knownValues = ['true', 'false', '1', '0', 'ya', 'tidak', 'selesai', 'belum', 'completed', 'pending'];
  return [
    ...new Set(
      headers.filter((header) => {
        const normalized = normalizeHeader(header);
        const labelMatches = normalized.includes('status') || normalized.includes('selesai') || normalized.includes('done') || normalized.includes('check');
        if (!labelMatches) {
          const sampleValues = rows
            .slice(0, 40)
            .map((row) => asText(row[header]))
            .filter(Boolean);
          return sampleValues.some((value) => knownValues.includes(value.toLowerCase()));
        }
        return true;
      }),
    ),
  ];
};

const detectDateColumns = (headers, rows) => {
  const datePattern = /\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|tanggal|date|waktu|selesai|completed/;
  return [
    ...new Set(
      headers.filter((header) => {
        const normalized = normalizeHeader(header);
        const labelMatches = normalized.includes('tanggal') || normalized.includes('date') || normalized.includes('waktu') || normalized.includes('selesai');
        if (labelMatches) return true;
        const sampleValues = rows
          .slice(0, 40)
          .map((row) => asText(row[header]))
          .filter(Boolean);
        return sampleValues.some((value) => datePattern.test(value.toLowerCase()));
      }),
    ),
  ];
};

const detectNoteColumns = (headers) => {
  return headers.filter((header) => {
    const normalized = normalizeHeader(header);
    return normalized.includes('catatan') || normalized.includes('note') || normalized.includes('komentar') || normalized.includes('keterangan') || normalized.includes('tindak_lanjut') || normalized.includes('action');
  });
};

const getSheetSources = (worksheetPayload) => {
  if (!worksheetPayload) return [];

  const candidates = Array.isArray(worksheetPayload.sheets)
    ? worksheetPayload.sheets
    : Array.isArray(worksheetPayload.worksheets)
      ? worksheetPayload.worksheets
      : Array.isArray(worksheetPayload.data) && worksheetPayload.data.some((item) => item && Array.isArray(item.rows))
        ? worksheetPayload.data
        : [worksheetPayload];

  return candidates.map((sheet, index) => {
    const sheetName = sheet.sheetName || sheet.name || sheet.sheet || sheet.title || `Sheet${index + 1}`;
    const rows = Array.isArray(sheet.data) ? sheet.data : Array.isArray(sheet.rows) ? sheet.rows : [];
    return {
      sheetName,
      headers: Array.isArray(sheet.headers) ? sheet.headers : Array.isArray(worksheetPayload.headers) ? worksheetPayload.headers : [],
      data: rows,
    };
  });
};

export default function PenyelesaianDetail() {
  const { surveiId, spreadsheetId } = useParams();
  const navigate = useNavigate();
  const authenticated = isAuthenticated();
  const [sources, setSources] = useState([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sheetFilter, setSheetFilter] = useState('ALL');
  const [columnFilters, setColumnFilters] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
  const [filterMenuOpen, setFilterMenuOpen] = useState(null);
  const [hiddenColumns, setHiddenColumns] = useState([]);
  const [freezeColumnsCount, setFreezeColumnsCount] = useState(0);
  const [statusColumnChoice, setStatusColumnChoice] = useState('');
  const [dateColumnChoice, setDateColumnChoice] = useState('');
  const [noteColumnChoice, setNoteColumnChoice] = useState('');
  const [showFieldSettings, setShowFieldSettings] = useState(true);
  const [surveyName, setSurveyName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        let records;
        if (surveiId) {
          const response = await api.get('/penyelesaian');
          records = response.data.filter((item) => String(item.id_survei || item.daftar_survei?.id) === String(surveiId));
        } else {
          records = [{ spreadsheet_id: spreadsheetId, uploaded_by: 'LK' }];
        }

        const loadedSources = await Promise.all(
          records.map(async (record) => {
            const response = await api.get(`/sheets/data/${record.spreadsheet_id}`);
            const sheetItems = getSheetSources(response.data || {});
            const normalizedSheets = sheetItems.map((sheetItem, index) => ({
              id: record.id ?? `${record.spreadsheet_id}-${index}`,
              spreadsheetId: record.spreadsheet_id,
              sheetName: sheetItem.sheetName || `Sheet${index + 1}`,
              label: record.uploaded_by || 'LK',
              headers: sheetItem.headers || [],
              data: sheetItem.data || [],
            }));

            return normalizedSheets;
          }),
        );

        const allSources = loadedSources.flat();
        setSources(allSources);
        if (surveiId && records[0]?.daftar_survei?.nama_survei) {
          setSurveyName(records[0].daftar_survei.nama_survei);
        } else if (surveiId) {
          try {
            const surveyResponse = await api.get(`/survei/${surveiId}`);
            setSurveyName(surveyResponse.data?.nama_survei || '');
          } catch {
            setSurveyName('');
          }
        } else {
          setSurveyName('');
        }
        setSheetFilter('ALL');
        setSelectedKey(findDefaultKey([...new Set(allSources.flatMap((source) => source.headers))]));
      } catch (requestError) {
        setError(requestError.response?.data?.error || 'Gagal mengambil data LK.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [surveiId, spreadsheetId]);

  const headers = useMemo(() => [...new Set(sources.flatMap((source) => source.headers))], [sources]);
  const sheetNames = useMemo(() => [...new Set(sources.map((source) => source.sheetName))], [sources]);
  const activeSources = useMemo(() => (sheetFilter === 'ALL' ? sources : sources.filter((source) => source.sheetName === sheetFilter)), [sheetFilter, sources]);
  const merged = useMemo(() => mergeLkRows(activeSources, selectedKey), [activeSources, selectedKey]);
  const detectedStatusColumns = useMemo(() => detectStatusColumns(headers, merged.rows), [headers, merged.rows]);
  const detectedDateColumns = useMemo(() => detectDateColumns(headers, merged.rows), [headers, merged.rows]);
  const detectedNoteColumns = useMemo(() => detectNoteColumns(headers), [headers]);
  const effectiveStatusHeader = statusColumnChoice || merged.statusHeader || '';
  const effectiveDateHeader = dateColumnChoice || merged.dateHeader || '';
  const visibleHeaders = headers.filter((header) => !['status_penyelesaian', 'tanggal_selesai'].includes(normalizeHeader(header)) && !hiddenColumns.includes(header));
  const filteredRows = useMemo(() => {
    const matchesStatus = (row) => {
      const completed = isCompleted(effectiveStatusHeader ? { ...row, 'Status Penyelesaian': row[effectiveStatusHeader] } : row);
      if (statusFilter === 'SELESAI' && !completed) return false;
      if (statusFilter === 'BELUM' && completed) return false;
      return true;
    };

    const matchesSearch = (row) => {
      if (!searchTerm) return true;
      return Object.values(row).join(' ').toLowerCase().includes(searchTerm.toLowerCase());
    };

    const matchesColumnFilters = (row) => {
      return Object.entries(columnFilters).every(([header, selectedValues]) => {
        if (!selectedValues || selectedValues.length === 0) return true;
        const cellValue = asText(row[header]);
        if (selectedValues.includes(EMPTY_FILTER_VALUE)) {
          if (!cellValue && selectedValues.length === 1) return true;
          if (!cellValue) return selectedValues.includes(EMPTY_FILTER_VALUE);
        }
        return selectedValues.some((value) => (value === EMPTY_FILTER_VALUE ? !cellValue : cellValue === value));
      });
    };

    return merged.rows.filter((row) => matchesStatus(row) && matchesSearch(row) && matchesColumnFilters(row));
  }, [columnFilters, effectiveStatusHeader, merged.rows, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    const completed = filteredRows.filter((row) => isCompleted(effectiveStatusHeader ? { ...row, 'Status Penyelesaian': row[effectiveStatusHeader] } : row)).length;
    return { total: filteredRows.length, completed, pending: filteredRows.length - completed };
  }, [effectiveStatusHeader, filteredRows]);

  const headerOptions = useMemo(() => {
    return visibleHeaders.reduce((acc, header) => {
      const uniqueValues = [...new Set(merged.rows.map((row) => asText(row[header])).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id'));
      acc[header] = uniqueValues;
      return acc;
    }, {});
  }, [merged.rows, visibleHeaders]);

  const sortedRows = useMemo(() => {
    if (!sortConfig.key) return filteredRows;

    const rows = [...filteredRows];
    rows.sort((left, right) => {
      const leftValue = left[sortConfig.key];
      const rightValue = right[sortConfig.key];
      const leftComparable = getComparableValue(leftValue);
      const rightComparable = getComparableValue(rightValue);

      if (leftComparable === rightComparable) return 0;
      const comparison = leftComparable > rightComparable ? 1 : -1;
      return sortConfig.direction === 'asc' ? comparison : comparison * -1;
    });

    return rows;
  }, [filteredRows, sortConfig]);

  const handleColumnFilterToggle = (header, value) => {
    setColumnFilters((current) => {
      const currentValues = current[header] || [];
      const nextValues = currentValues.includes(value) ? currentValues.filter((item) => item !== value) : [...currentValues, value];

      const nextState = { ...current };
      if (nextValues.length === 0) {
        delete nextState[header];
      } else {
        nextState[header] = nextValues;
      }
      return nextState;
    });
  };

  const handleSort = (header) => {
    setSortConfig((current) => {
      if (current.key !== header) {
        return { key: header, direction: 'asc' };
      }
      return { key: header, direction: current.direction === 'asc' ? 'desc' : 'asc' };
    });
  };

  const clearColumnFilter = (header) => {
    setColumnFilters((current) => {
      const nextState = { ...current };
      delete nextState[header];
      return nextState;
    });
  };

  const handleToggleHiddenColumn = (header) => {
    setHiddenColumns((current) => (current.includes(header) ? current.filter((item) => item !== header) : [...current, header]));
  };

  const handleStatusChange = async (row) => {
    const source = sources.find((item) => item.spreadsheetId === (row._sourceSpreadsheetId ?? row._spreadsheetId));
    const statusColumn = source?.headers.find((header) => header === effectiveStatusHeader || normalizeHeader(header) === 'status_penyelesaian');
    const dateColumn = source?.headers.find((header) => header === effectiveDateHeader || normalizeHeader(header) === 'tanggal_selesai');
    const sourceRowIndex = row._sourceRowIndex ?? row._rowIndex;

    if (!source || sourceRowIndex === undefined || !statusColumn || !dateColumn) return;

    const nextCompleted = !isCompleted(row);
    const nextStatusValue = nextCompleted ? 'SELESAI' : 'BELUM';
    const columnLetter = (index) => {
      let result = '';
      for (let value = index; value >= 0; value = Math.floor(value / 26) - 1) result = String.fromCharCode((value % 26) + 65) + result;
      return result;
    };

    const previousSources = sources;
    setSources((prevSources) =>
      prevSources.map((item) => {
        if (item.spreadsheetId !== source.spreadsheetId || item.sheetName !== source.sheetName) return item;

        const nextData = [...(item.data || [])];
        const targetRow = nextData[sourceRowIndex];
        if (!targetRow) return item;

        nextData[sourceRowIndex] = {
          ...targetRow,
          [statusColumn]: nextStatusValue,
          [dateColumn]: new Date().toISOString(),
        };

        return { ...item, data: nextData };
      }),
    );

    try {
      await api.post('/sheets/update-row', {
        spreadsheetId: source.spreadsheetId,
        sheetName: source.sheetName,
        rowIndex: sourceRowIndex,
        isChecked: nextCompleted,
        statusColLetter: columnLetter(source.headers.indexOf(statusColumn)),
        timestampColLetter: columnLetter(source.headers.indexOf(dateColumn)),
      });
    } catch (requestError) {
      setSources(previousSources);
      alert(requestError.response?.data?.error || 'Gagal menyimpan status penyelesaian.');
    }
  };

  if (loading) return <div className="rounded-3xl bg-white p-8 text-slate-500 shadow-sm">Memuat gabungan LK...</div>;
  if (error) return <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700">{error}</div>;

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <header className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={() => navigate('/penyelesaian')} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50">
          <ArrowLeft size={20} />
        </button>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Gabungan {sources.length} LK</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Penyelesaian Anomali{surveyName ? ` · ${surveyName}` : ''}</h1>
          <p className="text-sm text-slate-500">Kolom berbeda digabung berdasarkan referensi yang dipilih.</p>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat icon={<Table2 />} label="Total unik" value={stats.total} color="blue" />
        <Stat icon={<CheckCircle2 />} label="Selesai" value={stats.completed} color="emerald" />
        <Stat icon={<Layers3 />} label="Belum selesai" value={stats.pending} color="amber" />
      </section>

      <section className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="min-w-56 flex-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Kolom induk referensi
          <select value={selectedKey} onChange={(event) => setSelectedKey(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal text-slate-800">
            <option value="">Pilih kolom...</option>
            {headers.map((header) => (
              <option key={header} value={header}>
                {header}
              </option>
            ))}
          </select>
        </label>

        <div className="relative min-w-64 flex-1">
          <Search className="absolute left-3 top-3 text-slate-400" size={17} />
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Cari data..." className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm" />
        </div>

        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-2 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal text-slate-800">
            <option value="ALL">Semua</option>
            <option value="SELESAI">Selesai</option>
            <option value="BELUM">Belum selesai</option>
          </select>
        </label>

        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Freeze kolom
          <select value={freezeColumnsCount} onChange={(event) => setFreezeColumnsCount(Number(event.target.value))} className="mt-2 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal text-slate-800">
            {[0, 1, 2, 3, 4].map((value) => (
              <option key={value} value={value}>
                {value === 0 ? 'Tidak ada' : `${value} kolom`}
              </option>
            ))}
          </select>
        </label>

        <span className="flex items-center gap-2 pb-2 text-xs text-slate-500">
          <Filter size={15} /> {sortedRows.length} baris tampil
        </span>
      </section>

      {(detectedStatusColumns.length > 0 || detectedDateColumns.length > 0 || detectedNoteColumns.length > 0) && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">Deteksi kolom LK</p>
              <p className="text-xs text-slate-500">Konfirmasi kolom status, tanggal penyelesaian, dan catatan tindak lanjut.</p>
            </div>
            <button type="button" onClick={() => setShowFieldSettings((value) => !value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              {showFieldSettings ? 'Sembunyikan' : 'Tampilkan'}
            </button>
          </div>

          {showFieldSettings && (
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Status penyelesaian
                <select value={statusColumnChoice} onChange={(event) => setStatusColumnChoice(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal text-slate-800">
                  <option value="">Otomatis / tidak diubah</option>
                  {detectedStatusColumns.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Tanggal penyelesaian
                <select value={dateColumnChoice} onChange={(event) => setDateColumnChoice(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal text-slate-800">
                  <option value="">Otomatis / tidak diubah</option>
                  {detectedDateColumns.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Kolom catatan
                <select value={noteColumnChoice} onChange={(event) => setNoteColumnChoice(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal text-slate-800">
                  <option value="">Tidak ada kolom catatan</option>
                  {detectedNoteColumns.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">Tampilkan / sembunyikan kolom</p>
            <p className="text-xs text-slate-500">Pilih kolom yang ingin ditampilkan di tabel.</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {headers.map((header) => {
            const isHidden = hiddenColumns.includes(header);
            const isStatusLike = normalizeHeader(header) === 'status_penyelesaian' || normalizeHeader(header) === 'tanggal_selesai';
            if (isStatusLike) return null;

            return (
              <button
                key={header}
                type="button"
                onClick={() => handleToggleHiddenColumn(header)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${isHidden ? 'border-slate-300 bg-slate-100 text-slate-500' : 'border-blue-200 bg-blue-50 text-blue-700'}`}
              >
                {isHidden ? 'Tampilkan' : 'Sembunyikan'} · {header}
              </button>
            );
          })}
        </div>
      </section>

      {sheetNames.length > 1 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setSheetFilter('ALL')} className={`rounded-full px-3 py-1.5 text-sm font-medium ${sheetFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
              Semua sheet
            </button>
            {sheetNames.map((sheetName) => (
              <button
                key={sheetName}
                type="button"
                onClick={() => setSheetFilter(sheetName)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${sheetFilter === sheetName ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                {sheetName}
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-auto" style={{ maxHeight: '72vh' }}>
          <table className="min-w-full table-fixed border-collapse text-left text-sm">
            <thead className="sticky top-0 z-20 bg-slate-900 text-white">
              <tr>
                <th className="sticky left-0 z-20 w-40 bg-slate-900 px-4 py-3 text-left align-top">Status</th>
                {visibleHeaders.map((header, headerIndex) => {
                  const isFrozen = headerIndex < freezeColumnsCount;
                  const leftOffset = isFrozen ? 160 + headerIndex * 200 : 0;
                  return (
                    <th key={header} className="min-w-52 px-4 py-3 align-top" style={{ maxWidth: '280px', ...(isFrozen ? { position: 'sticky', left: `${leftOffset}px`, zIndex: 10, backgroundColor: '#0f172a' } : {}) }}>
                      <div className="flex items-start justify-between gap-2">
                        <button type="button" onClick={() => handleSort(header)} className="flex items-center gap-1 text-left font-semibold text-white hover:text-blue-200">
                          <span>{header}</span>
                          <ArrowUpDown size={14} />
                        </button>
                        <ColumnFilterMenu
                          header={header}
                          options={headerOptions[header] || []}
                          selectedValues={columnFilters[header] || []}
                          open={filterMenuOpen === header}
                          onToggleOpen={() => setFilterMenuOpen((current) => (current === header ? null : header))}
                          onClose={() => setFilterMenuOpen(null)}
                          onToggleValue={(value) => handleColumnFilterToggle(header, value)}
                          onClear={() => clearColumnFilter(header)}
                        />
                      </div>
                    </th>
                  );
                })}
                <th className="w-40 whitespace-nowrap px-4 py-3 align-top">Sumber LK</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
              {sortedRows.map((row, index) => {
                const completed = isCompleted(effectiveStatusHeader ? { ...row, 'Status Penyelesaian': row[effectiveStatusHeader] } : row);
                const rowKeyValue = `${row._spreadsheetId ?? row[selectedKey] ?? 'row'}-${row._sourceRowIndex ?? index}`;
                return (
                  <tr key={rowKeyValue} className={completed ? 'bg-emerald-50/90' : 'hover:bg-blue-50/90'}>
                    <td className="sticky left-0 z-10 bg-inherit px-4 py-3 align-top font-semibold">
                      <label className="flex items-center gap-2">
                        {authenticated && <input type="checkbox" checked={completed} onChange={() => handleStatusChange(row)} />}
                        <span className={completed ? 'text-emerald-700' : 'text-amber-700'}>{completed ? 'Selesai' : 'Tindak lanjut'}</span>
                      </label>
                    </td>

                    {visibleHeaders.map((header, headerIndex) => {
                      const isFrozen = headerIndex < freezeColumnsCount;
                      const leftOffset = isFrozen ? 160 + headerIndex * 200 : 0;
                      return (
                        <td
                          key={`${rowKeyValue}-${header}`}
                          className="px-4 py-3 align-top text-slate-700"
                          style={{ maxWidth: '280px', overflowWrap: 'anywhere', ...(isFrozen ? { position: 'sticky', left: `${leftOffset}px`, zIndex: 5, backgroundColor: completed ? '#ecfdf5' : '#ffffff' } : {}) }}
                        >
                          {isLinkColumn(header) && row[header] ? (
                            <a href={row[header]} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 hover:bg-blue-100 hover:underline">
                              Buka link
                            </a>
                          ) : isMetadataColumn(header) ? (
                            <span className="inline-flex rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">{row[header] || '-'}</span>
                          ) : (
                            <span className="block leading-relaxed">{String(row[header] ?? '-')}</span>
                          )}
                        </td>
                      );
                    })}

                    <td className="whitespace-normal px-4 py-3 align-top text-xs text-slate-500" style={{ overflowWrap: 'anywhere' }}>
                      {row._sources?.join(', ')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {sortedRows.length === 0 && <div className="p-10 text-center text-slate-500">Tidak ada data sesuai filter.</div>}
        </div>
      </div>

      <p className="text-xs text-slate-500">Duplikat berdasarkan kolom referensi diabaikan. Jika salah satu versi sudah selesai, versi selesai dipertahankan; nilai berbeda pada kolom lain digabungkan.</p>
    </div>
  );
}

function ColumnFilterMenu({ header, options, selectedValues, open, onToggleOpen, onClose, onToggleValue, onClear }) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggleOpen}
        className={`rounded-lg border px-2 py-1 text-xs ${selectedValues.length ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-600/20 bg-white text-slate-300 hover:text-slate-600'}`}
        aria-label={`Filter ${header}`}
      >
        <Filter size={12} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Filter {header}</p>
            <button type="button" onClick={onClear} className="text-[11px] font-medium text-blue-600 hover:underline">
              Reset
            </button>
          </div>

          <div className="max-h-64 space-y-2 overflow-auto pr-1">
            {options.length === 0 ? (
              <p className="text-xs text-slate-400">Belum ada data pada kolom ini.</p>
            ) : (
              options.map((option) => (
                <label key={option} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                  <input type="checkbox" checked={selectedValues.includes(option)} onChange={() => onToggleValue(option)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  <span className="truncate text-sm text-slate-700">{option}</span>
                </label>
              ))
            )}
          </div>

          <button type="button" onClick={onClose} className="mt-3 w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700">
            Tutup
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value, color }) {
  const colors = { blue: 'bg-blue-50 text-blue-600', emerald: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600' };
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`rounded-xl p-3 ${colors[color]}`}>{icon}</div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}
