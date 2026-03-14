/**
 * dataImporter.js - HTML data importer and demo data seeder
 * Parses regional HTML spreadsheets and populates the SQLite database
 */

// ─── City/Location codes per regional ────────────────────────────────────────

const SIGLA_POOLS = {
  PR: ['CWB','LDA','MGA','PGR','FOZ','CAS','PAT','CMP','ARU','GUA',
       'PAL','UMU','FEN','SAJ','APU','MAR','COR','JAC','IBI','TLM',
       'PTO','CAM','IGA','BAR','CLF','TAL','SBO','SJP','GER','PIN'],
  SC: ['FNS','CHA','BLU','JOI','CRI','TUB','LGS','ARE','ITA','CAC',
       'SAO','CON','XAN','INL','SMI','TIM','MAF','JAR','CAN','FLO',
       'POO','RIO','ICR','LAG','IPO','SBO','ARA','TUP','STO','GAL'],
  RS: ['POA','CFD','CAX','PEL','STA','CSU','GRA','IJU','SAP','URI',
       'CRU','ERI','VIO','TRE','BPO','NOV','SBO','LIV','ALG','CAM',
       'PAR','BAG','TAP','ENT','SAN','CRO','SAL','GUA','ALE','TOR'],
};

// ─── Regional target data (from actual spreadsheets) ─────────────────────────

const REGIONAL_META = {
  PR: { totalSites: 86, alarmesDesconectados: 21, cftvDesconectado: 15, cftvParcial: 4, vegetacao: 0 },
  SC: { totalSites: 83, alarmesDesconectados: 16, cftvDesconectado: 50, cftvParcial: 6, vegetacao: 0 },
  RS: { totalSites: 66, alarmesDesconectados: 14, cftvDesconectado: 75, cftvParcial: 8, vegetacao: 0 },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _genSigla(regional, index) {
  const pool = SIGLA_POOLS[regional] || ['SIT'];
  const cityCode = pool[index % pool.length];
  const num = String((Math.floor(index / pool.length) * pool.length + (index % pool.length) + 1) % 100).padStart(2, '0');
  return `${regional}${cityCode}${num}`;
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
    const baseContaOffset = regional === 'PR' ? 0 : regional === 'SC' ? 100 : 200;
    const conta = 1300 + baseContaOffset + i;
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
 * Open the drag-and-drop HTML import modal.
 * Shows a preview of the data before importing.
 */
function triggerHTMLImport() {
  _showImporterModal();
}

// ─── Importer Modal ───────────────────────────────────────────────────────────

const _importerState = {
  files:        [],
  previewed:    [],
  strategy:     'mesclar', // 'mesclar' | 'sobrescrever' | 'apenas_novos'
  loading:      false,
  result:       null,
};

/**
 * Renders and shows the drag-and-drop HTML importer modal.
 */
function _showImporterModal() {
  _importerState.files     = [];
  _importerState.previewed = [];
  _importerState.result    = null;

  // Remove any existing modal
  const existing = document.getElementById('importer-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id        = 'importer-modal-overlay';
  overlay.className = 'importer-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'importer-modal-title');

  overlay.innerHTML = `
    <div class="importer-modal" id="importer-modal">
      <div class="importer-modal-header">
        <span class="importer-modal-title" id="importer-modal-title">📥 Importar Planilhas Regionais</span>
        <button class="importer-modal-close" onclick="_closeImporterModal()" aria-label="Fechar">✕</button>
      </div>
      <div class="importer-modal-body">
        <!-- Drop Zone -->
        <div class="drop-zone" id="importer-drop-zone"
          onclick="document.getElementById('importer-file-input').click()"
          ondragover="_importerDragOver(event)"
          ondragleave="_importerDragLeave(event)"
          ondrop="_importerDrop(event)"
          tabindex="0"
          role="button"
          aria-label="Zona de arrastar e soltar arquivos HTML"
          onkeydown="if(e.key==='Enter'||e.key===' ')document.getElementById('importer-file-input').click()">
          <div class="drop-zone-icon">📂</div>
          <div class="drop-zone-label">Arraste os arquivos SC.html e RS.html aqui</div>
          <div class="drop-zone-sub">ou clique para selecionar · Aceita .html e .htm</div>
        </div>
        <input type="file" id="importer-file-input" accept=".html,.htm" multiple style="display:none"
          onchange="_importerFilesSelected(event)">

        <!-- File pills -->
        <div class="file-pills" id="importer-file-pills"></div>

        <!-- Import strategy options -->
        <div class="import-options">
          <label class="import-option">
            <input type="radio" name="import-strategy" value="mesclar" checked
              onchange="_importerState.strategy='mesclar'">
            <div>
              <div class="import-option-label">🔄 Mesclar (Recomendado)</div>
              <div class="import-option-desc">Atualiza sites existentes e cria os novos</div>
            </div>
          </label>
          <label class="import-option">
            <input type="radio" name="import-strategy" value="apenas_novos"
              onchange="_importerState.strategy='apenas_novos'">
            <div>
              <div class="import-option-label">➕ Apenas Novos</div>
              <div class="import-option-desc">Cria apenas sites que ainda não existem</div>
            </div>
          </label>
          <label class="import-option">
            <input type="radio" name="import-strategy" value="sobrescrever"
              onchange="_importerState.strategy='sobrescrever'">
            <div>
              <div class="import-option-label">⚠️ Sobrescrever</div>
              <div class="import-option-desc">Substitui todos os dados dos sites importados</div>
            </div>
          </label>
        </div>

        <!-- Preview -->
        <div class="import-preview" id="importer-preview" style="display:none">
          <div class="import-preview-title">👁 Preview dos dados</div>
          <div class="import-preview-table-wrap">
            <table class="import-preview-table" id="importer-preview-table">
              <thead>
                <tr>
                  <th>Sigla</th>
                  <th>Conta</th>
                  <th>Regional</th>
                  <th>Status Alarme</th>
                  <th>Status CFTV</th>
                  <th>Câmeras</th>
                </tr>
              </thead>
              <tbody id="importer-preview-body"></tbody>
            </table>
          </div>
          <div id="importer-preview-count" style="font-size:.75rem;color:var(--text-muted);margin-top:6px"></div>
        </div>

        <!-- Progress -->
        <div class="import-progress" id="importer-progress" style="display:none">
          <div class="import-progress-text" id="importer-progress-text">Processando...</div>
          <div class="import-progress-bar">
            <div class="import-progress-fill" id="importer-progress-fill" style="width:0%"></div>
          </div>
        </div>

        <!-- Result -->
        <div class="import-result" id="importer-result" style="display:none"></div>
      </div>
      <div class="importer-modal-footer">
        <button class="btn btn-outline" onclick="_closeImporterModal()">Cancelar</button>
        <button class="btn btn-secondary" id="importer-preview-btn"
          onclick="_importerDoPreview()" style="display:none">👁 Preview</button>
        <button class="btn btn-primary" id="importer-import-btn"
          onclick="_importerDoImport()" style="display:none">✅ Importar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Close on overlay click
  overlay.addEventListener('click', e => {
    if (e.target === overlay) _closeImporterModal();
  });

  // Trap focus in modal
  const modal = overlay.querySelector('.importer-modal');
  if (modal) modal.querySelector('.importer-modal-close').focus();
}

function _closeImporterModal() {
  const overlay = document.getElementById('importer-modal-overlay');
  if (overlay) overlay.remove();
}

function _importerDragOver(e) {
  e.preventDefault();
  document.getElementById('importer-drop-zone').classList.add('dragover');
}

function _importerDragLeave(e) {
  document.getElementById('importer-drop-zone').classList.remove('dragover');
}

function _importerDrop(e) {
  e.preventDefault();
  document.getElementById('importer-drop-zone').classList.remove('dragover');
  const files = Array.from(e.dataTransfer.files).filter(f => /\.html?$/i.test(f.name));
  if (files.length) _importerAddFiles(files);
}

function _importerFilesSelected(e) {
  const files = Array.from(e.target.files);
  if (files.length) _importerAddFiles(files);
}

function _importerAddFiles(newFiles) {
  // Merge, avoiding duplicates by name
  const existing = _importerState.files.map(f => f.name);
  newFiles.forEach(f => {
    if (!existing.includes(f.name)) _importerState.files.push(f);
  });
  _importerRenderPills();
  _importerRenderButtons();
  _importerDoPreview();
}

function _importerRenderPills() {
  const container = document.getElementById('importer-file-pills');
  if (!container) return;
  container.innerHTML = _importerState.files.map((f, i) => `
    <div class="file-pill">
      📄 ${escapeHtml(f.name)}
      <button class="file-pill-remove" onclick="_importerRemoveFile(${i})" aria-label="Remover ${escapeHtml(f.name)}">✕</button>
    </div>
  `).join('');
}

function _importerRemoveFile(idx) {
  _importerState.files.splice(idx, 1);
  _importerRenderPills();
  _importerRenderButtons();
  if (!_importerState.files.length) {
    const preview = document.getElementById('importer-preview');
    if (preview) preview.style.display = 'none';
  } else {
    _importerDoPreview();
  }
}

function _importerRenderButtons() {
  const hasFiles = _importerState.files.length > 0;
  const previewBtn = document.getElementById('importer-preview-btn');
  const importBtn  = document.getElementById('importer-import-btn');
  if (previewBtn) previewBtn.style.display = hasFiles ? '' : 'none';
  if (importBtn)  importBtn.style.display  = hasFiles ? '' : 'none';
}

async function _importerDoPreview() {
  if (!_importerState.files.length) return;
  const previewSection = document.getElementById('importer-preview');
  const tbody          = document.getElementById('importer-preview-body');
  const countEl        = document.getElementById('importer-preview-count');
  if (!previewSection || !tbody) return;

  // Parse first file for preview
  const file = _importerState.files[0];
  try {
    const text = await file.text();
    const reg = typeof detectRegional !== 'undefined' ? detectRegional('', file.name) : null;
    const sites = parseRegionalHTML(text, reg);
    _importerState.previewed = sites;

    tbody.innerHTML = sites.slice(0, 20).map(s => `
      <tr>
        <td>${escapeHtml(s.sigla || '-')}</td>
        <td>${escapeHtml(String(s.conta || '-'))}</td>
        <td>${escapeHtml(s.regional || '-')}</td>
        <td>${escapeHtml(s.status_conexao || '-')}</td>
        <td>${escapeHtml(s.status2 || '-')}</td>
        <td>${s.cameras_hoje !== null && s.cameras_hoje !== undefined ? escapeHtml(String(s.cameras_hoje)) : '-'}/${s.padrao_cameras || '-'}</td>
      </tr>
    `).join('');

    if (countEl) {
      const extra = sites.length > 20 ? ` (mostrando 20 de ${sites.length})` : '';
      countEl.textContent = `${sites.length} sites encontrados no arquivo${extra}`;
    }
    previewSection.style.display = '';
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:var(--offline);padding:8px">Erro ao fazer preview: ${escapeHtml(err.message)}</td></tr>`;
    previewSection.style.display = '';
  }
}

async function _importerDoImport() {
  if (!_importerState.files.length) return;
  _importerState.loading = true;

  const progressSection = document.getElementById('importer-progress');
  const progressFill    = document.getElementById('importer-progress-fill');
  const progressText    = document.getElementById('importer-progress-text');
  const importBtn       = document.getElementById('importer-import-btn');
  const resultEl        = document.getElementById('importer-result');

  if (progressSection) progressSection.style.display = '';
  if (importBtn) importBtn.disabled = true;

  let totalImported = 0, totalUpdated = 0, totalSkipped = 0;
  const allErrors   = [];
  const total       = _importerState.files.length;

  for (let i = 0; i < total; i++) {
    const file = _importerState.files[i];
    const pct  = Math.round(((i + 1) / total) * 100);
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (progressText) progressText.textContent = `Importando ${file.name} (${i + 1}/${total})...`;

    try {
      const text = await file.text();
      const reg  = typeof detectRegional !== 'undefined' ? detectRegional('', file.name) : null;
      const r    = importFromHTML(text, reg);

      totalImported += r.imported;
      totalUpdated  += r.updated;
      totalSkipped  += r.skipped;
      if (r.errors && r.errors.length) allErrors.push(...r.errors.map(e => `${file.name}: ${e}`));
    } catch (err) {
      allErrors.push(`${file.name}: ${err.message}`);
    }
  }

  // Registro de auditoria
  if (typeof auditLog === 'function') {
    auditLog('import', `Importação HTML: ${totalImported} novos, ${totalUpdated} atualizados, ${totalSkipped} ignorados`);
  }

  if (progressFill)  progressFill.style.width  = '100%';
  if (progressText)  progressText.textContent  = 'Concluído!';

  // Mostrar resultado
  if (resultEl) {
    resultEl.style.display = '';
    resultEl.innerHTML = `
      <div class="import-result-row">
        <span>✅ Sites novos criados:</span>
        <span style="color:var(--ok)">${totalImported}</span>
      </div>
      <div class="import-result-row">
        <span>🔄 Sites atualizados:</span>
        <span style="color:var(--accent)">${totalUpdated}</span>
      </div>
      <div class="import-result-row">
        <span>⏭️ Linhas ignoradas:</span>
        <span style="color:var(--text-muted)">${totalSkipped}</span>
      </div>
      ${allErrors.length ? `
      <div class="import-result-row">
        <span>⚠️ Erros:</span>
        <span style="color:var(--offline)">${allErrors.length}</span>
      </div>` : ''}
    `;
  }

  if (importBtn) {
    importBtn.textContent = '✅ Fechar';
    importBtn.disabled    = false;
    importBtn.onclick     = () => {
      _closeImporterModal();
      refreshDashboard();
      renderSitesList();
    };
  }

  // Also update a "Cancel" button to "Fechar"
  const cancelBtn = document.querySelector('#importer-modal-overlay .btn-outline');
  if (cancelBtn) {
    cancelBtn.textContent = 'Fechar';
    cancelBtn.onclick     = () => {
      _closeImporterModal();
      refreshDashboard();
      renderSitesList();
    };
  }

  showToast(
    `✅ Importação concluída: ${totalImported} novos, ${totalUpdated} atualizados`,
    'success', 4000
  );

  _importerState.loading = false;
}
