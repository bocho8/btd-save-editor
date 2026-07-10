import { nkDecrypt, nkEncrypt } from './nk-crypto.mjs';
import { setByPath } from './json-path.mjs';

function isValidJSON(str) {
  try { JSON.parse(str); return true; } catch { return false; }
}

const sizeFmt = new Intl.NumberFormat('en', {
  style: 'unit', unit: 'byte', unitDisplay: 'narrow', maximumFractionDigits: 1,
});
function formatFileSize(bytes) {
  return sizeFmt.format(bytes);
}

const fileInput       = document.getElementById('file-input');
const dropZone        = document.getElementById('drop-zone');
const fileInfo        = document.getElementById('file-info');
const fileName        = document.getElementById('file-name');
const fileSize        = document.getElementById('file-size');
const clearFileBtn    = document.getElementById('clear-file-btn');
const actions         = document.getElementById('actions');
const decryptBtn      = document.getElementById('decrypt-btn');
const validateBtn     = document.getElementById('validate-btn');
const crcStatus       = document.getElementById('crc-status');
const editorSection   = document.getElementById('editor-section');
const treeView        = document.getElementById('tree-view');
const jsonEditor      = document.getElementById('json-editor');
const jsonStatus      = document.getElementById('json-status');
const viewTreeBtn     = document.getElementById('view-tree-btn');
const viewRawBtn      = document.getElementById('view-raw-btn');
const searchInput     = document.getElementById('search-input');
const searchCount     = document.getElementById('search-count');
const sanitizeBtn      = document.getElementById('sanitize-btn');
const setMedallionsBtn = document.getElementById('set-medallions-btn');
const setPremiumsBtn   = document.getElementById('set-premiums-btn');
const setFarmersBtn    = document.getElementById('set-farmers-btn');
const setBattleScoreBtn = document.getElementById('set-battle-score-btn');
const encryptBtn      = document.getElementById('encrypt-btn');

const modalDialog    = document.getElementById('modal-dialog');
const modalTitle     = document.getElementById('modal-title');
const modalBody      = document.getElementById('modal-body');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalConfirmBtn= document.getElementById('modal-confirm-btn');
let modalResolve     = null;
let modalSession     = null;

let rawFileBytes   = null;
let decryptedJSON  = null;
let currentView    = 'tree';

/** onConfirm: false keeps open; else close & resolve. Cancel → null. */
function openModal({ onConfirm }) {
  if (modalDialog.open) return Promise.resolve(null);
  return new Promise((resolve) => {
    modalResolve = resolve;
    modalSession = { onConfirm };
    modalDialog.showModal();
    focusModalInput();
  });
}

function focusModalInput() {
  const input = modalBody.querySelector('input');
  if (input) setTimeout(() => { input.focus(); input.select(); }, 50);
}

function closeModal(value) {
  if (!modalDialog.open) return;
  const resolve = modalResolve;
  modalResolve = null;
  modalSession = null;
  modalDialog.close();
  modalBody.innerHTML = '';
  if (resolve) resolve(value);
}

function handleModalConfirm() {
  if (!modalSession?.onConfirm) {
    closeModal(null);
    return;
  }
  const result = modalSession.onConfirm();
  if (result === false) return;
  closeModal(result ?? null);
}

modalConfirmBtn.addEventListener('click', handleModalConfirm);
modalCancelBtn.addEventListener('click', () => closeModal(null));

modalDialog.addEventListener('cancel', (e) => {
  e.preventDefault();
  closeModal(null);
});

modalDialog.addEventListener('close', () => {
  if (modalResolve) closeModal(null);
});

modalDialog.addEventListener('click', (e) => {
  if (e.target === modalDialog) closeModal(null);
});

modalBody.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleModalConfirm();
  }
});

function loadFile(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    rawFileBytes = new Uint8Array(e.target.result);
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(rawFileBytes.length);
    fileInfo.hidden = false;
    actions.hidden = false;
    editorSection.hidden = true;
    crcStatus.textContent = '';
    crcStatus.className = 'status-badge';
    decryptedJSON = null;
    treeView.innerHTML = '';
    jsonEditor.value = '';
    jsonStatus.textContent = '';
    jsonStatus.className = 'status-badge';
    validateCRCOnly();
  };
  reader.readAsArrayBuffer(file);
}

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files.length > 0) loadFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) loadFile(fileInput.files[0]);
});

clearFileBtn.addEventListener('click', () => {
  rawFileBytes = null;
  decryptedJSON = null;
  fileInfo.hidden = true;
  actions.hidden = true;
  editorSection.hidden = true;
  crcStatus.textContent = '';
  crcStatus.className = 'status-badge';
  jsonEditor.value = '';
  jsonStatus.textContent = '';
  jsonStatus.className = 'status-badge';
  treeView.innerHTML = '';
  fileInput.value = '';
});

function validateCRCOnly() {
  if (!rawFileBytes) return;
  const header = String.fromCharCode(...rawFileBytes.slice(0, 6));
  if (header !== 'DGDATA') {
    crcStatus.textContent = '✗ No DGDATA header';
    crcStatus.className = 'status-badge invalid';
    return;
  }
  if (nkDecrypt(rawFileBytes) !== null) {
    crcStatus.textContent = '✓ CRC valid';
    crcStatus.className = 'status-badge valid';
  } else {
    crcStatus.textContent = '✗ CRC mismatch or corrupt payload';
    crcStatus.className = 'status-badge invalid';
  }
}

function doDecrypt() {
  if (!rawFileBytes) return;
  const jsonStr = nkDecrypt(rawFileBytes);
  if (jsonStr === null || !isValidJSON(jsonStr)) {
    editorSection.hidden = true;
    return;
  }

  decryptedJSON = JSON.parse(jsonStr);
  editorSection.hidden = false;
  switchToTreeView();
}

function switchToTreeView() {
  currentView = 'tree';
  viewTreeBtn.classList.add('active');
  viewRawBtn.classList.remove('active');
  jsonEditor.hidden = true;
  treeView.hidden = false;
  renderTree();
  if (decryptedJSON) {
    jsonStatus.textContent = '✓ Valid JSON';
    jsonStatus.className = 'status-badge valid-json';
  }
}

function switchToRawView() {
  currentView = 'raw';
  viewRawBtn.classList.add('active');
  viewTreeBtn.classList.remove('active');
  treeView.hidden = true;
  jsonEditor.hidden = false;
  jsonEditor.value = JSON.stringify(decryptedJSON, null, 2);
  validateJSON();
}

viewTreeBtn.addEventListener('click', () => {
  if (currentView === 'raw') {
    const text = jsonEditor.value.trim();
    if (isValidJSON(text)) {
      decryptedJSON = JSON.parse(text);
      switchToTreeView();
    }
  }
});

viewRawBtn.addEventListener('click', () => {
  if (currentView === 'tree') switchToRawView();
});

function validateJSON() {
  const text = jsonEditor.value;
  if (!text.trim()) {
    jsonStatus.textContent = 'Empty';
    jsonStatus.className = 'status-badge';
    jsonEditor.classList.remove('error');
    return;
  }
  if (isValidJSON(text)) {
    jsonStatus.textContent = '✓ Valid JSON';
    jsonStatus.className = 'status-badge valid-json';
    jsonEditor.classList.remove('error');
  } else {
    jsonStatus.textContent = '✗ Invalid JSON';
    jsonStatus.className = 'status-badge invalid-json';
    jsonEditor.classList.add('error');
  }
}

jsonEditor.addEventListener('input', validateJSON);

const HIGH_KEYS = new Set(['detectedhacks', 'streamid', 'datetime', 'higherversionprofile']);
const DANGER_KEYS = new Set(['detectedhacks', 'streamid']);

function keyClass(key) {
  const lower = key.toLowerCase();
  if (DANGER_KEYS.has(lower)) return ' danger';
  if (HIGH_KEYS.has(lower)) return ' highlight';
  return '';
}

function renderTree() {
  if (!decryptedJSON) return;
  treeView.innerHTML = '';
  const searchTerm = searchInput.value.trim().toLowerCase();
  const root = document.createElement('div');
  renderNode(decryptedJSON, root, '', 0, searchTerm, true, []);
  treeView.appendChild(root);
  updateSearchCount();
}

function renderNode(value, container, key, depth, searchTerm, expanded, path) {
  const isRoot = key === '';
  if (isRoot) {
    if (value !== null && typeof value === 'object') {
      const entries = Object.entries(value);
      if (searchTerm && !entries.some(([k, v]) =>
        k.toLowerCase().includes(searchTerm) || deepSearch(v, searchTerm))) {
        container.innerHTML = '<div class="tree-empty no-results">No matching fields</div>';
        return;
      }
      for (const [k, v] of entries) {
        const isVisible = !searchTerm || k.toLowerCase().includes(searchTerm) || deepSearch(v, searchTerm);
        const wrapper = document.createElement('div');
        if (!isVisible) wrapper.classList.add('filtered-out');
        // Expand branches while searching so nested hits stay visible
        const startExpanded = !!searchTerm || typeof v !== 'object' || v === null;
        renderNode(v, wrapper, k, 0, searchTerm, startExpanded, [k]);
        container.appendChild(wrapper);
      }
    }
    return;
  }

  const isArray = Array.isArray(value);

  const row = document.createElement('div');
  row.className = 'tree-node';
  row.style.paddingLeft = (depth * 20) + 'px';

  if (value === null || typeof value !== 'object') {
    const keySpan = document.createElement('span');
    keySpan.className = 'tree-key' + keyClass(key);
    keySpan.textContent = key;
    row.appendChild(keySpan);

    const colon = document.createElement('span');
    colon.className = 'tree-colon';
    colon.textContent = ':';
    row.appendChild(colon);

    const valSpan = document.createElement('span');
    valSpan.className = 'tree-value';

    if (value === null) {
      valSpan.textContent = 'null';
      valSpan.className += ' type-null';
    } else if (typeof value === 'boolean') {
      valSpan.className += ' type-boolean';
      valSpan.appendChild(createBoolToggle(path, value));
    } else if (typeof value === 'number') {
      valSpan.className += ' type-number';
      valSpan.textContent = String(value);
      valSpan.dataset.editable = 'number';
      valSpan.dataset.path = JSON.stringify(path);
      valSpan.title = 'Double-click to edit';
      valSpan.addEventListener('dblclick', onValueDblClick);
    } else {
      valSpan.className += ' type-string';
      valSpan.textContent = value;
      valSpan.dataset.editable = 'string';
      valSpan.dataset.path = JSON.stringify(path);
      valSpan.title = 'Double-click to edit';
      valSpan.addEventListener('dblclick', onValueDblClick);
    }

    row.appendChild(valSpan);
    container.appendChild(row);
    return;
  }

  const arrow = document.createElement('span');
  const entries = isArray ? value.map((v, i) => [i, v]) : Object.entries(value);
  arrow.className = 'tree-arrow' + (entries.length === 0 ? ' empty' : '') + (expanded ? '' : ' collapsed');
  arrow.textContent = expanded ? '▼' : '▶';
  row.appendChild(arrow);

  const keySpan = document.createElement('span');
  keySpan.className = 'tree-key' + keyClass(key);
  keySpan.textContent = isArray ? `[${key}]` : key;
  row.appendChild(keySpan);

  const colon = document.createElement('span');
  colon.className = 'tree-colon';
  colon.textContent = ':';
  row.appendChild(colon);

  const summary = document.createElement('span');
  summary.className = 'tree-value type-object';
  const label = isArray ? 'Array' : 'Object';
  summary.textContent = isArray
    ? `[${entries.length} items]`
    : `{${entries.length} keys}`;
  row.appendChild(summary);

  const childrenDiv = document.createElement('div');
  childrenDiv.className = 'tree-children' + (expanded ? '' : ' collapsed');
  childrenDiv.dataset.parentDepth = depth;

  row.addEventListener('click', () => {
    arrow.textContent = arrow.classList.toggle('collapsed') ? '▶' : '▼';
    childrenDiv.classList.toggle('collapsed');
  });

  container.appendChild(row);

  if (entries.length > 0) {
    if (searchTerm) {
      const visible = entries.filter(([k, v]) => {
        const sk = String(k).toLowerCase();
        return sk.includes(searchTerm) || deepSearch(v, searchTerm);
      });
      for (const [k, v] of visible) {
        const sk = String(k);
        const childPath = [...path, isArray ? Number(k) : k];
        const wrapper = document.createElement('div');
        renderNode(v, wrapper, sk, depth + 1, searchTerm, true, childPath);
        childrenDiv.appendChild(wrapper);
      }
    } else {
      for (const [k, v] of entries) {
        const sk = String(k);
        const childPath = [...path, isArray ? Number(k) : k];
        const wrapper = document.createElement('div');
        renderNode(v, wrapper, sk, depth + 1, searchTerm, false, childPath);
        childrenDiv.appendChild(wrapper);
      }
    }
  }

  container.appendChild(childrenDiv);
}

function createBoolToggle(path, value) {
  const label = document.createElement('label');
  label.className = 'tree-bool-toggle';

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = value;

  const text = document.createElement('span');
  text.className = 'tree-bool-label';
  text.textContent = value ? 'true' : 'false';

  cb.addEventListener('change', () => {
    if (!decryptedJSON) return;
    if (!setByPath(decryptedJSON, path, cb.checked)) {
      cb.checked = !cb.checked;
    }
    text.textContent = cb.checked ? 'true' : 'false';
  });

  label.appendChild(cb);
  label.appendChild(text);
  return label;
}

function deepSearch(value, term) {
  if (value === null || typeof value !== 'object') return false;
  for (const k of Object.keys(value)) {
    if (k.toLowerCase().includes(term)) return true;
    const v = value[k];
    if (v !== null && typeof v === 'object') {
      if (deepSearch(v, term)) return true;
    } else if (String(v).toLowerCase().includes(term)) {
      return true;
    }
  }
  return false;
}

function onValueDblClick(e) {
  const span = e.currentTarget;
  if (span.querySelector('input')) return;

  const currentValue = span.textContent;
  const type = span.dataset.editable;
  const path = JSON.parse(span.dataset.path);

  const input = document.createElement('input');
  input.className = 'tree-value-input';
  input.type = type === 'number' ? 'number' : 'text';
  input.value = currentValue;
  input.dataset.type = type;

  span.textContent = '';
  span.appendChild(input);
  input.focus();
  input.select();

  function finish() {
    const raw = input.value.trim();
    let newVal;
    if (type === 'number') {
      newVal = raw === '' ? 0 : Number(raw);
      if (isNaN(newVal)) newVal = 0;
    } else {
      newVal = raw;
    }
    if (decryptedJSON && !setByPath(decryptedJSON, path, newVal)) {
      span.textContent = currentValue;
      return;
    }
    span.textContent = type === 'number' ? String(newVal) : newVal;
    span.dataset.value = String(newVal);
  }

  input.addEventListener('blur', finish);
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { input.blur(); }
    if (ev.key === 'Escape') {
      span.textContent = currentValue;
    }
  });
}

function updateSearchCount() {
  const term = searchInput.value.trim();
  if (!term) {
    searchCount.textContent = '';
    return;
  }
  const nodes = treeView.querySelectorAll('.tree-node');
  let visible = 0;
  for (const node of nodes) {
    if (!node.closest('.filtered-out')) visible++;
  }
  searchCount.textContent = `${visible} / ${nodes.length}`;
}

searchInput.addEventListener('input', () => {
  renderTree();
});

// Incomplete catalog; extend when new IDs show up in saves
const PREMIUM_CATALOG = [
  { id: 'ClubRoomEntry', label: 'Club Room Entry' },
  { id: 'CobraTower', label: 'Cobra Tower' },
  { id: 'RemoveAdverts', label: 'Remove Ads' },
];

const PREMIUM_CATALOG_IDS = new Set(PREMIUM_CATALOG.map(p => p.id));

const FARMER_CATALOG = [
  { id: 'MonkeyFarmer', label: 'Monkey Farmer' },
  { id: 'RoboFarmer', label: 'Robo Farmer' },
];

const FARMER_CATALOG_IDS = new Set(FARMER_CATALOG.map(f => f.id));

function parseNonNegativeInt(raw) {
  const val = parseInt(raw, 10);
  return isNaN(val) || val < 0 ? null : val;
}

function parseTowerInventory(arr) {
  const map = {};
  if (!Array.isArray(arr)) return map;
  for (const entry of arr) {
    if (entry && typeof entry.Type === 'string') {
      map[entry.Type] = Number(entry.Amount) || 0;
    }
  }
  return map;
}

function buildTowerInventory(amounts, extraTypes) {
  const result = [];
  for (const { id } of FARMER_CATALOG) {
    result.push({ Type: id, Amount: amounts[id] ?? 0 });
  }
  for (const id of extraTypes) {
    result.push({ Type: id, Amount: amounts[id] ?? 0 });
  }
  return result;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPremiumsArray(checkedIds, extraIds) {
  const checked = new Set(checkedIds);
  const result = [];
  for (const { id } of PREMIUM_CATALOG) {
    if (checked.has(id)) result.push(id);
  }
  for (const id of extraIds) {
    if (checked.has(id)) result.push(id);
  }
  return result;
}

function sanitizeSave(obj) {
  const now = Math.floor(Date.now() / 1000);
  let cleared = 0, removed = 0, merged = 0, tsUpdated = 0;

  walkTree(obj, (key, val, parent) => {
    const lower = key.toLowerCase();

    if (lower === 'detectedhacks' && parent[key] !== 0) {
      parent[key] = 0;
      cleared++;
    }

    if (lower === 'streamid') {
      delete parent[key];
      removed++;
    }

    if (lower === 'higherversionprofile' && typeof val === 'string' && val.trim()) {
      try {
        const hvp = JSON.parse(val);
        for (const k of Object.keys(hvp)) {
          if (parent[k] !== undefined) {
            parent[k] = hvp[k];
            merged++;
          }
        }
        delete parent[key];
      } catch {
        // invalid HVP JSON; leave as-is
      }
    }

    if (lower === 'datetime' || lower === 'timestamp') {
      parent[key] = now;
      tsUpdated++;
    }
  });

  if (tsUpdated === 0) {
    obj.DateTime = now;
  }

  return { cleared, removed, merged, tsUpdated, now };
}

function syncFromTree() {
  // Tree edits mutate decryptedJSON in place; raw view needs a parse first
  if (currentView === 'raw') {
    const text = jsonEditor.value.trim();
    if (isValidJSON(text)) decryptedJSON = JSON.parse(text);
  }
}

function walkTree(o, fn) {
  if (o === null || typeof o !== 'object') return;
  for (const key of Object.keys(o)) {
    fn(key, o[key], o);
    walkTree(o[key], fn);
  }
}

function applyEdit(fn) {
  syncFromTree();
  try {
    fn(decryptedJSON);
    if (currentView === 'tree') {
      renderTree();
    } else {
      jsonEditor.value = JSON.stringify(decryptedJSON, null, 2);
      validateJSON();
    }
  } catch {
    /* ignore */
  }
}

sanitizeBtn.addEventListener('click', () => {
  applyEdit(obj => { sanitizeSave(obj); });
});

setMedallionsBtn.addEventListener('click', () => {
  syncFromTree();
  const current = decryptedJSON?.Levels?.Medallions;
  if (current === undefined) return;

  const winsTotal = decryptedJSON.Levels.MedallionWinsTotal ?? 0;
  let page = 0;
  let pendingRaw = '';

  showMedallionPage(current, winsTotal, page);

  openModal({
    onConfirm() {
      if (page === 0) {
        const input = modalBody.querySelector('input');
        const raw = input ? input.value.trim() : '';
        const val = parseNonNegativeInt(raw);
        if (val === null || val === current) return null;
        if (val > 500000) {
          page = 1;
          pendingRaw = raw;
          showMedallionPage(current, winsTotal, page, val);
          return false;
        }
        return raw;
      }
      return pendingRaw;
    }
  }).then((valueStr) => {
    if (valueStr === null) return;
    const value = parseNonNegativeInt(valueStr);
    if (value === null) return;

    applyEdit(obj => {
      if (!obj.Levels) return;
      obj.Levels.Medallions = value;
      const oldWins = obj.Levels.MedallionWinsTotal ?? 0;
      if (value > oldWins) obj.Levels.MedallionWinsTotal = value;
    });
  });
});

setPremiumsBtn.addEventListener('click', () => {
  syncFromTree();
  if (!decryptedJSON?.Items) return;

  const current = Array.isArray(decryptedJSON.Items.Premiums)
    ? [...decryptedJSON.Items.Premiums]
    : [];
  const currentSet = new Set(current);
  const extraIds = current.filter(id => !PREMIUM_CATALOG_IDS.has(id));

  modalTitle.textContent = 'Set Premiums';
  modalBody.innerHTML = buildPremiumsModalHtml(currentSet, extraIds);

  openModal({
    onConfirm() {
      const checked = [...modalBody.querySelectorAll('input[name="premium"]:checked')]
        .map(cb => cb.value);
      if (checked.length === current.length && checked.every(id => currentSet.has(id))) {
        return null;
      }
      return buildPremiumsArray(checked, extraIds);
    }
  }).then((selected) => {
    if (selected === null) return;

    applyEdit(obj => {
      if (!obj.Items) return;
      obj.Items.Premiums = selected;
    });
  });
});

function buildPremiumsModalHtml(currentSet, extraIds) {
  let html = '<div class="modal-field-label">Premiums</div><div class="modal-premium-list">';

  for (const { id, label } of PREMIUM_CATALOG) {
    const checked = currentSet.has(id) ? ' checked' : '';
    html +=
      `<label class="modal-premium-item" title="${escapeHtml(id)}">` +
      `<input type="checkbox" name="premium" value="${escapeHtml(id)}"${checked}>` +
      `<span class="modal-premium-label">` +
      `<span>${escapeHtml(label)}</span>` +
      `<span class="modal-premium-id">${escapeHtml(id)}</span>` +
      `</span></label>`;
  }

  for (const id of extraIds) {
    const checked = currentSet.has(id) ? ' checked' : '';
    html +=
      `<label class="modal-premium-item modal-premium-extra" title="${escapeHtml(id)}">` +
      `<input type="checkbox" name="premium" value="${escapeHtml(id)}"${checked}>` +
      `<span class="modal-premium-label">` +
      `<span>${escapeHtml(id)}</span>` +
      `<span class="modal-premium-id">not in catalog</span>` +
      `</span></label>`;
  }

  html += '</div>';
  return html;
}

setFarmersBtn.addEventListener('click', () => {
  syncFromTree();
  if (!decryptedJSON?.Items) return;

  const rawMap = parseTowerInventory(decryptedJSON.Items.TowerInventory);
  const extraTypes = Object.keys(rawMap).filter(id => !FARMER_CATALOG_IDS.has(id));
  const currentMap = {};
  for (const { id } of FARMER_CATALOG) currentMap[id] = rawMap[id] ?? 0;
  for (const id of extraTypes) currentMap[id] = rawMap[id] ?? 0;

  modalTitle.textContent = 'Set Farmers';
  modalBody.innerHTML = buildFarmersModalHtml(currentMap, extraTypes);

  openModal({
    onConfirm() {
      const amounts = {};
      for (const input of modalBody.querySelectorAll('input[name="farmer-amount"]')) {
        const val = parseNonNegativeInt(input.value.trim());
        if (val === null) return null;
        amounts[input.dataset.type] = val;
      }
      const keys = Object.keys(amounts);
      if (keys.length === Object.keys(currentMap).length && keys.every(k => amounts[k] === currentMap[k])) {
        return null;
      }
      return buildTowerInventory(amounts, extraTypes);
    }
  }).then((inventory) => {
    if (inventory === null) return;

    applyEdit(obj => {
      if (!obj.Items) return;
      obj.Items.TowerInventory = inventory;
    });
  });
});

function buildFarmersModalHtml(currentMap, extraTypes) {
  let html = '<div class="modal-field-label">Tower inventory</div><div class="modal-premium-list">';

  function row(id, label, subtitle, isExtra) {
    const amount = currentMap[id] ?? 0;
    const extraClass = isExtra ? ' modal-premium-extra' : '';
    html +=
      `<div class="modal-premium-item modal-inventory-item${extraClass}" title="${escapeHtml(id)}">` +
      `<span class="modal-premium-label">` +
      `<span>${escapeHtml(label)}</span>` +
      `<span class="modal-premium-id">${escapeHtml(subtitle)}</span>` +
      `</span>` +
      `<input type="number" name="farmer-amount" data-type="${escapeHtml(id)}" value="${amount}" min="0" step="1">` +
      `</div>`;
  }

  for (const { id, label } of FARMER_CATALOG) {
    row(id, label, id, false);
  }
  for (const id of extraTypes) {
    row(id, id, 'not in catalog', true);
  }

  html += '</div>';
  return html;
}

setBattleScoreBtn.addEventListener('click', () => {
  syncFromTree();
  const current = decryptedJSON?.Levels?.BattleScore;
  if (current === undefined) return;

  modalTitle.textContent = 'Set Battle Score';
  modalBody.innerHTML =
    `<div class="modal-info-line"><span>Current Battle Score</span><span class="modal-info-val">${current.toLocaleString()}</span></div>` +
    `<div style="margin-top:0.7rem;">` +
    `<label class="modal-field-label">New score</label>` +
    `<input type="number" id="modal-battle-score-input" value="${current}" min="0" step="1">` +
    `</div>`;

  openModal({
    onConfirm() {
      const input = modalBody.querySelector('#modal-battle-score-input');
      const val = parseNonNegativeInt(input ? input.value.trim() : '');
      if (val === null || val === current) return null;
      return val;
    }
  }).then((value) => {
    if (value === null) return;

    applyEdit(obj => {
      if (!obj.Levels) return;
      obj.Levels.BattleScore = value;
    });
  });
});

function showMedallionPage(current, winsTotal, page, largeVal) {
  if (page === 0) {
    modalTitle.textContent = 'Set Medallions';
    modalBody.innerHTML =
      `<div class="modal-info-line"><span>Current Medallions</span><span class="modal-info-val">${current.toLocaleString()}</span></div>
<div class="modal-info-line"><span>MedallionWinsTotal</span><span class="modal-info-val">${winsTotal.toLocaleString()}</span></div>
<div style="margin-top:0.7rem;">
  <label class="modal-field-label">New amount</label>
  <input type="number" id="modal-medallion-input" value="${current}" min="0" step="1">
</div>
<div class="modal-warning">⚠️ Ninja Kiwi validates Medallions server-side. Values over 500,000 need a second confirm.</div>`;
  } else {
    modalTitle.textContent = 'Confirm';
    modalBody.innerHTML =
      `<p>Set Medallions to <strong>${largeVal.toLocaleString()}</strong>?</p>
<p><code>MedallionWinsTotal</code> will rise to match if it's lower.</p>
<div class="modal-warning">⚠️ <strong>${largeVal.toLocaleString()}</strong> medallions will likely trip server checks.</div>`;
  }
}

function downloadEncryptedSave() {
  const encrypted = nkEncrypt(JSON.stringify(decryptedJSON));
  const blob = new Blob([encrypted], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Profile.save';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

encryptBtn.addEventListener('click', () => {
  if (!decryptedJSON) return;
  if (currentView === 'raw') {
    const text = jsonEditor.value.trim();
    if (!isValidJSON(text)) return;
    decryptedJSON = JSON.parse(text);
  } else {
    syncFromTree();
  }

  modalTitle.textContent = 'Encrypt & Download';
  modalBody.innerHTML =
    `<p>Encrypt the current JSON and download <code>Profile.save</code>.</p>` +
    `<label class="modal-checkbox-row">` +
    `<input type="checkbox" id="export-sanitize-cb" checked>` +
    `<span>Sanitize first <span style="color:var(--text-tertiary)">(zero DetectedHacks, delete StreamID, refresh DateTime)</span></span>` +
    `</label>`;

  openModal({
    onConfirm() {
      const cb = modalBody.querySelector('#export-sanitize-cb');
      return { sanitize: cb ? cb.checked : true };
    }
  }).then((result) => {
    if (result === null) return;

    if (result.sanitize) {
      applyEdit(obj => { sanitizeSave(obj); });
    }

    downloadEncryptedSave();
  });
});

validateBtn.addEventListener('click', validateCRCOnly);
decryptBtn.addEventListener('click', doDecrypt);
