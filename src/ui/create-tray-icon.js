/**
 * create-tray-icon.js
 * Creates a simple tray icon PNG using the Electron nativeImage API.
 * Run: node create-tray-icon.js
 */
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const size = 32;
const canvas = createCanvas(size, size);
const ctx = canvas.getContext('2d');

// Background
ctx.fillStyle = 'transparent';
ctx.clearRect(0, 0, size, size);

// Draw evil eye circle
ctx.beginPath();
ctx.arc(16, 18, 12, 0, Math.PI * 2);
ctx.fillStyle = '#1a3a6e';
ctx.fill();

// White ring
ctx.beginPath();
ctx.arc(16, 18, 8, 0, Math.PI * 2);
ctx.fillStyle = '#ffffff';
ctx.fill();

// Light blue iris
ctx.beginPath();
ctx.arc(16, 18, 5, 0, Math.PI * 2);
ctx.fillStyle = '#7ec8e3';
ctx.fill();

// Pupil
ctx.beginPath();
ctx.arc(16, 18, 2.5, 0, Math.PI * 2);
ctx.fillStyle = '#111111';
ctx.fill();

// String
ctx.strokeStyle = '#c8a84b';
ctx.lineWidth = 1.5;
ctx.beginPath();
ctx.moveTo(16, 1);
ctx.lineTo(16, 6);
ctx.stroke();

// Anchor dot
ctx.beginPath();
ctx.arc(16, 2, 2, 0, Math.PI * 2);
ctx.fillStyle = '#c8a84b';
ctx.fill();

const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(path.join(__dirname, '..', '..', 'assets', 'icons', 'tray-icon.png'), buffer);
console.log('Tray icon created!');
