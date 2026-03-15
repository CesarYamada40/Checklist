/**
 * ronda-cameras.js - Camera round launcher and navigation screen
 */

// ─── Navigation ───────────────────────────────────────────────────────────────

function showRondaCamerasScreen() {
  showScreen('ronda-cameras');
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const el = document.getElementById('nav-ronda-cameras');
  if (el) el.classList.add('active');
  renderRondaCamerasLauncher();
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderRondaCamerasLauncher() {
  const screen = document.getElementById('screen-ronda-cameras');
  if (!screen) return;

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
          <span class="sp-badge sp-badge-pr">CFTV OK: ${s.cftv_ok || 0}</span>
          <span class="sp-badge sp-badge-rs">Desc.: ${s.cftv_desconectado || 0}</span>
        </div>
        <button class="btn btn-primary rc-start-btn"
          onclick="startCameraRondaForRegional('${r}')">
          📹 Iniciar Ronda ${r}
        </button>
      </div>
    `;
  }).join('');

  screen.innerHTML = `
    ${typeof _buildPageNav === 'function' ? _buildPageNav('ronda-cameras') : ''}
    <div class="rc-container">
      <div class="rc-header">
        <h2 class="rc-title">📹 Ronda de Câmeras</h2>
      </div>

      ${rondaState.active ? `
        <div class="rc-active-banner">
          <span>⚡ Ronda em andamento (${rondaState.currentIndex}/${rondaState.sites.length} sites)</span>
          <button class="btn btn-primary" onclick="resumeCameraRonda()">▶️ Retomar Ronda</button>
        </div>
      ` : ''}

      <div class="rc-info-cards">
        <div class="rc-info-card">
          <div class="rc-info-number">${allSites.length}</div>
          <div class="rc-info-label">Total de Sites</div>
        </div>
        <div class="rc-info-card rc-info-ok">
          <div class="rc-info-number">${stats.cftv_ok}</div>
          <div class="rc-info-label">CFTV OK</div>
        </div>
        <div class="rc-info-card rc-info-warn">
          <div class="rc-info-number">${stats.cftv_parcial || 0}</div>
          <div class="rc-info-label">CFTV Parcial</div>
        </div>
        <div class="rc-info-card rc-info-offline">
          <div class="rc-info-number">${stats.cftv_desconectado}</div>
          <div class="rc-info-label">CFTV Desc.</div>
        </div>
      </div>

      <div class="rc-section-title">Iniciar Ronda por Regional</div>
      <div class="rc-region-grid">
        ${regionCards}
      </div>

      <div class="rc-divider"></div>

      <div class="rc-full-section">
        <div class="rc-section-title">Ronda Completa (Todas Regionais)</div>
        <p class="rc-section-desc">
          Verifica todos os <strong>${allSites.length} sites</strong> em ordem de prioridade
          (problemas primeiro, depois não verificados, depois OK).
        </p>
        <button class="btn btn-primary rc-full-btn" onclick="startFullCameraRonda()">
          🚀 Iniciar Ronda Completa
        </button>
      </div>

      <div class="rc-help">
        <div class="rc-help-title">⌨️ Atalhos durante a ronda:</div>
        <div class="rc-help-grid">
          <span><kbd>Espaço</kbd> ou <kbd>Enter</kbd> → OK</span>
          <span><kbd>P</kbd> → Parcial</span>
          <span><kbd>O</kbd> → Offline</span>
          <span><kbd>S</kbd> → Pular</span>
        </div>
      </div>
    </div>
  `;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

function startCameraRondaForRegional(regional) {
  if (!appState.operador) { showToast('Faça login primeiro.', 'error'); return; }

  const sites = getAllSites().filter(s => s.regional === regional);
  if (!sites.length) {
    showToast(`Nenhum site encontrado para ${regional}.`, 'error');
    return;
  }

  const sorted = _sortSitesForRonda(sites);
  startRonda(appState.operador, sorted);
}

function startFullCameraRonda() {
  if (!appState.operador) { showToast('Faça login primeiro.', 'error'); return; }

  const sites = getAllSites();
  if (!sites.length) {
    showToast('Nenhum site cadastrado. Importe dados primeiro.', 'error');
    return;
  }

  const sorted = _sortSitesForRonda(sites);
  startRonda(appState.operador, sorted);
}

function resumeCameraRonda() {
  renderRondaScreen();
  showScreen('ronda');
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
}

function _sortSitesForRonda(sites) {
  return [...sites].sort((a, b) => {
    const order = { 'DESCONECTADO': 0, 'PARCIAL': 1, null: 2, 'OK': 3 };
    const getLastStatus = s => {
      try {
        const r = getLastRondaBySite(s.id);
        return r ? r.status : null;
      } catch (_) { return null; }
    };
    return (order[getLastStatus(a)] ?? 2) - (order[getLastStatus(b)] ?? 2);
  });
}
