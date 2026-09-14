'use strict';

/**
 * Default configuration for Hangly-Win.
 * This file documents the config schema.
 */
module.exports = {
  version: '1.0.0',

  // General
  showOverlay:       true,
  alwaysOnTop:       true,
  startWithWindows:  false,

  // Appearance
  showStrings:       true,
  stringThickness:   1.5,
  charmSize:         70,
  animationIntensity: 0.5,
  opacity:           1.0,

  // Physics
  gravity:           1.0,
  swingStrength:     0.3,
  damping:           0.02,
  collisionEnabled:  true,
  idleMovement:      true,

  // Default charms
  charms: [
    { id: 'charm-1', type: 'nazar',        anchorX: 0.2,  size: 70 },
    { id: 'charm-2', type: 'hamsa',        anchorX: 0.45, size: 70 },
    { id: 'charm-3', type: 'temple-bell',  anchorX: 0.65, size: 70 },
    { id: 'charm-4', type: 'nimbu-mirchi', anchorX: 0.82, size: 70 }
  ]
};
