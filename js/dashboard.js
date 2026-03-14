/**
 * dashboard.js - Enhanced dashboard module
 * Provides regional summary cards, additional charts, and problems table
 * Depends on: database.js, app.js, chart.umd.min.js
 */

// ─── Dashboard State ──────────────────────────────────────────────────────────

const dashState = {
  charts: {
    alarmRegional: null,
    cameraRegional: null,
    top10: null,
    problemDist: null,
  },
  problemsTable: {
    page: 1,
    pageSize: 10,
    sortBy: 'regional',
    sortDir: 'asc',
    filterRegional: 'todos',
    filterStatus: 'todos',
    searchQuery: '',
    data: [],
    filteredData: [],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _getCssVar(name, fallback) {
  return getComputedStyle(document.body).getPropertyValue(name).trim() || fallback;
}

function _fmtDate(str) {
  if (!str) return '-';
  try {
    const [y, m, d] = (str.split('T')[0]).split('-');
    if (y && m && d) return `${d}/${m}/${y.slice(2)}`;
  } catch (_) {}
  return str;
}

// ─── Top Summary Cards ────────────────────────────────────────────────────────

/**
 * Render the 4 regional summary cards at the top of the main content area.
 */
function renderTopSummaryCards() {
  const container = document.getElementById('regional-summary-cards');
  if (!container) return;

  let regionalStats, totalStats;
  try {
    regionalStats = getRegionalStats();
    totalStats    = getDashboardStats();
  } catch (e) {
    console.warn('[dashboard] renderTopSummaryCards:', e);
    return;
  }

  const regionais = [
    { code: 'PR', name: 'Paraná' },
    { code: 'SC', name: 'Santa Catarina' },
    { code: 'RS', name: 'Rio Grande do Sul' },
  ];

  function buildCard(code, name, s) {
    const alarmTotal = (s.alarmes_conectados || 0) + (s.alarmes_desconectados || 0);
    const cftvTotal  = (s.cftv_ok || 0) + (s.cftv_desconectado || 0);
    const alarmPct = alarmTotal > 0 ? Math.round((s.alarmes_conectados || 0) / alarmTotal * 100) : 0;
    const cftvPct  = cftvTotal  > 0 ? Math.round((s.cftv_ok || 0) / cftvTotal * 100) : 0;

    const onClick = code === 'GERAL' ? "setRegional('todos')" : `setRegional('${code}')`;
    const ariaLabel = code === 'GERAL'
      ? `Total geral: ${s.total || 0} sites`
      : `Regional ${code}: ${s.total || 0} sites`;

    return `
      <div class="top-card top-card-${code}"
           onclick="${onClick}"
           tabindex="0"
           role="button"
           aria-label="${ariaLabel}">
        <div class="top-card-header">
          <span class="top-card-badge top-card-badge-${code}">${code === 'GERAL' ? 'GERAL' : code}</span>
          <span class="top-card-title">${name}</span>
        </div>
        <div class="top-card-stat-row">
          <div class="top-card-stat">
            <span class="top-card-num">${s.total || 0}</span>
            <span class="top-card-lbl">Sites</span>
          </div>
          <div class="top-card-stat">
            <span class="top-card-num top-card-num-ok">${s.alarmes_conectados || 0}</span>
            <span class="top-card-lbl">Alarm. OK</span>
          </div>
          <div class="top-card-stat">
            <span class="top-card-num top-card-num-err">${s.alarmes_desconectados || 0}</span>
            <span class="top-card-lbl">Alarm. Desc.</span>
          </div>
        </div>
        <div class="top-card-bars">
          <div class="top-card-bar-row">
            <span class="top-card-bar-label" aria-hidden="true">🔔</span>
            <div class="top-card-progress"
                 role="progressbar"
                 aria-valuenow="${alarmPct}"
                 aria-valuemin="0"
                 aria-valuemax="100"
                 aria-label="Alarmes online: ${alarmPct}%">
              <div class="top-card-progress-fill top-card-progress-alarm"
                   style="width:${alarmPct}%"></div>
            </div>
            <span class="top-card-pct">${alarmPct}%</span>
          </div>
          <div class="top-card-bar-row">
            <span class="top-card-bar-label" aria-hidden="true">📷</span>
            <div class="top-card-progress"
                 role="progressbar"
                 aria-valuenow="${cftvPct}"
                 aria-valuemin="0"
                 aria-valuemax="100"
                 aria-label="CFTV online: ${cftvPct}%">
              <div class="top-card-progress-fill top-card-progress-cftv"
                   style="width:${cftvPct}%"></div>
            </div>
            <span class="top-card-pct">${cftvPct}%</span>
          </div>
        </div>
        <div class="top-card-cftv-row" aria-label="CFTV: ${s.cftv_ok || 0} OK, ${s.cftv_desconectado || 0} desconectadas">
          <span class="ok-text">${s.cftv_ok || 0}</span>
          <span class="sep"> / </span>
          <span class="offline-text">${s.cftv_desconectado || 0}</span>
          <span class="top-card-lbl"> câm. OK/Desc.</span>
          ${(s.vegetacao_alta || 0) > 0
            ? `<span class="top-card-veg" aria-label="${s.vegetacao_alta} sites com vegetação alta">🌿 ${s.vegetacao_alta}</span>`
            : ''}
        </div>
      </div>
    `;
  }

  const totalAlarmTotal = (totalStats.alarmes_conectados || 0) + (totalStats.alarmes_desconectados || 0);
  const totalCftvTotal  = (totalStats.cftv_ok || 0) + (totalStats.cftv_desconectado || 0);
  const geralStats = {
    total: totalStats.total,
    alarmes_conectados: totalStats.alarmes_conectados,
    alarmes_desconectados: totalStats.alarmes_desconectados,
    cftv_ok: totalStats.cftv_ok,
    cftv_desconectado: totalStats.cftv_desconectado,
    vegetacao_alta: totalStats.vegetacao_alta,
  };

  container.innerHTML =
    regionais.map(r => buildCard(r.code, r.name, regionalStats[r.code] || {})).join('') +
    buildCard('GERAL', 'Consolidado', geralStats);

  // Keyboard navigation
  container.querySelectorAll('.top-card').forEach(card => {
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
    });
  });
}

// ─── Charts ───────────────────────────────────────────────────────────────────

/** Destroy a named chart instance if it exists */
function _destroyChart(name) {
  if (dashState.charts[name]) {
    dashState.charts[name].destroy();
    dashState.charts[name] = null;
  }
}

/**
 * Render stacked bar chart: alarm status by regional.
 */
function renderAlarmRegionalChart() {
  const ctx = document.getElementById('alarm-regional-chart');
  if (!ctx) return;
  _destroyChart('alarmRegional');

  let stats;
  try { stats = getRegionalStats(); } catch (e) { return; }

  const labels = ['PR', 'SC', 'RS'].filter(r => stats[r]);
  if (!labels.length) return;

  const colorText  = _getCssVar('--text', '#e2e8f0');
  const colorMuted = _getCssVar('--text-muted', '#94a3b8');

  dashState.charts.alarmRegional = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Online',
          data: labels.map(r => stats[r]?.alarmes_conectados || 0),
          backgroundColor: 'rgba(16,185,129,.8)',
          borderRadius: 4,
        },
        {
          label: 'Desconectado',
          data: labels.map(r => stats[r]?.alarmes_desconectados || 0),
          backgroundColor: 'rgba(239,68,68,.8)',
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: colorMuted, boxWidth: 12, font: { size: 11 } } },
        tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.raw}` } },
      },
      scales: {
        x: { stacked: true, ticks: { color: colorText }, grid: { display: false } },
        y: { stacked: true, ticks: { color: colorMuted }, grid: { color: 'rgba(255,255,255,.06)' }, beginAtZero: true },
      },
    },
  });
}

/**
 * Render grouped bar chart: camera status by regional.
 */
function renderCameraRegionalChart() {
  const ctx = document.getElementById('camera-regional-chart');
  if (!ctx) return;
  _destroyChart('cameraRegional');

  let stats;
  try { stats = getRegionalStats(); } catch (e) { return; }

  const labels = ['PR', 'SC', 'RS'].filter(r => stats[r]);
  if (!labels.length) return;

  const colorText  = _getCssVar('--text', '#e2e8f0');
  const colorMuted = _getCssVar('--text-muted', '#94a3b8');

  dashState.charts.cameraRegional = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'OK',
          data: labels.map(r => stats[r]?.cftv_ok || 0),
          backgroundColor: 'rgba(59,130,246,.8)',
          borderRadius: 4,
        },
        {
          label: 'Parcial',
          data: labels.map(r => stats[r]?.cftv_parcial || 0),
          backgroundColor: 'rgba(245,158,11,.8)',
          borderRadius: 4,
        },
        {
          label: 'Desconectado',
          data: labels.map(r => stats[r]?.cftv_desconectado || 0),
          backgroundColor: 'rgba(239,68,68,.8)',
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: colorMuted, boxWidth: 12, font: { size: 11 } } },
        tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.raw}` } },
      },
      scales: {
        x: { ticks: { color: colorText }, grid: { display: false } },
        y: { ticks: { color: colorMuted }, grid: { color: 'rgba(255,255,255,.06)' }, beginAtZero: true },
      },
    },
  });
}

/**
 * Render horizontal bar chart: top 10 sites with the most problems.
 */
function renderTop10Chart() {
  const ctx = document.getElementById('top10-chart');
  if (!ctx) return;
  _destroyChart('top10');

  let sites;
  try { sites = searchSites('', 'todos', 'todos'); } catch (e) { return; }

  const scored = sites
    .filter(s =>
      s.status_conexao === 'DESCONECTADO' ||
      s.status2 === 'DESCONECTADO' ||
      s.status2 === 'PARCIAL' ||
      s.ultimo_status_ronda === 'DESCONECTADO' ||
      s.ultimo_status_ronda === 'PARCIAL'
    )
    .map(s => {
      let score = 0;
      if (s.status_conexao === 'DESCONECTADO') score += 3;
      if (s.status2 === 'DESCONECTADO') score += 3;
      if (s.status2 === 'PARCIAL') score += 1;
      if (s.ultimo_status_ronda === 'DESCONECTADO') score += 2;
      if (s.padrao_cameras > 0 && s.cameras_hoje !== null) {
        score += Math.max(0, (s.padrao_cameras || 0) - (s.cameras_hoje || 0));
      }
      return { ...s, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const emptyMsg = ctx.closest('.chart-panel')?.querySelector('.chart-empty-msg');

  if (!scored.length) {
    if (emptyMsg) emptyMsg.classList.remove('hidden');
    return;
  }
  if (emptyMsg) emptyMsg.classList.add('hidden');

  const colorText = _getCssVar('--text', '#e2e8f0');

  dashState.charts.top10 = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: scored.map(s => `${s.sigla}${s.regional ? ' (' + s.regional + ')' : ''}`),
      datasets: [{
        label: 'Problemas',
        data: scored.map(s => s.score),
        backgroundColor: scored.map(s =>
          s.score >= 5 ? 'rgba(239,68,68,.85)' :
          s.score >= 3 ? 'rgba(245,158,11,.85)' :
                         'rgba(59,130,246,.65)'
        ),
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ` Pontuação: ${c.raw}` } },
      },
      scales: {
        x: { ticks: { color: _getCssVar('--text-muted', '#94a3b8') }, grid: { color: 'rgba(255,255,255,.06)' }, beginAtZero: true },
        y: { ticks: { color: colorText, font: { size: 11 } }, grid: { display: false } },
      },
    },
  });
}

/**
 * Render doughnut chart: distribution of problem types.
 */
function renderProblemDistChart() {
  const ctx = document.getElementById('problem-dist-chart');
  if (!ctx) return;
  _destroyChart('problemDist');

  let stats;
  try { stats = getDashboardStats(); } catch (e) { return; }

  const data = [
    stats.alarmes_desconectados || 0,
    stats.cftv_desconectado || 0,
    stats.cftv_parcial || 0,
    stats.vegetacao_alta || 0,
    stats.offline || 0,
  ];
  const total = data.reduce((a, b) => a + b, 0);
  if (!total) return;

  dashState.charts.problemDist = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Alarme Desc.', 'CFTV Desc.', 'CFTV Parcial', 'Vegetação Alta', 'Ronda Offline'],
      datasets: [{
        data,
        backgroundColor: [
          'rgba(239,68,68,.85)',
          'rgba(245,158,11,.85)',
          'rgba(251,191,36,.85)',
          'rgba(52,211,153,.85)',
          'rgba(156,163,175,.85)',
        ],
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: { color: _getCssVar('--text-muted', '#94a3b8'), boxWidth: 10, font: { size: 10 } },
        },
        tooltip: {
          callbacks: {
            label: c => ` ${c.label}: ${c.raw} (${Math.round(c.raw / total * 100)}%)`,
          },
        },
      },
    },
  });
}

// ─── Problems Table ───────────────────────────────────────────────────────────

/** Get problem description for a site */
function _getProblemDesc(s) {
  const parts = [];
  if (s.status_conexao === 'DESCONECTADO') parts.push('🔴 Alarme');
  if (s.status2 === 'DESCONECTADO') parts.push('📵 CFTV Desc.');
  if (s.status2 === 'PARCIAL') {
    const cam = (s.cameras_hoje !== null && s.padrao_cameras)
      ? ` (${s.cameras_hoje}/${s.padrao_cameras})` : '';
    parts.push(`🟡 Parcial${cam}`);
  }
  if (s.camera_problema && s.camera_problema !== '❌' && s.camera_problema !== '🔶')
    parts.push(s.camera_problema);
  if (s.ultimo_status_ronda === 'DESCONECTADO') parts.push('❌ Ronda Off.');
  if (s.vegetacao_alta) parts.push('🌿 Vegetação');
  return parts.join(', ') || '-';
}

/** Get all sites that have at least one problem */
function _getProblemSites() {
  try {
    return searchSites('', 'todos', 'todos').filter(s =>
      s.status_conexao === 'DESCONECTADO' ||
      s.status2 === 'DESCONECTADO' ||
      s.status2 === 'PARCIAL' ||
      s.ultimo_status_ronda === 'DESCONECTADO' ||
      s.ultimo_status_ronda === 'PARCIAL'
    ).map(s => ({
      ...s,
      problema: _getProblemDesc(s),
      data_problema: s.data_desconexao || s.data_alteracao || (s.ultima_ronda_ts ? s.ultima_ronda_ts.split('T')[0] : null) || '',
    }));
  } catch (_) { return []; }
}

/** Generate page number buttons */
function _buildPageButtons(current, total) {
  const maxVisible = 5;
  let start = Math.max(1, current - Math.floor(maxVisible / 2));
  let end   = Math.min(total, start + maxVisible - 1);
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);

  return Array.from({ length: end - start + 1 }, (_, i) => {
    const p = start + i;
    return `<button class="page-btn${p === current ? ' active' : ''}"
      onclick="changeProblemsPage(${p})"
      ${p === current ? 'aria-current="page"' : ''}
      aria-label="Página ${p}">${p}</button>`;
  }).join('');
}

/**
 * Render (or re-render) the paginated, sortable problems table.
 */
function renderProblemsTable() {
  const container = document.getElementById('problems-table-section');
  if (!container) return;

  const pt = dashState.problemsTable;

  // Refresh raw data
  pt.data = _getProblemSites();

  // Apply filters
  let filtered = pt.data;
  if (pt.filterRegional !== 'todos') {
    filtered = filtered.filter(s => s.regional === pt.filterRegional);
  }
  if (pt.filterStatus !== 'todos') {
    const map = {
      alarme:    s => s.status_conexao === 'DESCONECTADO',
      cftv_desc: s => s.status2 === 'DESCONECTADO',
      parcial:   s => s.status2 === 'PARCIAL',
      ronda:     s => s.ultimo_status_ronda === 'DESCONECTADO',
    };
    if (map[pt.filterStatus]) filtered = filtered.filter(map[pt.filterStatus]);
  }
  if (pt.searchQuery) {
    const q = pt.searchQuery.toLowerCase();
    filtered = filtered.filter(s =>
      s.sigla?.toLowerCase().includes(q) || String(s.conta || '').includes(q)
    );
  }

  // Sort
  filtered.sort((a, b) => {
    let va = a[pt.sortBy] ?? '';
    let vb = b[pt.sortBy] ?? '';
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return pt.sortDir === 'asc' ? cmp : -cmp;
  });

  pt.filteredData = filtered;
  const total      = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pt.pageSize));
  pt.page          = Math.min(pt.page, totalPages);

  const start    = (pt.page - 1) * pt.pageSize;
  const pageData = filtered.slice(start, start + pt.pageSize);

  function sortIcon(col) {
    if (pt.sortBy !== col) return '<span class="sort-icon" aria-hidden="true">↕</span>';
    return pt.sortDir === 'asc'
      ? '<span class="sort-icon active" aria-hidden="true">↑</span>'
      : '<span class="sort-icon active" aria-hidden="true">↓</span>';
  }

  function ariaSort(col) {
    if (pt.sortBy !== col) return 'none';
    return pt.sortDir === 'asc' ? 'ascending' : 'descending';
  }

  if (!total) {
    container.innerHTML = `
      <div class="problems-table-wrap">
        <div class="problems-table-header">
          <h3 class="problems-table-title">⚠️ Problemas Ativos</h3>
        </div>
        <div class="empty-state" style="padding:32px 20px">
          <div class="empty-icon">🎉</div>
          <p>Nenhum problema ativo encontrado!</p>
        </div>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="problems-table-wrap">
      <div class="problems-table-header">
        <h3 class="problems-table-title" id="prob-table-heading">
          ⚠️ Problemas Ativos
          <span class="badge-count" aria-label="${total} problemas">${total}</span>
        </h3>
        <div class="problems-table-controls">
          <input type="search"
            id="problems-search"
            class="problems-search"
            placeholder="Buscar SIGLA..."
            value="${escapeHtml(pt.searchQuery)}"
            aria-label="Buscar sites com problemas"
            autocomplete="off">
          <select id="problems-filter-regional" class="problems-filter-select" aria-label="Filtrar por regional">
            <option value="todos"   ${pt.filterRegional === 'todos' ? 'selected' : ''}>🗺️ Todas</option>
            <option value="PR"      ${pt.filterRegional === 'PR'    ? 'selected' : ''}>📍 PR</option>
            <option value="SC"      ${pt.filterRegional === 'SC'    ? 'selected' : ''}>📍 SC</option>
            <option value="RS"      ${pt.filterRegional === 'RS'    ? 'selected' : ''}>📍 RS</option>
          </select>
          <select id="problems-filter-status" class="problems-filter-select" aria-label="Filtrar por tipo de problema">
            <option value="todos"     ${pt.filterStatus === 'todos'     ? 'selected' : ''}>🔍 Todos</option>
            <option value="alarme"    ${pt.filterStatus === 'alarme'    ? 'selected' : ''}>🔴 Alarme Desc.</option>
            <option value="cftv_desc" ${pt.filterStatus === 'cftv_desc' ? 'selected' : ''}>📵 CFTV Desc.</option>
            <option value="parcial"   ${pt.filterStatus === 'parcial'   ? 'selected' : ''}>🟡 CFTV Parcial</option>
            <option value="ronda"     ${pt.filterStatus === 'ronda'     ? 'selected' : ''}>❌ Ronda Off.</option>
          </select>
        </div>
      </div>

      <div class="table-wrap" role="region" aria-labelledby="prob-table-heading">
        <table class="problems-table" aria-label="Tabela de problemas ativos">
          <thead>
            <tr>
              <th class="sortable" onclick="sortProblemsTable('regional')"
                  tabindex="0" aria-sort="${ariaSort('regional')}">Regional${sortIcon('regional')}</th>
              <th class="sortable" onclick="sortProblemsTable('sigla')"
                  tabindex="0" aria-sort="${ariaSort('sigla')}">SIGLA${sortIcon('sigla')}</th>
              <th class="sortable" onclick="sortProblemsTable('conta')"
                  tabindex="0" aria-sort="${ariaSort('conta')}">Conta${sortIcon('conta')}</th>
              <th>Status Alarme</th>
              <th>Status CFTV</th>
              <th>Problema</th>
              <th class="sortable" onclick="sortProblemsTable('data_problema')"
                  tabindex="0" aria-sort="${ariaSort('data_problema')}">Data${sortIcon('data_problema')}</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${pageData.map(s => `
              <tr class="problem-row" onclick="showSiteDetail(${s.id})" tabindex="0"
                  aria-label="${escapeHtml(s.sigla)}: ${escapeHtml(s.problema)}">
                <td><span class="badge-regional badge-regional-${escapeHtml(s.regional || '')}">${escapeHtml(s.regional || '-')}</span></td>
                <td class="sigla-cell"><strong>${escapeHtml(s.sigla)}</strong></td>
                <td>${s.conta || '-'}</td>
                <td><span class="badge ${connectionStatusClass(s.status_conexao)}">${escapeHtml(s.status_conexao || '-')}</span></td>
                <td><span class="badge ${status2Class(s.status2)}">${escapeHtml(s.status2 || '-')}</span></td>
                <td class="problema-cell" title="${escapeHtml(s.problema)}">${escapeHtml(s.problema)}</td>
                <td>${_fmtDate(s.data_problema)}</td>
                <td onclick="event.stopPropagation()">
                  <button class="btn-action btn-action-ok"
                    onclick="quickMark(${s.id},'OK')"
                    title="Marcar OK"
                    aria-label="Marcar ${escapeHtml(s.sigla)} como OK">✅</button>
                  <button class="btn-action btn-action-off"
                    onclick="quickMark(${s.id},'DESCONECTADO')"
                    title="Marcar Offline"
                    aria-label="Marcar ${escapeHtml(s.sigla)} como offline">❌</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="problems-table-footer">
        <span class="problems-count" aria-live="polite">
          Mostrando ${start + 1}–${Math.min(start + pt.pageSize, total)} de ${total}
        </span>
        <nav class="pagination" aria-label="Paginação da tabela de problemas">
          <button class="page-btn" onclick="changeProblemsPage(1)"
            ${pt.page === 1 ? 'disabled' : ''} aria-label="Primeira página">«</button>
          <button class="page-btn" onclick="changeProblemsPage(${pt.page - 1})"
            ${pt.page === 1 ? 'disabled' : ''} aria-label="Página anterior">‹</button>
          ${_buildPageButtons(pt.page, totalPages)}
          <button class="page-btn" onclick="changeProblemsPage(${pt.page + 1})"
            ${pt.page === totalPages ? 'disabled' : ''} aria-label="Próxima página">›</button>
          <button class="page-btn" onclick="changeProblemsPage(${totalPages})"
            ${pt.page === totalPages ? 'disabled' : ''} aria-label="Última página">»</button>
        </nav>
      </div>
    </div>`;

  // Wire up search (debounced)
  const searchEl = document.getElementById('problems-search');
  if (searchEl) {
    let timer;
    searchEl.addEventListener('input', e => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        dashState.problemsTable.searchQuery = e.target.value.trim();
        dashState.problemsTable.page = 1;
        renderProblemsTable();
      }, 300);
    });
  }

  document.getElementById('problems-filter-regional')?.addEventListener('change', e => {
    dashState.problemsTable.filterRegional = e.target.value;
    dashState.problemsTable.page = 1;
    renderProblemsTable();
  });

  document.getElementById('problems-filter-status')?.addEventListener('change', e => {
    dashState.problemsTable.filterStatus = e.target.value;
    dashState.problemsTable.page = 1;
    renderProblemsTable();
  });

  // Keyboard support for sortable headers
  document.querySelectorAll('.problems-table th.sortable').forEach(th => {
    th.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); th.click(); }
    });
  });

  // Keyboard support for data rows
  document.querySelectorAll('.problem-row').forEach(row => {
    row.addEventListener('keydown', e => {
      if (e.key === 'Enter') row.click();
    });
  });
}

// ─── Public: Sort / Page ──────────────────────────────────────────────────────

function sortProblemsTable(col) {
  const pt = dashState.problemsTable;
  if (pt.sortBy === col) {
    pt.sortDir = pt.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    pt.sortBy  = col;
    pt.sortDir = 'asc';
  }
  pt.page = 1;
  renderProblemsTable();
}

function changeProblemsPage(page) {
  const pt = dashState.problemsTable;
  const totalPages = Math.max(1, Math.ceil(pt.filteredData.length / pt.pageSize));
  pt.page = Math.max(1, Math.min(page, totalPages));
  renderProblemsTable();
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Refresh all enhanced dashboard components.
 * Called from app.js after the original refreshDashboard().
 */
function refreshEnhancedDashboard() {
  renderTopSummaryCards();
  renderAlarmRegionalChart();
  renderCameraRegionalChart();
  renderTop10Chart();
  renderProblemDistChart();
  renderProblemsTable();
}
