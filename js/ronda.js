/**
 * ronda.js - Round mode management
 * Handles start, navigation, marking status, and finishing a ronda
 */

let rondaState = {
  active: false,
  sites: [],          // full list of sites for this ronda
  currentIndex: 0,
  operador: '',
  startTime: null,
  results: [],        // { site_id, sigla, status, cameras_funcionando, cameras_esperadas, observacao }
  skipped: [],        // site ids skipped
};

/**
 * Start a new ronda
 * @param {string} operador - operator name
 * @param {Array} sites - array of site objects (from DB)
 */
function startRonda(operador, sites) {
  rondaState = {
    active: true,
    sites: [...sites],
    currentIndex: 0,
    operador,
    startTime: new Date(),
    results: [],
    skipped: [],
  };
  renderRondaScreen();
}

/**
 * Get current site in the ronda
 */
function getCurrentRondaSite() {
  return rondaState.sites[rondaState.currentIndex] || null;
}

/**
 * Mark current site with a status and advance
 * @param {string} status - 'OK' | 'PARCIAL' | 'DESCONECTADO'
 * @param {object} extra - { cameras_funcionando, cameras_esperadas, observacao }
 */
function markCurrentSite(status, extra = {}) {
  const site = getCurrentRondaSite();
  if (!site) return;

  const result = {
    site_id: site.id,
    sigla: site.sigla,
    status,
    cameras_funcionando: extra.cameras_funcionando ?? null,
    cameras_esperadas: extra.cameras_esperadas ?? site.padrao_cameras ?? null,
    observacao: extra.observacao ?? null,
  };

  rondaState.results.push(result);

  // Save to DB immediately
  insertRonda({
    site_id: result.site_id,
    operador: rondaState.operador,
    status: result.status,
    cameras_funcionando: result.cameras_funcionando,
    cameras_esperadas: result.cameras_esperadas,
    observacao: result.observacao,
  });

  advanceRonda();
}

/**
 * Skip current site (will appear at end)
 */
function skipCurrentSite() {
  const site = getCurrentRondaSite();
  if (!site) return;
  rondaState.skipped.push(site); // store site object, not index
  rondaState.currentIndex++;

  // Check if we've gone through all queued sites
  if (rondaState.currentIndex >= rondaState.sites.length) {
    if (rondaState.skipped.length > 0) {
      // Append skipped sites at the end
      rondaState.sites = [...rondaState.sites, ...rondaState.skipped];
      rondaState.skipped = [];
    }
  }

  const done = rondaState.currentIndex >= rondaState.sites.length;
  if (done) {
    showRondaComplete();
  } else {
    renderRondaScreen();
  }
}

/**
 * Advance to next site after marking
 */
function advanceRonda() {
  rondaState.currentIndex++;

  // Check if ronda is complete
  const done = rondaState.currentIndex >= rondaState.sites.length;
  if (done) {
    // Check if there are still skipped sites to revisit
    if (rondaState.skipped.length > 0) {
      rondaState.sites = [...rondaState.sites, ...rondaState.skipped];
      rondaState.skipped = [];
    }
  }

  const stillDone = rondaState.currentIndex >= rondaState.sites.length;
  if (stillDone) {
    showRondaComplete();
  } else {
    renderRondaScreen();
  }
}

/**
 * Finish the ronda early (with confirmation)
 */
function finishRondaEarly() {
  const remaining = rondaState.sites.length - rondaState.currentIndex;
  if (remaining > 0) {
    if (!confirm(`Ainda restam ${remaining} sites não verificados. Deseja finalizar a ronda agora?`)) {
      return;
    }
  }
  showRondaComplete();
}

/**
 * Get ronda summary
 */
function getRondaSummary() {
  const total = rondaState.sites.length;
  const checked = rondaState.results.length;
  const ok = rondaState.results.filter(r => r.status === 'OK').length;
  const parcial = rondaState.results.filter(r => r.status === 'PARCIAL').length;
  const offline = rondaState.results.filter(r => r.status === 'DESCONECTADO').length;
  const duration = rondaState.startTime
    ? Math.round((new Date() - rondaState.startTime) / 60000)
    : 0;

  return {
    total,
    checked,
    ok,
    parcial,
    offline,
    skipped: total - checked,
    duration,
    operador: rondaState.operador,
    startTime: rondaState.startTime,
    problemSites: rondaState.results.filter(r => r.status !== 'OK'),
  };
}

/**
 * Render the ronda mode UI
 */
function renderRondaScreen() {
  const site = getCurrentRondaSite();
  if (!site) return;

  const total = rondaState.sites.length;
  const current = rondaState.currentIndex + 1;
  const progress = Math.round((rondaState.currentIndex / total) * 100);

  // Get last ronda info for this site
  const lastRonda = getLastRondaBySite(site.id);
  const lastStatus = lastRonda ? lastRonda.status : null;
  const lastTs = lastRonda ? formatDateTime(lastRonda.timestamp) : 'Nunca';
  const lastOperador = lastRonda ? lastRonda.operador : '';

  const statusClass = lastStatus ? statusToClass(lastStatus) : 'status-unknown';
  const statusLabel = lastStatus || 'Não verificado';

  const cameras = site.padrao_cameras || '?';
  const camerasHoje = site.cameras_hoje || '?';

  document.getElementById('screen-ronda').innerHTML = `
    <div class="ronda-header">
      <div class="ronda-progress-info">
        <span class="ronda-counter">RONDA EM ANDAMENTO (${current}/${total})</span>
        <button class="btn btn-outline btn-sm" onclick="finishRondaEarly()">⏹ Encerrar</button>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${progress}%"></div>
      </div>
      <div class="ronda-progress-pct">${progress}% concluído · ${rondaState.results.length} marcados</div>
    </div>

    <div class="ronda-site-card">
      <div class="ronda-site-badge ${statusClass}">${statusLabel}</div>
      <h1 class="ronda-site-sigla">${escapeHtml(site.sigla)}</h1>
      ${site.conta ? `<div class="ronda-site-sub">Conta: ${site.conta}</div>` : ''}

      <div class="ronda-cameras-info">
        <span class="cam-expected">${cameras} câmeras esperadas</span>
        ${camerasHoje !== '?' ? `<span class="cam-hoje">${camerasHoje}/${cameras} hoje</span>` : ''}
      </div>

      <div class="ronda-last-info">
        Última ronda: <strong>${escapeHtml(statusLabel)}</strong>
        ${lastTs !== 'Nunca' ? `em ${lastTs}` : ''}
        ${lastOperador ? `por ${escapeHtml(lastOperador)}` : ''}
      </div>

      ${site.os ? `<div class="ronda-badge-os">📋 O.S. Aberta</div>` : ''}
      ${site.vegetacao_alta ? `<div class="ronda-badge-veg">🌿 Vegetação Alta</div>` : ''}

      <div class="ronda-actions">
        <button class="btn-ronda btn-ok" onclick="markCurrentSite('OK')" title="Atalho: Espaço">
          ✅ OK
        </button>
        <button class="btn-ronda btn-parcial" onclick="openParcialModal()" title="Atalho: P">
          ⚠️ PARCIAL
        </button>
        <button class="btn-ronda btn-offline" onclick="markCurrentSite('DESCONECTADO')" title="Atalho: O">
          ❌ OFFLINE
        </button>
      </div>

      <button class="btn-skip" onclick="skipCurrentSite()" title="Atalho: S">
        ⏭️ PULAR SITE
      </button>

      <div class="ronda-shortcuts">
        Atalhos: <kbd>Espaço</kbd> = OK · <kbd>P</kbd> = Parcial · <kbd>O</kbd> = Offline · <kbd>S</kbd> = Pular
      </div>
    </div>
  `;

  showScreen('ronda');
}

/**
 * Open partial cameras modal
 */
function openParcialModal() {
  const site = getCurrentRondaSite();
  if (!site) return;

  const esperadas = site.padrao_cameras || '';
  const hoje = site.cameras_hoje || '';

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
              max="${esperadas || 99}" value="${hoje || ''}" placeholder="0">
            <span class="cam-sep">de</span>
            <input type="number" id="cam-esp" class="input-number" min="1"
              max="99" value="${esperadas || ''}" placeholder="${esperadas || '?'}">
          </div>
        </div>
        <div class="modal-field">
          <label>Observação (opcional):</label>
          <textarea id="obs-field" class="textarea" rows="3"
            placeholder="Ex: Câmera 3 sem imagem desde ontem..."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-warning" onclick="saveParcial()">⚠️ Salvar Parcial</button>
      </div>
    </div>
  `;
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('cam-func').focus();
}

/**
 * Save partial status from modal
 */
function saveParcial() {
  const camFunc = parseInt(document.getElementById('cam-func').value, 10);
  const camEsp = parseInt(document.getElementById('cam-esp').value, 10);
  const obs = document.getElementById('obs-field').value.trim();
  const site = getCurrentRondaSite();

  if (isNaN(camFunc) || camFunc < 0) {
    alert('Informe quantas câmeras estão funcionando.');
    return;
  }
  if (!isNaN(camEsp) && camFunc >= camEsp) {
    const confirmOk = confirm(`${camFunc} câmeras funcionando de ${camEsp}. Isso não é parcial — deseja marcar como OK?`);
    if (!confirmOk) {
      // User wants to go back and fix the value — keep modal open
      return;
    }
    closeModal();
    markCurrentSite('OK', { cameras_funcionando: camFunc, cameras_esperadas: camEsp, observacao: obs });
    return;
  }

  closeModal();
  markCurrentSite('PARCIAL', {
    cameras_funcionando: camFunc,
    cameras_esperadas: isNaN(camEsp) ? (site?.padrao_cameras || null) : camEsp,
    observacao: obs || null,
  });
}

/**
 * Show ronda completion screen
 */
function showRondaComplete() {
  rondaState.active = false;
  const summary = getRondaSummary();

  const problemRows = summary.problemSites.map(r => `
    <tr>
      <td>${escapeHtml(r.sigla)}</td>
      <td><span class="badge ${statusToClass(r.status)}">${r.status}</span></td>
      <td>${r.cameras_funcionando !== null ? `${r.cameras_funcionando}/${r.cameras_esperadas}` : '-'}</td>
      <td>${escapeHtml(r.observacao || '')}</td>
    </tr>
  `).join('');

  document.getElementById('screen-ronda').innerHTML = `
    <div class="ronda-complete">
      <div class="complete-icon">🎉</div>
      <h2>Ronda Finalizada!</h2>
      <p class="complete-sub">por ${escapeHtml(summary.operador)} · ${summary.duration} min</p>

      <div class="complete-stats">
        <div class="stat-card stat-ok">
          <div class="stat-number">${summary.ok}</div>
          <div class="stat-label">✅ OK</div>
        </div>
        <div class="stat-card stat-parcial">
          <div class="stat-number">${summary.parcial}</div>
          <div class="stat-label">⚠️ Parcial</div>
        </div>
        <div class="stat-card stat-offline">
          <div class="stat-number">${summary.offline}</div>
          <div class="stat-label">❌ Offline</div>
        </div>
        <div class="stat-card stat-skip">
          <div class="stat-number">${summary.skipped}</div>
          <div class="stat-label">⏭️ Pulados</div>
        </div>
      </div>

      ${problemRows ? `
        <h3 class="problems-title">Sites com Problemas (${summary.problemSites.length})</h3>
        <div class="table-wrap">
          <table class="problem-table">
            <thead><tr><th>Sigla</th><th>Status</th><th>Câmeras</th><th>Observação</th></tr></thead>
            <tbody>${problemRows}</tbody>
          </table>
        </div>
      ` : '<p class="all-ok">✅ Todos os sites verificados estão OK!</p>'}

      <div class="complete-actions">
        <button class="btn btn-primary" onclick="exportRondaReport()">📤 Exportar Relatório</button>
        <button class="btn btn-secondary" onclick="showMainScreen()">🏠 Voltar ao Início</button>
      </div>
    </div>
  `;
  showScreen('ronda');
}

/**
 * Export ronda report as JSON file
 */
function exportRondaReport() {
  const summary = getRondaSummary();
  const report = {
    data: summary.startTime ? summary.startTime.toISOString() : new Date().toISOString(),
    operador: summary.operador,
    total_sites: summary.total,
    verificados: summary.checked,
    ok: summary.ok,
    parcial: summary.parcial,
    offline: summary.offline,
    pulados: summary.skipped,
    duracao_minutos: summary.duration,
    sites_problema: summary.problemSites.map(r => ({
      sigla: r.sigla,
      status: r.status,
      cameras: r.cameras_funcionando !== null
        ? `${r.cameras_funcionando}/${r.cameras_esperadas}`
        : null,
      observacao: r.observacao,
    })),
  };

  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  a.download = `ronda_${sanitizeFilename(summary.operador)}_${dateStr}.json`;
  a.click();
}

/**
 * Keyboard shortcuts handler for ronda mode
 */
function handleRondaKeyboard(e) {
  if (!rondaState.active) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  switch (e.key) {
    case ' ':
    case 'Enter':
      e.preventDefault();
      markCurrentSite('OK');
      break;
    case 'p':
    case 'P':
      e.preventDefault();
      openParcialModal();
      break;
    case 'o':
    case 'O':
      e.preventDefault();
      markCurrentSite('DESCONECTADO');
      break;
    case 's':
    case 'S':
      e.preventDefault();
      skipCurrentSite();
      break;
    case 'Escape':
      if (!document.getElementById('modal-overlay').classList.contains('hidden')) {
        closeModal();
      }
      break;
  }
}

document.addEventListener('keydown', handleRondaKeyboard);
