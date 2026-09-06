import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpDown, CheckCircle2, Filter, Layers3, Save, Search, Share2, SlidersHorizontal, Table2 } from 'lucide-react';
import api from '../api';
import { isAuthenticated } from '../auth';
import { findDefaultKey, isCompleted, mergeLkRows, normalizeHeader } from '../utils/lkMerge';

const EMPTY_FILTER_VALUE = '__EMPTY__';
const STANDARD_COLUMNS = ['Status Penyelesaian', 'Tanggal Selesai', 'Catatan'];

const handleShareLink = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    alert('Tautan halaman ini berhasil disalin ke clipboard!');
  } catch (err) {
    alert('Gagal menyalin tautan.', err);
  }
};

const hasStandardCounterpart = (headers, target) =>
  headers.some((header) => {
    const value = normalizeHeader(header);
    if (target === 'Status Penyelesaian') return value.includes('status') || value.includes('selesai') || value.includes('done') || value.includes('check');
    if (target === 'Tanggal Selesai') return value.includes('tanggal') || value.includes('date') || value.includes('waktu') || value.includes('selesai');
    return value.includes('catatan') || value.includes('note') || value.includes('komentar') || value.includes('keterangan') || value.includes('tindak_lanjut') || value.includes('action');
  });

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
  return [
    ...new Set(
      headers.filter((header) => {
        const sampleValues = rows
          .slice(0, 40)
          .map((row) => asText(row[header]).toLowerCase())
          .filter(Boolean);
        if (!sampleValues.length) return false;
        const booleanValues = sampleValues.filter((value) => value === 'true' || value === 'false');
        return booleanValues.length >= 1 && booleanValues.length / sampleValues.length >= 0.6;
      }),
    ),
  ];
};

const isDateValue = (value) => {
  const text = asText(value);
  if (!text || /^(true|false)$/i.test(text)) return false;
  if (!/[\d][\s/.-][\d]/.test(text)) return false;
  const normalized = text.replace(/[.]/g, '/').replace(/-/g, '/');
  const parts = normalized.split(/[\s/]+/).filter(Boolean);
  let parsed;
  if (parts.length >= 3 && parts.every((part) => /^\d+$/.test(part))) {
    const [first, second, third] = parts.map(Number);
    const year = first > 31 ? first : third;
    const month = first > 31 ? second : second;
    const day = first > 31 ? third : first;
    parsed = new Date(year, month - 1, day).getTime();
  } else {
    parsed = Date.parse(text);
  }
  return Number.isFinite(parsed);
};

const detectDateColumns = (headers, rows) => {
  return [
    ...new Set(
      headers.filter((header) => {
        const sampleValues = rows
          .slice(0, 40)
          .map((row) => row[header])
          .filter((value) => asText(value));
        if (!sampleValues.length) return false;
        const dateValues = sampleValues.filter(isDateValue);
        return dateValues.length >= 1 && dateValues.length / sampleValues.length >= 0.6;
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

const resolveSavedMappings = (sources, savedKeys, aliases) => {
  const hasSourceKeys = Object.keys(savedKeys || {}).some((key) => sources.some((source) => source.sourceKey === key));
  if (hasSourceKeys) return savedKeys;
  return Object.fromEntries(
    sources.map((source) => {
      const match = source.headers.find((header) => Object.values(aliases || {}).some((values) => (Array.isArray(values) ? values : [values]).some((value) => normalizeHeader(value) === normalizeHeader(header))));
      return [source.sourceKey, match || findDefaultKey(source.headers)];
    }),
  );
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
      rowIndexOffset: Number(sheet.rowIndexOffset ?? sheet.dataStartRow ?? worksheetPayload.rowIndexOffset ?? worksheetPayload.dataStartRow) || 0,
    };
  });
};

const getMergeGroupId = (record, recordsById) => {
  const visited = new Set();
  let current = record;
  while (current?.gabung_dengan_id) {
    const currentId = String(current.id || current.spreadsheet_id);
    if (visited.has(currentId)) break;
    visited.add(currentId);
    const target = recordsById.get(String(current.gabung_dengan_id));
    if (!target) break;
    current = target;
  }
  return String(current?.id || current?.spreadsheet_id || record.spreadsheet_id);
};

const getRecordFromResponse = (payload) => {
  const value = payload?.data ?? payload?.penyelesaian ?? payload;
  if (Array.isArray(value)) return value[0];
  return value && typeof value === 'object' ? value : null;
};

const recordMatchesReference = (record, reference) => String(record?.id) === String(reference) || String(record?.spreadsheet_id) === String(reference);

async function getPenyelesaianRecord(reference) {
  try {
    const response = await api.get(`/penyelesaian/${encodeURIComponent(reference)}`);
    const record = getRecordFromResponse(response.data);
    if (recordMatchesReference(record, reference)) return record;
  } catch {
    // Fallback below supports public URLs that contain spreadsheet_id.
  }

  const response = await api.get('/penyelesaian');
  const records = Array.isArray(response.data) ? response.data : response.data?.data || response.data?.penyelesaian || [];
  return records.find((record) => recordMatchesReference(record, reference)) || null;
}

async function getRelatedPenyelesaianRecords(primaryRecord) {
  const records = [];
  const visited = new Set();
  let current = primaryRecord;

  while (current) {
    const recordKey = String(current.id ?? current.spreadsheet_id);
    if (visited.has(recordKey)) break;
    visited.add(recordKey);
    records.push(current);

    if (!current.gabung_dengan_id) break;
    current = await getPenyelesaianRecord(current.gabung_dengan_id);
  }

  return records;
}

export default function PenyelesaianDetail() {
  const { surveiId, spreadsheetId } = useParams();
  const navigate = useNavigate();
  const authenticated = isAuthenticated();
  const [sources, setSources] = useState([]);
  const [sourceGroup, setSourceGroup] = useState('ALL');
  const [selectedKey, setSelectedKey] = useState('');
  const [keyMappings, setKeyMappings] = useState({});
  const [columnMappings, setColumnMappings] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedSheetKeys, setSelectedSheetKeys] = useState([]);
  const [columnFilters, setColumnFilters] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
  const [filterMenuOpen, setFilterMenuOpen] = useState(null);
  const [hiddenColumns, setHiddenColumns] = useState([]);
  const [hiddenColumnsOpen, setHiddenColumnsOpen] = useState(false);
  const [freezeColumnsCount, setFreezeColumnsCount] = useState(0);
  const [statusColumnChoice, setStatusColumnChoice] = useState('');
  const [dateColumnChoice, setDateColumnChoice] = useState('');
  const [noteColumnChoice, setNoteColumnChoice] = useState('');
  const [noteTemplates, setNoteTemplates] = useState(['sesuai lapangan', 'perbaikan']);
  const [noteModalRow, setNoteModalRow] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [mappingSaving, setMappingSaving] = useState(false);
  const [mappingMessage, setMappingMessage] = useState('');
  const [showFieldSettings, setShowFieldSettings] = useState(true);
  const [surveyName, setSurveyName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const tableViewportRef = useRef(null);
  const publicDetail = !authenticated && Boolean(spreadsheetId) && !surveiId;
  const canUpdateStatus = authenticated || publicDetail;

  const [mappingIds, setMappingIds] = useState([]);
  const [mappingId, setMappingId] = useState('');
  const mappingEndpoint = mappingId ? `/penyelesaian/${mappingId}/mapping` : '';
  const localMappingKey = `penyelesaian-column-mapping:${surveiId || spreadsheetId}`;

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
          const primaryRecord = await getPenyelesaianRecord(spreadsheetId);
          records = primaryRecord ? await getRelatedPenyelesaianRecords(primaryRecord) : [];

          if (!records.length) throw new Error('Data LK tidak ditemukan.');
        }

        const resolvedMappingIds = records
          .map((record) => record.id)
          .filter(Boolean)
          .map(String);
        const publicMappingId = publicDetail && !resolvedMappingIds.length ? String(spreadsheetId) : '';
        setMappingIds(resolvedMappingIds.length ? resolvedMappingIds : publicMappingId ? [publicMappingId] : []);
        setMappingId(resolvedMappingIds[0] || publicMappingId);

        const recordsById = new Map(records.filter((record) => record.id != null).map((record) => [String(record.id), record]));
        const loadedSources = await Promise.all(
          records.map(async (record, recordIndex) => {
            const groupId = `group-${getMergeGroupId(record, recordsById) || recordIndex}`;
            const sourceLabel = record.Nama || record.nama_lk || record.nama_file || record.file_name || `LK ${recordIndex + 1}`;
            let response = await api.get(`/sheets/data/${record.spreadsheet_id}`);
            let sheetItems = getSheetSources(response.data || {});
            const missingColumnsBySheet = sheetItems
              .map((sheet) => ({
                sheetName: sheet.sheetName,
                columns: STANDARD_COLUMNS.filter((column) => !hasStandardCounterpart(sheet.headers || [], column)),
              }))
              .filter((sheet) => sheet.columns.length > 0);
            if (authenticated && missingColumnsBySheet.length > 0) {
              try {
                await Promise.all(
                  missingColumnsBySheet.map(({ sheetName, columns }) =>
                    api.post('/sheets/inject-columns', {
                      spreadsheetId: record.spreadsheet_id,
                      spreadsheetUrl: record.link_spreadsheet_anomali,
                      sheetName,
                      columns,
                      onlyMissing: true,
                    }),
                  ),
                );
                response = await api.get(`/sheets/data/${record.spreadsheet_id}`);
                sheetItems = getSheetSources(response.data || {});
              } catch (columnError) {
                setMappingMessage(columnError.response?.data?.error || 'Kolom standar belum dapat ditambahkan otomatis.');
              }
            }
            const normalizedSheets = sheetItems.map((sheetItem, index) => ({
              id: record.id ?? `${record.spreadsheet_id}-${index}`,
              sourceKey: `${record.spreadsheet_id}::${sheetItem.sheetName || `Sheet${index + 1}`}`,
              spreadsheetId: record.spreadsheet_id,
              sheetName: sheetItem.sheetName || `Sheet${index + 1}`,
              label: sourceLabel,
              groupId,
              headers: sheetItem.headers || [],
              data: sheetItem.data || [],
              rowIndexOffset: sheetItem.rowIndexOffset || 0,
            }));

            return normalizedSheets;
          }),
        );

        const allSources = loadedSources.flat();
        setSources(allSources);
        setSourceGroup('ALL');
        if (surveiId && records[0]?.daftar_survei?.nama_survei) {
          setSurveyName(records[0].daftar_survei.nama_survei);
        } else if (surveiId) {
          try {
            const surveyResponse = await api.get(`/penyelesaian/survei/${surveiId}`);
            setSurveyName(surveyResponse.data?.nama_survei || '');
          } catch {
            setSurveyName('');
          }
        } else {
          setSurveyName('');
        }
        setSelectedSheetKeys(allSources.map((source) => source.sourceKey));
        const defaultKey = findDefaultKey([...new Set(allSources.flatMap((source) => source.headers))]);
        setSelectedKey(defaultKey);
        const defaults = Object.fromEntries(allSources.map((source) => [source.sourceKey, findDefaultKey(source.headers)]));
        const defaultColumnMappings = Object.fromEntries(allSources.map((source) => [source.sourceKey, Object.fromEntries(source.headers.map((header) => [header, header]))]));
        const recordMappingId = records[0]?.id ? String(records[0].id) : publicMappingId;
        const recordMappingEndpoint = recordMappingId ? `/penyelesaian/${recordMappingId}/mapping` : '';
        if (recordMappingEndpoint) {
          try {
            const mappingResponse = await api.get(recordMappingEndpoint);
            const storedMapping = mappingResponse.data?.column_mapping || mappingResponse.data?.mapping || {};
            const mappingMeta = storedMapping.__meta || mappingResponse.data?.mapping_meta || {};
            const savedKeys = mappingResponse.data?.key_mappings || storedMapping.__key_mappings || mappingResponse.data?.source_keys || {};
            const savedMapping = Object.fromEntries(Object.entries(storedMapping).filter(([key]) => key !== '__meta' && key !== '__key_mappings'));
            setKeyMappings({ ...defaults, ...resolveSavedMappings(allSources, savedKeys, savedMapping) });
            setColumnMappings(
              Object.fromEntries(
                allSources.map((source) => [
                  source.sourceKey,
                  typeof savedMapping[source.sourceKey] === 'object' ? { ...defaultColumnMappings[source.sourceKey], ...savedMapping[source.sourceKey] } : defaultColumnMappings[source.sourceKey],
                ]),
              ),
            );
            if (mappingResponse.data?.key_column || storedMapping.__key_column) setSelectedKey(mappingResponse.data?.key_column || storedMapping.__key_column);
            if (mappingMeta.status_column) setStatusColumnChoice(mappingMeta.status_column);
            if (mappingMeta.date_column) setDateColumnChoice(mappingMeta.date_column);
            if (mappingMeta.note_column) setNoteColumnChoice(mappingMeta.note_column);
            if (Array.isArray(mappingMeta.note_templates) && mappingMeta.note_templates.length) setNoteTemplates(mappingMeta.note_templates);
            if (Array.isArray(mappingMeta.hidden_columns)) setHiddenColumns(mappingMeta.hidden_columns);
            if (Array.isArray(mappingMeta.selected_sheet_keys)) {
              const availableKeys = new Set(allSources.map((source) => source.sourceKey));
              setSelectedSheetKeys(mappingMeta.selected_sheet_keys.filter((key) => availableKeys.has(key)));
            }
            if (mappingMeta.source_group) setSourceGroup(mappingMeta.source_group);
          } catch (mappingError) {
            if (mappingError.response?.status !== 404) setMappingMessage('Konfigurasi standar belum dapat dimuat.');
            setKeyMappings(defaults);
            try {
              const localMapping = JSON.parse(localStorage.getItem(localMappingKey) || 'null');
              if (localMapping) {
                const localMeta = localMapping.column_mapping?.__meta || localMapping.mapping_meta || localMapping;
                if (localMapping.key_column) setSelectedKey(localMapping.key_column);
                if (localMapping.key_mappings) setKeyMappings({ ...defaults, ...localMapping.key_mappings });
                if (localMapping.column_mapping) {
                  setColumnMappings(Object.fromEntries(allSources.map((source) => [source.sourceKey, { ...defaultColumnMappings[source.sourceKey], ...(localMapping.column_mapping[source.sourceKey] || {}) }])));
                }
                if (localMeta.status_column) setStatusColumnChoice(localMeta.status_column);
                if (localMeta.date_column) setDateColumnChoice(localMeta.date_column);
                if (localMeta.note_column) setNoteColumnChoice(localMeta.note_column);
                if (Array.isArray(localMeta.note_templates) && localMeta.note_templates.length) setNoteTemplates(localMeta.note_templates);
                if (Array.isArray(localMeta.hidden_columns)) setHiddenColumns(localMeta.hidden_columns);
                if (Array.isArray(localMeta.selected_sheet_keys)) {
                  const availableKeys = new Set(allSources.map((source) => source.sourceKey));
                  setSelectedSheetKeys(localMeta.selected_sheet_keys.filter((key) => availableKeys.has(key)));
                }
                if (localMeta.source_group) setSourceGroup(localMeta.source_group);
              }
            } catch {
              // Ignore malformed browser-only configuration.
            }
          }
        } else {
          setKeyMappings(defaults);
          setColumnMappings(defaultColumnMappings);
        }
      } catch (requestError) {
        setError(requestError.response?.data?.error || 'Gagal mengambil data LK.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [authenticated, localMappingKey, surveiId, spreadsheetId]);

  async function saveColumnMapping() {
    if (!mappingId) return;
    setMappingSaving(true);
    setMappingMessage('');
    const mappingMeta = {
      status_column: statusColumnChoice || effectiveStatusHeader,
      date_column: dateColumnChoice || effectiveDateHeader,
      note_column: noteColumnChoice,
      note_templates: noteTemplates,
      hidden_columns: hiddenColumns,
      selected_sheet_keys: selectedSheetKeys,
      source_group: sourceGroup,
    };
    try {
      const mappingPayload = {
        key_column: selectedKey,
        column_mapping: { ...columnMappings, __meta: mappingMeta, __key_mappings: keyMappings, __key_column: selectedKey },
      };
      await Promise.all((mappingIds.length ? mappingIds : [mappingId]).map((id) => api.put(`/penyelesaian/${id}/mapping`, mappingPayload)));
      localStorage.setItem(
        localMappingKey,
        JSON.stringify({
          key_column: selectedKey,
          key_mappings: keyMappings,
          column_mapping: { ...columnMappings, __meta: mappingMeta, __key_mappings: keyMappings, __key_column: selectedKey },
        }),
      );
      setMappingMessage('Konfigurasi standar berhasil disimpan.');
    } catch (requestError) {
      localStorage.setItem(
        localMappingKey,
        JSON.stringify({
          key_column: selectedKey,
          key_mappings: keyMappings,
          column_mapping: { ...columnMappings, __meta: mappingMeta, __key_mappings: keyMappings, __key_column: selectedKey },
        }),
      );
      setMappingMessage(requestError.response?.data?.error || 'Konfigurasi disimpan di browser karena server belum menyediakan penyimpanan detail.');
    } finally {
      setMappingSaving(false);
    }
  }

  const headers = useMemo(() => [...new Set(sources.flatMap((source) => source.headers.map((header) => columnMappings[source.sourceKey]?.[header] || header)))], [columnMappings, sources]);
  const sheetOptions = useMemo(() => sources.map((source) => ({ key: source.sourceKey, label: `${source.label} / ${source.sheetName}` })), [sources]);
  const activeSources = useMemo(() => {
    return sources.filter((source) => selectedSheetKeys.includes(source.sourceKey));
  }, [selectedSheetKeys, sources]);
  const mergeMappings = useMemo(() => ({ ...columnMappings, ...Object.fromEntries(Object.entries(keyMappings).map(([sourceKey, value]) => [`${sourceKey}::key`, value])) }), [columnMappings, keyMappings]);
  const merged = useMemo(() => mergeLkRows(activeSources, selectedKey, mergeMappings), [activeSources, mergeMappings, selectedKey]);
  const detectedStatusColumns = useMemo(() => detectStatusColumns(headers, merged.rows), [headers, merged.rows]);
  const detectedDateColumns = useMemo(() => detectDateColumns(headers, merged.rows), [headers, merged.rows]);
  const detectedNoteColumns = useMemo(() => detectNoteColumns(headers), [headers]);
  const effectiveStatusHeader = statusColumnChoice || merged.statusHeader || '';
  const effectiveDateHeader = dateColumnChoice || merged.dateHeader || '';
  const effectiveNoteHeader = noteColumnChoice || detectedNoteColumns[0] || '';
  const getRowCompletion = (row) => isCompleted(effectiveStatusHeader ? { ...row, 'Status Penyelesaian': row[effectiveStatusHeader] } : row);
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

  const handleSelectedKeyChange = (nextKey) => {
    setSelectedKey(nextKey);
    setKeyMappings((current) => {
      const nextMappings = { ...current };
      sources.forEach((source) => {
        const mappedHeader = source.headers.find((header) => (columnMappings[source.sourceKey]?.[header] || header) === nextKey);
        nextMappings[source.sourceKey] = mappedHeader || '';
      });
      return nextMappings;
    });
  };

  const handleStatusChange = async (row, noteValue) => {
    const nextCompleted = !getRowCompletion(row);
    const completionNote = nextCompleted ? noteValue : '';

    const sourceRows = row._sourceRows?.length
      ? row._sourceRows
      : [
          {
            sourceKey: sources.find((item) => item.spreadsheetId === (row._sourceSpreadsheetId ?? row._spreadsheetId))?.sourceKey,
            spreadsheetId: row._spreadsheetId,
            sheetName: row._sourceSheetName,
            dataIndex: row._sourceDataIndex ?? row._rowIndex,
            rowIndex: row._sourceRowIndex ?? row._sourceDataIndex ?? row._rowIndex,
            sheetRowNumber: row._sheetRowNumber ?? row._sourceRowIndex ?? row._sourceDataIndex ?? row._rowIndex,
          },
        ];
    const updates = sourceRows.map((sourceRow) => {
      const source = sources.find((item) => item.sourceKey === sourceRow.sourceKey) || sources.find((item) => item.spreadsheetId === sourceRow.spreadsheetId && item.sheetName === sourceRow.sheetName);
      const sourceOutputHeader = (header) => columnMappings[source?.sourceKey]?.[header] || header;
      const statusColumn = source?.headers.find((header) => sourceOutputHeader(header) === effectiveStatusHeader || normalizeHeader(header) === 'status_penyelesaian');
      const dateColumn = source?.headers.find((header) => sourceOutputHeader(header) === effectiveDateHeader || normalizeHeader(header) === 'tanggal_selesai');
      const noteColumn = source?.headers.find((header) => sourceOutputHeader(header) === effectiveNoteHeader || detectNoteColumns([header]).length > 0);
      return { source, sourceRow, statusColumn, dateColumn, noteColumn };
    });

    if (updates.some(({ source, sourceRow, statusColumn, dateColumn }) => !source || sourceRow.dataIndex === undefined || !statusColumn || !dateColumn)) {
      alert('Kolom status atau tanggal belum tersedia pada salah satu sumber data.');
      return;
    }

    if (nextCompleted && completionNote === undefined) {
      if (updates.some(({ noteColumn }) => !noteColumn)) {
        alert('Kolom catatan belum tersedia pada spreadsheet ini.');
        return;
      }
      setNoteDraft('');
      setNoteModalRow(row);
      return;
    }
    const nextStatusValue = nextCompleted ? 'SELESAI' : 'BELUM';
    const columnLetter = (index) => {
      let result = '';
      for (let value = index; value >= 0; value = Math.floor(value / 26) - 1) result = String.fromCharCode((value % 26) + 65) + result;
      return result;
    };

    const previousSources = sources;
    setSources((prevSources) =>
      prevSources.map((item) => {
        const sourceUpdates = updates.filter(({ source }) => source.spreadsheetId === item.spreadsheetId && source.sheetName === item.sheetName);
        if (!sourceUpdates.length) return item;

        const nextData = [...(item.data || [])];
        sourceUpdates.forEach(({ sourceRow, statusColumn, dateColumn, noteColumn }) => {
          const targetRow = nextData[sourceRow.dataIndex];
          if (!targetRow) return;
          nextData[sourceRow.dataIndex] = {
            ...targetRow,
            [statusColumn]: nextStatusValue,
            [dateColumn]: nextCompleted ? new Date().toISOString() : '',
            ...(noteColumn ? { [noteColumn]: completionNote } : {}),
          };
        });

        return { ...item, data: nextData };
      }),
    );

    try {
      await Promise.all(
        updates.map(({ source, sourceRow, statusColumn, dateColumn, noteColumn }) =>
          api.post('/sheets/update-row', {
            spreadsheetId: source.spreadsheetId,
            sheetName: source.sheetName,
            rowIndex: sourceRow.rowIndex,
            dataRowIndex: sourceRow.dataIndex,
            sheetRowNumber: sourceRow.sheetRowNumber,
            isChecked: nextCompleted,
            statusColLetter: columnLetter(source.headers.indexOf(statusColumn)),
            timestampColLetter: columnLetter(source.headers.indexOf(dateColumn)),
            noteColLetter: noteColumn ? columnLetter(source.headers.indexOf(noteColumn)) : undefined,
            noteValue: completionNote,
            note: completionNote,
            catatan: completionNote,
          }),
        ),
      );
    } catch (requestError) {
      setSources(previousSources);
      alert(requestError.response?.data?.error || 'Gagal menyimpan status penyelesaian.');
    }
  };

  const submitCompletionNote = async () => {
    if (!noteModalRow || !noteDraft.trim()) return;
    const row = noteModalRow;
    setNoteModalRow(null);
    await handleStatusChange(row, noteDraft.trim());
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
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">{sourceGroup === 'ALL' ? `Gabungan ${new Set(sources.map((source) => source.spreadsheetId)).size} LK` : 'LK terpisah'}</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Penyelesaian Anomali{surveyName ? ` · ${surveyName}` : ''}</h1>
          <p className="text-sm text-slate-500">Periksa dan tandai data yang sudah diselesaikan.</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {authenticated && (
            <button type="button" onClick={handleShareLink} className="flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition-colors" title="Salin tautan untuk dibagikan">
              <Share2 size={18} />
              Bagikan
            </button>
          )}
          {publicDetail && <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">Mode publik</span>}
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat icon={<Table2 />} label="Total data" value={stats.total} color="blue" />
        <Stat icon={<CheckCircle2 />} label="Selesai" value={stats.completed} color="emerald" />
        <Stat icon={<Layers3 />} label="Belum selesai" value={stats.pending} color="amber" />
      </section>

      {!publicDetail && (
        <section className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="min-w-56 flex-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Gabungkan berdasarkan kolom
            <select value={selectedKey} onChange={(event) => handleSelectedKeyChange(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal text-slate-800">
              <option value="">Pilih kolom...</option>
              {headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
          </label>

          {showAdvancedSettings && (
            <div className="min-w-64 flex-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Pencocokan kolom per LK / sheet
              <div className="mt-2 max-h-32 space-y-2 overflow-auto rounded-xl border border-slate-300 p-2">
                {activeSources.map((source) => (
                  <div key={source.sourceKey} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-xs font-normal text-slate-600" title={`${source.label} / ${source.sheetName}`}>
                      {source.label} / {source.sheetName}
                    </span>
                    <select
                      value={keyMappings[source.sourceKey] || ''}
                      onChange={(event) => setKeyMappings((current) => ({ ...current, [source.sourceKey]: event.target.value }))}
                      className="max-w-44 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-normal text-slate-800"
                    >
                      <option value="">Tidak dicocokkan</option>
                      {source.headers.map((header) => (
                        <option key={`${source.sourceKey}-${header}`} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="mt-3 max-h-72 space-y-2 overflow-auto rounded-xl border border-slate-300 p-2">
                <p className="px-1 text-[11px] font-semibold normal-case text-slate-500">Nama kolom hasil</p>
                {activeSources.map((source) => (
                  <div key={`${source.sourceKey}-columns`} className="space-y-1 rounded-lg bg-slate-50 p-2">
                    <p className="truncate text-[11px] font-semibold normal-case text-slate-600">
                      {source.label} / {source.sheetName}
                    </p>
                    {source.headers.map((header) => (
                      <label key={`${source.sourceKey}-${header}`} className="flex items-center gap-2 normal-case">
                        <span className="min-w-0 flex-1 truncate text-[11px] font-normal text-slate-600" title={header}>
                          {header}
                        </span>
                        <select
                          value={columnMappings[source.sourceKey]?.[header] || header}
                          onChange={(event) => setColumnMappings((current) => ({ ...current, [source.sourceKey]: { ...(current[source.sourceKey] || {}), [header]: event.target.value || header } }))}
                          className="max-w-44 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[11px] font-normal text-slate-800"
                        >
                          {headers.map((targetHeader) => (
                            <option key={`${source.sourceKey}-${header}-${targetHeader}`} value={targetHeader}>
                              {targetHeader}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
              {authenticated && (surveiId || spreadsheetId) && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={saveColumnMapping} disabled={mappingSaving} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                    <Save size={14} /> {mappingSaving ? 'Menyimpan...' : 'Simpan standar admin'}
                  </button>
                  {mappingMessage && <span className="text-xs font-normal text-slate-500">{mappingMessage}</span>}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <section className="sticky top-3 z-30 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-lg shadow-slate-200/40 backdrop-blur">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-3 text-slate-400" size={17} />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Cari data..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-800">
            <option value="ALL">Semua</option>
            <option value="SELESAI">Selesai</option>
            <option value="BELUM">Belum selesai</option>
          </select>
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setHiddenColumnsOpen((value) => !value)}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${hiddenColumns.length ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700'}`}
          >
            <SlidersHorizontal size={16} /> Kolom{hiddenColumns.length ? ` (${hiddenColumns.length} tersembunyi)` : ''}
          </button>
          {hiddenColumnsOpen && (
            <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Tampilkan kolom</p>
                <button type="button" onClick={() => setHiddenColumns([])} className="text-xs font-semibold text-blue-600">
                  Reset
                </button>
              </div>
              <div className="max-h-64 space-y-1 overflow-auto">
                {headers.map((header) => {
                  if (['status_penyelesaian', 'tanggal_selesai'].includes(normalizeHeader(header))) return null;
                  const checked = !hiddenColumns.includes(header);
                  return (
                    <label key={header} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      <input type="checkbox" checked={checked} onChange={() => handleToggleHiddenColumn(header)} className="h-4 w-4 accent-blue-600" />
                      <span className="truncate">{header}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        {!publicDetail && (
          <button
            type="button"
            onClick={() => setShowAdvancedSettings((value) => !value)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <SlidersHorizontal size={16} />
            {showAdvancedSettings ? 'Tutup pengaturan' : 'Pengaturan lanjutan'}
          </button>
        )}
        <span className="flex items-center gap-2 text-xs text-slate-500">
          <Filter size={15} /> {sortedRows.length} baris tampil
        </span>
      </section>

      {showAdvancedSettings && (detectedStatusColumns.length > 0 || detectedDateColumns.length > 0 || detectedNoteColumns.length > 0) && (
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

      {!publicDetail && sheetOptions.length > 1 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">Pilih sheet yang ditampilkan</p>
              <p className="text-xs text-slate-500">Sheet yang tidak dipilih tidak ikut digabung.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setSelectedSheetKeys(sheetOptions.map((sheet) => sheet.key))} className="text-xs font-semibold text-blue-600 hover:underline">
                Pilih semua
              </button>
              <button type="button" onClick={() => setSelectedSheetKeys([])} className="text-xs font-semibold text-slate-500 hover:underline">
                Kosongkan
              </button>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sheetOptions.map((sheet) => (
              <label key={sheet.key} className="flex min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={selectedSheetKeys.includes(sheet.key)}
                  onChange={() => setSelectedSheetKeys((current) => (current.includes(sheet.key) ? current.filter((key) => key !== sheet.key) : [...current, sheet.key]))}
                  className="h-4 w-4 accent-blue-600"
                />
                <span className="truncate" title={sheet.label}>
                  {sheet.label}
                </span>
              </label>
            ))}
          </div>
        </section>
      )}

      {noteModalRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-base font-bold text-slate-900">Catatan penyelesaian</h2>
            <p className="mt-1 text-sm text-slate-500">Isi catatan sebelum data ditandai selesai.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {noteTemplates.map((template) => (
                <button key={template} type="button" onClick={() => setNoteDraft(template)} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100">
                  {template}
                </button>
              ))}
            </div>
            <textarea
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="Contoh: sesuai lapangan, perbaikan..."
              rows={4}
              className="mt-3 w-full resize-y rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setNoteModalRow(null)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600">
                Batal
              </button>
              <button type="button" onClick={submitCompletionNote} disabled={!noteDraft.trim()} className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                Tandai selesai
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div ref={tableViewportRef} className="overflow-auto" style={{ maxHeight: '72vh' }}>
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
                const completed = getRowCompletion(row);
                const rowKeyValue = `${row._spreadsheetId ?? row[selectedKey] ?? 'row'}-${row._sourceRowIndex ?? index}`;
                return (
                  <tr key={rowKeyValue} className={completed ? 'bg-emerald-50/90' : 'hover:bg-blue-50/90'}>
                    <td className="sticky left-0 z-10 bg-inherit px-4 py-3 align-top font-semibold">
                      <label className="flex items-center gap-2">
                        {canUpdateStatus && <input type="checkbox" checked={completed} onChange={() => handleStatusChange(row)} />}
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
