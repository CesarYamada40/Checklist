/**
 * kpi.js - Módulo de KPIs e Timeline de Atividades
 * Calcula métricas de disponibilidade e exibe feed de atividades recentes.
 * Depende de: database.js, app.js
 */

// ─── KPI State ────────────────────────────────────────────────────────────────

const kpiState = {
  previousStats: null,
};

// ─── Cálculo de KPIs ──────────────────────────────────────────────────────────

/**
 * Calcula os KPIs principais com base nos dados atuais do banco.
 * @returns {{ taxaDisp: number, sitesOnline: number, sitesTotal: number,
 *             criticos: number, tendencia: number, alarmesOK: number,
 *             cftvOK: number }}
 */
function calcularKPIs() {
  let stats, regStats;
  try {
    stats    = getDashboardStats();
    regStats = getRegionalStats();
  } catch (e) {
    return { taxaDisp: 0, sitesOnline: 0, sitesTotal: 0, criticos: 0, tendencia: 0, alarmesOK: 0, cftvOK: 0 };
  }

  const total = stats.total || 1;

  // Taxa de disponibilidade: sites onde alarme E câmera estão OK
  const alarmTotal = (stats.alarmes_conectados || 0) + (stats.alarmes_desconectados || 0);
  const cftvTotal  = (stats.cftv_ok || 0) + (stats.cftv_desconectado || 0);

  const alarmPct = alarmTotal > 0 ? (stats.alarmes_conectados / alarmTotal) : 0;
  const cftvPct  = cftvTotal  > 0 ? (stats.cftv_ok  / cftvTotal)  : 0;

  // Média ponderada (alarme tem peso 0.5, cftv peso 0.5)
  const taxaDisp = Math.round(((alarmPct + cftvPct) / 2) * 1000) / 10;

  // Tendência: comparar com valor salvo anteriormente
  let tendencia = 0;
  const savedKey = 'cftv_kpi_prev_taxa';
  const prevTaxa = parseFloat(localStorage.getItem(savedKey) || '0');
  if (prevTaxa > 0) {
    tendencia = Math.round((taxaDisp - prevTaxa) * 10) / 10;
  }
  // Salvar taxa atual para próxima comparação
  localStorage.setItem(savedKey, String(taxaDisp));

  // Críticos: sites com status ronda offline ou alarme desconectado há mais de 3 dias
  const criticos = (stats.criticos || []).length;

  return {
    taxaDisp,
    sitesOnline:  stats.alarmes_conectados || 0,
    sitesTotal:   total,
    criticos,
    tendencia,
    alarmesOK:    stats.alarmes_conectados || 0,
    cftvOK:       stats.cftv_ok || 0,
    alarmTotal,
    cftvTotal,
  };
}

// ─── Renderização dos KPI Cards ───────────────────────────────────────────────

/**
 * Renderiza a seção de KPI cards no topo do dashboard principal.
 */
function renderKPICards() {
  const container = document.getElementById('kpi-section');
  if (!container) return;

  const kpi = calcularKPIs();

  const trendClass = kpi.tendencia > 0
    ? 'kpi-trend-up'
    : kpi.tendencia < 0
      ? 'kpi-trend-down'
      : 'kpi-trend-flat';
  const trendIcon  = kpi.tendencia > 0 ? '↑' : kpi.tendencia < 0 ? '↓' : '→';
  const trendText  = kpi.tendencia !== 0
    ? `${trendIcon} ${Math.abs(kpi.tendencia)}% vs. anterior`
    : `→ Estável`;

  const disponibilidadeClass = kpi.taxaDisp >= 95
    ? 'kpi-card-disponibilidade'
    : kpi.taxaDisp >= 85
      ? 'kpi-card-disponibilidade'
      : 'kpi-card-disponibilidade';

  container.innerHTML = `
    <div class="kpi-card kpi-card-disponibilidade" title="Taxa de disponibilidade média (alarmes + câmeras)">
      <div class="kpi-icon">📊</div>
      <div class="kpi-value" id="kpi-taxa-disp">${kpi.taxaDisp.toFixed(1)}%</div>
      <div class="kpi-label">Disponibilidade Geral</div>
      <div class="kpi-trend ${trendClass}">${trendText}</div>
    </div>

    <div class="kpi-card kpi-card-online" title="Sites com alarme conectado vs. total">
      <div class="kpi-icon">🟢</div>
      <div class="kpi-value" id="kpi-sites-online">${kpi.sitesOnline} / ${kpi.sitesTotal}</div>
      <div class="kpi-label">Alarmes Online</div>
      <div class="kpi-trend kpi-trend-flat">
        ${kpi.alarmTotal > 0 ? Math.round(kpi.sitesOnline / kpi.alarmTotal * 100) : 0}% conectados
      </div>
    </div>

    <div class="kpi-card kpi-card-criticos" title="Sites marcados como críticos (desconectados há mais de 7 dias)">
      <div class="kpi-icon">🚨</div>
      <div class="kpi-value" id="kpi-criticos" style="color:${kpi.criticos > 0 ? 'var(--offline)' : 'var(--ok)'}">
        ${kpi.criticos}
      </div>
      <div class="kpi-label">Sites Críticos</div>
      <div class="kpi-trend ${kpi.criticos > 0 ? 'kpi-trend-down' : 'kpi-trend-up'}">
        ${kpi.criticos > 0 ? '⚠️ Requer atenção' : '✅ Tudo sob controle'}
      </div>
    </div>

    <div class="kpi-card kpi-card-tendencia" title="Câmeras OK vs. total esperado">
      <div class="kpi-icon">📷</div>
      <div class="kpi-value" id="kpi-cftv">${kpi.cftvOK} / ${kpi.cftvTotal}</div>
      <div class="kpi-label">Câmeras Online</div>
      <div class="kpi-trend kpi-trend-flat">
        ${kpi.cftvTotal > 0 ? Math.round(kpi.cftvOK / kpi.cftvTotal * 100) : 0}% CFTV OK
      </div>
    </div>
  `;
}

// ─── Timeline de Atividades ───────────────────────────────────────────────────

/**
 * Retorna eventos recentes de auditoria e rondas para o feed de timeline.
 * @returns {Array<{type: string, icon: string, title: string, detail: string, time: Date}>}
 */
function _buildTimelineEvents() {
  const events = [];

  // Eventos do audit log
  try {
    const auditEntries = auditLogGetRecent(15);
    auditEntries.forEach(entry => {
      events.push({
        type:   entry.action === 'ronda_concluida' ? 'ronda' :
                entry.action === 'site_atualizado'  ? 'resolucao' :
                entry.action === 'import'           ? 'import' : 'problema',
        icon:   entry.action === 'ronda_concluida' ? '✅' :
                entry.action === 'site_atualizado'  ? '🔧' :
                entry.action === 'import'           ? '📥' : '🔴',
        title:  entry.description,
        detail: entry.operador ? `Operador: ${entry.operador}` : '',
        time:   new Date(entry.timestamp),
      });
    });
  } catch (_) {}

  // Ordenar por tempo (mais recente primeiro)
  events.sort((a, b) => b.time - a.time);
  return events.slice(0, 20);
}

/**
 * Formata uma data em tempo relativo legível (ex: "há 2 horas").
 * @param {Date} date
 * @returns {string}
 */
function _timeAgo(date) {
  const diff = Date.now() - date.getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);

  if (mins  < 1)  return 'agora mesmo';
  if (mins  < 60) return `há ${mins} min`;
  if (hours < 24) return `há ${hours}h`;
  if (days  < 7)  return `há ${days}d`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

/**
 * Renderiza o feed de timeline de atividades.
 */
function renderTimeline() {
  const container = document.getElementById('timeline-feed');
  if (!container) return;

  const events = _buildTimelineEvents();

  if (!events.length) {
    container.innerHTML = `<div class="timeline-empty">🕐 Nenhuma atividade recente registrada.</div>`;
    return;
  }

  container.innerHTML = events.map(evt => `
    <div class="timeline-item timeline-item-${evt.type}">
      <div class="timeline-item-header">
        <span class="timeline-item-icon">${evt.icon}</span>
        <span class="timeline-item-title">${escapeHtml(evt.title)}</span>
        <span class="timeline-item-time">${_timeAgo(evt.time)}</span>
      </div>
      ${evt.detail ? `<div class="timeline-item-body">${escapeHtml(evt.detail)}</div>` : ''}
    </div>
  `).join('');
}

// ─── Refresh Completo ─────────────────────────────────────────────────────────

/**
 * Atualiza todos os componentes do módulo KPI/Timeline.
 * Chamado por refreshDashboard() em app.js.
 */
function refreshKPISection() {
  renderKPICards();
  renderTimeline();
}
