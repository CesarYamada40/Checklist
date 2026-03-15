/**
 * sites-page.js - Sites management page
 * Table view with filters, pagination, and CRUD operations
 */

// ─── State ───────────────────────────────────────────────────────────────────

const sitesPageState = {
  query: '',
  regional: 'todos',
  statusFilter: 'todos',
  page: 1,
  perPage: 10,
  total: 0,
};

// ─── Navigation ───────────────────────────────────────────────────────────────

function showSitesScreen() {
  showScreen('sites');
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const el = document.getElementById('nav-sites');
  if (el) el.classList.add('active');
  renderSitesPage();
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderSitesPage() {
  const screen = document.getElementById('screen-sites');
  if (!screen) return;

  const allSites = searchSites(sitesPageState.query, sitesPageState.statusFilter, sitesPageState.regional);
  sitesPageState.total = allSites.length;

  const pr = allSites.filter(s => s.regional === 'PR').length;
  const sc = allSites.filter(s => s.regional === 'SC').length;
  const rs = allSites.filter(s => s.regional === 'RS').length;

  const start = (sitesPageState.page - 1) * sitesPageState.perPage;
  const pageSites = allSites.slice(start, start + sitesPageState.perPage);
  const totalPages = Math.max(1, Math.ceil(sitesPageState.total / sitesPageState.perPage));

  const rows = pageSites.length
    ? pageSites.map(s => _renderSiteRow(s)).join('')
    : `<tr><td colspan="9" class="sp-empty-row">Nenhum site encontrado</td></tr>`;

  screen.innerHTML = `
    ${typeof _buildPageNav === 'function' ? _buildPageNav('sites') : ''}
    <div class="sp-container">
      <!-- Header -->
      <div class="sp-header">
        <h2 class="sp-title">🏢 Sites</h2>
        <div class="sp-stats">
          <span class="sp-badge sp-badge-total">Total: ${sitesPageState.total}</span>
          <span class="sp-badge sp-badge-pr">PR: ${pr}</span>
          <span class="sp-badge sp-badge-sc">SC: ${sc}</span>
          <span class="sp-badge sp-badge-rs">RS: ${rs}</span>
        </div>
        <div class="sp-header-actions">
          <button class="btn btn-primary" onclick="openNewSiteModal()">+ Novo Site</button>
        </div>
      </div>

      <!-- Filters -->
      <div class="sp-filters">
        <select id="sp-filter-regional" onchange="setSitesRegional(this.value)">
          <option value="todos" ${sitesPageState.regional === 'todos' ? 'selected' : ''}>🗺️ Todas Regionais</option>
          <option value="PR" ${sitesPageState.regional === 'PR' ? 'selected' : ''}>📍 PR - Paraná</option>
          <option value="SC" ${sitesPageState.regional === 'SC' ? 'selected' : ''}>📍 SC - Santa Catarina</option>
          <option value="RS" ${sitesPageState.regional === 'RS' ? 'selected' : ''}>📍 RS - Rio Grande do Sul</option>
        </select>
        <select id="sp-filter-status" onchange="setSitesStatus(this.value)">
          <option value="todos" ${sitesPageState.statusFilter === 'todos' ? 'selected' : ''}>Todos Status</option>
          <option value="ok" ${sitesPageState.statusFilter === 'ok' ? 'selected' : ''}>🟢 OK</option>
          <option value="parcial" ${sitesPageState.statusFilter === 'parcial' ? 'selected' : ''}>🟡 Parcial</option>
          <option value="offline" ${sitesPageState.statusFilter === 'offline' ? 'selected' : ''}>🔴 Offline</option>
          <option value="nao_verificado" ${sitesPageState.statusFilter === 'nao_verificado' ? 'selected' : ''}>⚫ Não Verificado</option>
          <option value="os" ${sitesPageState.statusFilter === 'os' ? 'selected' : ''}>📋 Com O.S.</option>
          <option value="vegetacao" ${sitesPageState.statusFilter === 'vegetacao' ? 'selected' : ''}>🌿 Vegetação</option>
        </select>
        <input type="search" id="sp-search" class="sp-search-input" placeholder="🔍 Buscar sigla ou conta..."
          value="${escapeHtml(sitesPageState.query)}"
          oninput="setSitesQuery(this.value)">
        <button class="btn btn-outline" onclick="clearSitesFilters()">🔄 Limpar</button>
      </div>

      <!-- Table -->
      <div class="sp-table-wrapper">
        <table class="sp-table">
          <thead>
            <tr>
              <th>Sigla</th>
              <th>Conta</th>
              <th>Regional</th>
              <th>Alarme</th>
              <th>CFTV</th>
              <th>Câmeras (hoje/padrão)</th>
              <th>O.S.</th>
              <th>Último Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="sp-pagination">
        <button class="btn btn-outline sp-pag-btn" onclick="setSitesPage(${sitesPageState.page - 1})"
          ${sitesPageState.page <= 1 ? 'disabled' : ''}>← Anterior</button>
        <span class="sp-pag-info">Página ${sitesPageState.page} de ${totalPages} (${sitesPageState.total} sites)</span>
        <button class="btn btn-outline sp-pag-btn" onclick="setSitesPage(${sitesPageState.page + 1})"
          ${sitesPageState.page >= totalPages ? 'disabled' : ''}>Próxima →</button>
        <select class="sp-per-page" onchange="setSitesPerPage(parseInt(this.value))">
          <option value="10" ${sitesPageState.perPage === 10 ? 'selected' : ''}>10 / página</option>
          <option value="25" ${sitesPageState.perPage === 25 ? 'selected' : ''}>25 / página</option>
          <option value="50" ${sitesPageState.perPage === 50 ? 'selected' : ''}>50 / página</option>
          <option value="100" ${sitesPageState.perPage === 100 ? 'selected' : ''}>100 / página</option>
        </select>
      </div>
    </div>
  `;
}

function _renderSiteRow(s) {
  const alarmClass = s.status_conexao === 'ONLINE' ? 'sp-status-ok'
    : s.status_conexao === 'DESCONECTADO' ? 'sp-status-offline'
    : 'sp-status-unknown';
  const alarmLabel = s.status_conexao || '—';

  const cftvClass = s.status2 === 'OK' ? 'sp-status-ok'
    : s.status2 === 'PARCIAL' ? 'sp-status-parcial'
    : s.status2 === 'DESCONECTADO' ? 'sp-status-offline'
    : 'sp-status-unknown';
  const cftvLabel = s.status2 || '—';

  const cam = s.cameras_hoje != null && s.padrao_cameras != null
    ? `${s.cameras_hoje}/${s.padrao_cameras}`
    : (s.padrao_cameras != null ? `—/${s.padrao_cameras}` : '—');
  const camWarn = s.cameras_hoje != null && s.padrao_cameras != null && s.cameras_hoje < s.padrao_cameras;

  const lastStatus = s.ultimo_status_ronda;
  const lastClass = lastStatus === 'OK' ? 'sp-status-ok'
    : lastStatus === 'PARCIAL' ? 'sp-status-parcial'
    : lastStatus === 'DESCONECTADO' ? 'sp-status-offline'
    : 'sp-status-unknown';
  const lastLabel = lastStatus || 'Não verificado';
  const lastTs = s.ultima_ronda_ts ? formatDateTime(s.ultima_ronda_ts) : '';

  const regionalClass = s.regional === 'PR' ? 'sp-reg-pr'
    : s.regional === 'SC' ? 'sp-reg-sc'
    : s.regional === 'RS' ? 'sp-reg-rs'
    : '';

  const osIndicator = s.os ? `<span class="sp-os-badge" title="${escapeHtml(s.os)}">O.S.</span>` : '—';

  return `
    <tr class="sp-row">
      <td><span class="sp-sigla ${regionalClass}">${escapeHtml(s.sigla)}</span></td>
      <td>${s.conta || '—'}</td>
      <td><span class="sp-regional-badge ${regionalClass}">${escapeHtml(s.regional || '—')}</span></td>
      <td><span class="sp-status-pill ${alarmClass}">${escapeHtml(alarmLabel)}</span></td>
      <td><span class="sp-status-pill ${cftvClass}">${escapeHtml(cftvLabel)}</span></td>
      <td class="${camWarn ? 'sp-cam-warn' : ''}">${cam}</td>
      <td>${osIndicator}</td>
      <td>
        <span class="sp-status-pill ${lastClass}">${escapeHtml(lastLabel)}</span>
        ${lastTs ? `<br><span class="sp-ts">${escapeHtml(lastTs)}</span>` : ''}
      </td>
      <td class="sp-actions">
        <button class="sp-action-btn" onclick="showSiteDetail(${s.id})" title="Visualizar">👁️</button>
        <button class="sp-action-btn" onclick="openEditSiteModal(${s.id})" title="Editar">✏️</button>
        <button class="sp-action-btn sp-action-danger" onclick="confirmDeleteSite(${s.id}, '${escapeHtml(s.sigla)}')" title="Excluir">🗑️</button>
      </td>
    </tr>
  `;
}

// ─── Filter/Pagination Handlers ───────────────────────────────────────────────

function setSitesQuery(query) {
  sitesPageState.query = query;
  sitesPageState.page = 1;
  renderSitesPage();
}

function setSitesRegional(regional) {
  sitesPageState.regional = regional;
  sitesPageState.page = 1;
  renderSitesPage();
}

function setSitesStatus(status) {
  sitesPageState.statusFilter = status;
  sitesPageState.page = 1;
  renderSitesPage();
}

function setSitesPage(page) {
  const totalPages = Math.max(1, Math.ceil(sitesPageState.total / sitesPageState.perPage));
  if (page < 1 || page > totalPages) return;
  sitesPageState.page = page;
  renderSitesPage();
}

function setSitesPerPage(perPage) {
  sitesPageState.perPage = perPage;
  sitesPageState.page = 1;
  renderSitesPage();
}

function clearSitesFilters() {
  sitesPageState.query = '';
  sitesPageState.regional = 'todos';
  sitesPageState.statusFilter = 'todos';
  sitesPageState.page = 1;
  renderSitesPage();
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

function openNewSiteModal() {
  _openSiteFormModal(null);
}

function openEditSiteModal(siteId) {
  const site = getSiteById(siteId);
  if (!site) { showToast('Site não encontrado.', 'error'); return; }
  _openSiteFormModal(site);
}

function _openSiteFormModal(site) {
  const isEdit = !!site;
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('hidden');

  overlay.innerHTML = `
    <div class="modal site-modal" role="dialog" aria-modal="true" aria-label="${isEdit ? 'Editar Site' : 'Novo Site'}">
      <div class="modal-header">
        <div class="modal-title">${isEdit ? '✏️ Editar Site' : '➕ Novo Site'}</div>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="site-form-grid">
          <div class="form-group">
            <label>Sigla <span class="required">*</span></label>
            <input type="text" id="sf-sigla" value="${escapeHtml(site?.sigla || '')}"
              placeholder="Ex: PRCWB01" maxlength="20" ${isEdit ? 'readonly' : ''}>
          </div>
          <div class="form-group">
            <label>Conta</label>
            <input type="number" id="sf-conta" value="${site?.conta || ''}" placeholder="Ex: 1326">
          </div>
          <div class="form-group">
            <label>Regional</label>
            <select id="sf-regional">
              <option value="">Selecione...</option>
              <option value="PR" ${site?.regional === 'PR' ? 'selected' : ''}>PR - Paraná</option>
              <option value="SC" ${site?.regional === 'SC' ? 'selected' : ''}>SC - Santa Catarina</option>
              <option value="RS" ${site?.regional === 'RS' ? 'selected' : ''}>RS - Rio Grande do Sul</option>
            </select>
          </div>
          <div class="form-group">
            <label>Padrão de Câmeras</label>
            <input type="number" id="sf-padrao-cam" value="${site?.padrao_cameras || ''}" min="0" max="99">
          </div>
          <div class="form-group">
            <label>Câmeras Hoje</label>
            <input type="number" id="sf-cameras-hoje" value="${site?.cameras_hoje ?? ''}" min="0" max="99">
          </div>
          <div class="form-group">
            <label>Status Alarme</label>
            <select id="sf-status-alarme">
              <option value="">—</option>
              <option value="ONLINE" ${site?.status_conexao === 'ONLINE' ? 'selected' : ''}>ONLINE</option>
              <option value="DESCONECTADO" ${site?.status_conexao === 'DESCONECTADO' ? 'selected' : ''}>DESCONECTADO</option>
            </select>
          </div>
          <div class="form-group">
            <label>Status CFTV</label>
            <select id="sf-status-cftv">
              <option value="">—</option>
              <option value="OK" ${site?.status2 === 'OK' ? 'selected' : ''}>OK</option>
              <option value="PARCIAL" ${site?.status2 === 'PARCIAL' ? 'selected' : ''}>PARCIAL</option>
              <option value="DESCONECTADO" ${site?.status2 === 'DESCONECTADO' ? 'selected' : ''}>DESCONECTADO</option>
            </select>
          </div>
          <div class="form-group">
            <label>Zona</label>
            <input type="text" id="sf-zona" value="${escapeHtml(site?.zona || '')}" maxlength="50">
          </div>
          <div class="form-group form-group-full">
            <label>O.S. (Ordem de Serviço)</label>
            <input type="text" id="sf-os" value="${escapeHtml(site?.os || '')}" maxlength="100">
          </div>
          <div class="form-group form-group-full">
            <label>Observação</label>
            <textarea id="sf-obs" rows="3" maxlength="500">${escapeHtml(site?.observacao || '')}</textarea>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" id="sf-vegetacao" ${site?.vegetacao_alta ? 'checked' : ''}>
              🌿 Vegetação Alta
            </label>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="saveSiteForm(${isEdit ? site.id : 'null'})">
          ${isEdit ? '💾 Salvar' : '➕ Criar'}
        </button>
      </div>
    </div>
  `;
}

function saveSiteForm(siteId) {
  const sigla = document.getElementById('sf-sigla')?.value.trim().toUpperCase();
  if (!sigla) { showToast('Sigla é obrigatória.', 'error'); return; }

  const siteData = {
    sigla,
    conta: parseInt(document.getElementById('sf-conta')?.value) || null,
    regional: document.getElementById('sf-regional')?.value || null,
    padrao_cameras: parseInt(document.getElementById('sf-padrao-cam')?.value) || null,
    cameras_hoje: document.getElementById('sf-cameras-hoje')?.value !== ''
      ? parseInt(document.getElementById('sf-cameras-hoje')?.value)
      : null,
    status_conexao: document.getElementById('sf-status-alarme')?.value || null,
    status2: document.getElementById('sf-status-cftv')?.value || null,
    zona: document.getElementById('sf-zona')?.value.trim() || null,
    os: document.getElementById('sf-os')?.value.trim() || null,
    observacao: document.getElementById('sf-obs')?.value.trim() || null,
    vegetacao_alta: document.getElementById('sf-vegetacao')?.checked ? 1 : 0,
  };

  try {
    if (siteId) {
      updateSite(siteId, siteData);
      if (typeof auditLog === 'function') auditLog('site_editado', `Site ${sigla} editado`, { target: sigla });
      showToast(`✅ Site ${sigla} atualizado com sucesso!`, 'success');
    } else {
      upsertSite(siteData);
      saveDatabase();
      if (typeof auditLog === 'function') auditLog('site_criado', `Site ${sigla} criado`, { target: sigla });
      showToast(`✅ Site ${sigla} criado com sucesso!`, 'success');
    }
    closeModal();
    renderSitesPage();
  } catch (e) {
    showToast(`❌ Erro: ${e.message}`, 'error', 5000);
  }
}

function confirmDeleteSite(siteId, sigla) {
  if (!confirm(`Excluir site "${sigla}"?\n\nEsta ação não pode ser desfeita.`)) return;

  try {
    if (!db) throw new Error('Banco de dados não inicializado');
    db.run('BEGIN TRANSACTION');
    try {
      db.run('DELETE FROM rondas WHERE site_id = ?', [siteId]);
      db.run('DELETE FROM sites WHERE id = ?', [siteId]);
      db.run('COMMIT');
    } catch (e) {
      db.run('ROLLBACK');
      throw e;
    }
    saveDatabase();
    if (typeof auditLog === 'function') auditLog('site_excluido', `Site ${sigla} excluído`, { target: sigla });
    showToast(`🗑️ Site ${sigla} excluído.`, 'success');
    renderSitesPage();
  } catch (e) {
    showToast(`❌ Erro ao excluir: ${e.message}`, 'error');
  }
}
