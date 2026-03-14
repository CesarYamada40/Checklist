/**
 * xlsx-import.js - SheetJS XLSX parser and database importer
 * Reads the CFTV checklist spreadsheet and populates the SQLite DB
 */

/**
 * Column name mappings (normalized → possible spreadsheet column names)
 * Supports both English and Portuguese headers as exported from Google Sheets/Excel.
 */
const COLUMN_MAP = {
  conta:                   ['CONTA', 'conta', 'ID', 'id'],
  sigla:                   ['SIGLA', 'sigla', 'SITE', 'site', 'Nome', 'NOME'],
  status_conexao:          ['STATUS', 'status', 'STATUS CONEXÃO', 'STATUS CONEXAO', 'Status Conexão',
                            'ALARME', 'STATUS ALARME', 'STATUS DO ALARME'],
  data_desconexao:         ['DATA', 'data', 'DATA DESCONEXÃO', 'DATA DESCONEXAO', 'Data Desconexão',
                            'DATA DE DESCONEXÃO', 'DATA DE DESCONEXAO'],
  os:                      ['O.S', 'OS', 'O.S.', 'os', 'Ordem de Serviço', 'ORDEM DE SERVIÇO',
                            'ORDEM DE SERVICO', 'N TICKET', 'TICKET'],
  zona:                    ['ZONA', 'zona', 'Zona', 'ZONA AFETADA'],
  status4:                 ['STATUS4', 'status4', 'STATUS 4'],
  padrao_cameras:          ['PADRÃO DE CÂMERAS', 'PADRAO DE CAMERAS', 'CÂMERAS', 'CAMERAS',
                            'Cameras', 'cameras', 'Qtd Cameras', 'PADRÃO', 'PADRAO',
                            'QTD CÂMERAS', 'QTD CAMERAS'],
  cameras_ontem:           ['ONTEM', 'ontem', 'Cameras Ontem', 'CÂMERAS ONTEM', 'CAMERAS ONTEM'],
  cameras_hoje:            ['HOJE', 'hoje', 'Cameras Hoje', 'CÂMERAS HOJE', 'CAMERAS HOJE'],
  status2:                 ['STATUS2', 'status2', 'STATUS 2', 'STATUS CFTV', 'CFTV',
                            'STATUS DO CFTV', 'STATUS_CFTV'],
  data_alteracao:          ['DATA DA ALTERAÇÃO', 'DATA DA ALTERACAO', 'Data Alteração',
                            'DATA ALTERAÇÃO', 'DATA ALTERACAO', 'QUANDO'],
  vegetacao_alta:          ['VEGETAÇÃO ALTA', 'VEGETACAO ALTA', 'vegetacao_alta',
                            'VEGETAÇÃO', 'VEGETACAO', 'VEG ALTA'],
  data_alteracao_vegetacao:['DATA DE ALTERAÇÃO', 'DATA DE ALTERACAO', 'Data Alt. Vegetação',
                            'DATA ALT VEGETAÇÃO', 'DATA ALT VEGETACAO'],
  camera_problema:         ['CÂMERA', 'CAMERA', 'camera', 'Câmera Problema', 'CÂMERA PROBLEMA',
                            'CAMERA PROBLEMA', 'TIPO PROBLEMA'],
  status3:                 ['STATUS3', 'status3', 'STATUS 3', 'STATUS_3'],
  regional:                ['REGIONAL', 'regional', 'ESTADO', 'UF', 'Estado'],
  observacao:              ['OBSERVAÇÃO', 'OBSERVACAO', 'OBS', 'Observação', 'observacao', 'Obs.',
                            'O QUE HOUVE?', 'O QUE HOUVE', 'DESCRIÇÃO', 'DESCRICAO',
                            'OBSERVAÇÕES', 'OBSERVACOES'],
};

/**
 * Detect regional (PR/SC/RS) from a sheet name or file name string
 * @param {string} sheetName
 * @param {string} [fileName]
 * @returns {'PR'|'SC'|'RS'|null}
 */
function detectRegional(sheetName, fileName) {
  const text = `${sheetName || ''} ${fileName || ''}`.toUpperCase();
  // Match whole-word or known state names
  if (/\bRS\b|RIO GRANDE/.test(text)) return 'RS';
  if (/\bSC\b|SANTA CATARINA/.test(text)) return 'SC';
  if (/\bPR\b|PARAN[AÁ]/.test(text)) return 'PR';
  return null;
}

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
 * Convert Excel date serial number, ISO date string, or Brazilian DD/MM/AA(AA) to ISO date string.
 * Returns null if value is empty or cannot be parsed.
 */
function excelDateToString(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return null;
    // Brazilian format: DD/MM/AA or DD/MM/AAAA
    const brMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if (brMatch) {
      const [, d, m, y] = brMatch;
      // Two-digit years: use current century, with a 10-year lookahead cutoff
      let year;
      if (y.length === 2) {
        const pivot = (new Date().getFullYear() % 100) + 10;
        year = parseInt(y, 10) <= pivot ? `20${y}` : `19${y}`;
      } else {
        year = y;
      }
      return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return s;
  }
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
 * Parse boolean-like values, including Portuguese VERDADEIRO/FALSO.
 */
function parseBool(value) {
  if (!value) return false;
  if (typeof value === 'boolean') return value;
  const s = String(value).toUpperCase().trim();
  return s === 'TRUE' || s === '1' || s === 'SIM' || s === 'S' ||
         s === 'VERDADEIRO' || s === 'V';
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
 * @param {object} row
 * @param {string|null} [regional] - override regional if detected from sheet/file name
 */
function parseRow(row, regional) {
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
    regional:                regional || findColumnValue(row, COLUMN_MAP.regional) || null,
    observacao:              findColumnValue(row, COLUMN_MAP.observacao) ? String(findColumnValue(row, COLUMN_MAP.observacao)) : null,
  };
}

/**
 * Import an XLSX file (ArrayBuffer) into the database
 * Returns { imported, updated, skipped, errors, sheetNames }
 * @param {ArrayBuffer} arrayBuffer
 * @param {string} [fileName] - original file name for regional detection
 */
function importXLSX(arrayBuffer, fileName) {
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

    // Detect regional from sheet name + file name
    const regional = detectRegional(sheetName, fileName);

    db.run('BEGIN TRANSACTION');
    try {
      for (const row of rows) {
        try {
          const site = parseRow(row, regional);
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
    'REGIONAL': s.regional || '',
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
    'OBSERVAÇÃO': s.observacao || '',
    'ÚLTIMA_RONDA': s.ultima_ronda_ts || '',
    'OPERADOR': s.ultimo_operador || '',
    'ÚLTIMO_STATUS': s.ultimo_status_ronda || '',
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Checklist');
  XLSX.writeFile(wb, `checklist_cftv_${new Date().toISOString().split('T')[0]}.xlsx`);
}
