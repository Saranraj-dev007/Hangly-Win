'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe, minimal API to the renderer
contextBridge.exposeInMainWorld('hanglyAPI', {
  // Config
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.send('save-config', config),

  // Mouse passthrough control
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),

  // Charm management
  addCharm: (type) => ipcRenderer.send('add-charm', type),
  removeCharm: (charmId) => ipcRenderer.send('remove-charm', charmId),
  duplicateCharm: (charmId) => ipcRenderer.send('duplicate-charm', charmId),
  changeCharmType: (charmId, newType) => ipcRenderer.send('change-charm-type', { charmId, newType }),
  resetPositions: () => ipcRenderer.send('reset-positions'),
  removeAllCharms: () => ipcRenderer.send('remove-all-charms'),
  restoreDefaults: () => ipcRenderer.send('restore-defaults'),
  saveCharmAnchor: (charmId, anchorX) => ipcRenderer.send('save-charm-anchor', { charmId, anchorX }),
  openSettings: () => ipcRenderer.send('open-settings'),

  // Event listeners
  onConfigLoaded: (callback) => ipcRenderer.on('config-loaded', (event, data) => callback(data)),
  onConfigUpdated: (callback) => ipcRenderer.on('config-updated', (event, data) => callback(data)),
  onCharmAdded: (callback) => ipcRenderer.on('charm-added', (event, data) => callback(data)),
  onCharmRemoved: (callback) => ipcRenderer.on('charm-removed', (event, id) => callback(id)),
  onCharmTypeChanged: (callback) => ipcRenderer.on('charm-type-changed', (event, data) => callback(data)),
  onScreenResized: (callback) => ipcRenderer.on('screen-resized', (event, data) => callback(data)),

  // Remove a specific listener
  removeListener: (channel, callback) => ipcRenderer.removeListener(channel, callback)
});
