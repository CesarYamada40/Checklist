/**
 * historico.js - Histórico de Rondas page
 * View and filter past inspection rounds
 */

// ─── State ───────────────────────────────────────────────────────────────────

const historicoState = {
  regional: 'todos',
  tipo: 'todos',
  operador: '',
  page: 1,
  perPage: 20,
  expandedId: null,
};

// ─── Navigation ───────────────────────────────────────────────────────────────

function showHistoricoScreen() {
  showScreen('historico');
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const el = document.getElementById('nav-historico');
  if (el) el.classList.add('active');
  renderHistoricoPage();
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderHistoricoPage() {
  const screen = document.getElementById('screen-historico');
  if (!screen) return;

  const allRondas = getRondasRecentes(500);

  // Filter
  let filtered = allRondas;
  if (historicoState.regional !== 'todos') {
    filtered = filtered.filter(r => r.regional === historicoState.regional);
  }
  if (historicoState.tipo !== 'todos') {
    filtered = filtered.filter(r => (r.tipo || RONDA_TIPO_CAMERAS) === historicoState.tipo);
  }
  if (historicoState.operador.trim()) {
    const q = historicoState.operador.trim().toLowerCase();
    filtered = filtered.filter(r => (r.operador || '').toLowerCase().includes(q));
  }

  const total = filtered.length;
  const start = (historicoState.page - 1) * historicoState.perPage;
  const pageItems = filtered.slice(start, start + historicoState.perPage);
  const totalPages = Math.max(1, Math.ceil(total / historicoState.perPage));

  // Collect unique operators for filter
  const operators = [...new Set(allRondas.map(r => r.operador).filter(Boolean))].sort();

  const rowsHtml = pageItems.length
    ? pageItems.map(r => _renderHistoricoRow(r)).join('')
    : `<div class="hist-empty">
        <div class="hist-empty-icon">📜</div>
        <p>Nenhuma ronda encontrada.</p>
        <p class="hist-empty-sub">Inicie uma ronda para começar a registrar o histórico.</p>
      </div>`;

  screen.innerHTML = `
    ${typeof _buildPageNav === 'function' ? _buildPageNav('historico') : ''}
    <div class="hist-container">
      <div class="hist-header">
        <h2 class="hist-title">📜 Histórico de Rondas</h2>
        <div class="hist-header-stats">
          <span class="sp-badge sp-badge-total">${total} registro${total !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <!-- Filters -->
      <div class="hist-filters">
        <select onchange="setHistoricoRegional(this.value)">
          <option value="todos" ${historicoState.regional === 'todos' ? 'selected' : ''}>🗺️ Todas Regionais</option>
          <option value="PR" ${historicoState.regional === 'PR' ? 'selected' : ''}>PR</option>
          <option value="SC" ${historicoState.regional === 'SC' ? 'selected' : ''}>SC</option>
          <option value="RS" ${historicoState.regional === 'RS' ? 'selected' : ''}>RS</option>
        </select>
        <select onchange="setHistoricoTipo(this.value)">
          <option value="todos" ${historicoState.tipo === 'todos' ? 'selected' : ''}>Todos Tipos</option>
          <option value="cameras" ${historicoState.tipo === 'cameras' ? 'selected' : ''}>📹 Câmeras</option>
          <option value="alarmes" ${historicoState.tipo === 'alarmes' ? 'selected' : ''}>🚨 Alarmes</option>
        </select>
        <select onchange="setHistoricoOperador(this.value)">
          <option value="">Todos Operadores</option>
          ${operators.map(op => `<option value="${escapeHtml(op)}" ${historicoState.operador === op ? 'selected' : ''}>${escapeHtml(op)}</option>`).join('')}
        </select>
        <button class="btn btn-outline" onclick="clearHistoricoFilters()">🔄 Limpar</button>
      </div>

      <!-- List -->
      <div class="hist-list" id="hist-list">
        ${rowsHtml}
      </div>

      <!-- Pagination -->
      ${total > historicoState.perPage ? `
        <div class="sp-pagination">
          <button class="btn btn-outline sp-pag-btn" onclick="setHistoricoPage(${historicoState.page - 1})"
            ${historicoState.page <= 1 ? 'disabled' : ''}>← Anterior</button>
          <span class="sp-pag-info">Página ${historicoState.page} de ${totalPages}</span>
          <button class="btn btn-outline sp-pag-btn" onclick="setHistoricoPage(${historicoState.page + 1})"
            ${historicoState.page >= totalPages ? 'disabled' : ''}>Próxima →</button>
        </div>
      ` : ''}
    </div>
  `;
}

function _renderHistoricoRow(r) {
  const statusClass = r.status === 'OK' ? 'sp-status-ok'
    : r.status === 'PARCIAL' ? 'sp-status-parcial'
    : r.status === 'DESCONECTADO' ? 'sp-status-offline'
    : 'sp-status-unknown';

  const regClass = r.regional === 'PR' ? 'sp-reg-pr'
    : r.regional === 'SC' ? 'sp-reg-sc'
    : r.regional === 'RS' ? 'sp-reg-rs' : '';

  const tipo = r.tipo || 'cameras';
  const tipoIcon = tipo === 'alarmes' ? '🚨' : '📹';
  const ts = r.timestamp ? formatDateTime(r.timestamp) : '—';

  const camInfo = (r.cameras_funcionando != null && r.cameras_esperadas != null)
    ? `${r.cameras_funcionando}/${r.cameras_esperadas} câmeras`
    : '';

  return `
    <div class="hist-row">
      <div class="hist-row-main">
        <div class="hist-row-left">
          <span class="hist-tipo-icon">${tipoIcon}</span>
          <span class="sp-sigla ${regClass}">${escapeHtml(r.sigla || '—')}</span>
          ${r.regional ? `<span class="sp-regional-badge ${regClass}">${escapeHtml(r.regional)}</span>` : ''}
        </div>
        <div class="hist-row-center">
          <span class="sp-status-pill ${statusClass}">${escapeHtml(r.status)}</span>
          ${camInfo ? `<span class="hist-cam-info">${escapeHtml(camInfo)}</span>` : ''}
        </div>
        <div class="hist-row-right">
          <span class="hist-operador">👤 ${escapeHtml(r.operador || '—')}</span>
          <span class="hist-ts">🕐 ${escapeHtml(ts)}</span>
        </div>
      </div>
      ${r.observacao ? `
        <div class="hist-obs">💬 ${escapeHtml(r.observacao)}</div>
      ` : ''}
    </div>
  `;
}

// ─── Filter Handlers ──────────────────────────────────────────────────────────

function setHistoricoRegional(regional) {
  historicoState.regional = regional;
  historicoState.page = 1;
  renderHistoricoPage();
}

function setHistoricoTipo(tipo) {
  historicoState.tipo = tipo;
  historicoState.page = 1;
  renderHistoricoPage();
}

function setHistoricoOperador(operador) {
  historicoState.operador = operador;
  historicoState.page = 1;
  renderHistoricoPage();
}

function setHistoricoPage(page) {
  historicoState.page = page;
  renderHistoricoPage();
}

function clearHistoricoFilters() {
  historicoState.regional = 'todos';
  historicoState.tipo = 'todos';
  historicoState.operador = '';
  historicoState.page = 1;
  renderHistoricoPage();
}
