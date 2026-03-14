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

/**
 * Parse and import an HTML table string into the database.
 * Looks for <table> elements with CONTA / SIGLA column headers.
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

  for (const table of tables) {
    const rows = Array.from(table.querySelectorAll('tr'));
    if (rows.length < 2) continue;

    // Locate header row (first row whose cells mention CONTA or SIGLA)
    let headerTexts = null;
    let dataStart = 0;

    for (let i = 0; i < Math.min(6, rows.length); i++) {
      const cells = Array.from(rows[i].querySelectorAll('th,td'));
      if (cells.length < 3) continue;
      const texts = cells.map(c => c.textContent.trim().toUpperCase());
      if (texts.some(t => t.includes('CONTA') || t.includes('SIGLA') || t.includes('SITE'))) {
        headerTexts = texts;
        dataStart = i + 1;
        break;
      }
    }

    if (!headerTexts) continue;

    // Detect regional from doc title or file content
    const detectedRegional = regional ||
      (typeof detectRegional === 'function' ? detectRegional(doc.title, '') : null);

    // Map field → column index using COLUMN_MAP from xlsx-import.js
    const colIndex = {};
    if (typeof COLUMN_MAP !== 'undefined') {
      for (const [field, candidates] of Object.entries(COLUMN_MAP)) {
        for (let j = 0; j < headerTexts.length; j++) {
          if (candidates.some(c => headerTexts[j].includes(c.toUpperCase()))) {
            colIndex[field] = j;
            break;
          }
        }
      }
    } else {
      // Minimal fallback mapping
      headerTexts.forEach((t, j) => {
        if (t.includes('CONTA')) colIndex.conta = j;
        if (t.includes('SIGLA') || t.includes('SITE')) colIndex.sigla = j;
        if (t.includes('STATUS')) colIndex.status_conexao = j;
      });
    }

    db.run('BEGIN TRANSACTION');
    try {
      for (let i = dataStart; i < rows.length; i++) {
        const cells = Array.from(rows[i].querySelectorAll('td'));
        if (cells.length < 2) { skipped++; continue; }

        const vals = cells.map(c => c.textContent.trim());
        const row = {};
        for (const [field, idx] of Object.entries(colIndex)) {
          if (idx !== undefined && idx < vals.length && vals[idx] !== '') {
            const colName = typeof COLUMN_MAP !== 'undefined' ? COLUMN_MAP[field][0] : field;
            row[colName] = vals[idx];
          }
        }

        try {
          let site;
          if (typeof parseRow !== 'undefined') {
            site = parseRow(row, detectedRegional);
          } else {
            const siglaVal = vals[colIndex.sigla ?? 1];
            if (!siglaVal) { skipped++; continue; }
            site = { sigla: String(siglaVal).trim().toUpperCase(), regional: detectedRegional };
          }
          if (!site || !site.sigla) { skipped++; continue; }

          const existing = getSiteBySigla(site.sigla);
          upsertSite(site);
          if (existing) updated++; else imported++;
        } catch (e) {
          errors.push(`Linha ${i}: ${e.message}`);
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
 */
function triggerHTMLImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.html,.htm';
  input.multiple = true;
  input.onchange = async e => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    showToast('⏳ Importando arquivos HTML...', 'info', 2000);
    let totalImported = 0, totalUpdated = 0, totalSkipped = 0;
    const errors = [];

    for (const file of files) {
      try {
        const r = await importHTMLFile(file);
        totalImported += r.imported;
        totalUpdated  += r.updated;
        totalSkipped  += r.skipped;
        if (r.errors.length) errors.push(...r.errors);
      } catch (err) {
        errors.push(`${file.name}: ${err.message}`);
      }
    }

    showToast(`✅ HTML: ${totalImported} novos, ${totalUpdated} atualizados, ${totalSkipped} ignorados`, 'success', 5000);
    if (errors.length) console.warn('[HTML import errors]', errors);

    refreshDashboard();
    renderSitesList();
  };
  input.click();
}
