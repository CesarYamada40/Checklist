/**
 * sync.js - JSON export/import for multi-user synchronization
 */

/**
 * Export all DB data as a downloadable JSON file
 */
function exportSync() {
  const data = exportAllData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  a.download = `cftv_sync_${dateStr}.json`;
  a.click();
  showToast('✅ Dados exportados com sucesso!', 'success');
}

/**
 * Trigger file input for JSON import
 */
function triggerImportSync() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const payload = JSON.parse(ev.target.result);
        importAllData(payload);
        showToast('✅ Sincronização importada com sucesso!', 'success');
        refreshDashboard();
        renderSitesList();
      } catch (err) {
        showToast(`❌ Erro ao importar: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

/**
 * Export the raw SQLite database as a backup file
 */
function exportDatabaseBackup() {
  const data = db.export();
  const blob = new Blob([data], { type: 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);
  a.download = `cftv_backup_${dateStr}.db`;
  a.click();
  showToast('✅ Backup do banco exportado!', 'success');
}
