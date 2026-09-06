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

function getSourceDataIndex(row, rowIndex) {
  const explicitIndex = row?._dataIndex ?? row?.dataIndex;
  return Number.isInteger(explicitIndex) ? explicitIndex : rowIndex;
}

function getSourceRowIndex(row, rowIndex, source) {
  const explicitIndex = row?._sheetRowIndex ?? row?.sheetRowIndex ?? row?.rowIndex ?? row?._rowIndex;
  if (Number.isInteger(explicitIndex)) return explicitIndex;
  const defaultHeaderOffset = Array.isArray(source?.headers) && source.headers.length ? 1 : 0;
  return rowIndex + (Number.isInteger(source?.rowIndexOffset) ? source.rowIndexOffset : defaultHeaderOffset);
}

function getSheetRowNumber(row, rowIndex, source) {
  const explicitNumber = row?._sheetRowNumber ?? row?.sheetRowNumber;
  if (Number.isInteger(explicitNumber)) return explicitNumber;
  return getSourceRowIndex(row, rowIndex, source);
}

function getSourceReference(source, row, rowIndex) {
  return {
    sourceKey: source.sourceKey,
    sourceId: source.id,
    sourceLabel: source.label,
    spreadsheetId: source.spreadsheetId,
    sheetName: source.sheetName,
    dataIndex: getSourceDataIndex(row, rowIndex),
    rowIndex: getSourceRowIndex(row, rowIndex, source),
    sheetRowNumber: getSheetRowNumber(row, rowIndex, source),
  };
}

export function mergeLkRows(sources, keyColumn, keyMappings = {}) {
  const standardHeaders = ['Jenis Anomali', 'PCL', 'PJ', 'Link'];
  const getColumnMapping = (source) => {
    const mapping = keyMappings[source.sourceKey];
    return mapping && typeof mapping === 'object' ? mapping : {};
  };
  const getOutputHeader = (source, header) => getColumnMapping(source)[header] || header;
  const allHeaders = [...new Set([...sources.flatMap((source) => (source.headers || []).map((header) => getOutputHeader(source, header))), ...standardHeaders])];
  const statusHeader = allHeaders.find((header) => normalizeHeader(header) === 'status_penyelesaian');
  const dateHeader = allHeaders.find((header) => normalizeHeader(header) === 'tanggal_selesai');
  const rowsByKey = new Map();

  sources.forEach((source) => {
    const mapping = getColumnMapping(source);
    const sourceKeyColumn = keyMappings[`${source.sourceKey}::key`] || (source.headers || []).find((header) => getOutputHeader(source, header) === keyColumn) || keyColumn;
    if (!sourceKeyColumn) return;
    (source.data || []).forEach((row, rowIndex) => {
      const key = rowKey(row, sourceKeyColumn);
      if (!key) return;
      const existing = rowsByKey.get(key);
      const sourceReference = getSourceReference(source, row, rowIndex);
      const rowMeta = {
        _sources: [source.label],
        _sourceIds: [source.id],
        _spreadsheetId: source.spreadsheetId,
        _sourceDataIndex: getSourceDataIndex(row, rowIndex),
        _sourceRowIndex: getSourceRowIndex(row, rowIndex, source),
        _sheetRowNumber: getSheetRowNumber(row, rowIndex, source),
        _sourceSheetName: source.sheetName,
        _sourceRows: [sourceReference],
        _completed: isCompleted(row),
      };

      const normalizedRow = Object.fromEntries(Object.entries(row).map(([header, value]) => [mapping[header] || header, value]));

      if (!existing) {
        rowsByKey.set(key, { ...normalizedRow, ...rowMeta });
        return;
      }

      const incomingCompleted = isCompleted(row);
      if (incomingCompleted && !existing._completed) {
        rowsByKey.set(key, {
          ...existing,
          ...normalizedRow,
          _sources: [...existing._sources, source.label],
          _sourceIds: [...existing._sourceIds, source.id],
          _spreadsheetId: source.spreadsheetId,
          _sourceDataIndex: getSourceDataIndex(row, rowIndex),
          _sourceRowIndex: getSourceRowIndex(row, rowIndex, source),
          _sheetRowNumber: getSheetRowNumber(row, rowIndex, source),
          _sourceSheetName: source.sheetName,
          _sourceRows: [...(existing._sourceRows || []), sourceReference],
          _completed: true,
        });
        return;
      }

      allHeaders.forEach((header) => {
        existing[header] = mergeValue(existing[header], normalizedRow[header]);
      });
      existing._sources = [...existing._sources, source.label];
      existing._sourceIds = [...existing._sourceIds, source.id];
      existing._spreadsheetId = source.spreadsheetId;
      existing._sourceDataIndex = getSourceDataIndex(row, rowIndex);
      existing._sourceRowIndex = getSourceRowIndex(row, rowIndex, source);
      existing._sheetRowNumber = getSheetRowNumber(row, rowIndex, source);
      existing._sourceSheetName = source.sheetName;
      existing._sourceRows = [...(existing._sourceRows || []), sourceReference];
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
