const KEY_ALIASES = ['id', 'kode', 'kode_sls', 'kode_sub_sls', 'id_pendataan', 'nik', 'nks', 'nomor'];

export function findDefaultKey(headers) {
  return headers.find((header) => KEY_ALIASES.includes(normalizeHeader(header))) || headers[0] || '';
}

export function normalizeHeader(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
}

export function isCompleted(row) {
  const value = row['Status Penyelesaian'] ?? row.status ?? row.status_penyelesaian;
  return ['TRUE', 'true', '1', 'YA', 'SELESAI', 'COMPLETED'].includes(String(value).trim());
}

function rowKey(row, keyColumn) {
  return String(row[keyColumn] ?? '')
    .trim()
    .toLowerCase();
}

function mergeValue(currentValue, incomingValue) {
  const current = String(currentValue ?? '').trim();
  const incoming = String(incomingValue ?? '').trim();
  if (!incoming) return current;
  if (!current || current === incoming) return current || incoming;
  return `${current} / ${incoming}`;
}

export function mergeLkRows(sources, keyColumn) {
  const standardHeaders = ['Jenis Anomali', 'PCL', 'PJ', 'Link'];
  const allHeaders = [...new Set([...sources.flatMap((source) => source.headers || []), ...standardHeaders])];
  const statusHeader = allHeaders.find((header) => normalizeHeader(header) === 'status_penyelesaian');
  const dateHeader = allHeaders.find((header) => normalizeHeader(header) === 'tanggal_selesai');
  const rowsByKey = new Map();

  sources.forEach((source) => {
    (source.data || []).forEach((row, rowIndex) => {
      const key = rowKey(row, keyColumn);
      if (!key) return;
      const existing = rowsByKey.get(key);
      const rowMeta = {
        _sources: [source.label],
        _sourceIds: [source.id],
        _spreadsheetId: source.spreadsheetId,
        _sourceRowIndex: rowIndex,
        _sourceSheetName: source.sheetName,
        _completed: isCompleted(row),
      };

      if (!existing) {
        rowsByKey.set(key, { ...row, ...rowMeta });
        return;
      }

      const incomingCompleted = isCompleted(row);
      if (incomingCompleted && !existing._completed) {
        rowsByKey.set(key, {
          ...existing,
          ...row,
          _sources: [...existing._sources, source.label],
          _sourceIds: [...existing._sourceIds, source.id],
          _spreadsheetId: source.spreadsheetId,
          _sourceRowIndex: rowIndex,
          _sourceSheetName: source.sheetName,
          _completed: true,
        });
        return;
      }

      allHeaders.forEach((header) => {
        existing[header] = mergeValue(existing[header], row[header]);
      });
      existing._sources = [...existing._sources, source.label];
      existing._sourceIds = [...existing._sourceIds, source.id];
      existing._spreadsheetId = source.spreadsheetId;
      existing._sourceRowIndex = rowIndex;
      existing._sourceSheetName = source.sheetName;
    });
  });

  const rows = [...rowsByKey.values()].map((row) => {
    const result = { ...row };
    delete result._completed;
    return result;
  });

  return { headers: allHeaders, rows, statusHeader, dateHeader };
}

export function getRowStats(rows, statusHeader) {
  const completed = rows.filter((row) => isCompleted(statusHeader ? { ...row, 'Status Penyelesaian': row[statusHeader] } : row)).length;
  return { total: rows.length, completed, pending: rows.length - completed };
}
