/**
 * exporter.js - Export module
 * Provides multi-tab Excel, print-ready PDF, and clipboard summary export.
 * Depends on: database.js, app.js, xlsx.full.min.js
 */

// ─── Excel (multi-tab) ────────────────────────────────────────────────────────

/**
 * Export all data to an XLSX file with separate sheets per regional plus a
 * consolidated sheet and a summary sheet.
 */
function exportExcelMultiTab() {
  try {
    showToast('⏳ Gerando arquivo Excel...', 'info', 2000);

    const wb = XLSX.utils.book_new();

    /** Normalise a site row into a plain object for the spreadsheet */
    function toRow(s) {
      return {
        'REGIONAL':        s.regional        || '',
        'CONTA':           s.conta           || '',
        'SIGLA':           s.sigla           || '',
        'STATUS ALARME':   s.status_conexao  || '',
        'DATA DESCONEXÃO': s.data_desconexao || '',
        'O.S.':            s.os              || '',
        'ZONA':            s.zona            || '',
        'PADRÃO CÂMERAS':  s.padrao_cameras  || '',
        'CÂMERAS ONTEM':   s.cameras_ontem   || '',
        'CÂMERAS HOJE':    s.cameras_hoje    || '',
        'STATUS CFTV':     s.status2         || '',
        'DATA ALTERAÇÃO':  s.data_alteracao  || '',
        'VEGETAÇÃO ALTA':  s.vegetacao_alta  ? 'SIM' : 'NÃO',
        'CÂMERA PROBLEMA': s.camera_problema || '',
        'OBSERVAÇÃO':      s.observacao      || '',
        'ÚLTIMA RONDA':    s.ultima_ronda_ts || '',
        'OPERADOR':        s.ultimo_operador || '',
        'STATUS RONDA':    s.ultimo_status_ronda || '',
      };
    }

    /** Add a sheet with auto-column widths */
    function addSheet(name, rows) {
      if (!rows.length) return;
      const ws = XLSX.utils.json_to_sheet(rows);
      // Approximate column widths
      const colWidths = [8,8,12,14,14,8,6,10,10,10,12,14,8,12,30,16,20,12];
      ws['!cols'] = colWidths.map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, name);
    }

    // One sheet per regional
    for (const r of ['PR', 'SC', 'RS']) {
      addSheet(`Regional ${r}`, searchSites('', 'todos', r).map(toRow));
    }

    // Consolidated sheet
    addSheet('Consolidado', searchSites('', 'todos', 'todos').map(toRow));

    // Summary sheet
    const stats    = getDashboardStats();
    const regStats = getRegionalStats();

    function regRow(r) {
      const s = regStats[r] || {};
      const alarmTotal = (s.alarmes_conectados || 0) + (s.alarmes_desconectados || 0);
      const cftvTotal  = (s.cftv_ok           || 0) + (s.cftv_desconectado  || 0);
      return {
        'REGIONAL':       r,
        'TOTAL SITES':    s.total                   || 0,
        'ALARMES OK':     s.alarmes_conectados       || 0,
        'ALARMES DESC.':  s.alarmes_desconectados    || 0,
        '% ALARMES':      alarmTotal > 0
          ? `${Math.round((s.alarmes_conectados || 0) / alarmTotal * 100)}%` : '0%',
        'CFTV OK':        s.cftv_ok                 || 0,
        'CFTV PARCIAL':   s.cftv_parcial            || 0,
        'CFTV DESC.':     s.cftv_desconectado       || 0,
        '% CFTV':         cftvTotal > 0
          ? `${Math.round((s.cftv_ok || 0) / cftvTotal * 100)}%` : '0%',
        'VEGETAÇÃO':      s.vegetacao_alta          || 0,
      };
    }

    const summaryRows = [
      regRow('PR'),
      regRow('SC'),
      regRow('RS'),
      {
        'REGIONAL':      'TOTAL',
        'TOTAL SITES':   stats.total,
        'ALARMES OK':    stats.alarmes_conectados,
        'ALARMES DESC.': stats.alarmes_desconectados,
        '% ALARMES': (stats.alarmes_conectados + stats.alarmes_desconectados) > 0
          ? `${Math.round(stats.alarmes_conectados / (stats.alarmes_conectados + stats.alarmes_desconectados) * 100)}%` : '0%',
        'CFTV OK':       stats.cftv_ok,
        'CFTV PARCIAL':  stats.cftv_parcial,
        'CFTV DESC.':    stats.cftv_desconectado,
        '% CFTV': (stats.cftv_ok + stats.cftv_desconectado) > 0
          ? `${Math.round(stats.cftv_ok / (stats.cftv_ok + stats.cftv_desconectado) * 100)}%` : '0%',
        'VEGETAÇÃO':     stats.vegetacao_alta,
      },
    ];

    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    wsSummary['!cols'] = [10,12,12,14,10,10,12,12,10,10].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo');

    const filename = `checklist_cftv_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
    showToast(`✅ Excel exportado: ${filename}`, 'success', 4000);
  } catch (e) {
    showToast(`❌ Erro ao exportar Excel: ${e.message}`, 'error');
    console.error('[exporter] exportExcelMultiTab:', e);
  }
}

// ─── PDF (print dialog) ───────────────────────────────────────────────────────

/**
 * Open a print-ready HTML report in a new window and trigger the print dialog.
 */
function exportPDF() {
  try {
    const stats    = getDashboardStats();
    const regStats = getRegionalStats();
    const today    = new Date().toLocaleDateString('pt-BR');
    const now      = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    function pct(num, den) {
      return den > 0 ? `${Math.round(num / den * 100)}%` : '0%';
    }

    const tableRows = ['PR', 'SC', 'RS'].map(r => {
      const s = regStats[r] || {};
      const alarmDen = (s.alarmes_conectados || 0) + (s.alarmes_desconectados || 0);
      const cftvDen  = (s.cftv_ok || 0) + (s.cftv_desconectado || 0);
      return `<tr>
        <td><strong>${r}</strong></td>
        <td>${s.total || 0}</td>
        <td style="color:#10b981">${s.alarmes_conectados || 0}</td>
        <td style="color:#ef4444">${s.alarmes_desconectados || 0}</td>
        <td>${pct(s.alarmes_conectados || 0, alarmDen)}</td>
        <td style="color:#3b82f6">${s.cftv_ok || 0}</td>
        <td style="color:#f59e0b">${s.cftv_parcial || 0}</td>
        <td style="color:#ef4444">${s.cftv_desconectado || 0}</td>
        <td>${pct(s.cftv_ok || 0, cftvDen)}</td>
        <td style="color:#34d399">${s.vegetacao_alta || 0}</td>
      </tr>`;
    }).join('');

    // Top 30 problem sites
    const problems = typeof _getProblemSites === 'function' ? _getProblemSites().slice(0, 30) : [];
    const problemRows = problems.map(s => `<tr>
      <td>${escapeHtml(s.regional || '-')}</td>
      <td><strong>${escapeHtml(s.sigla)}</strong></td>
      <td>${s.conta || '-'}</td>
      <td>${escapeHtml(s.status_conexao || '-')}</td>
      <td>${escapeHtml(s.status2 || '-')}</td>
      <td>${escapeHtml(s.problema || '-')}</td>
      <td>${s.data_problema || '-'}</td>
    </tr>`).join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório CFTV – ${today}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 20px; }
    h1  { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 8px; margin-bottom: 16px; }
    h2  { color: #374151; margin: 20px 0 8px; font-size: 14px; }
    .meta { color: #6b7280; font-size: 11px; margin-bottom: 20px; }
    .summary { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .summary-card {
      border: 1px solid #e5e7eb; border-radius: 6px;
      padding: 10px 16px; text-align: center; min-width: 110px;
    }
    .summary-num  { font-size: 22px; font-weight: 800; color: #1e40af; }
    .summary-label{ font-size: 10px; color: #6b7280; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: #1e40af; color: #fff; padding: 6px 8px; text-align: left; font-size: 11px; }
    td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
    tr:nth-child(even) td { background: #f9fafb; }
    @media print {
      body { margin: 10px; }
      h2 { page-break-before: auto; }
    }
  </style>
</head>
<body>
  <h1>🎯 Relatório Checklist CFTV – Claro Regional Sul</h1>
  <p class="meta">Gerado em: <strong>${today} às ${now}</strong></p>

  <div class="summary">
    <div class="summary-card">
      <div class="summary-num">${stats.total}</div>
      <div class="summary-label">Total Sites</div>
    </div>
    <div class="summary-card">
      <div class="summary-num" style="color:#10b981">${stats.alarmes_conectados}</div>
      <div class="summary-label">Alarmes Online</div>
    </div>
    <div class="summary-card">
      <div class="summary-num" style="color:#ef4444">${stats.alarmes_desconectados}</div>
      <div class="summary-label">Alarmes Desc.</div>
    </div>
    <div class="summary-card">
      <div class="summary-num" style="color:#3b82f6">${stats.cftv_ok}</div>
      <div class="summary-label">CFTV OK</div>
    </div>
    <div class="summary-card">
      <div class="summary-num" style="color:#ef4444">${stats.cftv_desconectado}</div>
      <div class="summary-label">CFTV Desc.</div>
    </div>
    <div class="summary-card">
      <div class="summary-num" style="color:#34d399">${stats.vegetacao_alta}</div>
      <div class="summary-label">Vegetação Alta</div>
    </div>
  </div>

  <h2>📊 Resumo por Regional</h2>
  <table>
    <thead>
      <tr>
        <th>Regional</th><th>Sites</th>
        <th>Alarm. OK</th><th>Alarm. Desc.</th><th>% Alarm.</th>
        <th>CFTV OK</th><th>CFTV Parc.</th><th>CFTV Desc.</th><th>% CFTV</th>
        <th>Vegetação</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>

  ${problems.length ? `
  <h2>⚠️ Problemas Ativos (Top ${problems.length})</h2>
  <table>
    <thead>
      <tr>
        <th>Regional</th><th>SIGLA</th><th>Conta</th>
        <th>Alarme</th><th>CFTV</th><th>Problema</th><th>Data</th>
      </tr>
    </thead>
    <tbody>${problemRows}</tbody>
  </table>` : ''}
</body>
</html>`;

    const win = window.open('', '_blank', 'width=960,height=700');
    if (!win) {
      showToast('❌ Bloqueador de popups ativo – permita popups para este site.', 'error', 5000);
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  } catch (e) {
    showToast(`❌ Erro ao gerar PDF: ${e.message}`, 'error');
    console.error('[exporter] exportPDF:', e);
  }
}

// ─── Clipboard summary ────────────────────────────────────────────────────────

/**
 * Copy a plain-text executive summary to the clipboard.
 */
function copyExecutiveSummary() {
  try {
    const stats    = getDashboardStats();
    const regStats = getRegionalStats();
    const today    = new Date().toLocaleDateString('pt-BR');

    function pct(num, den) { return den > 0 ? `${Math.round(num / den * 100)}%` : '0%'; }

    const regionalLines = ['PR', 'SC', 'RS'].map(r => {
      const s = regStats[r] || {};
      const aD = (s.alarmes_conectados || 0) + (s.alarmes_desconectados || 0);
      const cD = (s.cftv_ok || 0) + (s.cftv_desconectado || 0);
      return `📍 ${r}: ${s.total || 0} sites | Alarm: ${s.alarmes_conectados || 0}✅/${s.alarmes_desconectados || 0}❌ (${pct(s.alarmes_conectados || 0, aD)}) | CFTV: ${s.cftv_ok || 0}✅/${s.cftv_desconectado || 0}❌ (${pct(s.cftv_ok || 0, cD)})`;
    }).join('\n');

    const text = [
      `🎯 CHECKLIST CFTV – CLARO REGIONAL SUL`,
      `Data: ${today}`,
      ``,
      `📊 RESUMO GERAL`,
      `Total de Sites: ${stats.total}`,
      `Alarmes Online: ${stats.alarmes_conectados} | Desconectados: ${stats.alarmes_desconectados}`,
      `CFTV OK: ${stats.cftv_ok} | Desconectados: ${stats.cftv_desconectado} | Parcial: ${stats.cftv_parcial || 0}`,
      `Vegetação Alta: ${stats.vegetacao_alta}`,
      ``,
      `📍 POR REGIONAL`,
      regionalLines,
    ].join('\n');

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => showToast('📋 Resumo copiado para a área de transferência!', 'success', 3000))
        .catch(() => _clipboardFallback(text));
    } else {
      _clipboardFallback(text);
    }
  } catch (e) {
    showToast(`❌ Erro ao copiar resumo: ${e.message}`, 'error');
    console.error('[exporter] copyExecutiveSummary:', e);
  }
}

function _clipboardFallback(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('📋 Resumo copiado!', 'success', 3000);
  } catch (_) {
    showToast('⚠️ Não foi possível copiar automaticamente.', 'warning', 3000);
  }
}
