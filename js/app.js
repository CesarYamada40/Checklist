/**
 * app.js - Main application controller
 * Handles routing, login, dashboard, sites list, site detail, and global UI
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_SITES_VISIBLE = 300; // Maximum sites rendered at once in the list

// ─── State ───────────────────────────────────────────────────────────────────

let appState = {
  operador: null,
  searchQuery: '',
  activeFilter: 'todos',
  sortBy: 'sigla',
  chart: null,
};

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  showLoadingScreen('Inicializando banco de dados...');
  try {
    await initDatabase();
    showLoadingScreen('Pronto!');
    await new Promise(r => setTimeout(r, 300));

    // Check for saved operator
    const savedOp = localStorage.getItem('cftv_operador');
    if (savedOp) {
      appState.operador = savedOp;
      showMainScreen();
    } else {
      showLoginScreen();
    }
  } catch (err) {
    showLoadingScreen(`❌ Erro ao inicializar: ${err.message}`);
    console.error(err);
  }
});

// ─── Screen Management ───────────────────────────────────────────────────────

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  const el = document.getElementById(`screen-${name}`);
  if (el) el.classList.remove('hidden');
}

function showLoadingScreen(msg) {
  document.getElementById('loading-msg').textContent = msg;
  showScreen('loading');
}

function showLoginScreen() {
  showScreen('login');
  // Populate recent operators
  try {
    const users = getUsuarios();
    const list = document.getElementById('recent-operators');
    if (users.length) {
      list.innerHTML = users.slice(0, 5).map(u =>
        `<button class="operator-chip" onclick="selectOperator('${escapeHtml(u.nome)}')">${escapeHtml(u.nome)}</button>`
      ).join('');
      list.classList.remove('hidden');
    } else {
      list.classList.add('hidden');
    }
  } catch (_) {}
  document.getElementById('login-name').focus();
}

function selectOperator(nome) {
  document.getElementById('login-name').value = nome;
  doLogin();
}

function doLogin() {
  const name = document.getElementById('login-name').value.trim();
  if (!name) {
    document.getElementById('login-error').textContent = 'Digite seu nome para entrar.';
    return;
  }
  if (name.length > 60) {
    document.getElementById('login-error').textContent = 'Nome muito longo (máx. 60 caracteres).';
    return;
  }
  document.getElementById('login-error').textContent = '';
  appState.operador = name;
  localStorage.setItem('cftv_operador', name);
  upsertUsuario(name);
  showMainScreen();
}

function doLogout() {
  if (!confirm('Deseja sair? Você precisará fazer login novamente.')) return;
  appState.operador = null;
  localStorage.removeItem('cftv_operador');
  if (rondaState.active) {
    rondaState.active = false;
  }
  showLoginScreen();
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

function showMainScreen() {
  document.getElementById('operator-name').textContent = appState.operador || '';
  showScreen('main');
  refreshDashboard();
  renderSitesList();
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

function refreshDashboard() {
  const stats = getDashboardStats();

  document.getElementById('stat-total').textContent = stats.total;
  document.getElementById('stat-ok').textContent = stats.ok;
  document.getElementById('stat-parcial').textContent = stats.parcial;
  document.getElementById('stat-offline').textContent = stats.offline;
  document.getElementById('stat-nv').textContent = stats.nao_verificado;

  renderPieChart(stats);
  renderCriticos(stats.criticos);
}

function renderPieChart(stats) {
  const ctx = document.getElementById('status-chart');
  if (!ctx) return;

  if (appState.chart) {
    appState.chart.destroy();
    appState.chart = null;
  }

  const total = stats.ok + stats.parcial + stats.offline + stats.nao_verificado;
  if (!total) return;

  appState.chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['OK', 'Parcial', 'Offline', 'Não Verificado'],
      datasets: [{
        data: [stats.ok, stats.parcial, stats.offline, stats.nao_verificado],
        backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#6b7280'],
        borderWidth: 0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.raw} sites (${Math.round(ctx.raw / total * 100)}%)`
          }
        }
      },
      cutout: '65%',
    }
  });
}

function renderCriticos(criticos) {
  const el = document.getElementById('criticos-list');
  if (!criticos.length) {
    el.innerHTML = '<p class="empty-msg">Nenhum site crítico no momento 🎉</p>';
    return;
  }
  el.innerHTML = criticos.map(s => {
    const days = s.ultima_ronda_ts
      ? Math.floor((Date.now() - new Date(s.ultima_ronda_ts)) / 86400000)
      : null;
    return `
      <div class="critico-item" onclick="showSiteDetail(${s.id})">
        <span class="critico-sigla">${escapeHtml(s.sigla)}</span>
        <span class="critico-status">${escapeHtml(s.status_conexao || s.ultimo_status || 'DESCONECTADO')}</span>
        ${days !== null ? `<span class="critico-days">${days}d</span>` : ''}
      </div>
    `;
  }).join('');
}

// ─── Sites List ──────────────────────────────────────────────────────────────

function renderSitesList() {
  const sites = searchSites(appState.searchQuery, appState.activeFilter);

  const container = document.getElementById('sites-list');

  if (!sites.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <p>Nenhum site encontrado.</p>
        ${!appState.searchQuery && appState.activeFilter === 'todos'
          ? `<p class="empty-sub">Importe uma planilha XLSX para começar.</p>
             <button class="btn btn-primary" onclick="triggerXLSXImport()">📥 Importar XLSX</button>`
          : ''}
      </div>
    `;
    return;
  }

  // Show up to MAX_SITES_VISIBLE sites for performance
  const visible = sites.slice(0, MAX_SITES_VISIBLE);

  container.innerHTML = visible.map(s => renderSiteCard(s)).join('');
}

function renderSiteCard(s) {
  const lastStatus = s.ultimo_status_ronda;
  const statusClass = lastStatus ? statusToClass(lastStatus) : 'status-unknown';
  const statusLabel = lastStatus || 'Não verificado';
  const statusIcon = statusToIcon(lastStatus);

  const cameras = s.padrao_cameras
    ? (s.ultimas_cameras_func !== null && s.ultimas_cameras_func !== undefined
      ? `${s.ultimas_cameras_func}/${s.padrao_cameras}`
      : `${s.padrao_cameras}`)
    : '';

  const lastTs = s.ultima_ronda_ts ? formatDateTime(s.ultima_ronda_ts) : null;

  const badges = [
    s.os ? '<span class="badge-os">📋 O.S.</span>' : '',
    s.vegetacao_alta ? '<span class="badge-veg">🌿 Veg.</span>' : '',
    s.status_conexao === 'DESCONECTADO' ? '<span class="badge-disc">📵 Desc.</span>' : '',
  ].filter(Boolean).join('');

  return `
    <div class="site-card ${statusClass}" onclick="showSiteDetail(${s.id})">
      <div class="site-card-header">
        <span class="site-status-icon">${statusIcon}</span>
        <span class="site-sigla">${escapeHtml(s.sigla)}</span>
        ${s.conta ? `<span class="site-conta">${s.conta}</span>` : ''}
        <span class="site-badges">${badges}</span>
      </div>
      <div class="site-card-info">
        ${cameras ? `<span class="site-cameras">📷 ${cameras} câmeras</span>` : ''}
        <span class="site-last">${lastTs ? `Última: ${lastTs}` : 'Nunca verificado'}</span>
        ${s.ultimo_operador ? `<span class="site-operador">por ${escapeHtml(s.ultimo_operador)}</span>` : ''}
      </div>
      <div class="site-card-actions" onclick="event.stopPropagation()">
        <button class="btn-quick btn-ok-q" onclick="quickMark(${s.id}, 'OK')" title="Marcar OK">✅</button>
        <button class="btn-quick btn-parcial-q" onclick="quickMarkParcial(${s.id})" title="Marcar Parcial">⚠️</button>
        <button class="btn-quick btn-offline-q" onclick="quickMark(${s.id}, 'DESCONECTADO')" title="Marcar Offline">❌</button>
      </div>
    </div>
  `;
}

function quickMark(siteId, status) {
  if (!appState.operador) { showToast('Faça login primeiro.', 'error'); return; }
  const site = getSiteById(siteId);
  if (!site) return;
  insertRonda({
    site_id: siteId,
    operador: appState.operador,
    status,
    cameras_funcionando: null,
    cameras_esperadas: site.padrao_cameras,
    observacao: null,
  });
  showToast(`${statusToIcon(status)} ${site.sigla} marcado como ${status}`, 'success');
  renderSitesList();
  refreshDashboard();
}

function quickMarkParcial(siteId) {
  const site = getSiteById(siteId);
  if (!site) return;

  document.getElementById('modal-overlay').innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>⚠️ PARCIAL - ${escapeHtml(site.sigla)}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="modal-field">
          <label>Câmeras funcionando:</label>
          <div class="cameras-input-row">
            <input type="number" id="cam-func" class="input-number" min="0"
              max="${site.padrao_cameras || 99}" value="" placeholder="0">
            <span class="cam-sep">de</span>
            <input type="number" id="cam-esp" class="input-number" min="1"
              max="99" value="${site.padrao_cameras || ''}" placeholder="${site.padrao_cameras || '?'}">
          </div>
        </div>
        <div class="modal-field">
          <label>Observação (opcional):</label>
          <textarea id="obs-field" class="textarea" rows="3"
            placeholder="Ex: Câmera 3 sem imagem..."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-warning" onclick="saveQuickParcial(${siteId})">⚠️ Salvar</button>
      </div>
    </div>
  `;
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('cam-func').focus();
}

function saveQuickParcial(siteId) {
  const camFunc = parseInt(document.getElementById('cam-func').value, 10);
  const camEsp = parseInt(document.getElementById('cam-esp').value, 10);
  const obs = document.getElementById('obs-field').value.trim();

  if (isNaN(camFunc) || camFunc < 0) {
    alert('Informe quantas câmeras estão funcionando.');
    return;
  }

  const site = getSiteById(siteId);
  insertRonda({
    site_id: siteId,
    operador: appState.operador,
    status: 'PARCIAL',
    cameras_funcionando: camFunc,
    cameras_esperadas: isNaN(camEsp) ? (site?.padrao_cameras || null) : camEsp,
    observacao: obs || null,
  });
  closeModal();
  showToast(`⚠️ ${site?.sigla} marcado como PARCIAL`, 'success');
  renderSitesList();
  refreshDashboard();
}

// ─── Site Detail ─────────────────────────────────────────────────────────────

function showSiteDetail(siteId) {
  const site = getSiteById(siteId);
  if (!site) return;

  const rondas = getRondasBySite(siteId, 10);
  const lastRonda = rondas[0] || null;
  const statusClass = lastRonda ? statusToClass(lastRonda.status) : 'status-unknown';

  const sinceDate = site.data_desconexao
    ? daysSince(site.data_desconexao) + ' dias'
    : (site.data_alteracao ? daysSince(site.data_alteracao) + ' dias' : null);

  const rondaRows = rondas.map(r => `
    <tr>
      <td>${formatDateTime(r.timestamp)}</td>
      <td><span class="badge ${statusToClass(r.status)}">${r.status}</span></td>
      <td>${r.cameras_funcionando !== null ? `${r.cameras_funcionando}/${r.cameras_esperadas}` : '-'}</td>
      <td>${escapeHtml(r.operador)}</td>
      <td>${escapeHtml(r.observacao || '')}</td>
    </tr>
  `).join('');

  document.getElementById('site-detail-content').innerHTML = `
    <div class="detail-card">
      <div class="detail-header ${statusClass}">
        <div class="detail-title">
          <h2>${escapeHtml(site.sigla)}</h2>
          ${site.conta ? `<span class="detail-conta">Conta: ${site.conta}</span>` : ''}
        </div>
        <button class="btn btn-secondary btn-sm" onclick="showMainScreen()">✕ Fechar</button>
      </div>

      <div class="detail-grid">
        <div class="detail-section">
          <h4>Conexão</h4>
          <div class="detail-row">
            <span>Status:</span>
            <span class="badge ${connectionStatusClass(site.status_conexao)}">${site.status_conexao || '-'}</span>
          </div>
          ${site.data_desconexao ? `
          <div class="detail-row">
            <span>Desde:</span>
            <span>${site.data_desconexao}${sinceDate ? ` (${sinceDate})` : ''}</span>
          </div>` : ''}
          ${site.os ? `
          <div class="detail-row">
            <span>O.S.:</span>
            <span>${escapeHtml(site.os)}</span>
          </div>` : ''}
          ${site.zona ? `
          <div class="detail-row">
            <span>Zona:</span>
            <span>${escapeHtml(site.zona)} ${site.status4 ? `(${escapeHtml(site.status4)})` : ''}</span>
          </div>` : ''}
        </div>

        <div class="detail-section">
          <h4>Câmeras</h4>
          <div class="detail-row">
            <span>Padrão:</span>
            <span>${site.padrao_cameras || '-'}</span>
          </div>
          ${site.cameras_hoje !== null ? `
          <div class="detail-row">
            <span>Hoje:</span>
            <span>${site.cameras_hoje}/${site.padrao_cameras || '?'}</span>
          </div>` : ''}
          ${site.cameras_ontem !== null ? `
          <div class="detail-row">
            <span>Ontem:</span>
            <span>${site.cameras_ontem}/${site.padrao_cameras || '?'}</span>
          </div>` : ''}
          ${site.status2 ? `
          <div class="detail-row">
            <span>Status:</span>
            <span class="badge ${status2Class(site.status2)}">${site.status2}</span>
          </div>` : ''}
          ${site.camera_problema ? `
          <div class="detail-row">
            <span>Câmera prob.:</span>
            <span>${escapeHtml(site.camera_problema)}</span>
          </div>` : ''}
        </div>

        <div class="detail-section">
          <h4>Vegetação</h4>
          <div class="detail-row">
            <span>Vegetação alta:</span>
            <span>${site.vegetacao_alta ? '🌿 Sim' : '✅ Não'}</span>
          </div>
          ${site.data_alteracao_vegetacao ? `
          <div class="detail-row">
            <span>Alterado em:</span>
            <span>${site.data_alteracao_vegetacao}</span>
          </div>` : ''}
        </div>

        <div class="detail-section">
          <h4>Última Ronda</h4>
          ${lastRonda ? `
          <div class="detail-row">
            <span>Status:</span>
            <span class="badge ${statusToClass(lastRonda.status)}">${lastRonda.status}</span>
          </div>
          <div class="detail-row">
            <span>Data:</span>
            <span>${formatDateTime(lastRonda.timestamp)}</span>
          </div>
          <div class="detail-row">
            <span>Operador:</span>
            <span>${escapeHtml(lastRonda.operador)}</span>
          </div>
          ${lastRonda.cameras_funcionando !== null ? `
          <div class="detail-row">
            <span>Câmeras:</span>
            <span>${lastRonda.cameras_funcionando}/${lastRonda.cameras_esperadas}</span>
          </div>` : ''}
          ${lastRonda.observacao ? `
          <div class="detail-row">
            <span>Obs.:</span>
            <span>${escapeHtml(lastRonda.observacao)}</span>
          </div>` : ''}
          ` : '<p class="empty-msg">Nenhuma ronda registrada</p>'}
        </div>
      </div>

      ${rondas.length ? `
      <div class="detail-history">
        <h4>Histórico de Rondas (últimas ${rondas.length})</h4>
        <div class="table-wrap">
          <table class="history-table">
            <thead>
              <tr><th>Data/Hora</th><th>Status</th><th>Câmeras</th><th>Operador</th><th>Observação</th></tr>
            </thead>
            <tbody>${rondaRows}</tbody>
          </table>
        </div>
      </div>
      ` : ''}

      <div class="detail-actions">
        <button class="btn btn-primary" onclick="quickMark(${site.id}, 'OK')">✅ Marcar OK</button>
        <button class="btn btn-warning" onclick="quickMarkParcial(${site.id})">⚠️ Marcar Parcial</button>
        <button class="btn btn-danger" onclick="quickMark(${site.id}, 'DESCONECTADO')">❌ Marcar Offline</button>
      </div>
    </div>
  `;

  showScreen('detail');
}

// ─── XLSX Import ─────────────────────────────────────────────────────────────

function triggerXLSXImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xls,.csv';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    showToast('⏳ Importando planilha...', 'info');
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const result = importXLSX(ev.target.result);
        const msg = `✅ Importados: ${result.imported} novos, ${result.updated} atualizados, ${result.skipped} ignorados`;
        showToast(msg, 'success', 5000);
        if (result.errors.length) {
          console.warn('Import errors:', result.errors);
        }
        refreshDashboard();
        renderSitesList();
      } catch (err) {
        showToast(`❌ Erro na importação: ${err.message}`, 'error', 6000);
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
  };
  input.click();
}

// ─── Start Ronda ─────────────────────────────────────────────────────────────

function triggerStartRonda() {
  if (!appState.operador) { showToast('Faça login primeiro.', 'error'); return; }
  const sites = getAllSites();
  if (!sites.length) {
    showToast('Importe uma planilha XLSX primeiro.', 'error');
    return;
  }

  // Sort: sites with problems first, then unverified, then OK
  const sorted = [...sites].sort((a, b) => {
    const order = { 'DESCONECTADO': 0, 'PARCIAL': 1, null: 2, 'OK': 3 };
    const getLastStatus = s => {
      try {
        const r = getLastRondaBySite(s.id);
        return r ? r.status : null;
      } catch (_) { return null; }
    };
    return (order[getLastStatus(a)] ?? 2) - (order[getLastStatus(b)] ?? 2);
  });

  startRonda(appState.operador, sorted);
}

// ─── Search & Filter ─────────────────────────────────────────────────────────

function onSearch(e) {
  appState.searchQuery = e.target.value.trim();
  renderSitesList();
}

function setFilter(filter) {
  appState.activeFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  renderSitesList();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeFilename(str) {
  return (str || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
}

function statusToClass(status) {
  switch ((status || '').toUpperCase()) {
    case 'OK': return 'status-ok';
    case 'PARCIAL': return 'status-parcial';
    case 'DESCONECTADO': return 'status-offline';
    default: return 'status-unknown';
  }
}

function statusToIcon(status) {
  switch ((status || '').toUpperCase()) {
    case 'OK': return '🟢';
    case 'PARCIAL': return '🟡';
    case 'DESCONECTADO': return '🔴';
    default: return '⚫';
  }
}

function connectionStatusClass(status) {
  switch ((status || '').toUpperCase()) {
    case 'ONLINE': return 'status-ok';
    case 'DESCONECTADO': return 'status-offline';
    case 'NÃO POSSUI': return 'status-unknown';
    default: return 'status-unknown';
  }
}

function status2Class(status) {
  switch ((status || '').toUpperCase()) {
    case 'OK': return 'status-ok';
    case 'PARCIAL': return 'status-parcial';
    case 'DESCONECTADO': return 'status-offline';
    default: return 'status-unknown';
  }
}

function formatDateTime(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts.includes('T') ? ts : ts.replace(' ', 'T'));
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  } catch (_) { return ts; }
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return Math.floor((Date.now() - d.getTime()) / 86400000);
  } catch (_) { return null; }
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.add('hidden');
  overlay.innerHTML = '';
}

function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => toast.classList.add('toast-show'));

  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Login form enter key
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-name')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });

  document.getElementById('search-input')?.addEventListener('input', onSearch);
});
