/**
 * database.js - SQLite wrapper using sql.js
 * Manages the CFTV Checklist database (sites, rondas, usuarios)
 */

const DB_KEY = 'cftv_checklist_db';
const DB_BACKUP_KEY = 'cftv_checklist_backup';
const CRITICAL_OFFLINE_DAYS = 7; // Sites offline longer than this are shown as critical
const RONDA_TIPO_CAMERAS = 'cameras';
const RONDA_TIPO_ALARMES = 'alarmes';

let db = null;
let SQL = null;

/**
 * Initialize sql.js and load or create the database
 */
async function initDatabase() {
  SQL = await initSqlJs({
    locateFile: file => `libs/${file}`
  });

  // Try to load existing DB from LocalStorage
  const saved = localStorage.getItem(DB_KEY);
  if (saved) {
    try {
      const arr = JSON.parse(saved);
      db = new SQL.Database(new Uint8Array(arr));
      // Run migrations to ensure schema is up-to-date
      runMigrations();
      return db;
    } catch (e) {
      console.warn('Could not load saved DB, creating new one:', e);
    }
  }

  db = new SQL.Database();
  createSchema();
  saveDatabase();
  return db;
}

/**
 * Create all tables
 */
function createSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT UNIQUE NOT NULL,
      ultimo_acesso TEXT
    );

    CREATE TABLE IF NOT EXISTS sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conta INTEGER UNIQUE,
      sigla TEXT UNIQUE NOT NULL,
      status_conexao TEXT,
      data_desconexao TEXT,
      os TEXT,
      zona TEXT,
      status4 TEXT,
      padrao_cameras INTEGER,
      cameras_ontem INTEGER,
      cameras_hoje INTEGER,
      status2 TEXT,
      data_alteracao TEXT,
      vegetacao_alta INTEGER DEFAULT 0,
      data_alteracao_vegetacao TEXT,
      camera_problema TEXT,
      status3 TEXT,
      regional TEXT,
      observacao TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rondas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL,
      operador TEXT NOT NULL,
      status TEXT NOT NULL,
      cameras_funcionando INTEGER,
      cameras_esperadas INTEGER,
      observacao TEXT,
      tipo TEXT,
      timestamp TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (site_id) REFERENCES sites(id)
    );

    CREATE INDEX IF NOT EXISTS idx_sites_sigla ON sites(sigla);
    CREATE INDEX IF NOT EXISTS idx_rondas_site_id ON rondas(site_id);
    CREATE INDEX IF NOT EXISTS idx_rondas_timestamp ON rondas(timestamp);
  `);
}

/**
 * Run schema migrations to add missing columns
 */
function runMigrations() {
  try {
    // Ensure all columns exist (idempotent)
    const columns = [
      ['sites', 'cameras_ontem', 'INTEGER'],
      ['sites', 'cameras_hoje', 'INTEGER'],
      ['sites', 'status2', 'TEXT'],
      ['sites', 'data_alteracao', 'TEXT'],
      ['sites', 'camera_problema', 'TEXT'],
      ['sites', 'status3', 'TEXT'],
      ['sites', 'regional', 'TEXT'],
      ['sites', 'observacao', 'TEXT'],
      ['rondas', 'tipo', 'TEXT'],
    ];
    for (const [table, col, type] of columns) {
      try {
        db.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
      } catch (_) { /* column already exists */ }
    }
    // Ensure indexes exist
    db.run(`CREATE INDEX IF NOT EXISTS idx_sites_sigla ON sites(sigla)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_rondas_site_id ON rondas(site_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_rondas_timestamp ON rondas(timestamp)`);
    // Ensure tables exist
    createSchema();
  } catch (e) {
    console.warn('Migration warning:', e);
  }
}

/**
 * Persist database to LocalStorage
 */
function saveDatabase() {
  if (!db) return;
  try {
    const data = db.export();
    localStorage.setItem(DB_KEY, JSON.stringify(Array.from(data)));
    // Auto-backup every save
    localStorage.setItem(DB_BACKUP_KEY, JSON.stringify({
      timestamp: new Date().toISOString(),
      data: Array.from(data)
    }));
  } catch (e) {
    console.error('Failed to save database:', e);
  }
}

// ─── Usuarios ───────────────────────────────────────────────────────────────

function upsertUsuario(nome) {
  db.run(
    `INSERT INTO usuarios (nome, ultimo_acesso)
     VALUES (?, datetime('now'))
     ON CONFLICT(nome) DO UPDATE SET ultimo_acesso = datetime('now')`,
    [nome]
  );
  saveDatabase();
}

function getUsuarios() {
  const stmt = db.prepare(`SELECT * FROM usuarios ORDER BY ultimo_acesso DESC`);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

// ─── Sites ───────────────────────────────────────────────────────────────────

function upsertSite(site) {
  db.run(
    `INSERT INTO sites (
       conta, sigla, status_conexao, data_desconexao, os, zona, status4,
       padrao_cameras, cameras_ontem, cameras_hoje, status2, data_alteracao,
       vegetacao_alta, data_alteracao_vegetacao, camera_problema, status3,
       regional, observacao, updated_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, datetime('now'))
     ON CONFLICT(sigla) DO UPDATE SET
       conta = excluded.conta,
       status_conexao = excluded.status_conexao,
       data_desconexao = excluded.data_desconexao,
       os = excluded.os,
       zona = excluded.zona,
       status4 = excluded.status4,
       padrao_cameras = excluded.padrao_cameras,
       cameras_ontem = excluded.cameras_ontem,
       cameras_hoje = excluded.cameras_hoje,
       status2 = excluded.status2,
       data_alteracao = excluded.data_alteracao,
       vegetacao_alta = excluded.vegetacao_alta,
       data_alteracao_vegetacao = excluded.data_alteracao_vegetacao,
       camera_problema = excluded.camera_problema,
       status3 = excluded.status3,
       regional = COALESCE(excluded.regional, regional),
       observacao = COALESCE(excluded.observacao, observacao),
       updated_at = datetime('now')`,
    [
      site.conta ?? null,
      site.sigla,
      site.status_conexao ?? null,
      site.data_desconexao ?? null,
      site.os ?? null,
      site.zona ?? null,
      site.status4 ?? null,
      site.padrao_cameras ?? null,
      site.cameras_ontem ?? null,
      site.cameras_hoje ?? null,
      site.status2 ?? null,
      site.data_alteracao ?? null,
      site.vegetacao_alta ? 1 : 0,
      site.data_alteracao_vegetacao ?? null,
      site.camera_problema ?? null,
      site.status3 ?? null,
      site.regional ?? null,
      site.observacao ?? null,
    ]
  );
}

function getAllSites() {
  const stmt = db.prepare(`SELECT * FROM sites ORDER BY sigla ASC`);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function getSiteById(id) {
  const stmt = db.prepare(`SELECT * FROM sites WHERE id = ?`);
  stmt.bind([id]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

function getSiteBySigla(sigla) {
  const stmt = db.prepare(`SELECT * FROM sites WHERE sigla = ?`);
  stmt.bind([sigla]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

function updateSite(id, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const sets = keys.map(k => `${k} = ?`).join(', ');
  const vals = keys.map(k => fields[k]);
  db.run(`UPDATE sites SET ${sets}, updated_at = datetime('now') WHERE id = ?`, [...vals, id]);
  saveDatabase();
}

function searchSites(query, filter, regional) {
  let sql = `
    SELECT s.*,
      (SELECT status FROM rondas WHERE site_id = s.id ORDER BY timestamp DESC LIMIT 1) AS ultimo_status_ronda,
      (SELECT timestamp FROM rondas WHERE site_id = s.id ORDER BY timestamp DESC LIMIT 1) AS ultima_ronda_ts,
      (SELECT operador FROM rondas WHERE site_id = s.id ORDER BY timestamp DESC LIMIT 1) AS ultimo_operador,
      (SELECT cameras_funcionando FROM rondas WHERE site_id = s.id ORDER BY timestamp DESC LIMIT 1) AS ultimas_cameras_func
    FROM sites s
    WHERE 1=1
  `;
  const params = [];

  if (query) {
    sql += ` AND (s.sigla LIKE ? OR CAST(s.conta AS TEXT) LIKE ?)`;
    params.push(`%${query}%`, `%${query}%`);
  }

  if (regional && regional !== 'todos') {
    sql += ` AND s.regional = ?`;
    params.push(regional);
  }

  if (filter && filter !== 'todos') {
    if (filter === 'os') {
      sql += ` AND s.os != '' AND s.os IS NOT NULL`;
    } else if (filter === 'vegetacao') {
      sql += ` AND s.vegetacao_alta = 1`;
    } else if (filter === 'nao_verificado') {
      sql += ` AND (SELECT id FROM rondas WHERE site_id = s.id LIMIT 1) IS NULL`;
    } else {
      // Filter by last ronda status
      sql += ` AND (SELECT status FROM rondas WHERE site_id = s.id ORDER BY timestamp DESC LIMIT 1) = ?`;
      const statusMap = { ok: 'OK', parcial: 'PARCIAL', offline: 'DESCONECTADO' };
      params.push(statusMap[filter] || filter.toUpperCase());
    }
  }

  sql += ` ORDER BY s.sigla ASC`;

  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

// ─── Rondas ──────────────────────────────────────────────────────────────────

function insertRonda(ronda) {
  db.run(
    `INSERT INTO rondas (site_id, operador, status, cameras_funcionando, cameras_esperadas, observacao, tipo, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      ronda.site_id,
      ronda.operador,
      ronda.status,
      ronda.cameras_funcionando ?? null,
      ronda.cameras_esperadas ?? null,
      ronda.observacao ?? null,
      ronda.tipo ?? RONDA_TIPO_CAMERAS,
    ]
  );
  // Keep only last 30 rondas per site
  db.run(
    `DELETE FROM rondas WHERE site_id = ? AND id NOT IN (
       SELECT id FROM rondas WHERE site_id = ? ORDER BY timestamp DESC LIMIT 30
     )`,
    [ronda.site_id, ronda.site_id]
  );
  saveDatabase();
}

function getRondasBySite(siteId, limit = 10) {
  const stmt = db.prepare(
    `SELECT * FROM rondas WHERE site_id = ? ORDER BY timestamp DESC LIMIT ?`
  );
  stmt.bind([siteId, limit]);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function getLastRondaBySite(siteId) {
  const stmt = db.prepare(
    `SELECT * FROM rondas WHERE site_id = ? ORDER BY timestamp DESC LIMIT 1`
  );
  stmt.bind([siteId]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

/**
 * Retrieve the most recent rondas across all sites, with site sigla joined.
 * @param {number} [limit=100]
 * @returns {object[]}
 */
function getRondasRecentes(limit = 100) {
  try {
    const stmt = db.prepare(
      `SELECT r.*, s.sigla, s.regional,
         (SELECT COUNT(*) FROM rondas r2 WHERE r2.site_id = r.site_id AND r2.status != 'OK') AS problemas,
         1 AS total_sites,
         COALESCE(r.tipo, '${RONDA_TIPO_CAMERAS}') AS tipo
       FROM rondas r
       LEFT JOIN sites s ON s.id = r.site_id
       ORDER BY r.timestamp DESC
       LIMIT ?`
    );
    stmt.bind([limit]);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  } catch (_) {
    return [];
  }
}

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

function getDashboardStats() {
  const total = db.exec(`SELECT COUNT(*) as n FROM sites`)[0]?.values[0][0] || 0;

  const statusQuery = `
    SELECT
      SUM(CASE WHEN last_status = 'OK' THEN 1 ELSE 0 END) as ok,
      SUM(CASE WHEN last_status = 'PARCIAL' THEN 1 ELSE 0 END) as parcial,
      SUM(CASE WHEN last_status = 'DESCONECTADO' THEN 1 ELSE 0 END) as offline,
      SUM(CASE WHEN last_status IS NULL THEN 1 ELSE 0 END) as nao_verificado
    FROM (
      SELECT s.id,
        (SELECT status FROM rondas WHERE site_id = s.id ORDER BY timestamp DESC LIMIT 1) AS last_status
      FROM sites s
    )
  `;
  const stats = db.exec(statusQuery)[0]?.values[0] || [0, 0, 0, 0];

  // Alarm & CFTV stats from imported spreadsheet data
  const extraStats = db.exec(`
    SELECT
      SUM(CASE WHEN status_conexao = 'ONLINE' THEN 1 ELSE 0 END) as alarmes_conectados,
      SUM(CASE WHEN status_conexao = 'DESCONECTADO' THEN 1 ELSE 0 END) as alarmes_desconectados,
      SUM(CASE WHEN status2 = 'OK' THEN 1 ELSE 0 END) as cftv_ok,
      SUM(CASE WHEN status2 = 'PARCIAL' THEN 1 ELSE 0 END) as cftv_parcial,
      SUM(CASE WHEN status2 = 'DESCONECTADO' THEN 1 ELSE 0 END) as cftv_desconectado,
      SUM(CASE WHEN vegetacao_alta = 1 THEN 1 ELSE 0 END) as vegetacao_alta
    FROM sites
  `)[0]?.values[0] || [0, 0, 0, 0, 0, 0];

  // Critical: offline with connection status DESCONECTADO or offline ronda > 7 days
  const criticos = db.exec(`
    SELECT s.*, r.timestamp as ultima_ronda_ts, r.status as ultimo_status
    FROM sites s
    LEFT JOIN rondas r ON r.id = (
      SELECT id FROM rondas WHERE site_id = s.id ORDER BY timestamp DESC LIMIT 1
    )
    WHERE (
      s.status_conexao = 'DESCONECTADO'
      OR (r.status = 'DESCONECTADO' AND julianday('now') - julianday(r.timestamp) > ${CRITICAL_OFFLINE_DAYS})
    )
    ORDER BY r.timestamp ASC
    LIMIT 20
  `)[0];

  const criticosList = [];
  if (criticos) {
    const cols = criticos.columns;
    for (const row of criticos.values) {
      const obj = {};
      cols.forEach((c, i) => { obj[c] = row[i]; });
      criticosList.push(obj);
    }
  }

  return {
    total: Number(total),
    ok: Number(stats[0]) || 0,
    parcial: Number(stats[1]) || 0,
    offline: Number(stats[2]) || 0,
    nao_verificado: Number(stats[3]) || 0,
    alarmes_conectados: Number(extraStats[0]) || 0,
    alarmes_desconectados: Number(extraStats[1]) || 0,
    cftv_ok: Number(extraStats[2]) || 0,
    cftv_parcial: Number(extraStats[3]) || 0,
    cftv_desconectado: Number(extraStats[4]) || 0,
    vegetacao_alta: Number(extraStats[5]) || 0,
    criticos: criticosList
  };
}

/**
 * Get stats broken down by regional (PR, SC, RS)
 */
function getRegionalStats() {
  const result = db.exec(`
    SELECT
      COALESCE(regional, 'N/D') as regional,
      COUNT(*) as total,
      SUM(CASE WHEN status_conexao = 'ONLINE' THEN 1 ELSE 0 END) as alarmes_conectados,
      SUM(CASE WHEN status_conexao = 'DESCONECTADO' THEN 1 ELSE 0 END) as alarmes_desconectados,
      SUM(CASE WHEN status2 = 'OK' THEN 1 ELSE 0 END) as cftv_ok,
      SUM(CASE WHEN status2 = 'PARCIAL' THEN 1 ELSE 0 END) as cftv_parcial,
      SUM(CASE WHEN status2 = 'DESCONECTADO' THEN 1 ELSE 0 END) as cftv_desconectado,
      SUM(CASE WHEN vegetacao_alta = 1 THEN 1 ELSE 0 END) as vegetacao_alta
    FROM sites
    GROUP BY regional
    ORDER BY
      CASE regional WHEN 'PR' THEN 1 WHEN 'SC' THEN 2 WHEN 'RS' THEN 3 ELSE 4 END
  `);

  const stats = {};
  if (result[0]) {
    for (const row of result[0].values) {
      const obj = {};
      result[0].columns.forEach((c, i) => { obj[c] = row[i]; });
      stats[obj.regional] = obj;
    }
  }
  return stats;
}

// ─── Full Export / Import ─────────────────────────────────────────────────────

function exportAllData() {
  const sitesRows = getAllSites();

  // Build a map of site_id → sigla for ronda enrichment
  const siteMap = {};
  for (const s of sitesRows) siteMap[s.id] = s.sigla;

  const rondasStmt = db.prepare(`SELECT * FROM rondas ORDER BY timestamp ASC`);
  const rondas = [];
  while (rondasStmt.step()) {
    const r = rondasStmt.getAsObject();
    r.sigla = siteMap[r.site_id] || null; // add sigla for cross-DB import
    rondas.push(r);
  }
  rondasStmt.free();

  const usuariosRows = getUsuarios();

  return {
    version: 1,
    exported_at: new Date().toISOString(),
    sites: sitesRows,
    rondas,
    usuarios: usuariosRows
  };
}

function importAllData(payload) {
  if (!payload || payload.version !== 1) throw new Error('Formato inválido');

  db.run('BEGIN TRANSACTION');
  try {
    // Import usuarios
    for (const u of (payload.usuarios || [])) {
      db.run(
        `INSERT INTO usuarios (nome, ultimo_acesso)
         VALUES (?, ?)
         ON CONFLICT(nome) DO UPDATE SET ultimo_acesso = MAX(ultimo_acesso, excluded.ultimo_acesso)`,
        [u.nome, u.ultimo_acesso]
      );
    }

    // Import sites
    for (const s of (payload.sites || [])) {
      upsertSite(s);
    }

    // Import rondas (merge by site + operador + timestamp)
    for (const r of (payload.rondas || [])) {
      // Resolve site_id using sigla (cross-DB safe), fallback to raw site_id
      let siteId = null;
      if (r.sigla) {
        const site = getSiteBySigla(r.sigla);
        siteId = site ? site.id : null;
      }
      if (!siteId) siteId = r.site_id;
      if (!siteId) continue;

      // Check if ronda already exists (same site, operador, timestamp)
      const exists = db.exec(
        `SELECT id FROM rondas WHERE site_id = ? AND operador = ? AND timestamp = ?`,
        [siteId, r.operador, r.timestamp]
      );
      if (exists[0]?.values?.length) continue; // skip duplicate

      db.run(
        `INSERT INTO rondas (site_id, operador, status, cameras_funcionando, cameras_esperadas, observacao, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [siteId, r.operador, r.status, r.cameras_funcionando, r.cameras_esperadas, r.observacao, r.timestamp]
      );
    }

    db.run('COMMIT');
    saveDatabase();
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
}

// Auto-save every 5 minutes
setInterval(saveDatabase, 5 * 60 * 1000);
