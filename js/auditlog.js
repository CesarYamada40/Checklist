/**
 * auditlog.js - Log de auditoria e Backup/Restore
 * Registra todas as alterações de dados e fornece mecanismo de backup.
 * Depende de: app.js (escapeHtml, showToast)
 */

// ─── Constantes ───────────────────────────────────────────────────────────────

const AUDIT_KEY     = 'cftv_audit_log';
const AUDIT_MAX     = 500; // Máximo de entradas mantidas em memória

// ─── Estrutura de entrada de auditoria ───────────────────────────────────────
// {
//   id:          string (uuid simples),
//   timestamp:   string (ISO 8601),
//   action:      string (ex: 'site_atualizado', 'ronda_concluida', 'import', 'status_alterado'),
//   description: string (texto legível),
//   operador:    string,
//   target:      string (id ou sigla do recurso afetado),
//   before:      any    (estado anterior, opcional),
//   after:       any    (novo estado, opcional),
// }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _auditGenId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function _auditLoad() {
  try {
    return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]');
  } catch (_) {
    return [];
  }
}

function _auditSave(entries) {
  try {
    localStorage.setItem(AUDIT_KEY, JSON.stringify(entries));
  } catch (_) {}
}

// ─── API Pública ──────────────────────────────────────────────────────────────

/**
 * Registra uma entrada no audit log.
 * @param {string} action       - Código da ação (ex: 'site_atualizado')
 * @param {string} description  - Descrição legível (ex: 'Site SCFNS01 marcado como Offline')
 * @param {object} [options]    - { operador, target, before, after }
 */
function auditLog(action, description, options = {}) {
  const entries = _auditLoad();
  const entry = {
    id:          _auditGenId(),
    timestamp:   new Date().toISOString(),
    action,
    description,
    operador:    options.operador || (typeof appState !== 'undefined' ? appState.operador : null) || '',
    target:      options.target   || '',
    before:      options.before   !== undefined ? options.before : undefined,
    after:       options.after    !== undefined ? options.after  : undefined,
  };

  // Adicionar no início (mais recente primeiro) e limitar
  entries.unshift(entry);
  if (entries.length > AUDIT_MAX) entries.splice(AUDIT_MAX);

  _auditSave(entries);
}

/**
 * Retorna as N entradas mais recentes do audit log.
 * @param {number} [limit=50]
 * @returns {Array}
 */
function auditLogGetRecent(limit = 50) {
  return _auditLoad().slice(0, limit);
}

/**
 * Retorna todas as entradas do audit log, opcionalmente filtradas.
 * @param {{ action?: string, operador?: string, desde?: string }} [filtros]
 * @returns {Array}
 */
function auditLogGetAll(filtros = {}) {
  let entries = _auditLoad();
  if (filtros.action    ) entries = entries.filter(e => e.action   === filtros.action);
  if (filtros.operador  ) entries = entries.filter(e => e.operador === filtros.operador);
  if (filtros.desde     ) entries = entries.filter(e => e.timestamp >= filtros.desde);
  return entries;
}

/**
 * Limpa o audit log.
 */
function auditLogClear() {
  _auditSave([]);
}

// ─── Backup / Restore ─────────────────────────────────────────────────────────

/**
 * Exporta um backup completo do sistema (banco + configurações + audit log)
 * como um arquivo JSON com timestamp no nome.
 */
function exportarBackupCompleto() {
  try {
    showToast('⏳ Gerando backup...', 'info', 2000);

    // Coletar dados do banco SQLite
    let dbData = null;
    try {
      if (typeof db !== 'undefined' && db) {
        const binaryArray = db.export();
        dbData = Array.from(binaryArray);
      }
    } catch (_) {}

    // Coletar configurações e state do localStorage
    const settings = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('cftv_')) {
        try { settings[key] = JSON.parse(localStorage.getItem(key)); }
        catch (_) { settings[key] = localStorage.getItem(key); }
      }
    }

    const backup = {
      version:     '2.0',
      timestamp:   new Date().toISOString(),
      app:         'Checklist CFTV - Claro Regional Sul',
      operador:    typeof appState !== 'undefined' ? appState.operador : '',
      database:    dbData,
      settings,
      auditLog:    auditLogGetAll(),
    };

    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);

    const ts = new Date().toISOString().slice(0,16).replace('T','-').replace(':','-');
    const a  = document.createElement('a');
    a.href     = url;
    a.download = `backup-cftv-${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);

    auditLog('backup_exportado', `Backup completo exportado em ${new Date().toLocaleString('pt-BR')}`);
    showToast('✅ Backup exportado com sucesso!', 'success', 3000);
  } catch (err) {
    showToast(`❌ Erro ao exportar backup: ${err.message}`, 'error', 4000);
    console.error('[auditlog] exportarBackupCompleto:', err);
  }
}

/**
 * Importa um backup a partir de um arquivo JSON.
 * @param {File} file
 */
async function importarBackup(file) {
  try {
    const text = await file.text();
    const backup = JSON.parse(text);

    // Validação básica
    if (!backup.version || !backup.app || !backup.timestamp) {
      showToast('❌ Arquivo de backup inválido.', 'error', 4000);
      return;
    }
    if (!backup.app.includes('Checklist CFTV')) {
      showToast('❌ Backup incompatível com este sistema.', 'error', 4000);
      return;
    }

    if (!confirm(
      `Restaurar backup de ${new Date(backup.timestamp).toLocaleString('pt-BR')}?\n\n` +
      `Isso irá substituir todos os dados atuais.\n\nDeseja continuar?`
    )) return;

    // Restaurar banco de dados SQLite
    if (backup.database && Array.isArray(backup.database)) {
      try {
        const binaryArray = new Uint8Array(backup.database);
        db = new SQL.Database(binaryArray);
        if (typeof saveDatabase === 'function') saveDatabase();
        showToast('✅ Banco de dados restaurado!', 'success', 2000);
      } catch (e) {
        console.warn('[auditlog] Falha ao restaurar banco:', e);
      }
    }

    // Restaurar settings (exceto dados sensíveis)
    if (backup.settings) {
      Object.entries(backup.settings).forEach(([key, val]) => {
        if (key.startsWith('cftv_') && key !== 'cftv_operador') {
          try {
            localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
          } catch (_) {}
        }
      });
    }

    // Restaurar audit log
    if (Array.isArray(backup.auditLog)) {
      _auditSave(backup.auditLog);
    }

    auditLog('backup_importado', `Backup restaurado de ${new Date(backup.timestamp).toLocaleString('pt-BR')}`);
    showToast('✅ Backup restaurado com sucesso! Recarregando...', 'success', 2000);

    setTimeout(() => window.location.reload(), 2000);
  } catch (err) {
    showToast(`❌ Erro ao importar backup: ${err.message}`, 'error', 5000);
    console.error('[auditlog] importarBackup:', err);
  }
}

/**
 * Renderiza a tela de Audit Log dentro de uma seção da tela de relatórios.
 * @param {string} containerId - ID do elemento container
 * @param {object} [filtros]
 */
function renderAuditLogSection(containerId, filtros = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const entries = auditLogGetAll(filtros);

  const actionIcons = {
    site_atualizado:  '🔧',
    ronda_concluida:  '✅',
    import:           '📥',
    status_alterado:  '🔄',
    backup_exportado: '💾',
    backup_importado: '📂',
    login:            '👤',
    logout:           '🚪',
    ronda_iniciada:   '🚀',
    default:          '📝',
  };

  const html = `
    <div class="audit-log-container">
      <div class="audit-log-header">
        <span class="audit-log-header-title">📋 Histórico de Alterações (${entries.length})</span>
        <button class="btn btn-outline" style="font-size:.75rem;padding:5px 10px"
          onclick="exportarAuditLogCSV()">📄 Exportar CSV</button>
        <button class="btn btn-outline" style="font-size:.75rem;padding:5px 10px"
          onclick="auditLogClear(); renderAuditLogSection('${containerId}'); showToast('Log limpo', 'success', 2000)">
          🗑️ Limpar
        </button>
      </div>
      <div class="audit-log-list">
        ${entries.length === 0 ? '<div style="padding:20px;text-align:center;color:var(--text-muted)">Nenhuma entrada registrada.</div>' :
          entries.map(e => `
            <div class="audit-entry">
              <span class="audit-entry-icon">${actionIcons[e.action] || actionIcons.default}</span>
              <div class="audit-entry-main">
                <div class="audit-entry-action">${escapeHtml(e.description)}</div>
                ${e.operador ? `<div class="audit-entry-operator">${escapeHtml(e.operador)}</div>` : ''}
                ${e.target   ? `<div class="audit-entry-detail">ID: ${escapeHtml(e.target)}</div>` : ''}
              </div>
              <div class="audit-entry-time">${_formatAuditTime(e.timestamp)}</div>
            </div>
          `).join('')
        }
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function _formatAuditTime(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch (_) { return ts; }
}

/**
 * Exporta o audit log como arquivo CSV.
 */
function exportarAuditLogCSV() {
  const entries = auditLogGetAll();
  if (!entries.length) { showToast('Nenhuma entrada no log.', 'warning', 2000); return; }

  const header = 'Data/Hora,Ação,Descrição,Operador,Alvo\n';
  const rows = entries.map(e =>
    [
      new Date(e.timestamp).toLocaleString('pt-BR'),
      e.action,
      `"${(e.description || '').replace(/"/g, '""')}"`,
      e.operador,
      e.target,
    ].join(',')
  ).join('\n');

  const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `audit-log-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
