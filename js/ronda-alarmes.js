/**
 * ronda-alarmes.js - Alarm round page
 * Site-by-site alarm status verification with alarm-specific statuses
 */

// ─── State ───────────────────────────────────────────────────────────────────

let rondaAlarmesState = {
  active: false,
  sites: [],
  currentIndex: 0,
  operador: '',
  startTime: null,
  results: [],
};

// ─── Navigation ───────────────────────────────────────────────────────────────

function showRondaAlarmesScreen() {
  showScreen('ronda-alarmes');
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const el = document.getElementById('nav-ronda-alarmes');
  if (el) el.classList.add('active');
  renderRondaAlarmesLauncher();
}

// ─── Launcher ─────────────────────────────────────────────────────────────────

function renderRondaAlarmesLauncher() {
  const screen = document.getElementById('screen-ronda-alarmes');
  if (!screen) return;

  if (rondaAlarmesState.active) {
    renderAlarmRondaScreen();
    return;
  }

  const allSites = getAllSites();
  const stats = getDashboardStats();
  const regionalStats = getRegionalStats();
  const regionals = ['PR', 'SC', 'RS'].filter(r => regionalStats[r]);

  const regionCards = regionals.map(r => {
    const s = regionalStats[r];
    return `
      <div class="rc-region-card">
        <div class="rc-region-title">${r}</div>
        <div class="rc-region-stats">
          <span class="sp-badge sp-badge-total">${s.total} sites</span>
          <span class="sp-badge sp-badge-pr">Online: ${s.alarmes_conectados || 0}</span>
          <span class="sp-badge sp-badge-rs">Desc.: ${s.alarmes_desconectados || 0}</span>
        </div>
        <button class="btn btn-primary rc-start-btn"
          onclick="startAlarmRondaForRegional('${r}')">
          🚨 Ronda Alarmes ${r}
        </button>
      </div>
    `;
  }).join('');

  screen.innerHTML = `
    ${typeof _buildPageNav === 'function' ? _buildPageNav('ronda-alarmes') : ''}
    <div class="rc-container">
      <div class="rc-header">
        <h2 class="rc-title">🚨 Ronda de Alarmes</h2>
      </div>

      <div class="rc-info-cards">
        <div class="rc-info-card">
          <div class="rc-info-number">${allSites.length}</div>
          <div class="rc-info-label">Total de Sites</div>
        </div>
        <div class="rc-info-card rc-info-ok">
          <div class="rc-info-number">${stats.alarmes_conectados}</div>
          <div class="rc-info-label">Alarmes Online</div>
        </div>
        <div class="rc-info-card rc-info-offline">
          <div class="rc-info-number">${stats.alarmes_desconectados}</div>
          <div class="rc-info-label">Alarmes Desc.</div>
        </div>
      </div>

      <div class="rc-section-title">Iniciar Ronda por Regional</div>
      <div class="rc-region-grid">
        ${regionCards}
      </div>

      <div class="rc-divider"></div>

      <div class="rc-full-section">
        <div class="rc-section-title">Ronda Completa de Alarmes</div>
        <p class="rc-section-desc">
          Verifica o status do alarme em todos os <strong>${allSites.length} sites</strong>.
        </p>
        <button class="btn btn-primary rc-full-btn" onclick="startFullAlarmRonda()">
          🚀 Iniciar Ronda de Alarmes Completa
        </button>
      </div>
    </div>
  `;
}

// ─── Alarm Ronda Flow ─────────────────────────────────────────────────────────

function startAlarmRondaForRegional(regional) {
  if (!appState.operador) { showToast('Faça login primeiro.', 'error'); return; }

  const sites = getAllSites().filter(s => s.regional === regional);
  if (!sites.length) {
    showToast(`Nenhum site encontrado para ${regional}.`, 'error');
    return;
  }

  _beginAlarmRonda(appState.operador, sites);
}

function startFullAlarmRonda() {
  if (!appState.operador) { showToast('Faça login primeiro.', 'error'); return; }

  const sites = getAllSites();
  if (!sites.length) {
    showToast('Nenhum site cadastrado. Importe dados primeiro.', 'error');
    return;
  }

  _beginAlarmRonda(appState.operador, sites);
}

function _beginAlarmRonda(operador, sites) {
  // Prioritize disconnected sites first
  const sorted = [...sites].sort((a, b) => {
    const aDisc = a.status_conexao === 'DESCONECTADO' ? 0 : 1;
    const bDisc = b.status_conexao === 'DESCONECTADO' ? 0 : 1;
    return aDisc - bDisc;
  });

  rondaAlarmesState = {
    active: true,
    sites: sorted,
    currentIndex: 0,
    operador,
    startTime: new Date(),
    results: [],
  };

  renderAlarmRondaScreen();
}

function renderAlarmRondaScreen() {
  const screen = document.getElementById('screen-ronda-alarmes');
  if (!screen) return;

  const state = rondaAlarmesState;
  if (!state.active || !state.sites.length) {
    renderRondaAlarmesLauncher();
    return;
  }

  const site = state.sites[state.currentIndex];
  if (!site) {
    showAlarmRondaComplete();
    return;
  }

  const total = state.sites.length;
  const current = state.currentIndex + 1;
  const progress = Math.round((state.currentIndex / total) * 100);

  const regClass = site.regional === 'PR' ? 'sp-reg-pr'
    : site.regional === 'SC' ? 'sp-reg-sc'
    : site.regional === 'RS' ? 'sp-reg-rs' : '';

  const currentAlarmStatus = site.status_conexao || 'Desconhecido';
  const alarmClass = currentAlarmStatus === 'ONLINE' ? 'sp-status-ok' : 'sp-status-offline';

  // Already marked in this ronda?
  const already = state.results.find(r => r.site_id === site.id);

  screen.innerHTML = `
    <div class="ra-container">
      <!-- Header -->
      <div class="ra-header">
        <div class="ra-header-left">
          <h2 class="ra-title">🚨 Ronda de Alarmes</h2>
          <span class="ra-progress-text">${current} / ${total}</span>
        </div>
        <div class="ra-header-right">
          <button class="btn btn-outline" onclick="finishAlarmRondaEarly()">⏹️ Finalizar</button>
        </div>
      </div>

      <!-- Progress -->
      <div class="ronda-progress-bar">
        <div class="ronda-progress-fill" style="width:${progress}%"></div>
      </div>

      <!-- Site Card -->
      <div class="ra-site-card">
        <div class="ra-site-header">
          <span class="sp-sigla ${regClass}">${escapeHtml(site.sigla)}</span>
          ${site.regional ? `<span class="sp-regional-badge ${regClass}">${escapeHtml(site.regional)}</span>` : ''}
          ${site.conta ? `<span class="ra-conta">Conta: ${site.conta}</span>` : ''}
        </div>

        <!-- Current alarm status from DB -->
        <div class="ra-current-status">
          <span class="ra-status-label">Status Atual:</span>
          <span class="sp-status-pill ${alarmClass}">${escapeHtml(currentAlarmStatus)}</span>
        </div>

        ${site.os ? `<div class="ra-os-alert">📋 O.S.: ${escapeHtml(site.os)}</div>` : ''}
        ${site.observacao ? `<div class="ra-obs-info">💬 ${escapeHtml(site.observacao)}</div>` : ''}

        <!-- Verification buttons -->
        <div class="ra-actions-label">Verificação:</div>
        <div class="ra-status-buttons">
          <button class="ra-btn ra-btn-ok ${already?.status === 'OK' ? 'ra-btn-active' : ''}"
            onclick="markAlarmSite('OK')">
            ✅ Ativado
          </button>
          <button class="ra-btn ra-btn-offline ${already?.status === 'DESCONECTADO' ? 'ra-btn-active' : ''}"
            onclick="markAlarmSite('DESCONECTADO')">
            ❌ Desativado
          </button>
          <button class="ra-btn ra-btn-parcial ${already?.status === 'PARCIAL' ? 'ra-btn-active' : ''}"
            onclick="markAlarmSite('PARCIAL')">
            ⚠️ Falha
          </button>
          <button class="ra-btn ra-btn-unknown ${already?.status === 'OUTRO' ? 'ra-btn-active' : ''}"
            onclick="openAlarmObsModal()">
            ❓ Outro
          </button>
        </div>

        <!-- Navigation -->
        <div class="ra-nav">
          <button class="btn btn-outline" onclick="skipAlarmSite()">⏭️ Pular</button>
        </div>
      </div>
    </div>
  `;
}

function markAlarmSite(status, observacao = null) {
  const state = rondaAlarmesState;
  const site = state.sites[state.currentIndex];
  if (!site) return;

  state.results.push({
    site_id: site.id,
    sigla: site.sigla,
    status,
    observacao,
  });

  // Save to DB as a ronda entry
  try {
    insertRonda({
      site_id: site.id,
      operador: state.operador,
      status,
      cameras_funcionando: null,
      cameras_esperadas: null,
      observacao,
      tipo: RONDA_TIPO_ALARMES,
    });
  } catch (e) {
    console.error('Failed to save alarm ronda:', e);
    showToast('⚠️ Erro ao salvar registro. Continuando...', 'error', 3000);
  }

  state.currentIndex++;

  if (state.currentIndex >= state.sites.length) {
    showAlarmRondaComplete();
  } else {
    renderAlarmRondaScreen();
  }
}

function skipAlarmSite() {
  rondaAlarmesState.currentIndex++;
  if (rondaAlarmesState.currentIndex >= rondaAlarmesState.sites.length) {
    showAlarmRondaComplete();
  } else {
    renderAlarmRondaScreen();
  }
}

function openAlarmObsModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('hidden');
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div class="modal-title">❓ Outro Status</div>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Observação:</label>
          <textarea id="alarm-obs-field" rows="3" class="textarea"
            placeholder="Descreva o problema encontrado..."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="saveAlarmObs()">💾 Salvar</button>
      </div>
    </div>
  `;
  document.getElementById('alarm-obs-field').focus();
}

function saveAlarmObs() {
  const obs = document.getElementById('alarm-obs-field')?.value.trim() || null;
  closeModal();
  markAlarmSite('OUTRO', obs);
}

function finishAlarmRondaEarly() {
  if (!confirm('Finalizar a ronda agora? Sites não verificados não serão registrados.')) return;
  rondaAlarmesState.active = false;
  showAlarmRondaComplete();
}

function showAlarmRondaComplete() {
  rondaAlarmesState.active = false;
  const state = rondaAlarmesState;
  const screen = document.getElementById('screen-ronda-alarmes');
  if (!screen) return;

  const results = state.results;
  const total = state.sites.length;
  const checked = results.length;
  const ok = results.filter(r => r.status === 'OK').length;
  const offline = results.filter(r => r.status === 'DESCONECTADO').length;
  const falha = results.filter(r => r.status === 'PARCIAL').length;
  const outro = results.filter(r => r.status === 'OUTRO').length;

  const duration = state.startTime
    ? Math.round((new Date() - state.startTime) / 60000)
    : 0;

  const problemResults = results.filter(r => r.status !== 'OK');

  const problemRows = problemResults.map(r => `
    <tr>
      <td>${escapeHtml(r.sigla)}</td>
      <td><span class="sp-status-pill ${r.status === 'DESCONECTADO' ? 'sp-status-offline' : r.status === 'PARCIAL' ? 'sp-status-parcial' : 'sp-status-unknown'}">${escapeHtml(r.status)}</span></td>
      <td>${escapeHtml(r.observacao || '—')}</td>
    </tr>
  `).join('');

  screen.innerHTML = `
    <div class="ronda-complete">
      <div class="complete-icon">🎉</div>
      <h2>Ronda de Alarmes Finalizada!</h2>
      <p class="complete-sub">por ${escapeHtml(state.operador)} · ${duration} min</p>

      <div class="complete-stats">
        <div class="stat-card stat-ok">
          <div class="stat-number">${ok}</div>
          <div class="stat-label">✅ Ativado</div>
        </div>
        <div class="stat-card stat-offline">
          <div class="stat-number">${offline}</div>
          <div class="stat-label">❌ Desativado</div>
        </div>
        <div class="stat-card stat-parcial">
          <div class="stat-number">${falha}</div>
          <div class="stat-label">⚠️ Falha</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${outro}</div>
          <div class="stat-label">❓ Outro</div>
        </div>
      </div>

      ${problemRows ? `
        <h3 class="problems-title">Alarmes com Problemas (${problemResults.length})</h3>
        <div class="table-wrap">
          <table class="problem-table">
            <thead><tr><th>Sigla</th><th>Status</th><th>Observação</th></tr></thead>
            <tbody>${problemRows}</tbody>
          </table>
        </div>
      ` : '<p class="all-ok">✅ Todos os alarmes verificados estão OK!</p>'}

      <div class="complete-actions">
        <button class="btn btn-primary" onclick="showMainScreen()">🏠 Voltar ao Início</button>
        <button class="btn btn-outline" onclick="showRondaAlarmesScreen()">🔄 Nova Ronda</button>
      </div>
    </div>
  `;
}
