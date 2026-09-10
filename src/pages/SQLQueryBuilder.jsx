import { useEffect, useMemo, useRef, useState } from 'react';
import { Braces, Check, ChevronDown, Clipboard, Code2, Download, FileJson, FilePlus2, GitBranch, GripVertical, Layers3, Pencil, Plus, RefreshCw, Search, SlidersHorizontal, Table2, Trash2, Upload, X } from 'lucide-react';
import api, { API_URL } from '../api';

const starterSchema = {
  version: 1,
  source: 'SQLab',
  tables: [
    {
      name: 'penduduk',
      columns: [
        { name: 'id_penduduk', type: 'INTEGER', nullable: false },
        { name: 'nama_lengkap', type: 'VARCHAR(120)', nullable: false },
        { name: 'jenis_kelamin', type: 'VARCHAR(1)', nullable: true },
        { name: 'umur', type: 'INTEGER', nullable: true },
        { name: 'status_pekerjaan', type: 'VARCHAR(30)', nullable: true },
      ],
    },
    {
      name: 'wilayah',
      columns: [
        { name: 'id_wilayah', type: 'INTEGER', nullable: false },
        { name: 'nama_kecamatan', type: 'VARCHAR(80)', nullable: false },
        { name: 'kabupaten', type: 'VARCHAR(80)', nullable: false },
      ],
    },
  ],
};

const operators = ['=', '<>', '>', '<', '>=', '<=', 'LIKE', 'IS NULL'];
const joinTypes = ['INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL OUTER JOIN'];
const aggregateFunctions = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'];
const expressionFunctions = ['COALESCE', 'NULLIF', 'CONCAT', 'LOWER', 'UPPER', 'DATE_TRUNC'];

function getTableAlias(index) {
  return index === 0 ? 'bt' : index === 1 ? 'rs' : `t${index + 1}`;
}

function getQualifiedColumn(value, alias) {
  return value?.includes('.') ? value : `${alias}.${value}`;
}

function makeCondition(column = 'umur') {
  return { id: crypto.randomUUID(), column, operator: '>=', value: '18', enabled: true };
}

function makeGroup(column) {
  return { id: crypto.randomUUID(), logic: 'AND', conditions: [makeCondition(column)] };
}

function makeExpression(column = 'umur') {
  return { id: crypto.randomUUID(), function: 'COALESCE', column, secondColumn: '', value: '', alias: 'nilai_bersih' };
}

function getStoredSchema() {
  try {
    const stored = JSON.parse(localStorage.getItem('sqlab-schema') || 'null');
    return Array.isArray(stored?.tables) && stored.tables.length ? stored : starterSchema;
  } catch {
    return starterSchema;
  }
}

function getSchemaPayload(item) {
  let payload = item;
  for (let attempt = 0; attempt < 4 && payload; attempt += 1) {
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        return null;
      }
    }
    if (Array.isArray(payload?.tables)) return payload;
    payload = payload?.skema_json || payload?.schema || payload?.struktur || payload?.json_schema || payload?.data || payload?.result;
  }
  return null;
}

async function normalizeSchema(item) {
  let payload = getSchemaPayload(item);
  if (!payload && item?.file_url) {
    const response = await fetch(item.file_url);
    if (!response.ok) throw new Error(`JSON skema gagal dimuat (${response.status}).`);
    payload = await response.json();
  }
  
  // Ambil nama dari payload, lalu item, atau beri nilai default
  const schemaName = item?.nama_skema || item?.name || payload?.name || item?.filename || 'Skema tanpa nama';
  
  return payload?.tables?.length
    ? {
        ...payload,
        id: item?.id ?? payload.id,
        id_survei: item?.id_survei ?? item?.survei_id ?? payload.id_survei,
        name: schemaName,
      }
    : null;
}

function getResponseRows(payload) {
  let current = payload;
  for (let attempt = 0; attempt < 4 && current; attempt += 1) {
    if (Array.isArray(current)) return current;
    if (Array.isArray(current.tables)) return [current];
    if (Array.isArray(current.data)) return current.data;
    if (Array.isArray(current.data?.tables)) return [current.data];
    if (Array.isArray(current.results)) return current.results;
    if (Array.isArray(current.skema)) return current.skema;
    current = current.data || current.result;
  }
  return [];
}

function getApiError(error) {
  const detail = error.response?.data?.error || error.response?.data?.message || error.message;
  return `${detail} (${API_URL}${error.response ? `, HTTP ${error.response.status}` : ''})`;
}

function SearchableSelect({ value, onChange, options, placeholder = 'Pilih...', className = '', disabled = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);
  const normalizedOptions = options.map((option) => (typeof option === 'string' ? { value: option, label: option } : option));
  const selected = normalizedOptions.find((option) => String(option.value) === String(value));
  const filteredOptions = normalizedOptions.filter((option) => String(option.label).toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  return (
    <div ref={containerRef} className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen((current) => !current);
          setQuery('');
        }}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-left text-xs font-normal text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      >
        <span className="min-w-0 truncate">{selected?.label || placeholder}</span>
        <ChevronDown size={13} className="shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-full min-w-48 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari pilihan..."
              className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-8 pr-2 text-xs outline-none focus:border-cyan-400"
            />
          </div>
          <div className="mt-1 max-h-52 overflow-auto">
            {filteredOptions.length ? (
              filteredOptions.map((option) => (
                <button
                  key={String(option.value)}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`block w-full rounded-md px-2 py-2 text-left text-xs hover:bg-cyan-50 ${String(option.value) === String(value) ? 'bg-cyan-50 font-semibold text-cyan-800' : 'text-slate-700'}`}
                >
                  {option.label}
                </button>
              ))
            ) : (
              <p className="px-2 py-3 text-xs text-slate-400">Tidak ditemukan</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SQLQueryBuilder() {
  const [schema, setSchema] = useState(getStoredSchema);
  const [schemas, setSchemas] = useState([]);
  const [surveys, setSurveys] = useState([]);
  const [selectedSchemaId, setSelectedSchemaId] = useState('local');
  const [selectedSurveyId, setSelectedSurveyId] = useState('');
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [schemaError, setSchemaError] = useState('');
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [editingSchemaId, setEditingSchemaId] = useState(null);
  const [schemaForm, setSchemaForm] = useState({ name: '', surveyId: '', json: '' });
  const [schemaFile, setSchemaFile] = useState(null);
  const [schemaSaving, setSchemaSaving] = useState(false);
  
  const [selectedTable, setSelectedTable] = useState(() => getStoredSchema().tables[0].name);
  const [selectedColumns, setSelectedColumns] = useState(['bt.id_penduduk', 'bt.nama_lengkap']);
  const [joins, setJoins] = useState([]);
  const [distinct, setDistinct] = useState(false);
  const [aggregate, setAggregate] = useState({ function: '', column: '' });
  const [groupBy, setGroupBy] = useState('');
  const [orderBy, setOrderBy] = useState('');
  const [orderDirection, setOrderDirection] = useState('ASC');
  const [limit, setLimit] = useState('');
  const [offset, setOffset] = useState('');
  const [search, setSearch] = useState('');
  const [expandedTables, setExpandedTables] = useState(() => ({ [getStoredSchema().tables[0].name]: true }));
  const [groups, setGroups] = useState([makeGroup()]);
  const [caseEnabled, setCaseEnabled] = useState(true);
  const [caseColumn, setCaseColumn] = useState('umur');
  const [expressions, setExpressions] = useState([]);
  const [copied, setCopied] = useState(false);
  const fileInput = useRef(null);

  useEffect(() => {
    let mounted = true;
    api
      .get('/survei')
      .then((surveyResult) => {
        if (!mounted) return;
        setSurveys(getResponseRows(surveyResult.data));
      })
      .catch((error) => mounted && setSchemaError(`Survei belum dapat dimuat: ${getApiError(error)}`))
      .finally(() => mounted && setSchemaLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const request = selectedSurveyId ? `/skema/by-survei/${encodeURIComponent(selectedSurveyId)}` : '/skema';
    api
      .get(request)
      .then(async (response) => {
        if (!mounted) return;
        const filteredSchemas = (await Promise.all(getResponseRows(response.data).map((item) => normalizeSchema(item).catch(() => null)))).filter(Boolean);
        setSchemas(filteredSchemas);
        if (selectedSurveyId && filteredSchemas[0]) applySchema(filteredSchemas[0], filteredSchemas[0].id);
      })
      .catch((error) => mounted && setSchemaError(`Skema belum dapat dimuat: ${getApiError(error)}`))
      .finally(() => mounted && setSchemaLoading(false));
    return () => {
      mounted = false;
    };
  }, [selectedSurveyId]);

  function applySchema(nextSchema, id = 'local') {
    const firstColumn = nextSchema.tables[0].columns[0]?.name || '';
    setSchema(nextSchema);
    setSelectedSchemaId(id);
    setSelectedTable(nextSchema.tables[0].name);
    setExpandedTables({ [nextSchema.tables[0].name]: true });
    setSelectedColumns(nextSchema.tables[0].columns.slice(0, 2).map((column) => `bt.${column.name}`));
    setJoins([]);
    setGroups([makeGroup(firstColumn)]);
    setCaseColumn(firstColumn);
    setAggregate({ function: '', column: '' });
    setExpressions([]);
  }

  function changeSurvey(value) {
    setSchemaLoading(true);
    setSchemaError('');
    setSelectedSurveyId(value);
  }

  function openSchemaModal(item = null) {
    setEditingSchemaId(item?.id || null);
    setSchemaFile(null);
    setSchemaForm({ 
      name: item?.name || item?.nama_skema || '', // Mengambil name atau nama_skema
      surveyId: item?.id_survei || item?.survei_id || selectedSurveyId || '', 
      json: JSON.stringify(item ? getSchemaPayload(item) : schema, null, 2) 
    });
    setIsSchemaModalOpen(true);
  }

  async function saveServerSchema(event) {
    event.preventDefault();
    let parsed;
    try {
      parsed = JSON.parse(schemaForm.json);
      if (!Array.isArray(parsed.tables) || !parsed.tables.length) throw new Error('JSON harus berisi array tables yang tidak kosong.');
    } catch (error) {
      window.alert(`JSON skema tidak valid: ${error.message}`);
      return;
    }
    setSchemaSaving(true);
    try {
      const formData = new FormData();
      const finalName = schemaForm.name.trim() || 'Skema tanpa nama'; // Gunakan default name yg sama dengan normalizer
      formData.append('nama_skema', finalName);
      formData.append('id_survei', schemaForm.surveyId);
      formData.append('skema_json', JSON.stringify(parsed));
      if (schemaFile) formData.append('file', schemaFile);
      
      const response = editingSchemaId ? await api.put(`/skema/${editingSchemaId}`, formData) : await api.post('/skema', formData);
      const saved = (await normalizeSchema(response.data?.data || response.data)) || { ...parsed, id: editingSchemaId, name: finalName };
      
      setSchemas((current) => (editingSchemaId ? current.map((item) => (item.id === editingSchemaId ? saved : item)) : [...current, saved]));
      setSelectedSurveyId(schemaForm.surveyId);
      applySchema(saved, saved.id || editingSchemaId || 'local');
      setIsSchemaModalOpen(false);
    } catch (error) {
      window.alert(`Gagal menyimpan skema: ${getApiError(error)}`);
    } finally {
      setSchemaSaving(false);
    }
  }

  async function deleteServerSchema(item) {
    if (!item.id || !window.confirm(`Hapus skema "${item.name}"?`)) return;
    try {
      await api.delete(`/skema/${item.id}`);
      setSchemas((current) => current.filter((entry) => entry.id !== item.id));
      if (selectedSchemaId === item.id) applySchema(starterSchema);
    } catch (error) {
      window.alert(`Gagal menghapus skema: ${getApiError(error)}`);
    }
  }

  const table = schema.tables.find((item) => item.name === selectedTable) || schema.tables[0];
  const joinedTableNames = joins.map((join) => join.table);
  const tableAliases = useMemo(() => {
    const orderedNames = [selectedTable, ...joinedTableNames, ...schema.tables.map((item) => item.name)];
    return Object.fromEntries([...new Set(orderedNames)].map((name, index) => [name, getTableAlias(index)]));
  }, [joinedTableNames, schema.tables, selectedTable]);
  
  // Semua tabel yg belum tergabung di join (bebas dari base table / root)
  const availableJoinTables = schema.tables.filter((item) => item.name !== selectedTable && !joinedTableNames.includes(item.name));
  
  // Mengumpulkan source table untuk autocomplete 
  const sourceTables = [selectedTable, ...joinedTableNames].map((name) => schema.tables.find((item) => item.name === name)).filter(Boolean);
  const sourceColumns = sourceTables.flatMap((source) => source.columns.map((column) => ({ ...column, table: source.name, alias: tableAliases[source.name], qualified: `${tableAliases[source.name]}.${column.name}` })));

  const sql = useMemo(() => {
    const selectFields = selectedColumns.length ? selectedColumns.map((column) => `  ${column}`) : ['  *'];
    if (aggregate.function && aggregate.column)
      selectFields.push(
        `  ${aggregate.function}(${aggregate.column === '*' ? '*' : getQualifiedColumn(aggregate.column, tableAliases[selectedTable])}) AS ${aggregate.function.toLowerCase()}_${aggregate.column === '*' ? 'rows' : aggregate.column.split('.').pop()}`,
      );
    const selectList = `${distinct ? 'DISTINCT\n' : ''}${selectFields.join(',\n')}`;
    const caseSql = caseEnabled ? `,\n  CASE\n    WHEN ${getQualifiedColumn(caseColumn, tableAliases[selectedTable])} >= 18 THEN 'Dewasa'\n    ELSE 'Belum dewasa'\n  END AS kelompok_umur` : '';
    const expressionSql = expressions
      .map((expression) => {
        const first = getQualifiedColumn(expression.column, tableAliases[selectedTable]);
        const second = expression.secondColumn ? `, ${getQualifiedColumn(expression.secondColumn, tableAliases[selectedTable])}` : expression.value ? `, '${expression.value.replaceAll("'", "''")}'` : '';
        const args = expression.function === 'DATE_TRUNC' ? `'month', ${first}` : `${first}${second}`;
        return `,\n  ${expression.function}(${args}) AS ${expression.alias || 'hasil'}`;
      })
      .join('');
    const activeGroups = groups.map((group) => ({ ...group, conditions: group.conditions.filter((condition) => condition.enabled) })).filter((group) => group.conditions.length);
    const whereSql = activeGroups
      .map(
        (group) =>
          `(${group.conditions.map((condition) => `${getQualifiedColumn(condition.column, tableAliases[selectedTable])} ${condition.operator}${condition.operator === 'IS NULL' ? '' : ` '${condition.value.replaceAll("'", "''")}'`}`).join(` ${group.logic} `)})`,
      )
      .join('\n  AND ');
    const joinSql = joins.map((join) => `\n${join.type} ${join.table} ${tableAliases[join.table]} ON ${tableAliases[join.leftTable]}.${join.left} = ${tableAliases[join.table]}.${join.right}`).join('');
    const groupSql = groupBy ? `\nGROUP BY ${getQualifiedColumn(groupBy, tableAliases[selectedTable])}` : '';
    const orderSql = orderBy ? `\nORDER BY ${getQualifiedColumn(orderBy, tableAliases[selectedTable])} ${orderDirection}` : '';
    const limitSql = limit ? `\nLIMIT ${limit}` : '';
    const offsetSql = offset ? `\nOFFSET ${offset}` : '';
    return `SELECT\n${selectList}${caseSql}${expressionSql}\nFROM ${selectedTable} ${tableAliases[selectedTable]}${joinSql}${whereSql ? `\nWHERE ${whereSql}` : ''}${groupSql}${orderSql}${limitSql}${offsetSql};`;
  }, [aggregate, caseColumn, caseEnabled, distinct, expressions, groupBy, groups, joins, limit, offset, orderBy, orderDirection, selectedColumns, selectedTable, tableAliases]);

  function toggleColumn(columnName) {
    const qualified = columnName.includes('.') ? columnName : `${tableAliases[selectedTable]}.${columnName}`;
    setSelectedColumns((current) => (current.includes(qualified) ? current.filter((column) => column !== qualified) : [...current, qualified]));
  }

  function reorderSelectedColumn(sourceColumn, targetColumn) {
    if (!sourceColumn || sourceColumn === targetColumn) return;
    setSelectedColumns((current) => {
      const sourceIndex = current.indexOf(sourceColumn);
      const targetIndex = current.indexOf(targetColumn);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      next.splice(sourceIndex, 1);
      next.splice(targetIndex - (sourceIndex < targetIndex ? 1 : 0), 0, sourceColumn);
      return next;
    });
  }

  function addDroppedColumn(event) {
    event.preventDefault();
    const columnName = event.dataTransfer.getData('column');
    const qualified = columnName.includes('.') ? columnName : `${tableAliases[selectedTable]}.${columnName}`;
    if (columnName && !selectedColumns.includes(qualified)) setSelectedColumns((current) => [...current, qualified]);
  }

  function updateCondition(groupId, conditionId, key, value) {
    setGroups((current) => current.map((group) => (group.id === groupId ? { ...group, conditions: group.conditions.map((condition) => (condition.id === conditionId ? { ...condition, [key]: value } : condition)) } : group)));
  }

  function addJoin() {
    const joinTable = availableJoinTables[0];
    if (!joinTable) return;
    setJoins((current) => [...current, { id: crypto.randomUUID(), type: 'LEFT JOIN', leftTable: selectedTable, table: joinTable.name, left: table.columns[0].name, right: joinTable.columns[0].name }]);
  }

  function updateJoin(joinId, key, value) {
    setJoins((current) => current.map((join) => (join.id === joinId ? { ...join, [key]: value } : join)));
  }

  function updateExpression(expressionId, key, value) {
    setExpressions((current) => current.map((expression) => (expression.id === expressionId ? { ...expression, [key]: value } : expression)));
  }

  function removeCondition(groupId, conditionId) {
    setGroups((current) =>
      current.map((group) => {
        if (group.id !== groupId || group.conditions.length === 1) return group;
        return { ...group, conditions: group.conditions.filter((condition) => condition.id !== conditionId) };
      }),
    );
  }

  // Set tabel utama baru dengan manual (tombol Set Utama)
  function setBaseTable(tableName) {
    if (tableName === selectedTable) return;
    setSelectedTable(tableName);
    setSelectedColumns([]); // Kosongkan yang dipilih sebelumnya
    setJoins([]); // Reset Joins karena base table terganti
    setExpandedTables((current) => ({ ...current, [tableName]: true }));
  }

  function importSchema(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!Array.isArray(imported.tables) || !imported.tables.length) throw new Error('Format tabel tidak ditemukan');
        applySchema(imported);
        localStorage.setItem('sqlab-schema', JSON.stringify(imported));
      } catch (error) {
        window.alert(`Gagal membaca skema: ${error.message}`);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  function downloadSchema() {
    const blob = new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'sqlab-schema.json';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function copySql() {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="max-w-370 mx-auto pb-10">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-cyan-600">
            <Code2 size={15} /> Query studio
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Susun query tanpa menghafal SQL</h1>
          <p className="mt-1 text-slate-500">Pilih tabel, tarik kolom, lalu rangkai kondisi yang Anda perlukan.</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileInput} type="file" accept=".json,application/json" className="hidden" onChange={importSchema} />
          <button type="button" onClick={() => openSchemaModal()} className="flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-700">
            <FilePlus2 size={16} /> Skema baru
          </button>
          <button type="button" onClick={() => fileInput.current?.click()} className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-cyan-400">
            <Upload size={16} /> Import JSON
          </button>
          <button type="button" onClick={downloadSchema} className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-cyan-400">
            <Download size={16} /> Export skema
          </button>
        </div>
      </header>

      <section className="mb-5 rounded-2xl border border-cyan-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_auto] lg:items-end">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Skema aktif
            <SearchableSelect
              value={selectedSchemaId}
              onChange={(value) => {
                const item = schemas.find((entry) => String(entry.id) === String(value));
                if (item) applySchema(item, item.id);
              }}
              options={[{ value: 'local', label: 'Skema lokal / starter' }, ...schemas.map((item) => ({ value: item.id, label: item.name }))]}
              className="mt-1"
            />
          </label>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Survei tujuan
            <SearchableSelect value={selectedSurveyId} onChange={changeSurvey} options={[{ value: '', label: 'Tanpa survei' }, ...surveys.map((survey) => ({ value: survey.id, label: survey.nama_survei }))]} className="mt-1" />
          </label>
          <div className="flex gap-2">
            {selectedSchemaId !== 'local' && (
              <>
                <button
                  type="button"
                  onClick={() => openSchemaModal(schemas.find((item) => item.id === selectedSchemaId))}
                  title="Edit skema"
                  className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:border-cyan-400 hover:text-cyan-700"
                >
                  <Pencil size={17} />
                </button>
                <button type="button" onClick={() => deleteServerSchema(schemas.find((item) => item.id === selectedSchemaId))} title="Hapus skema" className="rounded-lg border border-slate-200 p-2 text-rose-600 hover:border-rose-300">
                  <Trash2 size={17} />
                </button>
              </>
            )}
            <button type="button" onClick={() => window.location.reload()} title="Muat ulang skema" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:border-cyan-400">
              <RefreshCw size={17} />
            </button>
          </div>
        </div>
        {schemaLoading && <p className="mt-2 text-xs text-slate-400">Memuat skema dan survei...</p>}
        {schemaError && <p className="mt-2 text-xs text-amber-700">{schemaError}</p>}
      </section>

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(420px,1fr)_390px]">
        <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col max-h-[85vh]">
          <div className="border-b border-slate-100 p-4 shrink-0">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <Table2 size={18} className="text-cyan-600" /> Skema database
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {schema.tables.length} tabel dari {schema.source || 'file impor'}
            </p>
          </div>
          <div className="border-b border-slate-100 p-3 shrink-0">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari kolom..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-cyan-400"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto p-3 relative bg-slate-50/30">
            {schema.tables.map((item) => {
              const isBaseTable = selectedTable === item.name;
              
              return (
                <div key={item.name} className="mb-4 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                  {/* Sticky header untuk nama tabel */}
                  <div className={`sticky top-0 z-10 flex w-full items-center justify-between border-b px-2 py-2 text-left text-sm font-bold bg-white
                    ${isBaseTable ? 'border-cyan-200 bg-cyan-50/50' : 'border-slate-100'}`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedTables((current) => ({ ...current, [item.name]: !current[item.name] }));
                      }}
                      className={`flex flex-1 items-center gap-2 outline-none ${isBaseTable ? 'text-cyan-800' : 'text-slate-700'}`}
                    >
                      <ChevronDown size={14} className={`transition-transform text-slate-400 ${expandedTables[item.name] ? '' : '-rotate-90'}`} />
                      {item.name}
                    </button>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-normal text-slate-400 mr-1">{item.columns.length}</span>
                      {!isBaseTable && (
                        <button 
                          onClick={() => setBaseTable(item.name)}
                          title="Jadikan tabel utama (FROM)"
                          className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-cyan-600 bg-slate-100 hover:bg-cyan-100 px-1.5 py-0.5 rounded"
                        >
                          Set Utama
                        </button>
                      )}
                      {isBaseTable && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-600 bg-cyan-100 px-1.5 py-0.5 rounded">Utama</span>
                      )}
                    </div>
                  </div>
                  
                  {expandedTables[item.name] && (
                    <div className="space-y-1 p-2 bg-white">
                      {item.columns
                        .filter((column) => column.name.toLowerCase().includes(search.toLowerCase()))
                        .map((column) => (
                          <button
                            type="button"
                            draggable
                            onDragStart={(event) => event.dataTransfer.setData('column', `${tableAliases[item.name]}.${column.name}`)}
                            onClick={() => toggleColumn(`${tableAliases[item.name]}.${column.name}`)}
                            key={column.name}
                            className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs ${selectedColumns.includes(`${tableAliases[item.name]}.${column.name}`) ? 'bg-slate-100 text-slate-900 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                          >
                            <GripVertical size={13} className="text-slate-300" /> <span className="min-w-0 flex-1 truncate">{column.name}</span>
                            <span className="text-[10px] text-slate-400">{column.type}</span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="border-t border-slate-100 p-4 text-xs leading-relaxed text-slate-500 shrink-0">
            <FileJson size={15} className="mb-1 text-cyan-600" />
            Klik Set Utama untuk mengganti tabel dasar (FROM). Buka-tutup akordeon tidak me-reset tabel.
          </div>
        </aside>

        <section className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">01 / Kolom hasil</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">Apa yang ingin ditampilkan?</h2>
                <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">Klik kolom untuk memilihnya. Kolom terpilih akan masuk ke bagian SELECT pada SQL.</p>
              </div>
              <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700">{selectedColumns.length} dipilih</span>
            </div>
            <div onDragOver={(event) => event.preventDefault()} onDrop={addDroppedColumn} className="min-h-36.25 rounded-xl border-2 border-dashed border-cyan-200 bg-cyan-50/40 p-3">
              {selectedColumns.length ? (
                <div className="flex flex-wrap gap-2">
                  {selectedColumns.map((column) => (
                    <div
                      key={column}
                      draggable
                      onDragStart={(event) => event.dataTransfer.setData('selected-column', column)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        reorderSelectedColumn(event.dataTransfer.getData('selected-column'), column);
                      }}
                      className="flex cursor-grab items-center gap-2 rounded-lg border border-cyan-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm active:cursor-grabbing"
                    >
                      <GripVertical size={14} className="text-cyan-500" />
                      <span className="min-w-0 flex-1 truncate">{column}</span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleColumn(column);
                        }}
                        aria-label={`Hapus ${column}`}
                        className="text-slate-400 hover:text-rose-500"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-28 items-center justify-center text-sm text-cyan-700">Tarik kolom ke area ini</div>
              )}
              <p className="mt-6 text-center text-xs text-slate-400">atau klik nama kolom pada skema</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">01b / Relasi tabel</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">Gabungkan tabel dengan mudah</h2>
                <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">JOIN mengambil data terkait dari tabel lain. Pilih pasangan kolom yang menjadi penghubungnya.</p>
              </div>
              <button
                type="button"
                onClick={addJoin}
                disabled={!availableJoinTables.length}
                className="flex items-center gap-1 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus size={14} /> Tambah JOIN
              </button>
            </div>
            {joins.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                <GitBranch size={18} className="text-cyan-600" /> Belum ada relasi. Tambahkan JOIN untuk menggabungkan data dari tabel lain.
              </div>
            ) : (
              <div className="space-y-3">
                {joins.map((join) => {
                  const joinTable = schema.tables.find((item) => item.name === join.table) || availableJoinTables[0];
                  return (
                    <div key={join.id} className="grid min-w-0 gap-2 rounded-xl border border-cyan-100 bg-cyan-50/40 p-3 sm:grid-cols-[minmax(110px,0.8fr)_32px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_28px] sm:items-center">
                      <SearchableSelect value={join.type} onChange={(value) => updateJoin(join.id, 'type', value)} options={joinTypes} placeholder="Tipe JOIN" className="text-xs font-semibold" />
                      <span className="hidden text-center text-xs font-bold text-slate-400 sm:block">ON</span>
                      <SearchableSelect
                        value={`${join.leftTable}.${join.left}`}
                        onChange={(value) => {
                          const [leftTable, ...columnParts] = value.split('.');
                          setJoins((current) => current.map((item) => (item.id === join.id ? { ...item, leftTable, left: columnParts.join('.') } : item)));
                        }}
                        options={[{ value: '', label: 'Kolom kiri' }, ...sourceColumns.map((column) => ({ value: column.qualified, label: column.qualified }))]}
                        placeholder="Kolom kiri"
                      />
                      <SearchableSelect
                        value={join.table}
                        onChange={(value) => {
                          const nextTable = schema.tables.find((item) => item.name === value);
                          if (!nextTable) return;
                          setJoins((current) => current.map((item) => (item.id === join.id ? { ...item, table: nextTable.name, right: nextTable.columns[0].name } : item)));
                        }}
                        options={[
                          { value: '', label: 'Tabel tujuan' },
                          ...schema.tables
                            .filter((item) => item.name !== selectedTable && (item.name === join.table || !joinedTableNames.includes(item.name)))
                            .map((item) => ({ value: item.name, label: `${tableAliases[item.name] || 'tj'} (${item.name})` })),
                        ]}
                        placeholder="Tabel tujuan"
                      />
                      <SearchableSelect
                        value={join.right}
                        onChange={(value) => updateJoin(join.id, 'right', value)}
                        options={[{ value: '', label: `Kolom kanan (${tableAliases[join.table] || 'tj'})` }, ...joinTable.columns.map((column) => ({ value: column.name, label: `${tableAliases[join.table] || 'tj'}.${column.name}` }))]}
                        placeholder={`Kolom kanan (${tableAliases[join.table] || 'tj'})`}
                      />
                      <button type="button" onClick={() => setJoins((current) => current.filter((item) => item.id !== join.id))} className="flex items-center justify-center text-slate-400 hover:text-rose-500" aria-label="Hapus JOIN">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">02 / Kondisi</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">Saring data bertingkat</h2>
                <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">WHERE menyaring baris. Tambahkan beberapa kondisi untuk membuat aturan pencarian yang lebih spesifik.</p>
              </div>
              <button type="button" onClick={() => setGroups((current) => [...current, makeGroup()])} className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-700">
                <Plus size={14} /> Grup kondisi
              </button>
            </div>
            <div className="space-y-3">
              {groups.map((group, groupIndex) => (
                <div key={group.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">Grup {groupIndex + 1}</span>
                    <SearchableSelect
                      value={group.logic}
                      onChange={(value) => setGroups((current) => current.map((item) => (item.id === group.id ? { ...item, logic: value } : item)))}
                      options={['AND', 'OR']}
                      className="w-auto text-xs font-bold"
                    />
                  </div>
                  {group.conditions.map((condition) => (
                    <div key={condition.id} className="mb-2 grid min-w-0 grid-cols-1 gap-2 last:mb-0 sm:grid-cols-[minmax(0,1fr)_100px_minmax(0,1fr)_32px]">
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 sm:col-span-4">
                        <input type="checkbox" checked={condition.enabled} onChange={(event) => updateCondition(group.id, condition.id, 'enabled', event.target.checked)} className="h-4 w-4 accent-cyan-600" />
                        Gunakan kondisi ini
                      </label>
                      <SearchableSelect
                        value={condition.column}
                        onChange={(value) => updateCondition(group.id, condition.id, 'column', value)}
                        options={[{ value: '', label: 'Pilih kolom' }, ...sourceColumns.map((column) => column.name)]}
                        placeholder="Pilih kolom"
                      />
                      <SearchableSelect value={condition.operator} onChange={(value) => updateCondition(group.id, condition.id, 'operator', value)} options={operators} placeholder="Operator" />
                      <input
                        disabled={condition.operator === 'IS NULL'}
                        value={condition.value}
                        onChange={(event) => updateCondition(group.id, condition.id, 'value', event.target.value)}
                        placeholder="Nilai"
                        className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs disabled:bg-slate-100"
                      />
                      <button type="button" onClick={() => removeCondition(group.id, condition.id)} className="flex items-center justify-center text-slate-400 hover:text-rose-500" aria-label="Hapus kondisi">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setGroups((current) => current.map((item) => (item.id === group.id ? { ...item, conditions: [...item.conditions, makeCondition(table.columns[0].name)] } : item)))}
                    className="mt-2 flex items-center gap-1 text-xs font-bold text-cyan-700"
                  >
                    <Plus size={13} /> Tambah kondisi
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3">
                <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
                  <Braces size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-700">03 / Logika lanjutan</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">Buat kategori dengan CASE</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-600">CASE membuat label yang mudah dibaca dari aturan sederhana, misalnya umur menjadi Dewasa atau Belum dewasa.</p>
                </div>
              </div>
              <button type="button" onClick={() => setCaseEnabled((current) => !current)} className={`relative h-6 w-11 rounded-full transition ${caseEnabled ? 'bg-amber-500' : 'bg-slate-300'}`} aria-label="Aktifkan CASE">
                <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${caseEnabled ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            {caseEnabled && (
              <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-white p-3 text-xs">
                <span className="font-semibold text-slate-500">Jika</span>
                <SearchableSelect value={caseColumn} onChange={setCaseColumn} options={sourceColumns.map((column) => ({ value: column.qualified, label: column.qualified }))} placeholder="Pilih kolom" className="w-auto" />
                <span className="text-slate-500">
                  ≥ 18 maka <b>Dewasa</b>, selain itu <b>Belum dewasa</b>
                </span>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-cyan-200 bg-cyan-50/50 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-cyan-700">03b / Ekspresi hasil</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">Gabungkan dan rapikan nilai</h2>
                <p className="mt-1 max-w-xl text-xs leading-5 text-slate-600">Fungsi seperti COALESCE atau LOWER mengolah nilai sebelum ditampilkan. Nama hasil membantu membaca kolom baru.</p>
              </div>
              <button
                type="button"
                onClick={() => setExpressions((current) => [...current, makeExpression(sourceColumns[0]?.qualified || table.columns[0]?.name)])}
                className="flex items-center gap-1 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-700"
              >
                <Plus size={14} /> Tambah ekspresi
              </button>
            </div>
            {expressions.length === 0 ? (
              <p className="rounded-lg border border-dashed border-cyan-200 bg-white p-3 text-xs text-slate-500">Contoh: `COALESCE(bt.nama, rs.nama)` memakai nilai pertama yang tidak kosong.</p>
            ) : (
              <div className="space-y-3">
                {expressions.map((expression) => (
                  <div key={expression.id} className="grid min-w-0 gap-2 rounded-xl border border-cyan-100 bg-white p-3 sm:grid-cols-[125px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_28px] sm:items-center">
                    <SearchableSelect value={expression.function} onChange={(value) => updateExpression(expression.id, 'function', value)} options={expressionFunctions} placeholder="Fungsi" className="text-xs font-semibold" />
                    <SearchableSelect
                      value={expression.column}
                      onChange={(value) => updateExpression(expression.id, 'column', value)}
                      options={sourceColumns.map((column) => ({ value: column.qualified, label: column.qualified }))}
                      placeholder="Kolom"
                    />
                    <SearchableSelect
                      value={expression.secondColumn}
                      onChange={(value) => updateExpression(expression.id, 'secondColumn', value)}
                      disabled={['LOWER', 'UPPER', 'DATE_TRUNC'].includes(expression.function)}
                      options={[{ value: '', label: 'Nilai fallback / kolom kedua' }, ...sourceColumns.map((column) => ({ value: column.qualified, label: column.qualified }))]}
                      placeholder="Nilai fallback / kolom kedua"
                    />
                    <input
                      value={expression.alias}
                      onChange={(event) => updateExpression(expression.id, 'alias', event.target.value.replace(/[^a-zA-Z0-9_]/g, '_'))}
                      placeholder="Nama hasil"
                      className="min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setExpressions((current) => current.filter((item) => item.id !== expression.id))}
                      className="flex items-center justify-center text-slate-400 hover:text-rose-500"
                      aria-label="Hapus ekspresi"
                    >
                      <Trash2 size={15} />
                    </button>
                    {expression.function === 'COALESCE' && !expression.secondColumn && (
                      <input
                        value={expression.value}
                        onChange={(event) => updateExpression(expression.id, 'value', event.target.value)}
                        placeholder="atau isi nilai fallback"
                        className="sm:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-xs"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                <SlidersHorizontal size={18} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">04 / Query lanjutan</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">Kontrol hasil dan ringkasan</h2>
                <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">Atur data unik, ringkasan, pengurutan, dan jumlah halaman hasil tanpa menulis klausa SQL.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={distinct} onChange={(event) => setDistinct(event.target.checked)} className="h-4 w-4 accent-cyan-600" /> Hanya data unik (DISTINCT)
              </label>
              <label className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-3 text-xs font-semibold text-slate-600">
                Agregasi
                <SearchableSelect
                  value={aggregate.function}
                  onChange={(value) => setAggregate((current) => ({ ...current, function: value }))}
                  options={[{ value: '', label: 'Tidak ada' }, ...aggregateFunctions.map((fn) => ({ value: fn, label: fn }))]}
                  placeholder="Fungsi agregat"
                  className="w-auto"
                />
                <SearchableSelect
                  value={aggregate.column}
                  onChange={(value) => setAggregate((current) => ({ ...current, column: value }))}
                  options={[{ value: '', label: 'Tidak ada' }, { value: '*', label: 'Semua baris (*)' }, ...sourceColumns.map((column) => ({ value: column.qualified, label: column.qualified }))]}
                  placeholder="Kolom agregat"
                  className="ml-auto max-w-40"
                  disabled={!aggregate.function}
                />
              </label>
              <label className="flex min-w-0 flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                Kelompokkan
                <SearchableSelect
                  value={groupBy}
                  onChange={setGroupBy}
                  options={[{ value: '', label: 'Tidak ada' }, ...sourceColumns.map((column) => ({ value: column.qualified, label: column.qualified }))]}
                  placeholder="Tidak ada"
                  className="ml-auto flex-1"
                />
              </label>
              <label className="flex min-w-0 flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                Urutkan
                <SearchableSelect
                  value={orderBy}
                  onChange={setOrderBy}
                  options={[{ value: '', label: 'Tidak ada' }, ...sourceColumns.map((column) => ({ value: column.qualified, label: column.qualified }))]}
                  placeholder="Tidak ada"
                  className="ml-auto flex-1"
                />
                <SearchableSelect value={orderDirection} onChange={setOrderDirection} options={['ASC', 'DESC']} placeholder="Arah" className="w-auto" />
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                Batas baris
                <input type="number" min="1" value={limit} onChange={(event) => setLimit(event.target.value)} placeholder="Semua" className="ml-auto w-28 rounded-lg border border-slate-200 px-3 py-2 font-normal" />
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                Mulai dari baris
                <input type="number" min="0" value={offset} onChange={(event) => setOffset(event.target.value)} placeholder="0" className="ml-auto w-28 rounded-lg border border-slate-200 px-3 py-2 font-normal" />
              </label>
            </div>
          </div>
        </section>

        <aside className="flex min-h-155 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#101827] shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4 shrink-0">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Layers3 size={17} className="text-cyan-400" /> Preview query
              </div>
              <p className="mt-1 text-xs text-slate-400">SQL dibuat otomatis</p>
            </div>
            <button type="button" onClick={copySql} className="flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold text-white hover:bg-slate-600">
              {copied ? <Check size={14} /> : <Clipboard size={14} />}
              {copied ? 'Tersalin' : 'Salin'}
            </button>
          </div>
          <pre className="flex-1 overflow-auto p-5 font-mono text-xs leading-6 text-cyan-100">
            <code>{sql}</code>
          </pre>
          <div className="border-t border-slate-700 bg-slate-900/60 px-5 py-4 text-xs text-slate-400 shrink-0">Query ini siap ditempel ke SQLab atau disimpan sebagai pemeriksaan baru.</div>
        </aside>
      </div>
      
      {isSchemaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4 shrink-0">
              <div>
                <h2 className="font-bold text-slate-900">{editingSchemaId ? 'Edit skema' : 'Upload skema baru'}</h2>
                <p className="text-xs text-slate-500">Tempel JSON struktur tabel, lalu simpan ke database.</p>
              </div>
              <button type="button" onClick={() => setIsSchemaModalOpen(false)} className="text-slate-400 hover:text-slate-700" aria-label="Tutup">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={saveServerSchema} className="flex flex-col min-h-0 overflow-hidden flex-1">
              <div className="overflow-y-auto p-5 space-y-4 flex-1">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Nama skema
                    <input
                      required
                      value={schemaForm.name}
                      onChange={(event) => setSchemaForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Contoh: Skema Penduduk 2026"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-normal outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Survei
                    <SearchableSelect
                      required
                      value={schemaForm.surveyId}
                      onChange={(value) => setSchemaForm((current) => ({ ...current, surveyId: value }))}
                      options={[{ value: '', label: 'Pilih survei' }, ...surveys.map((survey) => ({ value: survey.id, label: survey.nama_survei }))]}
                      placeholder="Pilih survei"
                      className="mt-1 w-full font-normal"
                    />
                  </label>
                </div>
                <label className="block text-sm font-semibold text-slate-700">
                  File JSON (opsional)
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      setSchemaFile(file || null);
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => setSchemaForm((current) => ({ ...current, name: current.name || file.name.replace(/\.json$/i, ''), json: String(reader.result) }));
                      reader.readAsText(file);
                    }}
                    className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-normal text-slate-600"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700 h-full flex flex-col min-h-[250px]">
                  JSON skema
                  <textarea
                    required
                    value={schemaForm.json}
                    onChange={(event) => setSchemaForm((current) => ({ ...current, json: event.target.value }))}
                    className="mt-1 w-full flex-1 rounded-lg border border-slate-200 bg-slate-950 p-3 font-mono text-xs leading-5 text-cyan-100 outline-none focus:border-cyan-400 min-h-[150px] resize-none"
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 p-4 shrink-0 bg-white">
                <button type="button" onClick={() => setIsSchemaModalOpen(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                  Batal
                </button>
                <button type="submit" disabled={schemaSaving} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50">
                  {schemaSaving ? 'Menyimpan...' : 'Simpan ke database'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}