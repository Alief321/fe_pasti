import { useMemo, useRef, useState } from 'react';
import { Braces, Check, ChevronDown, Clipboard, Code2, Download, FileJson, GitBranch, GripVertical, Layers3, Plus, Search, SlidersHorizontal, Table2, Trash2, Upload, X } from 'lucide-react';

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
  return { id: crypto.randomUUID(), column, operator: '>=', value: '18' };
}

function makeGroup() {
  return { id: crypto.randomUUID(), logic: 'AND', conditions: [makeCondition()] };
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

export default function SQLQueryBuilder() {
  const [schema, setSchema] = useState(getStoredSchema);
  const [selectedTable, setSelectedTable] = useState(() => getStoredSchema().tables[0].name);
  const [selectedColumns, setSelectedColumns] = useState(['bt.id_penduduk', 'bt.nama_lengkap']);
  const [joins, setJoins] = useState([]);
  const [distinct, setDistinct] = useState(false);
  const [aggregate, setAggregate] = useState({ function: 'COUNT', column: '*' });
  const [groupBy, setGroupBy] = useState('');
  const [orderBy, setOrderBy] = useState('');
  const [orderDirection, setOrderDirection] = useState('ASC');
  const [limit, setLimit] = useState('');
  const [search, setSearch] = useState('');
  const [groups, setGroups] = useState([makeGroup()]);
  const [caseEnabled, setCaseEnabled] = useState(true);
  const [caseColumn, setCaseColumn] = useState('umur');
  const [expressions, setExpressions] = useState([]);
  const [copied, setCopied] = useState(false);
  const fileInput = useRef(null);

  const table = schema.tables.find((item) => item.name === selectedTable) || schema.tables[0];
  const joinedTableNames = joins.map((join) => join.table);
  const tableAliases = useMemo(() => {
    const orderedNames = [selectedTable, ...joinedTableNames, ...schema.tables.map((item) => item.name)];
    return Object.fromEntries([...new Set(orderedNames)].map((name, index) => [name, getTableAlias(index)]));
  }, [joinedTableNames, schema.tables, selectedTable]);
  const availableJoinTables = schema.tables.filter((item) => item.name !== selectedTable && !joinedTableNames.includes(item.name));
  const sourceTables = [selectedTable, ...joinedTableNames].map((name) => schema.tables.find((item) => item.name === name)).filter(Boolean);
  const sourceColumns = sourceTables.flatMap((source) => source.columns.map((column) => ({ ...column, table: source.name, alias: tableAliases[source.name], qualified: `${tableAliases[source.name]}.${column.name}` })));
  const filteredColumns = table.columns.filter((column) => column.name.toLowerCase().includes(search.toLowerCase()));

  const sql = useMemo(() => {
    const selectFields = selectedColumns.length ? selectedColumns.map((column) => `  ${column}`) : ['  *'];
    if (aggregate.column)
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
    const whereSql = groups
      .map(
        (group) =>
          `(${group.conditions.map((condition) => `${getQualifiedColumn(condition.column, tableAliases[selectedTable])} ${condition.operator}${condition.operator === 'IS NULL' ? '' : ` '${condition.value.replaceAll("'", "''")}'`}`).join(` ${group.logic} `)})`,
      )
      .join('\n  AND ');
    const joinSql = joins.map((join) => `\n${join.type} ${join.table} ${tableAliases[join.table]} ON ${tableAliases[join.leftTable]}.${join.left} = ${tableAliases[join.table]}.${join.right}`).join('');
    const groupSql = groupBy ? `\nGROUP BY ${getQualifiedColumn(groupBy, tableAliases[selectedTable])}` : '';
    const orderSql = orderBy ? `\nORDER BY ${getQualifiedColumn(orderBy, tableAliases[selectedTable])} ${orderDirection}` : '';
    const limitSql = limit ? `\nLIMIT ${limit}` : '';
    return `SELECT\n${selectList}${caseSql}${expressionSql}\nFROM ${selectedTable} ${tableAliases[selectedTable]}${joinSql}\nWHERE ${whereSql}${groupSql}${orderSql}${limitSql};`;
  }, [aggregate, caseColumn, caseEnabled, distinct, expressions, groupBy, groups, joins, limit, orderBy, orderDirection, selectedColumns, selectedTable, tableAliases]);

  function toggleColumn(columnName) {
    const qualified = `${tableAliases[selectedTable]}.${columnName}`;
    setSelectedColumns((current) => (current.includes(qualified) ? current.filter((column) => column !== qualified) : [...current, qualified]));
  }

  function addDroppedColumn(event) {
    event.preventDefault();
    const columnName = event.dataTransfer.getData('column');
    const qualified = `${tableAliases[selectedTable]}.${columnName}`;
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

  function importSchema(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!Array.isArray(imported.tables) || !imported.tables.length) throw new Error('Format tabel tidak ditemukan');
        setSchema(imported);
        setSelectedTable(imported.tables[0].name);
        const firstAlias = getTableAlias(0);
        setSelectedColumns(imported.tables[0].columns.slice(0, 2).map((column) => `${firstAlias}.${column.name}`));
        localStorage.setItem('sqlab-schema', JSON.stringify(imported));
      } catch (error) {
        window.alert(`Gagal membaca skema: ${error.message}`);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  function saveSchema() {
    localStorage.setItem('sqlab-schema', JSON.stringify({ ...schema, savedAt: new Date().toISOString() }));
    window.alert('Struktur tabel disimpan di browser ini.');
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
          <button type="button" onClick={() => fileInput.current?.click()} className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-cyan-400">
            <Upload size={16} /> Import SQLab
          </button>
          <button type="button" onClick={saveSchema} className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-cyan-400">
            <Download size={16} /> Simpan skema
          </button>
          <button type="button" onClick={downloadSchema} className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-cyan-400">
            <Download size={16} /> Export skema
          </button>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(420px,1fr)_390px]">
        <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <Table2 size={18} className="text-cyan-600" /> Skema database
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {schema.tables.length} tabel dari {schema.source || 'file impor'}
            </p>
          </div>
          <div className="border-b border-slate-100 p-3">
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
          <div className="max-h-140 overflow-auto p-3">
            {schema.tables.map((item) => (
              <div key={item.name} className="mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTable(item.name);
                    setSelectedColumns([]);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm font-bold ${selectedTable === item.name ? 'bg-cyan-50 text-cyan-800' : 'text-slate-700 hover:bg-slate-50'}`}
                >
                  <span className="flex items-center gap-2">
                    <ChevronDown size={14} /> {item.name}
                  </span>
                  <span className="text-[11px] font-normal text-slate-400">{item.columns.length}</span>
                </button>
                {selectedTable === item.name && (
                  <div className="mt-1 space-y-1 pl-2">
                    {filteredColumns.map((column) => (
                      <button
                        type="button"
                        draggable
                        onDragStart={(event) => event.dataTransfer.setData('column', column.name)}
                        onClick={() => toggleColumn(column.name)}
                        key={column.name}
                        className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs ${selectedColumns.includes(`${tableAliases[item.name]}.${column.name}`) ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        <GripVertical size={13} className="text-slate-300" /> <span className="min-w-0 flex-1 truncate">{column.name}</span>
                        <span className="text-[10px] text-slate-400">{column.type}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 p-4 text-xs leading-relaxed text-slate-500">
            <FileJson size={15} className="mb-1 text-cyan-600" />
            SQLab cukup mengirim JSON berisi `tables`, `columns`, `name`, dan `type`.
          </div>
        </aside>

        <section className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">01 / Kolom hasil</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">Apa yang ingin ditampilkan?</h2>
              </div>
              <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700">{selectedColumns.length} dipilih</span>
            </div>
            <div onDragOver={(event) => event.preventDefault()} onDrop={addDroppedColumn} className="min-h-36.25 rounded-xl border-2 border-dashed border-cyan-200 bg-cyan-50/40 p-3">
              {selectedColumns.length ? (
                <div className="flex flex-wrap gap-2">
                  {selectedColumns.map((column) => (
                    <div key={column} className="flex items-center gap-2 rounded-lg border border-cyan-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                      <GripVertical size={14} className="text-cyan-500" />
                      {column}
                      <button type="button" onClick={() => toggleColumn(column.split('.').slice(1).join('.'))} aria-label={`Hapus ${column}`} className="text-slate-400 hover:text-rose-500">
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
                    <div key={join.id} className="grid gap-2 rounded-xl border border-cyan-100 bg-cyan-50/40 p-3 sm:grid-cols-[115px_32px_1fr_1fr_1fr_28px] sm:items-center">
                      <select value={join.type} onChange={(event) => updateJoin(join.id, 'type', event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold">
                        {joinTypes.map((type) => (
                          <option key={type}>{type}</option>
                        ))}
                      </select>
                      <span className="hidden text-center text-xs font-bold text-slate-400 sm:block">ON</span>
                      <select
                        value={`${join.leftTable}.${join.left}`}
                        onChange={(event) => {
                          const [leftTable, ...columnParts] = event.target.value.split('.');
                          setJoins((current) => current.map((item) => (item.id === join.id ? { ...item, leftTable, left: columnParts.join('.') } : item)));
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs"
                      >
                        <option value="">Kolom kiri</option>
                        {sourceColumns.map((column) => (
                          <option key={`left-${column.qualified}`} value={column.qualified}>
                            {column.qualified}
                          </option>
                        ))}
                      </select>
                      <select
                        value={join.table}
                        onChange={(event) => {
                          const nextTable = schema.tables.find((item) => item.name === event.target.value);
                          if (!nextTable) return;
                          setJoins((current) => current.map((item) => (item.id === join.id ? { ...item, table: nextTable.name, right: nextTable.columns[0].name } : item)));
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs"
                      >
                        <option value="">Tabel tujuan</option>
                        {schema.tables
                          .filter((item) => item.name !== selectedTable && (item.name === join.table || !joinedTableNames.includes(item.name)))
                          .map((item) => (
                            <option key={item.name} value={item.name}>
                              {tableAliases[item.name]} ({item.name})
                            </option>
                          ))}
                      </select>
                      <select value={join.right} onChange={(event) => updateJoin(join.id, 'right', event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs">
                        <option value="">Kolom kanan ({tableAliases[join.table]})</option>
                        {joinTable.columns.map((column) => (
                          <option key={column.name} value={column.name}>
                            {tableAliases[join.table]}.{column.name}
                          </option>
                        ))}
                      </select>
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
                    <select
                      value={group.logic}
                      onChange={(event) => setGroups((current) => current.map((item) => (item.id === group.id ? { ...item, logic: event.target.value } : item)))}
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-bold"
                    >
                      <option>AND</option>
                      <option>OR</option>
                    </select>
                  </div>
                  {group.conditions.map((condition) => (
                    <div key={condition.id} className="mb-2 grid grid-cols-[1fr_82px_1fr_28px] gap-2 last:mb-0">
                      <select value={condition.column} onChange={(event) => updateCondition(group.id, condition.id, 'column', event.target.value)} className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs">
                        <option value="">Pilih kolom</option>
                        {table.columns.map((column) => (
                          <option key={column.name}>{column.name}</option>
                        ))}
                      </select>
                      <select value={condition.operator} onChange={(event) => updateCondition(group.id, condition.id, 'operator', event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs">
                        {operators.map((operator) => (
                          <option key={operator}>{operator}</option>
                        ))}
                      </select>
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
              <div className="flex gap-3">
                <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
                  <Braces size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-700">03 / Logika lanjutan</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">Buat kategori dengan CASE</h2>
                  <p className="mt-1 text-xs text-slate-600">Contoh: kelompokkan umur menjadi Dewasa atau Belum dewasa.</p>
                </div>
              </div>
              <button type="button" onClick={() => setCaseEnabled((current) => !current)} className={`relative h-6 w-11 rounded-full transition ${caseEnabled ? 'bg-amber-500' : 'bg-slate-300'}`} aria-label="Aktifkan CASE">
                <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${caseEnabled ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            {caseEnabled && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-white p-3 text-xs">
                <span className="font-semibold text-slate-500">Jika</span>
                <select value={caseColumn} onChange={(event) => setCaseColumn(event.target.value)} className="rounded border border-slate-200 px-2 py-1">
                  {sourceColumns.map((column) => (
                    <option key={column.qualified} value={column.qualified}>
                      {column.qualified}
                    </option>
                  ))}
                </select>
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
                <p className="mt-1 text-xs text-slate-600">Pilih fungsi, kolom, lalu beri nama hasilnya. SQL akan dirangkai otomatis.</p>
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
                  <div key={expression.id} className="grid gap-2 rounded-xl border border-cyan-100 bg-white p-3 sm:grid-cols-[125px_1fr_1fr_1fr_28px] sm:items-center">
                    <select value={expression.function} onChange={(event) => updateExpression(expression.id, 'function', event.target.value)} className="rounded-lg border border-slate-200 px-2 py-2 text-xs font-semibold">
                      {expressionFunctions.map((fn) => (
                        <option key={fn}>{fn}</option>
                      ))}
                    </select>
                    <select value={expression.column} onChange={(event) => updateExpression(expression.id, 'column', event.target.value)} className="min-w-0 rounded-lg border border-slate-200 px-2 py-2 text-xs">
                      {sourceColumns.map((column) => (
                        <option key={`expression-${expression.id}-${column.qualified}`} value={column.qualified}>
                          {column.qualified}
                        </option>
                      ))}
                    </select>
                    <select
                      value={expression.secondColumn}
                      onChange={(event) => updateExpression(expression.id, 'secondColumn', event.target.value)}
                      disabled={['LOWER', 'UPPER', 'DATE_TRUNC'].includes(expression.function)}
                      className="min-w-0 rounded-lg border border-slate-200 px-2 py-2 text-xs disabled:bg-slate-100"
                    >
                      <option value="">Nilai fallback / kolom kedua</option>
                      {sourceColumns.map((column) => (
                        <option key={`fallback-${expression.id}-${column.qualified}`} value={column.qualified}>
                          {column.qualified}
                        </option>
                      ))}
                    </select>
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
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={distinct} onChange={(event) => setDistinct(event.target.checked)} className="h-4 w-4 accent-cyan-600" /> Hanya data unik (DISTINCT)
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-xs font-semibold text-slate-600">
                Agregasi
                <select value={aggregate.function} onChange={(event) => setAggregate((current) => ({ ...current, function: event.target.value }))} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs">
                  {aggregateFunctions.map((fn) => (
                    <option key={fn}>{fn}</option>
                  ))}
                </select>
                <select value={aggregate.column} onChange={(event) => setAggregate((current) => ({ ...current, column: event.target.value }))} className="ml-auto max-w-32.5 rounded border border-slate-200 bg-white px-2 py-1 text-xs">
                  <option value="">Tidak ada</option>
                  <option value="*">Semua baris (*)</option>
                  {sourceColumns.map((column) => (
                    <option key={column.qualified} value={column.qualified}>
                      {column.qualified}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                Kelompokkan
                <select value={groupBy} onChange={(event) => setGroupBy(event.target.value)} className="ml-auto flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 font-normal">
                  <option value="">Tidak ada</option>
                  {sourceColumns.map((column) => (
                    <option key={`group-${column.qualified}`} value={column.qualified}>
                      {column.qualified}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                Urutkan
                <select value={orderBy} onChange={(event) => setOrderBy(event.target.value)} className="ml-auto flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 font-normal">
                  <option value="">Tidak ada</option>
                  {sourceColumns.map((column) => (
                    <option key={`order-${column.qualified}`} value={column.qualified}>
                      {column.qualified}
                    </option>
                  ))}
                </select>
                <select value={orderDirection} onChange={(event) => setOrderDirection(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-2">
                  <option>ASC</option>
                  <option>DESC</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                Batas baris
                <input type="number" min="1" value={limit} onChange={(event) => setLimit(event.target.value)} placeholder="Semua" className="ml-auto w-28 rounded-lg border border-slate-200 px-3 py-2 font-normal" />
              </label>
            </div>
          </div>
        </section>

        <aside className="flex min-h-155 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#101827] shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
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
          <div className="border-t border-slate-700 bg-slate-900/60 px-5 py-4 text-xs text-slate-400">Query ini siap ditempel ke SQLab atau disimpan sebagai pemeriksaan baru.</div>
        </aside>
      </div>
    </div>
  );
}
