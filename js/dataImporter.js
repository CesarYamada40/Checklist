/**
 * dataImporter.js - HTML data importer and demo data seeder
 * Parses regional HTML spreadsheets and populates the SQLite database
 */

// ─── City/Location codes per regional ────────────────────────────────────────

const SIGLA_POOLS = {
  PR: ['LDA','PCH','CWB','MGA','PGR','FOZ','CAS','PAT','CMP','ARU',
       'GUA','PAL','UMU','FEN','SAJ','APU','MAR','COR','JAC','IBI',
       'TLM','PTO','CAM','IGA','BAR','CLF','TAL','SBO','SJP','GER'],
  SC: ['FNS','IDL','BLU','JOI','CRI','TUB','LGS','ARE','ITA','CAC',
       'SAO','CON','XAN','INL','SMI','TIM','MAF','JAR','CAN','FLO',
       'POO','RIO','ICR','LAG','IPO','SBO','ARA','TUP','STO','GAL'],
  RS: ['CBM','GTI','POA','CFD','CAX','PEL','STA','CSU','GRA','IJU',
       'SAP','URI','CRU','ERI','VIO','TRE','BPO','NOV','LIV','ALG',
       'PAR','BAG','TAP','ENT','SAN','CRO','SAL','GUA','ALE','TOR'],
};

// ─── Regional target data (from actual spreadsheets) ─────────────────────────

const REGIONAL_META = {
  PR: { totalSites: 86, alarmesDesconectados: 21, cftvDesconectado: 15, cftvParcial: 4, vegetacao: 0 },
  SC: { totalSites: 83, alarmesDesconectados: 16, cftvDesconectado: 50, cftvParcial: 6, vegetacao: 0 },
  RS: { totalSites: 66, alarmesDesconectados: 14, cftvDesconectado: 75, cftvParcial: 8, vegetacao: 0 },
};

// ─── Known real site siglas (from operational spreadsheets) ──────────────────
// These are seeded as the first entries for each regional to match real data.

const REAL_SIGLAS = {
  PR: [
    { sigla: 'PRLDA79', conta: 1326 }, { sigla: 'PRPCH12', conta: 3425 },
    { sigla: 'PRCWB01', conta: 1401 }, { sigla: 'PRCWB02', conta: 1402 },
    { sigla: 'PRMGA03', conta: 1503 }, { sigla: 'PRPGR04', conta: 1604 },
  ],
  SC: [
    { sigla: 'SCFNSJ7', conta: 1542 }, { sigla: 'SCIDL08', conta: 1789 },
    { sigla: 'SCBLU01', conta: 1601 }, { sigla: 'SCJOI02', conta: 1702 },
    { sigla: 'SCCRI03', conta: 1803 }, { sigla: 'SCTUB04', conta: 1904 },
  ],
  RS: [
    { sigla: 'RSCBM04', conta: 1015 }, { sigla: 'RSGTI15', conta: 2156 },
    { sigla: 'RSPOA01', conta: 2001 }, { sigla: 'RSCFD02', conta: 2102 },
    { sigla: 'RSCAX03', conta: 2203 }, { sigla: 'RSPEL05', conta: 2305 },
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _genSigla(regional, index) {
  // Use known real siglas for the first few entries
  const realList = REAL_SIGLAS[regional] || [];
  if (index < realList.length) return realList[index].sigla;

  const pool = SIGLA_POOLS[regional] || ['SIT'];
  const adjustedIndex = index - realList.length;
  const cityCode = pool[adjustedIndex % pool.length];
  // Sequential number within each city code group (1-based, wraps at 99)
  const seqInGroup = (adjustedIndex % pool.length) + 1;
  const groupCycle = Math.floor(adjustedIndex / pool.length);
  const num = String(((groupCycle * pool.length + seqInGroup) % 100) || 1).padStart(2, '0');
  return `${regional}${cityCode}${num}`;
}

function _genConta(regional, index) {
  const realList = REAL_SIGLAS[regional] || [];
  if (index < realList.length) return realList[index].conta;
  const baseContaOffset = regional === 'PR' ? 0 : regional === 'SC' ? 100 : 200;
  return 1300 + baseContaOffset + index;
}

function _genCameras(index) {
  return [2, 4, 4, 4, 6, 8, 8, 10, 12, 16][index % 10];
}

function _genDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

// ─── Site Generator ───────────────────────────────────────────────────────────

/**
 * Generate realistic sites for a regional matching the target distribution
 * @param {'PR'|'SC'|'RS'} regional
 * @returns {object[]}
 */
function _generateRegionalSites(regional) {
  const meta = REGIONAL_META[regional];
  const sites = [];

  for (let i = 0; i < meta.totalSites; i++) {
    const sigla = _genSigla(regional, i);
    const conta = _genConta(regional, i);
    const padrao = _genCameras(i);

    // Alarm connection status
    const status_conexao = i < meta.alarmesDesconectados ? 'DESCONECTADO' : 'ONLINE';
    const data_desconexao = status_conexao === 'DESCONECTADO'
      ? _genDate(Math.floor(i * 1.5) + 1) : null;

    // CFTV status
    let status2, cameras_hoje, cameras_ontem;
    if (i < meta.cftvDesconectado) {
      status2 = 'DESCONECTADO';
      cameras_hoje = 0;
      cameras_ontem = 0;
    } else if (i < meta.cftvDesconectado + meta.cftvParcial) {
      status2 = 'PARCIAL';
      cameras_hoje = Math.max(1, Math.floor(padrao * 0.6));
      cameras_ontem = Math.max(1, Math.floor(padrao * 0.7));
    } else {
      status2 = 'OK';
      cameras_hoje = padrao;
      cameras_ontem = padrao;
    }

    const camera_problema = status2 === 'PARCIAL' ? '🔶' : status2 === 'DESCONECTADO' ? '❌' : null;

    sites.push({
      conta,
      sigla,
      regional,
      status_conexao,
      data_desconexao,
      os: null,
      zona: String((i % 4) + 1),
      status4: 'MONITORADO',
      padrao_cameras: padrao,
      cameras_ontem,
      cameras_hoje,
      status2,
      data_alteracao: _genDate(i % 7),
      vegetacao_alta: false,
      data_alteracao_vegetacao: null,
      camera_problema,
      status3: null,
      observacao: null,
    });
  }

  return sites;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Seed the database with demo data for all 3 regionals if it is empty.
 * @returns {number|false} Number of sites seeded, or false if already had data
 */
function seedDemoDataIfEmpty() {
  if (!db) return false;

  try {
    const count = Number(db.exec('SELECT COUNT(*) FROM sites')[0]?.values[0][0]) || 0;
    if (count > 0) return false;

    let totalImported = 0;
    db.run('BEGIN TRANSACTION');
    try {
      for (const regional of ['PR', 'SC', 'RS']) {
        for (const site of _generateRegionalSites(regional)) {
          upsertSite(site);
          totalImported++;
        }
      }
      db.run('COMMIT');
    } catch (e) {
      db.run('ROLLBACK');
      throw e;
    }

    saveDatabase();
    console.log(`[dataImporter] Seeded ${totalImported} demo sites`);
    return totalImported;
  } catch (e) {
    console.warn('[dataImporter] Could not seed demo data:', e);
    return false;
  }
}

// ─── HTML Column Mapping Helpers ──────────────────────────────────────────────

/**
 * Build a field→columnIndex map from a header row.
 * Uses COLUMN_MAP (from xlsx-import.js) with case-insensitive partial matching.
 * Falls back to positional mapping when the standard header keyword format is detected.
 *
 * @param {string[]} headerTexts  Normalised (trimmed, upper-cased) header cell texts
 * @returns {object}  { field: columnIndex, ... }
 */
function _buildColIndex(headerTexts) {
  const colIndex = {};

  if (typeof COLUMN_MAP !== 'undefined') {
    for (const [field, candidates] of Object.entries(COLUMN_MAP)) {
      // Pre-compute upper-cased candidates once per field
      const upperCandidates = candidates.map(c => c.toUpperCase());
      for (let j = 0; j < headerTexts.length; j++) {
        const h = headerTexts[j];
        if (upperCandidates.some(c => h === c || h.includes(c))) {
          if (colIndex[field] === undefined) colIndex[field] = j; // first match wins
          break;
        }
      }
    }
  }

  // Minimal fallback for files that have common keywords even without COLUMN_MAP
  headerTexts.forEach((t, j) => {
    if (colIndex.conta === undefined && t === 'CONTA') colIndex.conta = j;
    if (colIndex.sigla === undefined && (t === 'SIGLA' || t === 'SITE' || t === 'NOME')) colIndex.sigla = j;
    if (colIndex.status_conexao === undefined && (t === 'STATUS' || t === 'ALARME')) colIndex.status_conexao = j;
  });

  return colIndex;
}

/**
 * Apply positional column mapping for the known fixed-column HTML export format:
 *   Col 0: seq#, Col 1: CONTA, Col 2: SIGLA, Col 3: STATUS,
 *   Col 4: DATA, Col 5: O.S., Col 6: ZONA, Col 7: STATUS4,
 *   Col 8: PADRÃO CÂMERAS, Col 9: ONTEM, Col 10: HOJE, Col 11: STATUS2,
 *   Col 12: DATA ALTERAÇÃO, Col 13: VEGETAÇÃO, Col 14–28: camera cols,
 *   Col 29–31: observações / data / ticket
 *
 * Only applies when at least CONTA (col 1) and SIGLA (col 2) look valid.
 *
 * @param {string[]} vals  Cell values for a data row
 * @param {string|null} regional
 * @returns {object|null}  Parsed site object, or null if row looks invalid
 */
function _parseRowPositional(vals, regional) {
  const sigla = (vals[2] || '').trim().toUpperCase();
  // Validate sigla: 2–10 chars, starts with 2 letters, rest alphanumeric
  if (!sigla || !/^[A-Z]{2}[A-Z0-9]{0,8}$/.test(sigla)) return null;

  const conta = parseInt(vals[1], 10) || null;

  // Derive regional from sigla prefix if not provided
  let reg = regional;
  if (!reg && sigla.length >= 2) {
    const prefix = sigla.slice(0, 2);
    if (['PR', 'SC', 'RS'].includes(prefix)) reg = prefix;
  }

  const statusConexao = (vals[3] || '').trim().toUpperCase() || null;
  const dataDesconexao = (typeof excelDateToString === 'function')
    ? excelDateToString(vals[4] || '') : (vals[4] || null);
  const os   = (vals[5] || '').trim() || null;
  const zona = (vals[6] || '').trim() || null;
  const status4 = (vals[7] || '').trim() || null;

  const padrao   = parseInt(vals[8],  10) || null;
  const ontem    = parseInt(vals[9],  10);
  const hoje     = parseInt(vals[10], 10);
  const status2  = (vals[11] || '').trim().toUpperCase() || null;
  const dataAlt  = (typeof excelDateToString === 'function')
    ? excelDateToString(vals[12] || '') : (vals[12] || null);

  // Use parseBool from xlsx-import.js (handles VERDADEIRO/FALSO/TRUE/FALSE/SIM)
  const vegetacao = (typeof parseBool === 'function')
    ? parseBool(vals[13])
    : (vals[13] || '').trim().toUpperCase() === 'VERDADEIRO' ||
      (vals[13] || '').trim().toUpperCase() === 'TRUE';

  // Camera problem: look for a cell in columns 14-28 that contains a problem emoji/keyword
  let cameraProblema = null;
  for (let k = 14; k <= Math.min(28, vals.length - 1); k++) {
    const v = (vals[k] || '').trim();
    if (v && v !== '-' && v !== '0' && /[⬛🔶📶❌]|ESCURA|OBSTRU|SEM SINAL|OFFLINE|PROBLEMA/i.test(v)) {
      cameraProblema = cameraProblema ? `${cameraProblema}, ${v}` : v;
    }
  }

  // Observation: cols 29-31 (O QUE HOUVE?, QUANDO, N TICKET)
  const obsCols = vals.slice(29, 32).filter(v => v && v.trim() && v.trim() !== '-');
  const observacao = obsCols.length ? obsCols.join(' | ') : null;

  return {
    conta,
    sigla,
    regional: reg,
    status_conexao: statusConexao,
    data_desconexao: dataDesconexao || null,
    os,
    zona,
    status4,
    padrao_cameras: padrao,
    cameras_ontem: isNaN(ontem) ? null : ontem,
    cameras_hoje:  isNaN(hoje)  ? null : hoje,
    status2,
    data_alteracao: dataAlt || null,
    vegetacao_alta: vegetacao,
    data_alteracao_vegetacao: null,
    camera_problema: cameraProblema,
    status3: null,
    observacao,
  };
}

/**
 * Parse and import an HTML table string into the database.
 * Supports both named-column HTML exports and positional fixed-column format
 * (Cols A-AF as exported from Google Sheets / Excel for PR, SC and RS regionals).
 *
 * @param {string} htmlContent  HTML string to parse
 * @param {string} [regional]   Regional override ('PR'|'SC'|'RS')
 * @returns {{ imported: number, updated: number, skipped: number, errors: string[] }}
 */
function importFromHTML(htmlContent, regional) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');

  let imported = 0, updated = 0, skipped = 0;
  const errors = [];

  const tables = doc.querySelectorAll('table');
  if (!tables.length) throw new Error('Nenhuma tabela encontrada no arquivo HTML');

  // Detect regional from page title or body text when no override given
  const detectedRegional = regional ||
    (typeof detectRegional === 'function'
      ? detectRegional(doc.title, doc.body?.textContent?.slice(0, 200) || '')
      : null);

  for (const table of tables) {
    const rows = Array.from(table.querySelectorAll('tr'));
    if (rows.length < 2) continue;

    // ── Find the header row ──────────────────────────────────────────────────
    let headerTexts = null;
    let dataStart   = 0;
    let usePositional = false;

    for (let i = 0; i < Math.min(8, rows.length); i++) {
      const cells = Array.from(rows[i].querySelectorAll('th,td'));
      if (cells.length < 3) continue;
      const texts = cells.map(c => c.textContent.trim().toUpperCase());

      const hasConta = texts.some(t => t === 'CONTA');
      const hasSigla = texts.some(t => t === 'SIGLA' || t === 'SITE');

      if (hasConta || hasSigla) {
        headerTexts = texts;
        dataStart   = i + 1;
        break;
      }
    }

    // No named-header found → try positional (fixed-column) detection
    if (!headerTexts) {
      // Check if first data row has a potential sigla in column index 2
      for (let i = 0; i < Math.min(8, rows.length); i++) {
        const cells = Array.from(rows[i].querySelectorAll('td'));
        if (cells.length < 10) continue;
        const vals = cells.map(c => c.textContent.trim());
        const candidate = vals[2] || '';
        if (/^[A-Z]{2}[A-Z0-9]{2,8}$/.test(candidate.toUpperCase())) {
          dataStart     = i;
          usePositional = true;
          break;
        }
      }
      if (!usePositional) continue; // cannot parse this table
    }

    // ── Build column-index map for named-header mode ─────────────────────────
    const colIndex = headerTexts ? _buildColIndex(headerTexts) : {};

    // ── Process data rows ────────────────────────────────────────────────────
    db.run('BEGIN TRANSACTION');
    try {
      for (let i = dataStart; i < rows.length; i++) {
        const cells = Array.from(rows[i].querySelectorAll('td'));
        if (cells.length < 2) { skipped++; continue; }

        const vals = cells.map(c => c.textContent.trim());

        try {
          let site;

          if (usePositional) {
            site = _parseRowPositional(vals, detectedRegional);
          } else {
            // Build a row-object keyed by COLUMN_MAP first candidate
            const rowObj = {};
            for (const [field, idx] of Object.entries(colIndex)) {
              if (idx !== undefined && idx < vals.length && vals[idx] !== '') {
                const colName = (typeof COLUMN_MAP !== 'undefined')
                  ? COLUMN_MAP[field][0] : field;
                rowObj[colName] = vals[idx];
              }
            }
            if (typeof parseRow !== 'undefined') {
              site = parseRow(rowObj, detectedRegional);
            } else {
              // In named-header mode, require that sigla was found in the headers
              if (colIndex.sigla === undefined) { skipped++; continue; }
              const siglaVal = vals[colIndex.sigla] || '';
              if (!siglaVal) { skipped++; continue; }
              site = { sigla: siglaVal.trim().toUpperCase(), regional: detectedRegional };
            }
          }

          if (!site || !site.sigla) { skipped++; continue; }

          const existing = getSiteBySigla(site.sigla);
          upsertSite(site);
          if (existing) updated++; else imported++;
        } catch (e) {
          errors.push(`Linha ${i + 1}: ${e.message}`);
          skipped++;
        }
      }
      db.run('COMMIT');
    } catch (e) {
      db.run('ROLLBACK');
      errors.push(`Tabela: ${e.message}`);
    }
  }

  saveDatabase();
  return { imported, updated, skipped, errors };
}

/**
 * Parse an HTML regional spreadsheet and return structured site objects WITHOUT
 * saving to the database.  Useful for preview, validation, or custom processing.
 *
 * @param {string} htmlContent   Full HTML string of the exported spreadsheet
 * @param {string} [regionalCode] Override regional code ('PR'|'SC'|'RS').
 *   If omitted, the regional is auto-detected from the page title / file name.
 * @returns {object[]}  Array of site objects matching the database schema
 *
 * @example
 *   const sites = parseRegionalHTML(htmlString, 'PR');
 *   console.log(sites.length, 'sites found');
 *   sites.forEach(s => console.log(s.sigla, s.status_conexao, s.status2));
 */
function parseRegionalHTML(htmlContent, regionalCode) {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(htmlContent, 'text/html');

  const regional = regionalCode ||
    (typeof detectRegional === 'function'
      ? detectRegional(doc.title, doc.body?.textContent?.slice(0, 200) || '')
      : null);

  const sites = [];

  for (const table of doc.querySelectorAll('table')) {
    const rows = Array.from(table.querySelectorAll('tr'));
    if (rows.length < 2) continue;

    let headerTexts = null;
    let dataStart   = 0;
    let usePositional = false;

    for (let i = 0; i < Math.min(8, rows.length); i++) {
      const cells = Array.from(rows[i].querySelectorAll('th,td'));
      if (cells.length < 3) continue;
      const texts = cells.map(c => c.textContent.trim().toUpperCase());
      if (texts.some(t => t === 'CONTA') || texts.some(t => t === 'SIGLA' || t === 'SITE')) {
        headerTexts = texts;
        dataStart   = i + 1;
        break;
      }
    }

    if (!headerTexts) {
      for (let i = 0; i < Math.min(8, rows.length); i++) {
        const cells = Array.from(rows[i].querySelectorAll('td'));
        if (cells.length < 10) continue;
        const vals = cells.map(c => c.textContent.trim());
        if (/^[A-Z]{2}[A-Z0-9]{2,8}$/.test((vals[2] || '').toUpperCase())) {
          dataStart     = i;
          usePositional = true;
          break;
        }
      }
      if (!usePositional) continue;
    }

    const colIndex = headerTexts ? _buildColIndex(headerTexts) : {};

    for (let i = dataStart; i < rows.length; i++) {
      const cells = Array.from(rows[i].querySelectorAll('td'));
      if (cells.length < 2) continue;
      const vals = cells.map(c => c.textContent.trim());

      try {
        let site;
        if (usePositional) {
          site = _parseRowPositional(vals, regional);
        } else {
          const rowObj = {};
          for (const [field, idx] of Object.entries(colIndex)) {
            if (idx !== undefined && idx < vals.length && vals[idx] !== '') {
              const colName = (typeof COLUMN_MAP !== 'undefined') ? COLUMN_MAP[field][0] : field;
              rowObj[colName] = vals[idx];
            }
          }
          site = (typeof parseRow !== 'undefined')
            ? parseRow(rowObj, regional)
            : (colIndex.sigla !== undefined && vals[colIndex.sigla]
                ? { sigla: vals[colIndex.sigla].trim().toUpperCase(), regional }
                : null);
        }
        if (site && site.sigla) sites.push(site);
      } catch (_) { /* skip malformed rows */ }
    }
  }

  return sites;
}

/**
 * Import an HTML file chosen by the user via a file input.
 * @param {File} file
 * @param {string} [regional]
 * @returns {Promise<{ imported, updated, skipped, errors }>}
 */
function importHTMLFile(file, regional) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const reg = regional || (typeof detectRegional !== 'undefined'
          ? detectRegional('', file.name) : null);
        resolve(importFromHTML(e.target.result, reg));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsText(file, 'utf-8');
  });
}

/**
 * Open file picker and import one or more HTML regional files.
 * Refreshes dashboard and site list on completion.
 * @deprecated Use openHTMLImportModal() for the full preview workflow.
 */
function triggerHTMLImport() {
  openHTMLImportModal();
}

// ─── HTML Import Modal (Preview Workflow) ────────────────────────────────────

/** Internal state for the import preview modal */
const _importState = {
  sites: [],      // annotated parsed site objects ({ ...site, _existing, _include })
  fileNames: [],  // source file names for display
  escHandler: null,
};

/**
 * Open the HTML import modal.
 * Provides file upload + paste HTML tabs, a preview table with new/update badges,
 * merge-or-skip control for duplicates, and a confirm step before writing to DB.
 */
function openHTMLImportModal() {
  closeHTMLImportModal(); // remove any leftover modal

  const modal = document.createElement('div');
  modal.id = 'html-import-modal';
  modal.className = 'html-import-overlay';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Importar Planilha HTML Regional');

  modal.innerHTML = `
    <div class="html-import-dialog" role="document">

      <!-- Header -->
      <div class="html-import-header">
        <div class="html-import-header-text">
          <h2 class="html-import-title">📥 Importar Planilha HTML Regional</h2>
          <p class="html-import-subtitle">Suporta exportações do Google Sheets: PR.html, SC.html, RS.html</p>
        </div>
        <button class="html-import-close" onclick="closeHTMLImportModal()" aria-label="Fechar">✕</button>
      </div>

      <!-- Info banner: non-destructive import -->
      <div class="html-import-info-banner" role="note" aria-label="Informação sobre importação">
        <span class="html-import-info-icon" aria-hidden="true">ℹ️</span>
        <span>
          <strong>Importação não destrutiva:</strong> os sites já cadastrados nunca são apagados.
          Você pode importar novas planilhas a qualquer momento para <strong>adicionar mais sites</strong> sem perder os dados existentes.
          Use o modo <em>"Apenas novos"</em> para garantir que nenhum site existente seja alterado.
        </span>
      </div>

      <!-- Tabs -->
      <div class="html-import-tabs" role="tablist">
        <button class="html-import-tab html-import-tab-active"
                role="tab" aria-selected="true"
                data-tab="file" onclick="switchHTMLImportTab('file')">📁 Arquivo HTML</button>
        <button class="html-import-tab"
                role="tab" aria-selected="false"
                data-tab="paste" onclick="switchHTMLImportTab('paste')">📋 Colar HTML</button>
      </div>

      <!-- Tab: File upload -->
      <div id="html-import-tab-file" class="html-import-tab-content" role="tabpanel">
        <div class="html-import-dropzone"
             id="html-import-dropzone"
             tabindex="0"
             role="button"
             aria-label="Arraste arquivos HTML aqui ou pressione Enter para abrir o seletor de arquivos"
             onclick="document.getElementById('html-import-file-input').click()"
             onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();document.getElementById('html-import-file-input').click();}"
             ondrop="handleHTMLImportDrop(event)"
             ondragover="event.preventDefault();this.classList.add('drag-over')"
             ondragleave="this.classList.remove('drag-over')">
          <div class="dropzone-icon" aria-hidden="true">📂</div>
          <p class="dropzone-title">Arraste os arquivos HTML aqui</p>
          <p class="dropzone-sub">ou clique para selecionar</p>
          <input type="file" id="html-import-file-input"
                 accept=".html,.htm" multiple
                 style="display:none"
                 onchange="handleHTMLImportFileInput(event)">
        </div>
        <p class="html-import-hint">
          💡 Selecione um ou mais arquivos: <code>PR.html</code>, <code>SC.html</code>, <code>RS.html</code>.
          A regional é detectada automaticamente pelo nome do arquivo.
        </p>
      </div>

      <!-- Tab: Paste HTML -->
      <div id="html-import-tab-paste" class="html-import-tab-content hidden" role="tabpanel">
        <div class="html-import-paste-controls">
          <label class="html-import-label" for="html-import-regional-select">Regional:</label>
          <select id="html-import-regional-select" class="html-import-select">
            <option value="">Auto-detectar pelo conteúdo</option>
            <option value="PR">📍 PR – Paraná</option>
            <option value="SC">📍 SC – Santa Catarina</option>
            <option value="RS">📍 RS – Rio Grande do Sul</option>
          </select>
          <button class="btn btn-outline btn-sm" onclick="loadHTMLImportSample()">📄 Exemplo</button>
        </div>
        <textarea id="html-import-paste-input"
                  class="html-import-paste-area"
                  rows="8"
                  spellcheck="false"
                  aria-label="Cole o HTML da planilha aqui"
                  placeholder="Cole aqui o conteúdo HTML da planilha (use Arquivo > Salvar Como > Página da Web no Google Sheets, ou Ctrl+A e Ctrl+C na página HTML aberta)..."></textarea>
        <button class="btn btn-primary" onclick="parseHTMLImportPaste()" style="margin-top:8px">
          🔍 Analisar HTML
        </button>
      </div>

      <!-- Preview section (hidden until parsing completes) -->
      <div id="html-import-preview-section" class="html-import-preview hidden" aria-live="polite">
        <div class="preview-summary-bar">
          <div id="html-import-preview-count" class="preview-count" role="status"></div>
          <div class="preview-dup-row">
            <label class="html-import-label" for="html-import-dup-mode">
              Sites duplicados:
              <span class="html-import-dup-hint"
                    role="tooltip"
                    aria-label="Define o que acontece quando um site da planilha já existe no banco de dados. Os dados dos demais sites existentes nunca são apagados."
                    title="Define o que acontece quando um site da planilha já existe no banco de dados. Os dados dos demais sites existentes nunca são apagados."
                    tabindex="0">❓</span>
            </label>
            <select id="html-import-dup-mode" class="html-import-select html-import-select-sm">
              <option value="skip" aria-label="Apenas novos — manter dados existentes intactos">✅ Apenas novos — manter dados existentes intactos</option>
              <option value="merge" aria-label="Mesclar — atualizar campos dos sites existentes">🔄 Mesclar — atualizar campos dos sites existentes</option>
            </select>
          </div>
        </div>
        <div class="preview-table-wrap">
          <table class="preview-table" aria-label="Preview dos sites encontrados">
            <thead>
              <tr>
                <th>Regional</th>
                <th>Sigla</th>
                <th>Conta</th>
                <th>Alarme</th>
                <th>CFTV</th>
                <th>Câm.</th>
                <th>Veg.</th>
                <th>Observação</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="html-import-preview-tbody"></tbody>
          </table>
        </div>
        <div class="preview-footer">
          <button class="btn btn-secondary" onclick="closeHTMLImportModal()">✕ Cancelar</button>
          <button class="btn btn-primary" id="html-import-confirm-btn" onclick="confirmHTMLImport()">
            ✅ Confirmar Importação
          </button>
        </div>
      </div>

    </div>
  `;

  document.body.appendChild(modal);

  _importState.sites = [];
  _importState.fileNames = [];

  // Close on overlay click
  modal.addEventListener('click', e => {
    if (e.target === modal) closeHTMLImportModal();
  });

  // Close on ESC
  _importState.escHandler = e => {
    if (e.key === 'Escape') closeHTMLImportModal();
  };
  document.addEventListener('keydown', _importState.escHandler);
}

/** Close and clean up the import modal */
function closeHTMLImportModal() {
  const el = document.getElementById('html-import-modal');
  if (el) el.remove();
  _importState.sites = [];
  _importState.fileNames = [];
  if (_importState.escHandler) {
    document.removeEventListener('keydown', _importState.escHandler);
    _importState.escHandler = null;
  }
}

/** Switch between "file" and "paste" import tabs */
function switchHTMLImportTab(tab) {
  document.querySelectorAll('.html-import-tab').forEach(t => {
    const isActive = t.dataset.tab === tab;
    t.classList.toggle('html-import-tab-active', isActive);
    t.setAttribute('aria-selected', String(isActive));
  });
  const fileTab  = document.getElementById('html-import-tab-file');
  const pasteTab = document.getElementById('html-import-tab-paste');
  if (fileTab)  fileTab.classList.toggle('hidden', tab !== 'file');
  if (pasteTab) pasteTab.classList.toggle('hidden', tab !== 'paste');
  // Hide preview when switching tabs
  document.getElementById('html-import-preview-section')?.classList.add('hidden');
}

/** Handle file input change event */
async function handleHTMLImportFileInput(event) {
  const files = Array.from(event.target.files);
  if (!files.length) return;
  await _processHTMLImportFiles(files);
}

/** Handle drag-and-drop file event */
async function handleHTMLImportDrop(event) {
  event.preventDefault();
  document.getElementById('html-import-dropzone')?.classList.remove('drag-over');
  const files = Array.from(event.dataTransfer.files).filter(
    f => /\.(html|htm)$/i.test(f.name)
  );
  if (!files.length) {
    showToast('❌ Nenhum arquivo HTML detectado no drop', 'error');
    return;
  }
  await _processHTMLImportFiles(files);
}

/** Parse multiple HTML files and populate the preview */
async function _processHTMLImportFiles(files) {
  _importState.fileNames = files.map(f => f.name);
  const allSites = [];

  showToast('⏳ Analisando arquivos HTML...', 'info', 2000);

  for (const file of files) {
    try {
      const html = await _readFileAsText(file);
      // detectRegional(sheetName, fileName): pass empty string for sheetName since
      // we are detecting from the file name only (e.g. "PR.html" → 'PR')
      const reg = (typeof detectRegional === 'function')
        ? detectRegional('', file.name) : null;
      const sites = parseRegionalHTML(html, reg || undefined);
      allSites.push(...sites);
    } catch (e) {
      showToast(`❌ Erro em ${file.name}: ${e.message}`, 'error', 4000);
    }
  }

  _importState.sites = allSites;
  _showHTMLImportPreview();
}

/** Parse pasted HTML content and show the preview */
function parseHTMLImportPaste() {
  const html = (document.getElementById('html-import-paste-input')?.value || '').trim();
  if (!html) {
    showToast('⚠️ Cole o HTML da planilha antes de analisar.', 'warning');
    return;
  }
  const regional = document.getElementById('html-import-regional-select')?.value || undefined;
  _importState.fileNames = ['colado'];
  _importState.sites = parseRegionalHTML(html, regional);
  _showHTMLImportPreview();
}

/**
 * Load a minimal sample HTML table into the paste textarea for testing.
 * The sample matches the positional column layout expected by _parseRowPositional.
 */
function loadHTMLImportSample() {
  const sample = [
    '<!DOCTYPE html><html><body><table>',
    '<tr>',
    '  <th>N</th><th>CONTA</th><th>SIGLA</th><th>STATUS</th><th>DATA</th>',
    '  <th>O.S.</th><th>ZONA</th><th>STATUS4</th><th>PADRÃO DE CÂMERAS</th>',
    '  <th>ONTEM</th><th>HOJE</th><th>STATUS2</th><th>DATA DA ALTERAÇÃO</th>',
    '  <th>VEGETAÇÃO ALTA</th>',
    '</tr>',
    '<tr><td>1</td><td>1326</td><td>PRLDA01</td><td>ONLINE</td><td></td>',
    '    <td></td><td>1</td><td>MONITORADO</td><td>4</td><td>4</td><td>4</td>',
    '    <td>OK</td><td>2026-01-15</td><td>FALSO</td></tr>',
    '<tr><td>2</td><td>1327</td><td>PRLDA02</td><td>DESCONECTADO</td><td>2026-02-10</td>',
    '    <td></td><td>2</td><td>MONITORADO</td><td>8</td><td>0</td><td>0</td>',
    '    <td>DESCONECTADO</td><td>2026-02-10</td><td>FALSO</td></tr>',
    '<tr><td>3</td><td>1328</td><td>PRCWB01</td><td>ONLINE</td><td></td>',
    '    <td></td><td>1</td><td>MONITORADO</td><td>6</td><td>4</td><td>4</td>',
    '    <td>PARCIAL</td><td>2026-01-20</td><td>VERDADEIRO</td></tr>',
    '</table></body></html>',
  ].join('\n');

  const el = document.getElementById('html-import-paste-input');
  if (el) el.value = sample;
  const selEl = document.getElementById('html-import-regional-select');
  if (selEl) selEl.value = 'PR';
  showToast('📄 HTML de exemplo carregado. Clique em Analisar HTML.', 'info', 3000);
}

/**
 * Render the preview table with new/update badges.
 * Each site is annotated with _existing (DB record or null) and _include (bool).
 */
function _showHTMLImportPreview() {
  const sites = _importState.sites;
  const section = document.getElementById('html-import-preview-section');
  if (!section) return;

  if (!sites.length) {
    showToast(
      '⚠️ Nenhum site encontrado. Verifique se o HTML contém a tabela no formato esperado (colunas SIGLA, CONTA).',
      'warning', 6000
    );
    return;
  }

  // Annotate with DB existence (getSiteBySigla returns null when not found, so the
  // catch only fires for unexpected DB errors — the site is treated as new in that case)
  const annotated = sites.map(s => {
    let existing = null;
    try { existing = getSiteBySigla(s.sigla); } catch (e) {
      console.warn('[_showHTMLImportPreview] getSiteBySigla error for', s.sigla, e);
    }
    return { ...s, _existing: existing };
  });
  _importState.sites = annotated;

  const newCount = annotated.filter(s => !s._existing).length;
  const updCount = annotated.filter(s =>  s._existing).length;

  const countEl = document.getElementById('html-import-preview-count');
  if (countEl) {
    countEl.innerHTML =
      `<strong>${annotated.length}</strong> sites encontrados &mdash; ` +
      `<span class="preview-count-new"><span aria-hidden="true">✅</span> ${newCount} novos</span>` +
      ` / <span class="preview-count-upd"><span aria-hidden="true">🔄</span> ${updCount} já cadastrados</span>`;
  }

  const tbody = document.getElementById('html-import-preview-tbody');
  if (tbody) {
    tbody.innerHTML = annotated.map(s => {
      const badge = s._existing
        ? '<span class="preview-badge preview-badge-update" aria-label="Atualizar site existente">atualizar</span>'
        : '<span class="preview-badge preview-badge-new" aria-label="Novo site">novo</span>';

      const alarmClass  = typeof connectionStatusClass === 'function' ? connectionStatusClass(s.status_conexao) : '';
      const cftvClass   = typeof status2Class           === 'function' ? status2Class(s.status2) : '';
      const obs = (s.observacao || '');
      const obsShort = obs.length > 35 ? obs.slice(0, 35) + '…' : obs;

      return `
        <tr class="preview-row ${s._existing ? 'preview-row-update' : 'preview-row-new'}">
          <td><span class="badge-regional badge-regional-${escapeHtml(s.regional || '')}">${escapeHtml(s.regional || '-')}</span></td>
          <td><strong class="preview-sigla">${escapeHtml(s.sigla)}</strong></td>
          <td>${s.conta || '-'}</td>
          <td><span class="badge ${alarmClass}">${escapeHtml(s.status_conexao || '-')}</span></td>
          <td><span class="badge ${cftvClass}">${escapeHtml(s.status2 || '-')}</span></td>
          <td>${s.padrao_cameras !== null && s.padrao_cameras !== undefined ? s.padrao_cameras : '-'}</td>
          <td>${s.vegetacao_alta ? '🌿' : ''}</td>
          <td class="preview-obs-cell" title="${escapeHtml(obs)}">${escapeHtml(obsShort)}</td>
          <td>${badge}</td>
        </tr>
      `;
    }).join('');
  }

  const confirmBtn = document.getElementById('html-import-confirm-btn');
  if (confirmBtn) confirmBtn.textContent = `✅ Importar ${annotated.length} Sites`;

  section.classList.remove('hidden');
  section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Commit the previewed sites to the database.
 * Respects the merge/skip duplicate mode chosen by the user.
 */
function confirmHTMLImport() {
  const sites = _importState.sites;
  if (!sites.length) return;

  const dupMode = document.getElementById('html-import-dup-mode')?.value || 'merge';

  let imported = 0, updated = 0, skipped = 0;
  const errors = [];

  db.run('BEGIN TRANSACTION');
  try {
    for (const site of sites) {
      try {
        if (!site.sigla) { skipped++; continue; }
        if (site._existing && dupMode === 'skip') { skipped++; continue; }
        upsertSite(site);
        if (site._existing) updated++; else imported++;
      } catch (e) {
        errors.push(`${site.sigla}: ${e.message}`);
        skipped++;
      }
    }
    db.run('COMMIT');
    saveDatabase();
  } catch (e) {
    db.run('ROLLBACK');
    showToast(`❌ Erro ao salvar: ${e.message}`, 'error', 6000);
    console.error('[confirmHTMLImport]', e);
    return;
  }

  if (errors.length) console.warn('[HTML import errors]', errors);

  showToast(
    `✅ Importação concluída: ${imported} novos adicionados, ${updated} atualizados, ${skipped} ignorados — demais dados preservados`,
    'success', 5000
  );

  closeHTMLImportModal();
  refreshDashboard();
  renderSitesList();
}

// ─── File Reading Helper ──────────────────────────────────────────────────────

/**
 * Read a File object as UTF-8 text.
 * @param {File} file
 * @returns {Promise<string>}
 */
function _readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error(`Erro ao ler ${file.name}`));
    reader.readAsText(file, 'utf-8');
  });
}
