import { useEffect, useMemo, useRef, useState } from 'react';
import { Braces, Check, ChevronDown, Clipboard, Code2, Download, FileJson, FilePlus2, GitBranch, GripVertical, Layers3, Pencil, Plus, RefreshCw, Search, SlidersHorizontal, Table2, Trash2, Upload, X, Link } from 'lucide-react';
import api, { API_URL } from '../api';

const starterSchema = {
  version: 1,
  source: 'SQLab',
  tables: [
    {
      name: 'penduduk',
      columns: [
        { name: 'id_penduduk', type: 'INTEGER', nullable: false },
        { name: 'id_wilayah', type: 'INTEGER', nullable: false },
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
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 text-left text-[13px] font-medium text-slate-700 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50/30 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 disabled:shadow-none"
      >
        <span className="min-w-0 truncate">{selected?.label || placeholder}</span>
        <ChevronDown size={14} className="shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-full min-w-56 overflow-hidden rounded-xl border border-slate-200/80 bg-white p-1.5 shadow-xl shadow-slate-900/10 backdrop-blur-sm">
          <div className="relative mb-1">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari pilihan..."
              className="w-full rounded-lg bg-slate-50 py-2 pl-9 pr-3 text-[13px] text-slate-700 outline-none transition focus:bg-cyan-50/50"
            />
          </div>
          <div className="max-h-56 overflow-y-auto overflow-x-hidden">
            {filteredOptions.length ? (
              filteredOptions.map((option) => (
                <button
                  key={String(option.value)}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-[13px] transition ${String(option.value) === String(value) ? 'bg-cyan-50 font-bold text-cyan-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                >
                  {option.label}
                </button>
              ))
            ) : (
              <p className="px-3 py-4 text-center text-[13px] text-slate-400">Tidak ditemukan</p>
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
  
  // STRUKTUR BARU UNTUK ALIAS: array of objects { qualified, alias }
  const [selectedColumns, setSelectedColumns] = useState(() => 
    getStoredSchema().tables[0].columns.slice(0, 2).map((column) => ({
      qualified: `bt.${column.name}`,
      alias: ''
    }))
  );
  
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
    setSelectedColumns(nextSchema.tables[0].columns.slice(0, 2).map((column) => ({
      qualified: `bt.${column.name}`,
      alias: ''
    })));
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
      name: item?.name || item?.nama_skema || '',
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
      const finalName = schemaForm.name.trim() || 'Skema tanpa nama';
      
      formData.append('name', finalName); 
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
  
  const availableJoinTables = schema.tables.filter((item) => item.name !== selectedTable && !joinedTableNames.includes(item.name));
  const sourceTables = [selectedTable, ...joinedTableNames].map((name) => schema.tables.find((item) => item.name === name)).filter(Boolean);
  const sourceColumns = sourceTables.flatMap((source) => source.columns.map((column) => ({ ...column, table: source.name, alias: tableAliases[source.name], qualified: `${tableAliases[source.name]}.${column.name}` })));

  const sql = useMemo(() => {
    // GENERASI SQL: Terapkan Alias 'AS' jika diisi
    const selectFields = selectedColumns.length 
      ? selectedColumns.map((col) => col.alias ? `  ${col.qualified} AS ${col.alias}` : `  ${col.qualified}`) 
      : ['  *'];
      
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

  function findMatchingColumns(targetTableName) {
    const targetTable = schema.tables.find(t => t.name === targetTableName);
    if (!targetTable) return null;
    for (const tCol of targetTable.columns) {
      for (const sTable of sourceTables) {
        const match = sTable.columns.find(sc => sc.name === tCol.name);
        if (match) return { leftTable: sTable.name, leftCol: match.name, rightCol: tCol.name };
      }
    }
    return null;
  }

  function handleColumnAdd(qualifiedColumn) {
    const [alias] = qualifiedColumn.split('.');
    const sourceTableName = Object.keys(tableAliases).find(key => tableAliases[key] === alias);

    // Auto Join Logic
    if (sourceTableName && sourceTableName !== selectedTable && !joins.some(j => j.table === sourceTableName)) {
       const match = findMatchingColumns(sourceTableName);
       const joinTableObj = schema.tables.find(t => t.name === sourceTableName);

       const leftTable = match ? match.leftTable : selectedTable;
       const leftCol = match ? match.leftCol : table.columns[0].name;
       const rightCol = match ? match.rightCol : (joinTableObj ? joinTableObj.columns[0].name : '');

       setJoins(current => [...current, { 
          id: crypto.randomUUID(), 
          type: 'LEFT JOIN', 
          leftTable, 
          table: sourceTableName, 
          left: leftCol, 
          right: rightCol 
       }]);
    }

    // Insert column as object
    setSelectedColumns(current => {
       if (current.some(c => c.qualified === qualifiedColumn)) return current;
       return [...current, { qualified: qualifiedColumn, alias: '' }];
    });
  }

  function toggleColumn(columnName) {
    const qualified = columnName.includes('.') ? columnName : `${tableAliases[selectedTable]}.${columnName}`;
    if (selectedColumns.some((col) => col.qualified === qualified)) {
      setSelectedColumns((current) => current.filter((col) => col.qualified !== qualified));
    } else {
      handleColumnAdd(qualified);
    }
  }
  
  function updateColumnAlias(qualified, newAlias) {
    setSelectedColumns(current => 
      current.map(col => col.qualified === qualified ? { ...col, alias: newAlias.replace(/[^a-zA-Z0-9_]/g, '') } : col)
    );
  }

  function addDroppedColumn(event) {
    event.preventDefault();
    const columnName = event.dataTransfer.getData('column');
    if (!columnName) return;
    const qualified = columnName.includes('.') ? columnName : `${tableAliases[selectedTable]}.${columnName}`;
    handleColumnAdd(qualified);
  }

  function reorderSelectedColumn(sourceQualified, targetQualified) {
    if (!sourceQualified || sourceQualified === targetQualified) return;
    setSelectedColumns((current) => {
      const sourceIndex = current.findIndex(c => c.qualified === sourceQualified);
      const targetIndex = current.findIndex(c => c.qualified === targetQualified);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex - (sourceIndex < targetIndex ? 1 : 0), 0, moved);
      return next;
    });
  }

  function updateCondition(groupId, conditionId, key, value) {
    setGroups((current) => current.map((group) => (group.id === groupId ? { ...group, conditions: group.conditions.map((condition) => (condition.id === conditionId ? { ...condition, [key]: value } : condition)) } : group)));
  }

  function addJoin() {
    const joinTable = availableJoinTables[0];
    if (!joinTable) return;
    
    const match = findMatchingColumns(joinTable.name);
    const leftTable = match ? match.leftTable : selectedTable;
    const leftCol = match ? match.leftCol : table.columns[0].name;
    const rightCol = match ? match.rightCol : joinTable.columns[0].name;

    setJoins((current) => [...current, { id: crypto.randomUUID(), type: 'LEFT JOIN', leftTable, table: joinTable.name, left: leftCol, right: rightCol }]);
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

  function setBaseTable(tableName) {
    if (tableName === selectedTable) return;
    setSelectedTable(tableName);
    setSelectedColumns([]); 
    setJoins([]); 
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
    <div className="max-w-370 mx-auto pb-10 font-sans">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="mb-2.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-600">
            <Code2 size={16} /> Query studio
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Susun query tanpa menghafal SQL</h1>
          <p className="mt-1.5 text-[15px] text-slate-500">Pilih tabel, tarik kolom, lalu rangkai kondisi yang Anda perlukan secara visual.</p>
        </div>
        <div className="flex gap-2.5">
          <input ref={fileInput} type="file" accept=".json,application/json" className="hidden" onChange={importSchema} />
          <button type="button" onClick={() => openSchemaModal()} className="flex items-center gap-2.5 rounded-xl bg-cyan-600 px-4 py-2.5 text-[13px] font-bold text-white shadow-sm shadow-cyan-600/20 transition hover:bg-cyan-700 hover:shadow-cyan-600/40">
            <FilePlus2 size={16} /> Skema baru
          </button>
          <button type="button" onClick={() => fileInput.current?.click()} className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-bold text-slate-700 shadow-sm transition hover:border-cyan-300 hover:bg-slate-50">
            <Upload size={16} className="text-slate-500" /> Import JSON
          </button>
          <button type="button" onClick={downloadSchema} className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-bold text-slate-700 shadow-sm transition hover:border-cyan-300 hover:bg-slate-50">
            <Download size={16} className="text-slate-500" /> Export skema
          </button>
        </div>
      </header>

      <section className="mb-6 rounded-2xl border border-slate-200/80 bg-white/50 p-5 shadow-sm shadow-slate-200/50 backdrop-blur-md">
        <div className="grid gap-4 lg:grid-cols-[minmax(240px,1fr)_minmax(240px,1fr)_auto] lg:items-end">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Skema aktif saat ini
            <SearchableSelect
              value={selectedSchemaId}
              onChange={(value) => {
                const item = schemas.find((entry) => String(entry.id) === String(value));
                if (item) applySchema(item, item.id);
              }}
              options={[{ value: 'local', label: 'Skema lokal / starter' }, ...schemas.map((item) => ({ value: item.id, label: item.name }))]}
              className="mt-2"
            />
          </label>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Target Survei
            <SearchableSelect value={selectedSurveyId} onChange={changeSurvey} options={[{ value: '', label: 'Tanpa survei' }, ...surveys.map((survey) => ({ value: survey.id, label: survey.nama_survei }))]} className="mt-2" />
          </label>
          <div className="flex gap-2">
            {selectedSchemaId !== 'local' && (
              <>
                <button
                  type="button"
                  onClick={() => openSchemaModal(schemas.find((item) => item.id === selectedSchemaId))}
                  title="Edit skema"
                  className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm transition hover:border-cyan-300 hover:text-cyan-700"
                >
                  <Pencil size={18} />
                </button>
                <button type="button" onClick={() => deleteServerSchema(schemas.find((item) => item.id === selectedSchemaId))} title="Hapus skema" className="rounded-xl border border-slate-200 bg-white p-2.5 text-rose-500 shadow-sm transition hover:border-rose-300 hover:bg-rose-50">
                  <Trash2 size={18} />
                </button>
              </>
            )}
            <button type="button" onClick={() => window.location.reload()} title="Muat ulang skema" className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm transition hover:border-cyan-300 hover:text-cyan-700">
              <RefreshCw size={18} />
            </button>
          </div>
        </div>
        {schemaLoading && <p className="mt-3 flex items-center gap-2 text-[13px] text-cyan-700"><RefreshCw size={14} className="animate-spin" /> Memuat skema dan survei...</p>}
        {schemaError && <p className="mt-3 text-[13px] font-medium text-rose-600">{schemaError}</p>}
      </section>

      <div className="grid gap-6 xl:grid-cols-[290px_minmax(460px,1fr)_400px]">
        
        {/* PANEL KIRI (SKEMA) */}
        <aside className="flex max-h-[85vh] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50">
          <div className="shrink-0 border-b border-slate-100 p-5">
            <div className="flex items-center gap-2.5 font-bold text-slate-800">
              <div className="rounded-lg bg-cyan-100 p-1.5 text-cyan-600">
                <Table2 size={16} />
              </div>
              Skema database
            </div>
            <p className="mt-2 text-[13px] text-slate-500">
              {schema.tables.length} tabel dari {schema.source || 'file impor'}
            </p>
          </div>
          <div className="shrink-0 border-b border-slate-100 p-3 bg-slate-50/50">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-2.5 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama kolom..."
                className="w-full rounded-xl border border-slate-200/80 bg-white py-2 pl-10 pr-4 text-[13px] outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/10"
              />
            </div>
          </div>
          
          <div className="relative flex-1 overflow-y-auto bg-slate-50/30 p-3">
            {schema.tables.map((item) => {
              const isBaseTable = selectedTable === item.name;
              
              return (
                <div key={item.name} className={`mb-3 overflow-hidden rounded-xl border shadow-sm transition-colors ${isBaseTable ? 'border-cyan-200 shadow-cyan-100/50' : 'border-slate-200/70 shadow-slate-200/30'}`}>
                  {/* HEADER STICKY */}
                  <div className={`sticky top-0 z-20 flex w-full items-center justify-between border-b px-3 py-2.5 text-left text-[13px] font-bold backdrop-blur-md
                    ${isBaseTable ? 'border-cyan-200 bg-cyan-50/90 text-cyan-800' : 'border-slate-100 bg-white/95 text-slate-700'}`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedTables((current) => ({ ...current, [item.name]: !current[item.name] }));
                      }}
                      className="flex flex-1 items-center gap-2 outline-none"
                    >
                      <ChevronDown size={14} className={`transition-transform text-slate-400 ${expandedTables[item.name] ? '' : '-rotate-90'}`} />
                      {item.name}
                    </button>
                    
                    <div className="flex items-center gap-2">
                      <span className="mr-1 text-[11px] font-medium text-slate-400">{item.columns.length}</span>
                      {!isBaseTable && (
                        <button 
                          onClick={() => setBaseTable(item.name)}
                          title="Jadikan tabel utama (FROM)"
                          className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 transition hover:bg-cyan-100 hover:text-cyan-700"
                        >
                          Set Utama
                        </button>
                      )}
                      {isBaseTable && (
                        <span className="rounded bg-cyan-200/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-700">Utama</span>
                      )}
                    </div>
                  </div>
                  
                  {expandedTables[item.name] && (
                    <div className="space-y-0.5 bg-white p-2">
                      {item.columns
                        .filter((column) => column.name.toLowerCase().includes(search.toLowerCase()))
                        .map((column) => {
                           const qualifiedCol = `${tableAliases[item.name]}.${column.name}`;
                           const isSelected = selectedColumns.some(c => c.qualified === qualifiedCol);

                           return (
                            <button
                              type="button"
                              draggable
                              onDragStart={(event) => event.dataTransfer.setData('column', qualifiedCol)}
                              onClick={() => toggleColumn(qualifiedCol)}
                              key={column.name}
                              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors ${isSelected ? 'bg-slate-100 font-bold text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                              <GripVertical size={13} className={isSelected ? 'text-cyan-500' : 'text-slate-300'} /> 
                              <span className="min-w-0 flex-1 truncate">{column.name}</span>
                              <span className="text-[10px] text-slate-400">{column.type}</span>
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="shrink-0 border-t border-slate-100 bg-white p-4 text-[12px] leading-relaxed text-slate-500">
            <FileJson size={15} className="mb-1 text-cyan-600" />
            Klik Set Utama untuk mengganti tabel dasar (FROM). Buka-tutup akordeon tidak mereset sesi.
          </div>
        </aside>

        <section className="space-y-6">
          {/* 01 / KOLOM HASIL & ALIAS */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/50">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">01 / Kolom hasil</p>
                <h2 className="mt-1 text-lg font-extrabold text-slate-900">Apa yang ingin ditampilkan?</h2>
                <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-slate-500">Tarik nama kolom ke area ini. Anda juga bisa memberi nama Alias (AS) di setiap kolom.</p>
              </div>
              <span className="rounded-full bg-cyan-50 px-3 py-1 text-[12px] font-bold text-cyan-700 shadow-sm shadow-cyan-100">{selectedColumns.length} dipilih</span>
            </div>
            
            <div onDragOver={(event) => event.preventDefault()} onDrop={addDroppedColumn} className="min-h-40 rounded-xl border-2 border-dashed border-cyan-200/60 bg-gradient-to-br from-cyan-50/50 to-white p-4 transition-colors hover:border-cyan-300">
              {selectedColumns.length ? (
                <div className="flex flex-wrap gap-2.5">
                  {selectedColumns.map((col) => (
                    <div
                      key={col.qualified}
                      draggable
                      onDragStart={(event) => event.dataTransfer.setData('selected-column', col.qualified)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        reorderSelectedColumn(event.dataTransfer.getData('selected-column'), col.qualified);
                      }}
                      className="group flex cursor-grab items-center gap-2 rounded-xl border border-slate-200/80 bg-white p-1.5 pl-3 text-[13px] font-bold text-slate-700 shadow-sm transition active:cursor-grabbing hover:border-cyan-300 hover:shadow focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-500/20"
                    >
                      <GripVertical size={14} className="text-cyan-400" />
                      <span className="min-w-0 truncate py-1 pr-1">{col.qualified}</span>
                      
                      {/* INPUT ALIAS */}
                      <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-cyan-500/20">
                        <span className="text-[10px] font-bold text-slate-400">AS</span>
                        <input
                          value={col.alias}
                          onChange={(event) => updateColumnAlias(col.qualified, event.target.value)}
                          placeholder="alias_baru"
                          className="w-20 bg-transparent text-[12px] font-mono font-bold text-cyan-700 outline-none placeholder:font-normal placeholder:text-slate-300"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleColumn(col.qualified);
                        }}
                        aria-label={`Hapus ${col.qualified}`}
                        className="rounded-md p-1.5 text-slate-400 opacity-50 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-32 flex-col items-center justify-center gap-3 text-[13px] font-medium text-cyan-700/60">
                  <Upload size={24} className="text-cyan-200" />
                  Tarik kolom ke area ini
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/50">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">01b / Relasi tabel</p>
                <h2 className="mt-1 text-lg font-extrabold text-slate-900">Gabungkan tabel (JOIN)</h2>
                <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-slate-500">Menebak otomatis hubungan data antar tabel saat Anda memilih kolom baru.</p>
              </div>
              <button
                type="button"
                onClick={addJoin}
                disabled={!availableJoinTables.length}
                className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:bg-slate-800 hover:shadow disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus size={15} /> Tambah Manual
              </button>
            </div>
            {joins.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-5 text-[13px] text-slate-500">
                <div className="rounded-full bg-white p-2 shadow-sm"><GitBranch size={18} className="text-cyan-500" /></div> 
                Belum ada relasi tambahan. Tabel saling bergabung secara otomatis ketika kolomnya dipilih.
              </div>
            ) : (
              <div className="space-y-4">
                {joins.map((join) => {
                  const joinTable = schema.tables.find((item) => item.name === join.table) || availableJoinTables[0];
                  return (
                    <div key={join.id} className="relative flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 pt-5 shadow-sm sm:flex-row sm:items-center sm:gap-4 sm:p-3 sm:pl-4">
                      {/* Dekorasi Visual Relasi */}
                      <div className="absolute -left-px top-1/2 hidden h-8 w-1 -translate-y-1/2 rounded-r bg-cyan-500 sm:block"></div>
                      
                      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                        <SearchableSelect value={join.type} onChange={(value) => updateJoin(join.id, 'type', value)} options={joinTypes} placeholder="Tipe" className="w-full sm:w-36" />
                        
                        <div className="flex w-full min-w-0 items-center gap-2 rounded-xl border border-slate-200/70 bg-white p-1.5 shadow-sm sm:w-auto sm:flex-1">
                          <SearchableSelect
                            value={join.table}
                            onChange={(value) => {
                              const nextTable = schema.tables.find((item) => item.name === value);
                              if (!nextTable) return;
                              
                              const match = findMatchingColumns(nextTable.name);
                              setJoins((current) => current.map((item) => {
                                if (item.id !== join.id) return item;
                                return { 
                                  ...item, 
                                  table: nextTable.name, 
                                  leftTable: match ? match.leftTable : item.leftTable,
                                  left: match ? match.leftCol : item.left,
                                  right: match ? match.rightCol : nextTable.columns[0].name 
                                };
                              }));
                            }}
                            options={[
                              { value: '', label: 'Tabel tujuan' },
                              ...schema.tables
                                .filter((item) => item.name !== selectedTable && (item.name === join.table || !joinedTableNames.includes(item.name)))
                                .map((item) => ({ value: item.name, label: `${item.name} (${tableAliases[item.name] || '?'})` })),
                            ]}
                            placeholder="Tabel tujuan"
                            className="flex-1"
                          />
                        </div>
                        
                        <div className="flex items-center justify-center font-bold text-slate-300 sm:w-6"><Link size={14} /></div>
                        
                        <div className="flex w-full min-w-0 items-center gap-2 rounded-xl border border-slate-200/70 bg-white p-1.5 shadow-sm sm:w-auto sm:flex-1">
                          <SearchableSelect
                            value={`${join.leftTable}.${join.left}`}
                            onChange={(value) => {
                              const [leftTable, ...columnParts] = value.split('.');
                              setJoins((current) => current.map((item) => (item.id === join.id ? { ...item, leftTable, left: columnParts.join('.') } : item)));
                            }}
                            options={[{ value: '', label: 'Kolom dasar' }, ...sourceColumns.map((column) => ({ value: column.qualified, label: column.qualified }))]}
                            placeholder="Kolom tabel dasar"
                            className="flex-1 border-none shadow-none"
                          />
                          <span className="text-slate-300">=</span>
                          <SearchableSelect
                            value={join.right}
                            onChange={(value) => updateJoin(join.id, 'right', value)}
                            options={[{ value: '', label: `Kolom tujuan` }, ...joinTable.columns.map((column) => ({ value: column.name, label: `${tableAliases[join.table] || '?'}.${column.name}` }))]}
                            placeholder={`Kolom tujuan`}
                            className="flex-1 border-none shadow-none"
                          />
                        </div>
                      </div>

                      <button type="button" onClick={() => setJoins((current) => current.filter((item) => item.id !== join.id))} className="absolute right-2 top-2 rounded-lg bg-white p-1.5 text-slate-400 shadow-sm hover:bg-rose-50 hover:text-rose-500 sm:relative sm:right-0 sm:top-0 sm:bg-transparent sm:shadow-none" aria-label="Hapus JOIN">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/50">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">02 / Kondisi</p>
                <h2 className="mt-1 text-lg font-extrabold text-slate-900">Saring data bertingkat</h2>
                <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-slate-500">WHERE menyaring baris. Tambahkan beberapa kondisi untuk membuat aturan pencarian spesifik.</p>
              </div>
              <button type="button" onClick={() => setGroups((current) => [...current, makeGroup()])} className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2.5 text-[13px] font-bold text-slate-700 transition hover:bg-slate-200">
                <Plus size={15} /> Grup kondisi
              </button>
            </div>
            <div className="space-y-4">
              {groups.map((group, groupIndex) => (
                <div key={group.id} className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
                  <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-[12px] font-bold uppercase tracking-wider text-slate-500">Grup {groupIndex + 1}</span>
                    <SearchableSelect
                      value={group.logic}
                      onChange={(value) => setGroups((current) => current.map((item) => (item.id === group.id ? { ...item, logic: value } : item)))}
                      options={['AND', 'OR']}
                      className="w-24 text-[12px] font-bold"
                    />
                  </div>
                  {group.conditions.map((condition) => (
                    <div key={condition.id} className="mb-2.5 grid min-w-0 grid-cols-1 gap-2.5 last:mb-0 sm:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)_32px]">
                      <label className="flex items-center gap-2 text-[13px] font-semibold text-slate-600 sm:col-span-4">
                        <input type="checkbox" checked={condition.enabled} onChange={(event) => updateCondition(group.id, condition.id, 'enabled', event.target.checked)} className="h-4 w-4 rounded accent-cyan-600 focus:ring-cyan-500" />
                        Gunakan kondisi ini
                      </label>
                      <SearchableSelect
                        value={condition.column}
                        onChange={(value) => updateCondition(group.id, condition.id, 'column', value)}
                        options={[{ value: '', label: 'Pilih kolom' }, ...sourceColumns.map((column) => column.qualified)]}
                        placeholder="Pilih kolom"
                      />
                      <SearchableSelect value={condition.operator} onChange={(value) => updateCondition(group.id, condition.id, 'operator', value)} options={operators} placeholder="Operator" />
                      <input
                        disabled={condition.operator === 'IS NULL'}
                        value={condition.value}
                        onChange={(event) => updateCondition(group.id, condition.id, 'value', event.target.value)}
                        placeholder="Nilai target"
                        className="min-w-0 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-[13px] transition focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/10 disabled:bg-slate-100/50"
                      />
                      <button type="button" onClick={() => removeCondition(group.id, condition.id)} className="flex items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-500" aria-label="Hapus kondisi">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setGroups((current) => current.map((item) => (item.id === group.id ? { ...item, conditions: [...item.conditions, makeCondition(table.columns[0].name)] } : item)))}
                    className="mt-3 flex items-center gap-1.5 text-[13px] font-bold text-cyan-700 hover:text-cyan-800"
                  >
                    <Plus size={14} /> Tambah kondisi
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* MENU LOGIKA LANJUTAN CASE */}
          <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50/80 to-white p-6 shadow-sm shadow-amber-100/50">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 gap-4">
                <div className="rounded-xl bg-amber-100 p-2.5 text-amber-600 shadow-sm shadow-amber-200/50">
                  <Braces size={20} />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-amber-600">03 / Logika lanjutan</p>
                  <h2 className="mt-1 text-lg font-extrabold text-slate-900">Buat kategori dengan CASE</h2>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">CASE membuat label yang mudah dibaca dari aturan sederhana, misalnya batas umur.</p>
                </div>
              </div>
              <button type="button" onClick={() => setCaseEnabled((current) => !current)} className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors ${caseEnabled ? 'bg-amber-500' : 'bg-slate-300'}`} aria-label="Aktifkan CASE">
                <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${caseEnabled ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            {caseEnabled && (
              <div className="mt-5 flex flex-wrap items-center gap-2.5 rounded-xl border border-amber-200 bg-white p-3.5 text-[13px]">
                <span className="font-bold text-slate-500">Jika</span>
                <SearchableSelect value={caseColumn} onChange={setCaseColumn} options={sourceColumns.map((column) => ({ value: column.qualified, label: column.qualified }))} placeholder="Pilih kolom" className="w-auto min-w-40" />
                <span className="text-slate-600">
                  ≥ 18 maka <b className="text-slate-800">Dewasa</b>, selain itu <b className="text-slate-800">Belum dewasa</b>
                </span>
              </div>
            )}
          </div>

          {/* MENU EKSPRESI HASIL */}
          <div className="rounded-2xl border border-cyan-200 bg-cyan-50/50 p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-cyan-700">03b / Ekspresi hasil</p>
                <h2 className="mt-1 text-lg font-extrabold text-slate-900">Gabungkan dan rapikan nilai</h2>
                <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-slate-600">Fungsi seperti COALESCE atau LOWER mengolah nilai sebelum ditampilkan. Nama hasil membantu membaca kolom baru.</p>
              </div>
              <button
                type="button"
                onClick={() => setExpressions((current) => [...current, makeExpression(sourceColumns[0]?.qualified || table.columns[0]?.name)])}
                className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-cyan-700 shadow-sm"
              >
                <Plus size={15} /> Tambah ekspresi
              </button>
            </div>
            {expressions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-cyan-300 bg-white p-4 text-[13px] text-slate-500">Contoh: `COALESCE(bt.nama, rs.nama)` memakai nilai pertama yang tidak kosong.</p>
            ) : (
              <div className="space-y-3">
                {expressions.map((expression) => (
                  <div key={expression.id} className="grid min-w-0 gap-3 rounded-xl border border-cyan-200/70 bg-white p-4 shadow-sm sm:grid-cols-[135px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_28px] sm:items-center">
                    <SearchableSelect value={expression.function} onChange={(value) => updateExpression(expression.id, 'function', value)} options={expressionFunctions} placeholder="Fungsi" className="text-[13px] font-semibold" />
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
                      options={[{ value: '', label: 'Fallback / Kolom 2' }, ...sourceColumns.map((column) => ({ value: column.qualified, label: column.qualified }))]}
                      placeholder="Nilai fallback / kolom kedua"
                    />
                    <input
                      value={expression.alias}
                      onChange={(event) => updateExpression(expression.id, 'alias', event.target.value.replace(/[^a-zA-Z0-9_]/g, '_'))}
                      placeholder="Nama hasil (Alias)"
                      className="min-w-0 rounded-xl border border-slate-200/80 px-4 py-2.5 text-[13px] outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/10"
                    />
                    <button
                      type="button"
                      onClick={() => setExpressions((current) => current.filter((item) => item.id !== expression.id))}
                      className="flex items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 p-1"
                      aria-label="Hapus ekspresi"
                    >
                      <Trash2 size={18} />
                    </button>
                    {expression.function === 'COALESCE' && !expression.secondColumn && (
                      <input
                        value={expression.value}
                        onChange={(event) => updateExpression(expression.id, 'value', event.target.value)}
                        placeholder="atau isi string fallback text manual"
                        className="sm:col-span-2 rounded-xl border border-slate-200/80 px-4 py-2.5 text-[13px] outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/10"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* MENU QUERY LANJUTAN */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/50">
            <div className="mb-5 flex items-center gap-4">
              <div className="rounded-xl bg-slate-100 p-2.5 text-slate-600">
                <SlidersHorizontal size={20} />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">04 / Query lanjutan</p>
                <h2 className="mt-1 text-lg font-extrabold text-slate-900">Kontrol hasil dan ringkasan</h2>
                <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-slate-500">Atur data unik, ringkasan, pengurutan, dan jumlah halaman hasil tanpa menulis klausa SQL.</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 p-4 text-[13px] font-bold text-slate-700 transition hover:bg-slate-50">
                <input type="checkbox" checked={distinct} onChange={(event) => setDistinct(event.target.checked)} className="h-4 w-4 rounded accent-cyan-600 focus:ring-cyan-500" /> Hanya data unik (DISTINCT)
              </label>
              <label className="flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200/80 p-3 px-4 text-[13px] font-bold text-slate-600 transition hover:bg-slate-50">
                Agregasi
                <SearchableSelect
                  value={aggregate.function}
                  onChange={(value) => setAggregate((current) => ({ ...current, function: value }))}
                  options={[{ value: '', label: 'Tidak ada' }, ...aggregateFunctions.map((fn) => ({ value: fn, label: fn }))]}
                  placeholder="Fungsi"
                  className="w-auto"
                />
                <SearchableSelect
                  value={aggregate.column}
                  onChange={(value) => setAggregate((current) => ({ ...current, column: value }))}
                  options={[{ value: '', label: 'Tidak ada' }, { value: '*', label: 'Semua baris (*)' }, ...sourceColumns.map((column) => ({ value: column.qualified, label: column.qualified }))]}
                  placeholder="Kolom"
                  className="ml-auto max-w-40"
                  disabled={!aggregate.function}
                />
              </label>
              <label className="flex min-w-0 flex-wrap items-center gap-2.5 text-[13px] font-bold text-slate-600">
                Kelompokkan
                <SearchableSelect
                  value={groupBy}
                  onChange={setGroupBy}
                  options={[{ value: '', label: 'Tidak ada' }, ...sourceColumns.map((column) => ({ value: column.qualified, label: column.qualified }))]}
                  placeholder="Pilih kolom grup"
                  className="ml-auto flex-1"
                />
              </label>
              <label className="flex min-w-0 flex-wrap items-center gap-2.5 text-[13px] font-bold text-slate-600">
                Urutkan
                <SearchableSelect
                  value={orderBy}
                  onChange={setOrderBy}
                  options={[{ value: '', label: 'Tidak ada' }, ...sourceColumns.map((column) => ({ value: column.qualified, label: column.qualified }))]}
                  placeholder="Pilih kolom"
                  className="ml-auto flex-1"
                />
                <SearchableSelect value={orderDirection} onChange={setOrderDirection} options={['ASC', 'DESC']} placeholder="Arah" className="w-auto" />
              </label>
              <label className="flex items-center gap-2 text-[13px] font-bold text-slate-600">
                Batas baris
                <input type="number" min="1" value={limit} onChange={(event) => setLimit(event.target.value)} placeholder="Semua baris" className="ml-auto w-32 rounded-xl border border-slate-200/80 px-4 py-2.5 font-normal outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/10" />
              </label>
              <label className="flex items-center gap-2 text-[13px] font-bold text-slate-600">
                Mulai dari baris
                <input type="number" min="0" value={offset} onChange={(event) => setOffset(event.target.value)} placeholder="0" className="ml-auto w-32 rounded-xl border border-slate-200/80 px-4 py-2.5 font-normal outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/10" />
              </label>
            </div>
          </div>
        </section>

        {/* SIDEBAR KANAN PREVIEW */}
        <aside className="flex min-h-[500px] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl shadow-slate-900/40">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-5 shrink-0">
            <div>
              <div className="flex items-center gap-2.5 text-[13px] font-bold text-white">
                <div className="rounded-lg bg-cyan-900/50 p-1.5 text-cyan-400">
                  <Layers3 size={15} />
                </div> 
                Preview query
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">SQL dibuat otomatis</p>
            </div>
            <button type="button" onClick={copySql} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-[12px] font-bold text-white transition hover:bg-cyan-500">
              {copied ? <Check size={14} /> : <Clipboard size={14} />}
              {copied ? 'Tersalin' : 'Salin Code'}
            </button>
          </div>
          <pre className="flex-1 overflow-auto p-6 font-mono text-[13px] leading-relaxed text-cyan-100 selection:bg-cyan-500/30">
            <code>{sql}</code>
          </pre>
        </aside>
      </div>
      
      {/* MODAL JSON */}
      {isSchemaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm transition-opacity">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/5">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-5 shrink-0 backdrop-blur-md">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">{editingSchemaId ? 'Edit skema database' : 'Upload skema baru'}</h2>
                <p className="mt-1 text-[13px] text-slate-500">Tempel struktur tabel dalam format JSON.</p>
              </div>
              <button type="button" onClick={() => setIsSchemaModalOpen(false)} className="rounded-full bg-slate-200/50 p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700" aria-label="Tutup">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={saveServerSchema} className="flex flex-col min-h-0 overflow-hidden flex-1">
              <div className="overflow-y-auto p-6 space-y-5 flex-1 bg-white">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-[13px] font-bold text-slate-700">
                    Nama skema
                    <input
                      required
                      value={schemaForm.name}
                      onChange={(event) => setSchemaForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Contoh: Skema Kependudukan"
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-500/20"
                    />
                  </label>
                  <label className="text-[13px] font-bold text-slate-700">
                    Target Survei
                    <SearchableSelect
                      required
                      value={schemaForm.surveyId}
                      onChange={(value) => setSchemaForm((current) => ({ ...current, surveyId: value }))}
                      options={[{ value: '', label: 'Pilih survei...' }, ...surveys.map((survey) => ({ value: survey.id, label: survey.nama_survei }))]}
                      placeholder="Pilih survei"
                      className="mt-1.5 w-full font-normal"
                    />
                  </label>
                </div>
                <label className="block text-[13px] font-bold text-slate-700">
                  Import dari File JSON
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
                    className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-[13px] text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-200 file:px-4 file:py-1.5 file:text-[13px] file:font-bold file:text-slate-700 hover:file:bg-slate-300"
                  />
                </label>
                <label className="block text-[13px] font-bold text-slate-700 h-full flex flex-col min-h-[250px]">
                  Konten JSON
                  <textarea
                    required
                    value={schemaForm.json}
                    onChange={(event) => setSchemaForm((current) => ({ ...current, json: event.target.value }))}
                    className="mt-1.5 w-full flex-1 resize-none rounded-xl border border-slate-800 bg-slate-900 p-4 font-mono text-[13px] leading-relaxed text-cyan-100 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 min-h-[150px]"
                  />
                </label>
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/50 p-5 shrink-0">
                <button type="button" onClick={() => setIsSchemaModalOpen(false)} className="rounded-xl px-5 py-2.5 text-[13px] font-bold text-slate-500 transition hover:bg-slate-200 hover:text-slate-700">
                  Batal
                </button>
                <button type="submit" disabled={schemaSaving} className="rounded-xl bg-cyan-600 px-6 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:bg-cyan-700 hover:shadow-cyan-600/30 disabled:opacity-50">
                  {schemaSaving ? 'Menyimpan...' : 'Simpan Database'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}