/**
 * omnisearch.js - Busca global (Omnisearch)
 * Permite busca fuzzy instantânea em sites, operadores e histórico.
 * Depende de: database.js, app.js (escapeHtml, showSiteDetail, setRegional)
 */

// ─── State ────────────────────────────────────────────────────────────────────

const omnisearchState = {
  open:        false,
  query:       '',
  results:     [],
  activeIndex: -1,
  debounceId:  null,
};

// ─── Init ─────────────────────────────────────────────────────────────────────

/**
 * Inicializa o Omnisearch – deve ser chamado após o DOM estar pronto.
 */
function initOmnisearch() {
  const input = document.getElementById('omnisearch-input');
  if (!input) return;

  input.addEventListener('input', () => {
    clearTimeout(omnisearchState.debounceId);
    omnisearchState.debounceId = setTimeout(() => {
      omnisearchState.query = input.value.trim();
      if (omnisearchState.query.length < 2) {
        _closeOmnisearch();
        return;
      }
      _runSearch(omnisearchState.query);
    }, 200); // Debounce 200ms
  });

  input.addEventListener('keydown', e => {
    if (!omnisearchState.open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); _moveActive(1);  }
    if (e.key === 'ArrowUp')   { e.preventDefault(); _moveActive(-1); }
    if (e.key === 'Enter')     { e.preventDefault(); _selectActive(); }
    if (e.key === 'Escape')    { e.preventDefault(); _closeOmnisearch(); input.blur(); }
  });

  // Fechar ao clicar fora
  document.addEventListener('click', e => {
    const wrap = document.getElementById('omnisearch-wrap');
    if (wrap && !wrap.contains(e.target)) {
      _closeOmnisearch();
    }
  });
}

// ─── Pesquisa ─────────────────────────────────────────────────────────────────

/**
 * Executa a busca e exibe os resultados.
 * @param {string} query
 */
function _runSearch(query) {
  const start = performance.now();
  const results = [];
  const qLower  = query.toLowerCase();

  // Busca em sites
  try {
    const sites = searchSites('', 'todos', 'todos');
    const siteMatches = sites
      .filter(s =>
        (s.sigla  && s.sigla.toLowerCase().includes(qLower))    ||
        (s.conta  && String(s.conta).includes(query))           ||
        (s.observacao && s.observacao.toLowerCase().includes(qLower)) ||
        (s.os     && s.os.toLowerCase().includes(qLower))
      )
      .slice(0, 8);

    siteMatches.forEach(s => {
      results.push({
        type:      'site',
        icon:      s.status_conexao === 'DESCONECTADO' ? '🔴' :
                   s.status2 === 'PARCIAL' ? '🟡' : '🟢',
        main:      s.sigla,
        sub:       `${s.regional || ''} · Conta ${s.conta} · ${s.status_conexao || ''}`,
        action:    () => { showSiteDetail(s.id); _closeOmnisearch(); },
        matchOn:   s.sigla,
      });
    });
  } catch (_) {}

  // Busca por regional
  ['PR', 'SC', 'RS'].forEach(reg => {
    if (reg.toLowerCase().includes(qLower) || `regional ${reg}`.toLowerCase().includes(qLower)) {
      results.push({
        type:   'regional',
        icon:   '📍',
        main:   `Regional ${reg}`,
        sub:    'Ver todos os sites desta regional',
        action: () => { setRegional(reg); _closeOmnisearch(); showScreen('main'); },
        matchOn: reg,
      });
    }
  });

  // Atalhos de tela
  const screens = [
    { label: 'Dashboard',     icon: '📊', action: () => { showScreen('main');     _closeOmnisearch(); } },
    { label: 'Relatórios',    icon: '📄', action: () => { showReportsScreen();    _closeOmnisearch(); } },
    { label: 'Configurações', icon: '⚙️', action: () => { showSettingsScreen();   _closeOmnisearch(); } },
    { label: 'Iniciar Ronda', icon: '🚀', action: () => { triggerStartRonda();    _closeOmnisearch(); } },
    { label: 'Importar HTML', icon: '📥', action: () => { triggerHTMLImport();    _closeOmnisearch(); } },
    { label: 'Exportar XLSX', icon: '📊', action: () => {
        exportExcelMultiTab();
        _closeOmnisearch();
      }
    },
    { label: 'Backup',        icon: '💾', action: () => { exportarBackupCompleto(); _closeOmnisearch(); } },
  ];

  screens.forEach(s => {
    if (s.label.toLowerCase().includes(qLower)) {
      results.push({
        type:   'action',
        icon:   s.icon,
        main:   s.label,
        sub:    'Atalho de navegação',
        action: s.action,
        matchOn: s.label,
      });
    }
  });

  const elapsed = Math.round(performance.now() - start);
  omnisearchState.results     = results;
  omnisearchState.activeIndex = -1;
  _renderDropdown(results, query, elapsed);
}

// ─── Dropdown ─────────────────────────────────────────────────────────────────

function _renderDropdown(results, query, elapsed) {
  let dropdown = document.getElementById('omnisearch-dropdown');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.id        = 'omnisearch-dropdown';
    dropdown.className = 'omnisearch-dropdown';
    document.getElementById('omnisearch-wrap').appendChild(dropdown);
  }

  if (!results.length) {
    dropdown.innerHTML = `<div class="omnisearch-empty">🔍 Nenhum resultado para "${escapeHtml(query)}"</div>`;
    omnisearchState.open = true;
    return;
  }

  // Agrupar por tipo
  const groups = {};
  results.forEach(r => {
    if (!groups[r.type]) groups[r.type] = [];
    groups[r.type].push(r);
  });

  const groupLabels = { site: '📋 Sites', regional: '📍 Regionais', action: '⚡ Ações' };

  let html = '';
  let itemIndex = 0;
  Object.entries(groups).forEach(([type, items]) => {
    html += `<div class="omnisearch-section-label">${groupLabels[type] || type}</div>`;
    items.forEach(item => {
      const idx   = itemIndex++;
      const hi    = _highlight(item.matchOn, query);
      const mainHtml = item.main === item.matchOn ? hi : escapeHtml(item.main);
      html += `
        <button class="omnisearch-item" data-idx="${idx}"
          onclick="omnisearchSelectIdx(${idx})"
          aria-label="${escapeHtml(item.main)}">
          <span class="omnisearch-item-icon">${item.icon}</span>
          <span class="omnisearch-item-main">${mainHtml}</span>
          <span class="omnisearch-item-sub">${escapeHtml(item.sub)}</span>
        </button>
      `;
    });
  });

  html += `<div class="omnisearch-empty" style="font-size:.7rem;padding:6px 12px">
    ${results.length} resultado${results.length !== 1 ? 's' : ''} em ${elapsed}ms
  </div>`;

  dropdown.innerHTML = html;
  omnisearchState.open = true;
}

/** Destaca o match na string */
function _highlight(text, query) {
  if (!text) return '';
  const escaped   = escapeHtml(text);
  const escapedQ  = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex     = new RegExp(`(${escapedQ})`, 'gi');
  return escaped.replace(regex, '<mark>$1</mark>');
}

/** Move seleção ativa no dropdown */
function _moveActive(delta) {
  const items = document.querySelectorAll('#omnisearch-dropdown .omnisearch-item');
  if (!items.length) return;

  // Remover ativo atual
  if (omnisearchState.activeIndex >= 0 && items[omnisearchState.activeIndex]) {
    items[omnisearchState.activeIndex].classList.remove('active');
  }

  omnisearchState.activeIndex = Math.max(
    0, Math.min(items.length - 1, omnisearchState.activeIndex + delta)
  );
  const active = items[omnisearchState.activeIndex];
  if (active) {
    active.classList.add('active');
    active.scrollIntoView({ block: 'nearest' });
  }
}

/** Executa ação do item ativo */
function _selectActive() {
  if (omnisearchState.activeIndex < 0) return;
  omnisearchSelectIdx(omnisearchState.activeIndex);
}

/** Executa ação pelo índice */
function omnisearchSelectIdx(idx) {
  const item = omnisearchState.results[idx];
  if (item && typeof item.action === 'function') {
    item.action();
  }
}

/** Fecha o dropdown */
function _closeOmnisearch() {
  const dropdown = document.getElementById('omnisearch-dropdown');
  if (dropdown) dropdown.remove();
  omnisearchState.open        = false;
  omnisearchState.activeIndex = -1;

  const input = document.getElementById('omnisearch-input');
  if (input && document.activeElement !== input) {
    input.value = '';
    omnisearchState.query = '';
  }
}

/**
 * Abre o omnisearch com foco no campo (usado pelo atalho Ctrl+K).
 */
function openOmnisearch() {
  const input = document.getElementById('omnisearch-input');
  if (input) {
    input.focus();
    input.select();
  }
}
