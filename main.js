'use strict';

const { app, BrowserWindow, Tray, Menu, ipcMain, screen, dialog, nativeImage } = require('electron');
const path = require('path');
const fs   = require('fs');

// ─── Fix transparent window compositing BEFORE app is ready ───
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('enable-transparent-visuals');
// Disable CORS for local files (not needed — but keep if loading local assets)
// app.commandLine.appendSwitch('disable-web-security');

// ─────────────────────────────────────────────
// Config / persistence
// ─────────────────────────────────────────────
const CONFIG_PATH = path.join(app.getPath('userData'), 'hanglywin-config.json');

const DEFAULT_CONFIG = {
  version: '1.0.0',
  showOverlay:        true,
  alwaysOnTop:        true,
  startWithWindows:   false,
  showStrings:        true,
  stringThickness:    1.5,
  charmSize:          70,
  animationIntensity: 0.5,
  gravity:            1.0,
  swingStrength:      0.3,
  damping:            0.02,
  collisionEnabled:   true,
  idleMovement:       true,
  opacity:            1.0,
  charms: [
    { id: 'charm-1', type: 'nazar',        anchorX: 0.20, size: 70 },
    { id: 'charm-2', type: 'hamsa',        anchorX: 0.42, size: 70 },
    { id: 'charm-3', type: 'temple-bell',  anchorX: 0.63, size: 70 },
    { id: 'charm-4', type: 'nimbu-mirchi', anchorX: 0.82, size: 70 }
  ]
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw    = fs.readFileSync(CONFIG_PATH, 'utf8');
      const loaded = JSON.parse(raw);
      // Deep-merge charms array: prefer saved charms if present
      const merged = Object.assign({}, DEFAULT_CONFIG, loaded);
      if (!Array.isArray(merged.charms) || merged.charms.length === 0) {
        merged.charms = DEFAULT_CONFIG.charms.map(c => ({ ...c }));
      }
      return merged;
    }
  } catch (e) {
    console.warn('[HanglyWin] Config load failed, using defaults:', e.message);
  }
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (e) {
    console.error('[HanglyWin] Config save failed:', e.message);
  }
}

let appConfig = loadConfig();

// ─────────────────────────────────────────────
// State
// ─────────────────────────────────────────────
let overlayWindow  = null;
let settingsWindow = null;
let tray           = null;
const isDev        = process.argv.includes('--dev');

// ─────────────────────────────────────────────
// Overlay window
// ─────────────────────────────────────────────
function createOverlayWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  // Use full display bounds so overlay covers the whole screen incl. taskbar area
  const { width, height } = primaryDisplay.bounds;

  overlayWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    transparent:    true,
    frame:          false,
    alwaysOnTop:    appConfig.alwaysOnTop,
    skipTaskbar:    true,
    resizable:      false,
    movable:        false,
    focusable:      true,
    hasShadow:      false,
    roundedCorners: false,
    type:           'toolbar',        // Windows: helps with transparency
    webPreferences: {
      preload:              path.join(__dirname, 'preload.js'),
      contextIsolation:     true,
      nodeIntegration:      false,
      devTools:             isDev,
      backgroundThrottling: false,
      webSecurity:          true
    }
  });

  // Start fully click-through; renderer will toggle per-hover
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  overlayWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));

  if (isDev) {
    overlayWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Send config after renderer is loaded
  overlayWindow.webContents.on('did-finish-load', () => {
    if (overlayWindow) {
      overlayWindow.webContents.send('config-loaded', appConfig);
    }
  });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });

  // Handle display changes (resolution, DPI, monitor add/remove)
  screen.on('display-metrics-changed', handleDisplayChange);
  screen.on('display-added',           handleDisplayChange);
  screen.on('display-removed',         handleDisplayChange);
}

function handleDisplayChange() {
  if (!overlayWindow) return;
  const d = screen.getPrimaryDisplay();
  const { width, height } = d.bounds;
  overlayWindow.setBounds({ x: 0, y: 0, width, height });
  if (overlayWindow.webContents) {
    overlayWindow.webContents.send('screen-resized', { width, height });
  }
}

// ─────────────────────────────────────────────
// Settings window
// ─────────────────────────────────────────────
function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width:       520,
    height:      700,
    title:       'Hangly-Win — Settings',
    frame:       true,
    resizable:   false,
    minimizable: true,
    maximizable: false,
    center:      true,
    skipTaskbar: false,
    icon:        path.join(__dirname, 'assets', 'icons', 'icon.png'),
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      devTools:         isDev
    }
  });

  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'settings.html'));

  settingsWindow.webContents.on('did-finish-load', () => {
    if (settingsWindow) {
      settingsWindow.webContents.send('config-loaded', appConfig);
    }
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// ─────────────────────────────────────────────
// System Tray
// ─────────────────────────────────────────────
function buildTrayIcon() {
  // Try dedicated tray PNG first, fall back to resized main icon
  const trayPngPath = path.join(__dirname, 'assets', 'icons', 'tray-icon.png');
  const mainJpgPath = path.join(__dirname, 'assets', 'icons', 'icon.jpg');

  if (fs.existsSync(trayPngPath)) {
    return nativeImage.createFromPath(trayPngPath);
  }
  if (fs.existsSync(mainJpgPath)) {
    return nativeImage.createFromPath(mainJpgPath).resize({ width: 16, height: 16 });
  }
  return nativeImage.createEmpty();
}

function createTray() {
  try {
    tray = new Tray(buildTrayIcon());
  } catch (e) {
    console.error('[HanglyWin] Tray creation failed:', e.message);
    return;
  }

  tray.setToolTip('Hangly-Win');
  updateTrayMenu();

  tray.on('double-click', toggleOverlay);
}

function updateTrayMenu() {
  if (!tray || tray.isDestroyed()) return;

  const menu = Menu.buildFromTemplate([
    {
      label: '🧿 Hangly-Win',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Show Overlay',
      type: 'checkbox',
      checked: appConfig.showOverlay,
      click: (item) => {
        appConfig.showOverlay = item.checked;
        saveConfig(appConfig);
        if (overlayWindow) {
          if (appConfig.showOverlay) overlayWindow.show();
          else overlayWindow.hide();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Add Charm',
      submenu: [
        { label: '🧿 Nazar',        click: () => addCharm('nazar') },
        { label: '🪬 Hamsa',        click: () => addCharm('hamsa') },
        { label: '🍋 Nimbu-Mirchi', click: () => addCharm('nimbu-mirchi') },
        { label: '🔔 Temple Bell',  click: () => addCharm('temple-bell') }
      ]
    },
    { type: 'separator' },
    { label: '⚙️  Settings', click: createSettingsWindow },
    { type: 'separator' },
    {
      label: 'Always on Top',
      type: 'checkbox',
      checked: appConfig.alwaysOnTop,
      click: (item) => {
        appConfig.alwaysOnTop = item.checked;
        saveConfig(appConfig);
        if (overlayWindow) overlayWindow.setAlwaysOnTop(appConfig.alwaysOnTop);
      }
    },
    {
      label: 'Start with Windows',
      type: 'checkbox',
      checked: appConfig.startWithWindows,
      click: (item) => {
        appConfig.startWithWindows = item.checked;
        saveConfig(appConfig);
        setStartWithWindows(item.checked);
      }
    },
    { type: 'separator' },
    { label: 'ℹ️  About', click: showAbout },
    { type: 'separator' },
    {
      label: '✕ Quit Hangly-Win',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(menu);
}

function toggleOverlay() {
  if (!overlayWindow) return;
  if (overlayWindow.isVisible()) {
    overlayWindow.hide();
    appConfig.showOverlay = false;
  } else {
    overlayWindow.show();
    appConfig.showOverlay = true;
  }
  saveConfig(appConfig);
  updateTrayMenu();
}

// ─────────────────────────────────────────────
// Charm management
// ─────────────────────────────────────────────
function generateId() {
  return 'charm-' + Date.now() + '-' + (Math.random() * 1e6 | 0);
}

function addCharm(type) {
  const id = generateId();

  // Find an open position along the top
  const usedX = appConfig.charms.map(c => c.anchorX);
  let anchorX = 0.5;
  for (let x = 0.08; x <= 0.92; x += 0.1) {
    const rx = Math.round(x * 100) / 100;
    if (!usedX.some(u => Math.abs(u - rx) < 0.07)) {
      anchorX = rx;
      break;
    }
  }

  const newCharm = { id, type, anchorX, size: appConfig.charmSize };
  appConfig.charms.push(newCharm);
  saveConfig(appConfig);

  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('charm-added', newCharm);
  }
}

// ─────────────────────────────────────────────
// System startup
// ─────────────────────────────────────────────
function setStartWithWindows(enabled) {
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path:        app.getPath('exe'),
      args:        []
    });
  } catch (e) {
    console.warn('[HanglyWin] setLoginItemSettings failed:', e.message);
  }
}

// ─────────────────────────────────────────────
// About dialog
// ─────────────────────────────────────────────
function showAbout() {
  dialog.showMessageBox({
    type:    'info',
    title:   'About Hangly-Win',
    message: 'Hangly-Win  v1.0.0',
    detail: [
      'Lightweight physics-based desktop charms for Windows.',
      '',
      'Charms hang from the top of your screen and swing',
      'with realistic 2D physics powered by Matter.js.',
      '',
      'Built with: Electron · Matter.js · JavaScript',
      '© 2024 Hangly-Win · MIT License'
    ].join('\n'),
    buttons: ['OK']
  });
}

// ─────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────

// Mouse click-through toggle
ipcMain.on('set-ignore-mouse', (event, ignore) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.setIgnoreMouseEvents(ignore, { forward: true });
  }
});

// Config getters / setters
ipcMain.handle('get-config', () => appConfig);

ipcMain.on('save-config', (event, newConfig) => {
  const prev = { showOverlay: appConfig.showOverlay, alwaysOnTop: appConfig.alwaysOnTop };

  // Never let renderer overwrite the charms array via save-config
  // (charms are managed via their own IPC messages to avoid race conditions)
  const { charms: _ignore, ...rest } = newConfig;
  appConfig = Object.assign({}, appConfig, rest);
  saveConfig(appConfig);

  // Side effects
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    if (prev.alwaysOnTop !== appConfig.alwaysOnTop) {
      overlayWindow.setAlwaysOnTop(appConfig.alwaysOnTop);
    }
    if (prev.showOverlay !== appConfig.showOverlay) {
      if (appConfig.showOverlay) overlayWindow.show();
      else overlayWindow.hide();
    }
    overlayWindow.webContents.send('config-updated', appConfig);
  }

  setStartWithWindows(appConfig.startWithWindows);
  updateTrayMenu();

  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('config-loaded', appConfig);
  }
});

// Charm IPC
ipcMain.on('add-charm', (event, type) => addCharm(type));

ipcMain.on('remove-charm', (event, charmId) => {
  appConfig.charms = appConfig.charms.filter(c => c.id !== charmId);
  saveConfig(appConfig);
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('charm-removed', charmId);
  }
});

ipcMain.on('change-charm-type', (event, { charmId, newType }) => {
  const charm = appConfig.charms.find(c => c.id === charmId);
  if (charm) {
    charm.type = newType;
    saveConfig(appConfig);
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('charm-type-changed', { charmId, newType });
    }
  }
});

ipcMain.on('duplicate-charm', (event, charmId) => {
  const src = appConfig.charms.find(c => c.id === charmId);
  if (!src) return;
  const newCharm = { ...src, id: generateId(), anchorX: Math.min(src.anchorX + 0.08, 0.93) };
  appConfig.charms.push(newCharm);
  saveConfig(appConfig);
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('charm-added', newCharm);
  }
});

ipcMain.on('reset-positions', () => {
  const count = appConfig.charms.length;
  const spacing = count > 1 ? 0.8 / (count - 1) : 0;
  appConfig.charms.forEach((c, i) => {
    c.anchorX = count === 1 ? 0.5 : 0.1 + i * spacing;
  });
  saveConfig(appConfig);
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('config-loaded', appConfig);
  }
});

ipcMain.on('remove-all-charms', () => {
  appConfig.charms = [];
  saveConfig(appConfig);
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('config-loaded', appConfig);
  }
});

ipcMain.on('restore-defaults', () => {
  appConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  saveConfig(appConfig);
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('config-loaded', appConfig);
  }
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('config-loaded', appConfig);
  }
});

ipcMain.on('save-charm-anchor', (event, { charmId, anchorX }) => {
  const charm = appConfig.charms.find(c => c.id === charmId);
  if (charm) {
    charm.anchorX = Math.max(0.01, Math.min(0.99, anchorX));
    saveConfig(appConfig);
  }
});

ipcMain.on('open-settings', () => createSettingsWindow());

// ─────────────────────────────────────────────
// App lifecycle
// ─────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (settingsWindow) settingsWindow.focus();
    else if (overlayWindow) overlayWindow.focus();
  });
}

app.whenReady().then(() => {
  createOverlayWindow();
  createTray();

  if (!appConfig.showOverlay && overlayWindow) {
    overlayWindow.hide();
  }
  setStartWithWindows(appConfig.startWithWindows);
});

app.on('window-all-closed', (e) => {
  // Keep running in tray — only quit via tray menu
  if (!app.isQuitting) {
    e.preventDefault();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

// macOS dock click — not needed for Windows but harmless
app.on('activate', () => {
  if (!overlayWindow) createOverlayWindow();
});
