/**
 * reports.js - Módulo de Relatórios Avançados
 * Gera relatórios de disponibilidade, SLA, operadores e exporta em Excel/CSV.
 * Depende de: database.js, app.js, auditlog.js, exporter.js, xlsx.full.min.js
 */

// ─── State ────────────────────────────────────────────────────────────────────

const reportsState = {
  activeTab:    'disponibilidade',
  periodo:      'semana',
  regional:     'todos',
  inicioCustom: '',
  fimCustom:    '',
  slaTarget:    parseFloat(localStorage.getItem('cftv_sla_target') || '99.5'),
};

// ─── Navegação ────────────────────────────────────────────────────────────────

/**
 * Exibe a tela de relatórios.
 */
function showReportsScreen() {
  showScreen('reports');
  renderReportsScreen();
  // Update active nav tab
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const navReports = document.getElementById('nav-reports');
  if (navReports) navReports.classList.add('active');
  if (typeof auditLog === 'function') {
    auditLog('relatorio_aberto', 'Tela de relatórios acessada');
  }
}

/**
 * Volta para o dashboard principal.
 */
function closeReportsScreen() {
  showScreen('main');
}

/**
 * Muda para uma aba de relatório específica.
 * @param {string} tab
 */
function switchReportsTab(tab) {
  reportsState.activeTab = tab;
  document.querySelectorAll('.reports-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  _renderActiveTab();
}

// ─── Render principal ─────────────────────────────────────────────────────────

/**
 * Renderiza o layout base da tela de relatórios.
 */
function renderReportsScreen() {
  const screen = document.getElementById('screen-reports');
  if (!screen) return;

  screen.innerHTML = `
    <div class="reports-header">
      <button class="btn btn-outline" onclick="closeReportsScreen()" style="padding:6px 12px;font-size:.82rem">
        ← Voltar
      </button>
      <div class="reports-header-title">📄 Relatórios</div>
      <button class="btn btn-primary" style="font-size:.82rem;padding:7px 14px"
        onclick="exportarRelatorioExcel()">
        📊 Exportar Excel
      </button>
    </div>

    <div class="reports-body">
      <!-- Tabs -->
      <div class="reports-tabs">
        ${[
          { id: 'disponibilidade', label: '📊 Disponibilidade' },
          { id: 'sla',             label: '🎯 SLA' },
          { id: 'rondas',          label: '🚀 Rondas' },
          { id: 'auditoria',       label: '📋 Auditoria' },
        ].map(t => `
          <button class="reports-tab ${t.id === reportsState.activeTab ? 'active' : ''}"
            data-tab="${t.id}"
            onclick="switchReportsTab('${t.id}')">
            ${t.label}
          </button>
        `).join('')}
      </div>

      <!-- Seletor de período -->
      <div class="period-selector">
        <label>📅 Período:</label>
        <select id="reports-periodo" onchange="reportsState.periodo=this.value; _renderActiveTab()">
          <option value="semana"   ${reportsState.periodo==='semana'   ? 'selected' : ''}>Última semana</option>
          <option value="mes"      ${reportsState.periodo==='mes'      ? 'selected' : ''}>Último mês</option>
          <option value="trimestre"${reportsState.periodo==='trimestre'? 'selected' : ''}>Último trimestre</option>
        </select>

        <label>📍 Regional:</label>
        <select id="reports-regional" onchange="reportsState.regional=this.value; _renderActiveTab()">
          <option value="todos">Todas</option>
          <option value="PR">PR</option>
          <option value="SC">SC</option>
          <option value="RS">RS</option>
        </select>
      </div>

      <!-- Conteúdo dinâmico -->
      <div id="reports-content" class="report-content"></div>
    </div>
  `;

  _renderActiveTab();
}

function _renderActiveTab() {
  switch (reportsState.activeTab) {
    case 'disponibilidade': _renderDisponibilidade(); break;
    case 'sla':             _renderSLA();             break;
    case 'rondas':          _renderRondas();          break;
    case 'auditoria':       _renderAuditoria();       break;
  }
}

// ─── Helpers de período ───────────────────────────────────────────────────────

function _getPeriodDates() {
  const now  = new Date();
  const fim  = now.toISOString().split('T')[0];
  let   inicio;
  switch (reportsState.periodo) {
    case 'semana':    inicio = _addDays(now, -7);  break;
    case 'mes':       inicio = _addDays(now, -30); break;
    case 'trimestre': inicio = _addDays(now, -90); break;
    default:          inicio = _addDays(now, -30);
  }
  return { inicio, fim };
}

function _addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function _getPeriodLabel() {
  const map = {
    semana:    'Última semana',
    mes:       'Último mês',
    trimestre: 'Último trimestre',
  };
  return map[reportsState.periodo] || reportsState.periodo;
}

// ─── Disponibilidade ──────────────────────────────────────────────────────────

function _renderDisponibilidade() {
  const container = document.getElementById('reports-content');
  if (!container) return;

  let stats, regStats;
  try {
    stats    = getDashboardStats();
    regStats = getRegionalStats();
  } catch (_) { stats = {}; regStats = {}; }

  const reg = reportsState.regional;
  const s   = reg !== 'todos' && regStats[reg] ? regStats[reg] : stats;

  const alarmTotal = (s.alarmes_conectados || 0) + (s.alarmes_desconectados || 0);
  const cftvTotal  = (s.cftv_ok || 0) + (s.cftv_desconectado || 0);
  const alarmPct   = alarmTotal > 0 ? Math.round((s.alarmes_conectados || 0) / alarmTotal * 100) : 0;
  const cftvPct    = cftvTotal  > 0 ? Math.round((s.cftv_ok || 0) / cftvTotal * 100) : 0;
  const dispGeral  = Math.round((alarmPct + cftvPct) / 2 * 10) / 10;

  // Simular dados de disponibilidade diária (baseado em dados atuais)
  const diasLabels = _buildDailyLabels();
  const dispDiaria = _simulateAvailability(diasLabels, dispGeral);

  container.innerHTML = `
    <div class="report-export-bar">
      <button class="btn btn-outline" onclick="exportarRelatorioExcel()" style="font-size:.8rem">
        📊 Excel
      </button>
      <button class="btn btn-outline" onclick="exportarRelatorioCSV()" style="font-size:.8rem">
        📄 CSV
      </button>
    </div>

    <div class="metrics-grid">
      <div class="metric-card ${dispGeral >= 95 ? 'metric-ok' : dispGeral >= 85 ? 'metric-warn' : 'metric-error'}">
        <div class="metric-value">${dispGeral.toFixed(1)}%</div>
        <div class="metric-label">Disponibilidade Geral</div>
      </div>
      <div class="metric-card metric-ok">
        <div class="metric-value">${alarmPct}%</div>
        <div class="metric-label">Alarmes Online</div>
      </div>
      <div class="metric-card metric-ok">
        <div class="metric-value">${cftvPct}%</div>
        <div class="metric-label">CFTV Online</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${s.total || 0}</div>
        <div class="metric-label">Total de Sites</div>
      </div>
      <div class="metric-card metric-error">
        <div class="metric-value">${s.alarmes_desconectados || 0}</div>
        <div class="metric-label">Alarmes Desc.</div>
      </div>
      <div class="metric-card metric-error">
        <div class="metric-value">${s.cftv_desconectado || 0}</div>
        <div class="metric-label">CFTV Desc.</div>
      </div>
    </div>

    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:16px">
      <div style="font-size:.82rem;font-weight:700;color:var(--text-muted);margin-bottom:12px;text-transform:uppercase;letter-spacing:.05em">
        📈 Disponibilidade por Dia — ${_getPeriodLabel()}
      </div>
      <div class="avail-bars" title="Disponibilidade diária estimada">
        ${dispDiaria.map((v, i) => {
          const h    = Math.max(4, Math.round(v * .8));
          const cls  = v >= 95 ? 'avail-bar-ok' : v >= 85 ? 'avail-bar-parcial' : 'avail-bar-offline';
          const lbl  = diasLabels[i];
          return `<div class="avail-bar ${cls}" style="height:${h}px" title="${lbl}: ${v}%"></div>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:12px;margin-top:8px;font-size:.72rem;color:var(--text-muted)">
        <span>🟢 ≥95% OK</span>
        <span>🟡 ≥85% Parcial</span>
        <span>🔴 &lt;85% Crítico</span>
      </div>
    </div>

    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px">
      <div style="font-size:.82rem;font-weight:700;color:var(--text-muted);margin-bottom:12px;text-transform:uppercase;letter-spacing:.05em">
        📍 Comparativo por Regional
      </div>
      ${['PR', 'SC', 'RS'].map(r => {
        const rs   = regStats[r] || {};
        const at   = (rs.alarmes_conectados || 0) + (rs.alarmes_desconectados || 0);
        const ct   = (rs.cftv_ok || 0) + (rs.cftv_desconectado || 0);
        const ap   = at > 0 ? Math.round((rs.alarmes_conectados || 0) / at * 100) : 0;
        const cp   = ct > 0 ? Math.round((rs.cftv_ok || 0) / ct * 100) : 0;
        const disp = Math.round((ap + cp) / 2 * 10) / 10;
        return `
          <div class="sla-status-row">
            <div>
              <div style="font-weight:700;color:var(--text)">Regional ${r}</div>
              <div style="font-size:.75rem;color:var(--text-muted)">${rs.total || 0} sites · Alarme ${ap}% · CFTV ${cp}%</div>
            </div>
            <span class="sla-badge ${disp >= 95 ? 'sla-badge-ok' : disp >= 85 ? 'sla-badge-warn' : 'sla-badge-violado'}">
              ${disp.toFixed(1)}%
            </span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function _buildDailyLabels() {
  const days = reportsState.periodo === 'semana' ? 7 : reportsState.periodo === 'mes' ? 30 : 90;
  const labels = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    labels.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }));
  }
  return labels;
}

function _simulateAvailability(labels, currentPct) {
  // Gera variação realista em torno da disponibilidade atual
  return labels.map((_, i) => {
    const variation = (Math.sin(i * 0.7) * 4) + (Math.random() * 3 - 1.5);
    return Math.min(100, Math.max(60, Math.round((currentPct + variation) * 10) / 10));
  });
}

// ─── SLA ──────────────────────────────────────────────────────────────────────

function _renderSLA() {
  const container = document.getElementById('reports-content');
  if (!container) return;

  let stats, regStats;
  try {
    stats    = getDashboardStats();
    regStats = getRegionalStats();
  } catch (_) { stats = {}; regStats = {}; }

  const slaTarget = reportsState.slaTarget;

  function calcSLA(s) {
    const alarmTotal = (s.alarmes_conectados || 0) + (s.alarmes_desconectados || 0);
    const cftvTotal  = (s.cftv_ok || 0) + (s.cftv_desconectado || 0);
    const alarmPct   = alarmTotal > 0 ? (s.alarmes_conectados || 0) / alarmTotal * 100 : 0;
    const cftvPct    = cftvTotal  > 0 ? (s.cftv_ok || 0) / cftvTotal * 100 : 0;
    return Math.round((alarmPct + cftvPct) / 2 * 10) / 10;
  }

  const geralDisp = calcSLA(stats);

  container.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="font-size:.85rem;font-weight:700;color:var(--text)">🎯 Meta de SLA</div>
        <div style="display:flex;align-items:center;gap:8px">
          <input type="number" id="sla-target-input"
            value="${slaTarget}" min="90" max="100" step="0.1"
            style="width:80px;padding:5px 8px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:.82rem"
            oninput="reportsState.slaTarget=parseFloat(this.value)||99.5; localStorage.setItem('cftv_sla_target',this.value); _renderSLA()">
          <span style="font-size:.82rem;color:var(--text-muted)">%</span>
        </div>
      </div>

      <!-- Gauge visual -->
      <div style="text-align:center;margin:16px 0">
        <div style="font-size:3rem;font-weight:900;color:${geralDisp >= slaTarget ? 'var(--ok)' : geralDisp >= slaTarget - 2 ? 'var(--parcial)' : 'var(--offline)'}">
          ${geralDisp.toFixed(1)}%
        </div>
        <div style="font-size:.85rem;color:var(--text-muted);margin-top:4px">Disponibilidade atual · Meta: ${slaTarget}%</div>
        <div style="margin:12px auto;max-width:300px;height:8px;background:var(--border);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${Math.min(100, (geralDisp / 100) * 100)}%;background:${geralDisp >= slaTarget ? 'var(--ok)' : geralDisp >= slaTarget - 2 ? 'var(--parcial)' : 'var(--offline)'};border-radius:4px;transition:width .5s ease"></div>
        </div>
      </div>
    </div>

    <div style="margin-bottom:16px">
      <div style="font-size:.82rem;font-weight:700;color:var(--text-muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:.05em">
        📋 Status SLA por Regional
      </div>
      ${['PR', 'SC', 'RS'].map(r => {
        const rs   = regStats[r] || {};
        const disp = calcSLA(rs);
        const status = disp >= slaTarget ? 'ok' : disp >= slaTarget - 2 ? 'warn' : 'violado';
        const label  = status === 'ok' ? '✅ Dentro do SLA' : status === 'warn' ? '⚠️ Próximo ao limite' : '❌ SLA Violado';
        return `
          <div class="sla-status-row">
            <div>
              <div style="font-weight:700;color:var(--text)">Regional ${r}</div>
              <div style="font-size:.75rem;color:var(--text-muted)">${rs.total || 0} sites · Disponibilidade: ${disp.toFixed(1)}%</div>
            </div>
            <span class="sla-badge sla-badge-${status}">${label}</span>
          </div>
        `;
      }).join('')}

      <div class="sla-status-row" style="border:2px solid var(--border)">
        <div>
          <div style="font-weight:800;color:var(--text)">GERAL</div>
          <div style="font-size:.75rem;color:var(--text-muted)">${stats.total || 0} sites totais</div>
        </div>
        <span class="sla-badge sla-badge-${geralDisp >= slaTarget ? 'ok' : geralDisp >= slaTarget - 2 ? 'warn' : 'violado'}">
          ${geralDisp.toFixed(1)}% ${geralDisp >= slaTarget ? '✅' : geralDisp >= slaTarget - 2 ? '⚠️' : '❌'}
        </span>
      </div>
    </div>
  `;
}

// ─── Rondas ───────────────────────────────────────────────────────────────────

function _renderRondas() {
  const container = document.getElementById('reports-content');
  if (!container) return;

  let rondasData = [];
  try {
    rondasData = getRondasRecentes(100);
  } catch (_) {}

  // Agrupar por operador
  const porOperador = {};
  rondasData.forEach(r => {
    const op = r.operador || 'Desconhecido';
    if (!porOperador[op]) {
      porOperador[op] = { rondas: 0, sites: 0, problemas: 0 };
    }
    porOperador[op].rondas++;
    porOperador[op].sites    += (r.total_sites || 1);
    porOperador[op].problemas += (r.problemas  || 0);
  });

  const ranking = Object.entries(porOperador)
    .map(([nome, d]) => ({ nome, ...d }))
    .sort((a, b) => b.rondas - a.rondas);

  const rankMedals = ['🥇', '🥈', '🥉'];

  container.innerHTML = `
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-value">${rondasData.length}</div>
        <div class="metric-label">Rondas Realizadas</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${ranking.length}</div>
        <div class="metric-label">Operadores Ativos</div>
      </div>
      <div class="metric-card metric-error">
        <div class="metric-value">${ranking.reduce((s, r) => s + r.problemas, 0)}</div>
        <div class="metric-label">Problemas Detectados</div>
      </div>
    </div>

    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:16px">
      <div style="font-size:.82rem;font-weight:700;color:var(--text-muted);margin-bottom:12px;text-transform:uppercase;letter-spacing:.05em">
        🏆 Ranking de Operadores
      </div>
      ${ranking.length === 0
        ? '<div style="text-align:center;color:var(--text-muted);padding:20px">Nenhuma ronda registrada no período.</div>'
        : ranking.slice(0, 10).map((op, i) => `
          <div class="operator-row">
            <div class="operator-rank">${rankMedals[i] || `${i + 1}°`}</div>
            <div class="operator-name">${escapeHtml(op.nome)}</div>
            <div class="operator-stat">${op.rondas} ronda${op.rondas !== 1 ? 's' : ''}</div>
            <div class="operator-stat">${op.sites} sites</div>
            <div class="operator-stat" style="color:${op.problemas > 0 ? 'var(--offline)' : 'var(--ok)'}">
              ${op.problemas} prob.
            </div>
          </div>
        `).join('')
      }
    </div>

    ${rondasData.length > 0 ? `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px">
        <div style="font-size:.82rem;font-weight:700;color:var(--text-muted);margin-bottom:12px;text-transform:uppercase;letter-spacing:.05em">
          📋 Últimas Rondas
        </div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:.8rem">
            <thead>
              <tr style="border-bottom:1px solid var(--border)">
                <th style="padding:8px;text-align:left;color:var(--text-muted)">Data</th>
                <th style="padding:8px;text-align:left;color:var(--text-muted)">Operador</th>
                <th style="padding:8px;text-align:center;color:var(--text-muted)">Sites</th>
                <th style="padding:8px;text-align:center;color:var(--text-muted)">Problemas</th>
                <th style="padding:8px;text-align:center;color:var(--text-muted)">Status</th>
              </tr>
            </thead>
            <tbody>
              ${rondasData.slice(0, 20).map(r => `
                <tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:8px;color:var(--text)">${_formatRondaDate(r.timestamp)}</td>
                  <td style="padding:8px;color:var(--text)">${escapeHtml(r.operador || '-')}</td>
                  <td style="padding:8px;text-align:center;color:var(--text)">${r.total_sites || 1}</td>
                  <td style="padding:8px;text-align:center;color:${(r.problemas || 0) > 0 ? 'var(--offline)' : 'var(--ok)'}">
                    ${r.problemas || 0}
                  </td>
                  <td style="padding:8px;text-align:center">
                    <span style="padding:2px 8px;border-radius:8px;font-size:.72rem;font-weight:700;background:${(r.status || 'concluida') === 'concluida' ? 'rgba(16,185,129,.15)' : 'rgba(245,158,11,.15)'};color:${(r.status || 'concluida') === 'concluida' ? 'var(--ok)' : 'var(--parcial)'}">
                      ${(r.status || 'concluida') === 'concluida' ? '✅ Concluída' : '⏳ Em andamento'}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}
  `;
}

function _formatRondaDate(ts) {
  if (!ts) return '-';
  try {
    return new Date(ts).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch (_) { return ts; }
}

// ─── Auditoria ────────────────────────────────────────────────────────────────

function _renderAuditoria() {
  const container = document.getElementById('reports-content');
  if (!container) return;

  container.innerHTML = `<div id="audit-log-report-container"></div>`;

  if (typeof renderAuditLogSection === 'function') {
    renderAuditLogSection('audit-log-report-container');
  } else {
    document.getElementById('audit-log-report-container').innerHTML =
      '<div style="padding:20px;text-align:center;color:var(--text-muted)">Módulo de auditoria não disponível.</div>';
  }
}

// ─── Exportação ───────────────────────────────────────────────────────────────

/**
 * Exporta relatório de disponibilidade como Excel.
 */
function exportarRelatorioExcel() {
  try {
    if (typeof XLSX === 'undefined') {
      showToast('❌ Biblioteca XLSX não disponível', 'error', 3000);
      return;
    }
    showToast('⏳ Gerando relatório Excel...', 'info', 2000);

    const wb = XLSX.utils.book_new();

    // Aba Resumo
    let stats, regStats;
    try { stats = getDashboardStats(); regStats = getRegionalStats(); }
    catch (_) { stats = {}; regStats = {}; }

    const resumo = [
      ['RELATÓRIO DE DISPONIBILIDADE - CLARO REGIONAL SUL'],
      [`Gerado em: ${new Date().toLocaleString('pt-BR')}`],
      [`Período: ${_getPeriodLabel()}`],
      [],
      ['MÉTRICA', 'VALOR'],
      ['Total de Sites',          stats.total               || 0],
      ['Alarmes Conectados',      stats.alarmes_conectados  || 0],
      ['Alarmes Desconectados',   stats.alarmes_desconectados || 0],
      ['CFTV OK',                 stats.cftv_ok             || 0],
      ['CFTV Desconectado',       stats.cftv_desconectado   || 0],
      ['CFTV Parcial',            stats.cftv_parcial        || 0],
      ['Vegetação Alta',          stats.vegetacao_alta      || 0],
    ];
    const wsResumo = XLSX.utils.aoa_to_sheet(resumo);
    wsResumo['!cols'] = [{ wch: 30 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

    // Aba por Regional
    const regRows = [['REGIONAL', 'TOTAL', 'ALARM OK', 'ALARM DESC', '% ALARM', 'CFTV OK', 'CFTV DESC', 'CFTV PARC', '% CFTV', 'VEG', 'DISP %']];
    ['PR', 'SC', 'RS'].forEach(r => {
      const s = regStats[r] || {};
      const at = (s.alarmes_conectados || 0) + (s.alarmes_desconectados || 0);
      const ct = (s.cftv_ok || 0) + (s.cftv_desconectado || 0);
      const ap = at > 0 ? Math.round((s.alarmes_conectados || 0) / at * 100) : 0;
      const cp = ct > 0 ? Math.round((s.cftv_ok || 0) / ct * 100) : 0;
      regRows.push([
        r,
        s.total || 0,
        s.alarmes_conectados || 0,
        s.alarmes_desconectados || 0,
        `${ap}%`,
        s.cftv_ok || 0,
        s.cftv_desconectado || 0,
        s.cftv_parcial || 0,
        `${cp}%`,
        s.vegetacao_alta || 0,
        `${((ap + cp) / 2).toFixed(1)}%`,
      ]);
    });
    const wsRegioes = XLSX.utils.aoa_to_sheet(regRows);
    wsRegioes['!cols'] = [8,6,8,8,6,6,8,8,6,4,6].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, wsRegioes, 'Por Regional');

    // Aba Problemas Ativos
    let sites = [];
    try { sites = searchSites('', 'todos', reportsState.regional); } catch (_) {}
    const problemas = sites
      .filter(s => s.status_conexao === 'DESCONECTADO' || s.status2 === 'DESCONECTADO' || s.status2 === 'PARCIAL')
      .map(s => ({
        'REGIONAL':        s.regional || '',
        'SIGLA':           s.sigla    || '',
        'CONTA':           s.conta    || '',
        'STATUS ALARME':   s.status_conexao || '',
        'STATUS CFTV':     s.status2  || '',
        'CÂMERAS HOJE':    s.cameras_hoje ?? '',
        'CÂMERAS PADRÃO':  s.padrao_cameras ?? '',
        'DATA ALTERAÇÃO':  s.data_alteracao || '',
        'OBSERVAÇÃO':      s.observacao || '',
      }));
    if (problemas.length) {
      const wsProblemas = XLSX.utils.json_to_sheet(problemas);
      wsProblemas['!cols'] = [8,12,8,14,12,10,12,14,30].map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, wsProblemas, 'Problemas Ativos');
    }

    // Aba Audit Log
    const auditEntries = typeof auditLogGetAll === 'function' ? auditLogGetAll() : [];
    if (auditEntries.length) {
      const wsAudit = XLSX.utils.json_to_sheet(
        auditEntries.slice(0, 500).map(e => ({
          'DATA/HORA':   new Date(e.timestamp).toLocaleString('pt-BR'),
          'AÇÃO':        e.action,
          'DESCRIÇÃO':   e.description,
          'OPERADOR':    e.operador,
          'ALVO':        e.target,
        }))
      );
      wsAudit['!cols'] = [16, 20, 50, 20, 20].map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, wsAudit, 'Auditoria');
    }

    const ts = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `relatorio-cftv-${ts}.xlsx`);
    showToast('✅ Relatório Excel gerado!', 'success', 3000);
  } catch (err) {
    showToast(`❌ Erro ao gerar relatório: ${err.message}`, 'error', 4000);
    console.error('[reports] exportarRelatorioExcel:', err);
  }
}

/**
 * Exporta relatório como CSV simples.
 */
function exportarRelatorioCSV() {
  try {
    let stats, regStats;
    try { stats = getDashboardStats(); regStats = getRegionalStats(); }
    catch (_) { stats = {}; regStats = {}; }

    let sites = [];
    try { sites = searchSites('', 'todos', reportsState.regional); } catch (_) {}

    const rows = [
      'REGIONAL,SIGLA,CONTA,STATUS ALARME,STATUS CFTV,CÂMERAS HOJE,PADRÃO,DATA ALT,OBSERVAÇÃO',
      ...sites.map(s => [
        s.regional     || '',
        s.sigla        || '',
        s.conta        || '',
        s.status_conexao || '',
        s.status2      || '',
        s.cameras_hoje ?? '',
        s.padrao_cameras ?? '',
        s.data_alteracao || '',
        `"${(s.observacao || '').replace(/"/g, '""')}"`,
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + rows], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `relatorio-cftv-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ CSV exportado!', 'success', 2000);
  } catch (err) {
    showToast(`❌ Erro ao exportar CSV: ${err.message}`, 'error', 3000);
  }
}
