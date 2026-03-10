/**
 * xlsx-import.js - SheetJS XLSX parser and database importer
 * Reads the CFTV checklist spreadsheet and populates the SQLite DB
 */

/**
 * Column name mappings (normalized → possible spreadsheet column names)
 */
const COLUMN_MAP = {
  conta:                   ['CONTA', 'conta', 'ID', 'id'],
  sigla:                   ['SIGLA', 'sigla', 'SITE', 'site', 'Nome', 'NOME'],
  status_conexao:          ['STATUS', 'status', 'STATUS CONEXÃO', 'Status Conexão'],
  data_desconexao:         ['DATA', 'data', 'DATA DESCONEXÃO', 'Data Desconexão'],
  os:                      ['O.S', 'OS', 'O.S.', 'os', 'Ordem de Serviço'],
  zona:                    ['ZONA', 'zona', 'Zona'],
  status4:                 ['STATUS4', 'status4', 'STATUS 4'],
  padrao_cameras:          ['PADRÃO DE CÂMERAS', 'PADRAO DE CAMERAS', 'CÂMERAS', 'Cameras', 'cameras', 'Qtd Cameras'],
  cameras_ontem:           ['ONTEM', 'ontem', 'Cameras Ontem'],
  cameras_hoje:            ['HOJE', 'hoje', 'Cameras Hoje'],
  status2:                 ['STATUS2', 'status2', 'STATUS 2'],
  data_alteracao:          ['DATA DA ALTERAÇÃO', 'DATA DA ALTERACAO', 'Data Alteração'],
  vegetacao_alta:          ['VEGETAÇÃO ALTA', 'VEGETACAO ALTA', 'vegetacao_alta'],
  data_alteracao_vegetacao:['DATA DE ALTERAÇÃO', 'DATA DE ALTERACAO', 'Data Alt. Vegetação'],
  camera_problema:         ['CÂMERA', 'CAMERA', 'camera', 'Câmera Problema'],
  status3:                 ['STATUS3', 'status3', 'STATUS 3'],
};

/**
 * Find a value in a row by trying multiple possible column names
 */
function findColumnValue(row, candidates) {
  for (const name of candidates) {
    if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
      return row[name];
    }
  }
  return null;
}

/**
 * Convert Excel date serial number or string to ISO date string
 */
function excelDateToString(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') {
    // Excel serial date: days since 1900-01-01
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return date.toISOString().split('T')[0];
  }
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  return String(value) || null;
}

/**
 * Parse boolean-like values
 */
function parseBool(value) {
  if (!value) return false;
  if (typeof value === 'boolean') return value;
  const s = String(value).toUpperCase().trim();
  return s === 'TRUE' || s === '1' || s === 'SIM' || s === 'S';
}

/**
 * Parse integer cameras count
 */
function parseCameras(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = parseInt(value, 10);
  return isNaN(n) ? null : n;
}

/**
 * Parse a single row from the spreadsheet into a site object
 */
function parseRow(row) {
  const sigla = findColumnValue(row, COLUMN_MAP.sigla);
  if (!sigla || String(sigla).trim() === '') return null;

  return {
    conta:                   parseCameras(findColumnValue(row, COLUMN_MAP.conta)),
    sigla:                   String(sigla).trim().toUpperCase(),
    status_conexao:          findColumnValue(row, COLUMN_MAP.status_conexao) || null,
    data_desconexao:         excelDateToString(findColumnValue(row, COLUMN_MAP.data_desconexao)),
    os:                      findColumnValue(row, COLUMN_MAP.os) || null,
    zona:                    findColumnValue(row, COLUMN_MAP.zona) ? String(findColumnValue(row, COLUMN_MAP.zona)) : null,
    status4:                 findColumnValue(row, COLUMN_MAP.status4) || null,
    padrao_cameras:          parseCameras(findColumnValue(row, COLUMN_MAP.padrao_cameras)),
    cameras_ontem:           parseCameras(findColumnValue(row, COLUMN_MAP.cameras_ontem)),
    cameras_hoje:            parseCameras(findColumnValue(row, COLUMN_MAP.cameras_hoje)),
    status2:                 findColumnValue(row, COLUMN_MAP.status2) || null,
    data_alteracao:          excelDateToString(findColumnValue(row, COLUMN_MAP.data_alteracao)),
    vegetacao_alta:          parseBool(findColumnValue(row, COLUMN_MAP.vegetacao_alta)),
    data_alteracao_vegetacao:excelDateToString(findColumnValue(row, COLUMN_MAP.data_alteracao_vegetacao)),
    camera_problema:         findColumnValue(row, COLUMN_MAP.camera_problema) ? String(findColumnValue(row, COLUMN_MAP.camera_problema)) : null,
    status3:                 findColumnValue(row, COLUMN_MAP.status3) || null,
  };
}

/**
 * Import an XLSX file (ArrayBuffer) into the database
 * Returns { imported, updated, skipped, errors, sheetNames }
 */
function importXLSX(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

  let imported = 0, updated = 0, skipped = 0;
  const errors = [];
  const sheetNames = workbook.SheetNames;

  for (const sheetName of sheetNames) {
    // Skip sheets that look like they are not site data
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!rows.length) continue;

    // Check if this sheet has a sigla column (skip irrelevant sheets)
    const firstRow = rows[0];
    const hasSigla = COLUMN_MAP.sigla.some(c => firstRow[c] !== undefined);
    if (!hasSigla) continue;

    db.run('BEGIN TRANSACTION');
    try {
      for (const row of rows) {
        try {
          const site = parseRow(row);
          if (!site) { skipped++; continue; }

          const existing = getSiteBySigla(site.sigla);
          upsertSite(site);
          if (existing) updated++;
          else imported++;
        } catch (e) {
          errors.push(`Linha ignorada: ${e.message}`);
          skipped++;
        }
      }
      db.run('COMMIT');
    } catch (e) {
      db.run('ROLLBACK');
      errors.push(`Aba "${sheetName}": ${e.message}`);
    }
  }

  saveDatabase();
  return { imported, updated, skipped, errors, sheetNames };
}

/**
 * Export sites back to XLSX with additional ronda columns
 */
function exportToXLSX(sites) {
  const data = sites.map(s => ({
    'CONTA': s.conta,
    'SIGLA': s.sigla,
    'STATUS': s.status_conexao,
    'DATA': s.data_desconexao,
    'O.S': s.os,
    'ZONA': s.zona,
    'STATUS4': s.status4,
    'PADRÃO DE CÂMERAS': s.padrao_cameras,
    'ONTEM': s.cameras_ontem,
    'HOJE': s.cameras_hoje,
    'STATUS2': s.status2,
    'DATA DA ALTERAÇÃO': s.data_alteracao,
    'VEGETAÇÃO ALTA': s.vegetacao_alta ? 'TRUE' : 'FALSE',
    'DATA DE ALTERAÇÃO': s.data_alteracao_vegetacao,
    'CÂMERA': s.camera_problema,
    'STATUS3': s.status3,
    'ÚLTIMA_RONDA': s.ultima_ronda_ts || '',
    'OPERADOR': s.ultimo_operador || '',
    'ÚLTIMO_STATUS': s.ultimo_status_ronda || '',
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Checklist');
  XLSX.writeFile(wb, `checklist_cftv_${new Date().toISOString().split('T')[0]}.xlsx`);
}
