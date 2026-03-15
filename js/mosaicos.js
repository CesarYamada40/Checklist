/**
 * mosaicos.js - Mosaicos management page
 * Groups of sites for organized monitoring
 */

// ─── State ───────────────────────────────────────────────────────────────────

const MOSAICOS_KEY = 'cftv_mosaicos';

function getMosaicos() {
  try {
    return JSON.parse(localStorage.getItem(MOSAICOS_KEY) || '[]');
  } catch (_) {
    return [];
  }
}

function saveMosaicos(mosaicos) {
  localStorage.setItem(MOSAICOS_KEY, JSON.stringify(mosaicos));
}

function getMosaicoById(id) {
  return getMosaicos().find(m => m.id === id) || null;
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function showMosaicosScreen() {
  showScreen('mosaicos');
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const el = document.getElementById('nav-mosaicos');
  if (el) el.classList.add('active');
  renderMosaicosPage();
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderMosaicosPage() {
  const screen = document.getElementById('screen-mosaicos');
  if (!screen) return;

  const mosaicos = getMosaicos();
  const allSites = getAllSites();
  const siteMap = {};
  allSites.forEach(s => { siteMap[s.id] = s; });

  const cardsHtml = mosaicos.length
    ? mosaicos.map(m => _renderMosaicoCard(m, siteMap)).join('')
    : `<div class="mos-empty">
        <div class="mos-empty-icon">📋</div>
        <p>Nenhum mosaico criado ainda.</p>
        <p class="mos-empty-sub">Crie mosaicos para agrupar sites por localização ou importância.</p>
      </div>`;

  screen.innerHTML = `
    ${typeof _buildPageNav === 'function' ? _buildPageNav('mosaicos') : ''}
    <div class="mos-container">
      <div class="mos-header">
        <h2 class="mos-title">📋 Mosaicos</h2>
        <div class="mos-header-stats">
          <span class="sp-badge sp-badge-total">${mosaicos.length} mosaico${mosaicos.length !== 1 ? 's' : ''}</span>
          <span class="sp-badge sp-badge-total">${allSites.length} sites</span>
        </div>
        <div class="mos-header-actions">
          <button class="btn btn-primary" onclick="openNewMosaicoModal()">+ Novo Mosaico</button>
        </div>
      </div>

      <div class="mos-grid">
        ${cardsHtml}
      </div>
    </div>
  `;
}

function _renderMosaicoCard(m, siteMap) {
  const siteIds = m.siteIds || [];
  const sites = siteIds.map(id => siteMap[id]).filter(Boolean);

  const sitesHtml = sites.length
    ? sites.slice(0, 12).map(s => {
        const regClass = s.regional === 'PR' ? 'sp-reg-pr'
          : s.regional === 'SC' ? 'sp-reg-sc'
          : s.regional === 'RS' ? 'sp-reg-rs' : '';
        return `<span class="mos-site-chip ${regClass}" title="${escapeHtml(s.sigla)}">${escapeHtml(s.sigla)}</span>`;
      }).join('') + (sites.length > 12 ? `<span class="mos-site-more">+${sites.length - 12}</span>` : '')
    : '<span class="mos-no-sites">Sem sites atribuídos</span>';

  const regBadge = m.regional
    ? `<span class="sp-regional-badge ${m.regional === 'PR' ? 'sp-reg-pr' : m.regional === 'SC' ? 'sp-reg-sc' : 'sp-reg-rs'}">${m.regional}</span>`
    : '';

  return `
    <div class="mos-card">
      <div class="mos-card-header">
        <div class="mos-card-title">${escapeHtml(m.nome)}</div>
        <div class="mos-card-meta">
          ${regBadge}
          <span class="sp-badge sp-badge-total">${sites.length} sites</span>
        </div>
      </div>
      <div class="mos-sites-grid">${sitesHtml}</div>
      <div class="mos-card-actions">
        <button class="btn btn-outline" onclick="openEditMosaicoModal('${escapeHtml(m.id)}')">✏️ Editar</button>
        <button class="btn btn-outline" onclick="openMosaicoAssignModal('${escapeHtml(m.id)}')">🔗 Sites</button>
        <button class="btn btn-outline" style="color:var(--offline)" onclick="confirmDeleteMosaico('${escapeHtml(m.id)}', '${escapeHtml(m.nome)}')">🗑️</button>
      </div>
    </div>
  `;
}

// ─── Mosaico CRUD ─────────────────────────────────────────────────────────────

function openNewMosaicoModal() {
  _openMosaicoFormModal(null);
}

function openEditMosaicoModal(id) {
  const m = getMosaicoById(id);
  if (!m) { showToast('Mosaico não encontrado.', 'error'); return; }
  _openMosaicoFormModal(m);
}

function _openMosaicoFormModal(m) {
  const isEdit = !!m;
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('hidden');

  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div class="modal-title">${isEdit ? '✏️ Editar Mosaico' : '➕ Novo Mosaico'}</div>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Nome do Mosaico <span class="required">*</span></label>
          <input type="text" id="mf-nome" value="${escapeHtml(m?.nome || '')}"
            placeholder="Ex: PR-Mosaico-1" maxlength="60">
        </div>
        <div class="form-group">
          <label>Regional</label>
          <select id="mf-regional">
            <option value="">Todas</option>
            <option value="PR" ${m?.regional === 'PR' ? 'selected' : ''}>PR - Paraná</option>
            <option value="SC" ${m?.regional === 'SC' ? 'selected' : ''}>SC - Santa Catarina</option>
            <option value="RS" ${m?.regional === 'RS' ? 'selected' : ''}>RS - Rio Grande do Sul</option>
          </select>
        </div>
        <div class="form-group">
          <label>Descrição</label>
          <textarea id="mf-desc" rows="2" maxlength="200">${escapeHtml(m?.descricao || '')}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="saveMosaicoForm(${isEdit ? `'${m.id}'` : 'null'})">
          ${isEdit ? '💾 Salvar' : '➕ Criar'}
        </button>
      </div>
    </div>
  `;
}

function saveMosaicoForm(id) {
  const nome = document.getElementById('mf-nome')?.value.trim();
  if (!nome) { showToast('Nome é obrigatório.', 'error'); return; }

  const mosaicos = getMosaicos();

  if (id) {
    const idx = mosaicos.findIndex(m => m.id === id);
    if (idx === -1) { showToast('Mosaico não encontrado.', 'error'); return; }
    mosaicos[idx].nome = nome;
    mosaicos[idx].regional = document.getElementById('mf-regional')?.value || '';
    mosaicos[idx].descricao = document.getElementById('mf-desc')?.value.trim() || '';
    mosaicos[idx].updatedAt = new Date().toISOString();
  } else {
    mosaicos.push({
      id: `m_${Date.now()}`,
      nome,
      regional: document.getElementById('mf-regional')?.value || '',
      descricao: document.getElementById('mf-desc')?.value.trim() || '',
      siteIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  saveMosaicos(mosaicos);
  closeModal();
  showToast(`✅ Mosaico "${nome}" ${id ? 'atualizado' : 'criado'}!`, 'success');
  renderMosaicosPage();
}

function confirmDeleteMosaico(id, nome) {
  if (!confirm(`Excluir mosaico "${nome}"?`)) return;
  const mosaicos = getMosaicos().filter(m => m.id !== id);
  saveMosaicos(mosaicos);
  showToast(`🗑️ Mosaico "${nome}" excluído.`, 'success');
  renderMosaicosPage();
}

// ─── Site Assignment ──────────────────────────────────────────────────────────

function openMosaicoAssignModal(mosaicoId) {
  const m = getMosaicoById(mosaicoId);
  if (!m) { showToast('Mosaico não encontrado.', 'error'); return; }

  const allSites = getAllSites();
  const assignedIds = new Set(m.siteIds || []);

  // Group by regional
  const regionals = ['PR', 'SC', 'RS'];
  const grouped = {};
  allSites.forEach(s => {
    const reg = s.regional || 'N/D';
    if (!grouped[reg]) grouped[reg] = [];
    grouped[reg].push(s);
  });

  const sitesHtml = Object.entries(grouped).map(([reg, sites]) => `
    <div class="mas-group">
      <div class="mas-group-title">${reg}</div>
      <div class="mas-sites">
        ${sites.map(s => `
          <label class="mas-site-item">
            <input type="checkbox" name="mas-site" value="${s.id}"
              ${assignedIds.has(s.id) ? 'checked' : ''}>
            <span class="mas-site-label">${escapeHtml(s.sigla)}</span>
            <span class="mas-site-conta">${s.conta || ''}</span>
          </label>
        `).join('')}
      </div>
    </div>
  `).join('');

  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('hidden');
  overlay.innerHTML = `
    <div class="modal mas-modal" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div class="modal-title">🔗 Sites → ${escapeHtml(m.nome)}</div>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body mas-body">
        <div class="mas-toolbar">
          <button class="btn btn-outline" onclick="masSelectAll()">Selecionar Todos</button>
          <button class="btn btn-outline" onclick="masDeselectAll()">Limpar</button>
          <span class="mas-count" id="mas-count">${assignedIds.size} selecionados</span>
        </div>
        <div class="mas-sites-list" id="mas-sites-list">${sitesHtml}</div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="saveMosaicoAssignment('${mosaicoId}')">💾 Salvar</button>
      </div>
    </div>
  `;

  // Update count on checkbox change
  document.querySelectorAll('input[name="mas-site"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const count = document.querySelectorAll('input[name="mas-site"]:checked').length;
      const el = document.getElementById('mas-count');
      if (el) el.textContent = `${count} selecionados`;
    });
  });
}

function masSelectAll() {
  document.querySelectorAll('input[name="mas-site"]').forEach(cb => { cb.checked = true; });
  const count = document.querySelectorAll('input[name="mas-site"]:checked').length;
  const el = document.getElementById('mas-count');
  if (el) el.textContent = `${count} selecionados`;
}

function masDeselectAll() {
  document.querySelectorAll('input[name="mas-site"]').forEach(cb => { cb.checked = false; });
  const el = document.getElementById('mas-count');
  if (el) el.textContent = '0 selecionados';
}

function saveMosaicoAssignment(mosaicoId) {
  const checked = document.querySelectorAll('input[name="mas-site"]:checked');
  const siteIds = Array.from(checked).map(cb => parseInt(cb.value, 10));

  const mosaicos = getMosaicos();
  const idx = mosaicos.findIndex(m => m.id === mosaicoId);
  if (idx === -1) { showToast('Mosaico não encontrado.', 'error'); return; }

  mosaicos[idx].siteIds = siteIds;
  mosaicos[idx].updatedAt = new Date().toISOString();
  saveMosaicos(mosaicos);

  closeModal();
  showToast(`✅ ${siteIds.length} sites atribuídos ao mosaico.`, 'success');
  renderMosaicosPage();
}
