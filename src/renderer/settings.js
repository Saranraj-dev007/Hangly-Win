'use strict';

/* ════════════════════════════════════════════
   Hangly-Win Settings Window Script
   ════════════════════════════════════════════ */

let currentConfig = null;
let saveDebounce  = null;

// ─────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────
async function init() {
  currentConfig = await window.hanglyAPI.getConfig();
  populateUI(currentConfig);
  bindControls();
  bindActions();
  setupTabNavigation();

  // Listen for config updates from main process
  window.hanglyAPI.onConfigLoaded((cfg) => {
    currentConfig = cfg;
    populateUI(cfg);
  });
}

// ─────────────────────────────────────────────
// Populate UI from config
// ─────────────────────────────────────────────
function populateUI(cfg) {
  // General
  setChecked('startWithWindows', cfg.startWithWindows);
  setChecked('showOverlay',      cfg.showOverlay);
  setChecked('alwaysOnTop',      cfg.alwaysOnTop);

  // Appearance
  setRange('charmSize',           cfg.charmSize,            'px');
  setChecked('showStrings',       cfg.showStrings);
  setRange('stringThickness',     cfg.stringThickness,      '');
  setRange('animationIntensity',  cfg.animationIntensity,   '');

  // Physics
  setRange('gravity',             cfg.gravity,              '');
  setRange('damping',             cfg.damping,              '');
  setRange('swingStrength',       cfg.swingStrength,        '');
  setChecked('collisionEnabled',  cfg.collisionEnabled);
  setChecked('idleMovement',      cfg.idleMovement);
}

function setChecked(id, value) {
  const el = document.getElementById(id);
  if (el) el.checked = !!value;
}

function setRange(id, value, suffix) {
  const el  = document.getElementById(id);
  const val = document.getElementById(id + 'Val');
  if (el) el.value = value;
  if (val) val.textContent = typeof suffix === 'string' ? value + suffix : value;
}

// ─────────────────────────────────────────────
// Bind all controls → auto-save
// ─────────────────────────────────────────────
function bindControls() {
  const controls = [
    // Checkboxes
    'startWithWindows', 'showOverlay', 'alwaysOnTop',
    'showStrings', 'collisionEnabled', 'idleMovement',
    // Ranges
    'charmSize', 'stringThickness', 'animationIntensity',
    'gravity', 'damping', 'swingStrength'
  ];

  controls.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener('change', () => updateConfig());
    el.addEventListener('input',  () => {
      // Live update range value labels
      updateRangeLabel(id);
      scheduleAutoSave();
    });
  });
}

function updateRangeLabel(id) {
  const el  = document.getElementById(id);
  const val = document.getElementById(id + 'Val');
  if (!el || !val) return;

  const suffixes = { charmSize: 'px', stringThickness: '', animationIntensity: '', gravity: '', damping: '', swingStrength: '' };
  const suffix = suffixes[id] !== undefined ? suffixes[id] : '';
  val.textContent = parseFloat(el.value).toFixed(id === 'damping' ? 3 : 2).replace(/\.?0+$/, '') + suffix;
}

function scheduleAutoSave() {
  clearTimeout(saveDebounce);
  saveDebounce = setTimeout(updateConfig, 400);
}

function updateConfig() {
  if (!currentConfig) return;

  const updated = Object.assign({}, currentConfig, {
    startWithWindows:   getChecked('startWithWindows'),
    showOverlay:        getChecked('showOverlay'),
    alwaysOnTop:        getChecked('alwaysOnTop'),
    showStrings:        getChecked('showStrings'),
    collisionEnabled:   getChecked('collisionEnabled'),
    idleMovement:       getChecked('idleMovement'),
    charmSize:          getNumber('charmSize'),
    stringThickness:    getNumber('stringThickness'),
    animationIntensity: getNumber('animationIntensity'),
    gravity:            getNumber('gravity'),
    damping:            getNumber('damping'),
    swingStrength:      getNumber('swingStrength')
  });

  currentConfig = updated;
  window.hanglyAPI.saveConfig(updated);
  showSaveToast();
}

function getChecked(id) {
  const el = document.getElementById(id);
  return el ? el.checked : false;
}

function getNumber(id) {
  const el = document.getElementById(id);
  return el ? parseFloat(el.value) : 0;
}

// ─────────────────────────────────────────────
// Action buttons
// ─────────────────────────────────────────────
function bindActions() {
  // Add charm buttons
  document.querySelectorAll('[data-add-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.hanglyAPI.addCharm(btn.dataset.addType);
      showSaveToast('Charm added!');
    });
  });

  // Reset positions
  document.getElementById('resetPositions').addEventListener('click', () => {
    window.hanglyAPI.resetPositions();
    showSaveToast('Positions reset!');
  });

  // Remove all
  document.getElementById('removeAllCharms').addEventListener('click', () => {
    if (confirm('Remove all charms?')) {
      window.hanglyAPI.removeAllCharms();
      showSaveToast('All charms removed.');
    }
  });

  // Restore defaults
  document.getElementById('restoreDefaults').addEventListener('click', () => {
    if (confirm('Restore all settings to defaults?')) {
      window.hanglyAPI.restoreDefaults();
      showSaveToast('Defaults restored!');
    }
  });
}

// ─────────────────────────────────────────────
// Tab navigation
// ─────────────────────────────────────────────
function setupTabNavigation() {
  const tabs = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const panel = document.getElementById('tab-' + btn.dataset.tab);
      if (panel) panel.classList.add('active');
    });
  });
}

// ─────────────────────────────────────────────
// Toast notification
// ─────────────────────────────────────────────
let toastTimer = null;

function showSaveToast(msg) {
  const toast = document.getElementById('save-toast');
  toast.textContent = '✓ ' + (msg || 'Settings saved');
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2000);
}

// ─────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
