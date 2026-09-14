'use strict';

/* ════════════════════════════════════════════════════════════════
   Hangly-Win — Overlay Renderer
   Controls Matter.js physics, charm rendering, drag, context menu
   ════════════════════════════════════════════════════════════════ */

const { Engine, Render, Runner, Bodies, Body, Composite, Constraint,
        Mouse, MouseConstraint, Events, Vector } = Matter;

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const CHARM_IMAGES = {
  'nazar':        '../../assets/charms/nazar.jpg',
  'hamsa':        '../../assets/charms/hamsa.jpg',
  'nimbu-mirchi': '../../assets/charms/nimbu-mirchi.jpg',
  'temple-bell':  '../../assets/charms/temple-bell.jpg'
};

const ANCHOR_Y   = 2;      // pixels from top
const STRING_LENGTH_BASE = 120; // px
const IDLE_FORCE = 0.00002;     // Very small nudge for idle motion
const IDLE_INTERVAL = 3000;     // ms between idle nudges
const MAX_ANGULAR_VELOCITY = 0.6;
const MAX_SPEED = 15;

// ─────────────────────────────────────────────
// State
// ─────────────────────────────────────────────
let config = null;
let engine = null;
let runner = null;
let canvas = null;
let ctx = null;
let W = window.innerWidth;
let H = window.innerHeight;

// Map: charmId → { body, anchor, constraint, el, config }
const charms = new Map();

let contextMenuTargetId = null;
let isDragging = false;
let dragCharmId = null;
let mouseConstraint = null;
let idleTimer = null;
let isOverCharm = false;
let animFrameId = null;

// ─────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────
async function init() {
  config = await window.hanglyAPI.getConfig();
  setupCanvas();
  setupPhysics();
  setupIdleMotion();
  setupMouseHandlers();
  setupContextMenu();
  setupIPCListeners();

  // Build charms from config
  for (const charmCfg of config.charms) {
    createCharm(charmCfg);
  }

  startRenderLoop();
}

// ─────────────────────────────────────────────
// Canvas
// ─────────────────────────────────────────────
function setupCanvas() {
  canvas = document.getElementById('physics-canvas');
  canvas.width  = W;
  canvas.height = H;
  ctx = canvas.getContext('2d');
}

// ─────────────────────────────────────────────
// Physics Engine
// ─────────────────────────────────────────────
function setupPhysics() {
  engine = Engine.create({
    gravity: { x: 0, y: config.gravity },
    positionIterations: 6,
    velocityIterations: 4
  });

  runner = Runner.create({ delta: 1000 / 60 });
  Runner.run(runner, engine);
}

// ─────────────────────────────────────────────
// Charm Creation
// ─────────────────────────────────────────────
function createCharm(charmCfg) {
  const size  = charmCfg.size || config.charmSize || 70;
  const ax    = Math.round(charmCfg.anchorX * W);
  const ay    = ANCHOR_Y;
  const stringLen = STRING_LENGTH_BASE + Math.random() * 40; // slight variance

  // Physics body (circle approximation for physics, image for visuals)
  const body = Bodies.circle(ax, ay + stringLen, size * 0.42, {
    restitution: 0.3,
    friction:    0.01,
    frictionAir: config.damping,
    density:     0.002,
    label:       charmCfg.id,
    collisionFilter: {
      category: 0x0001,
      mask:     config.collisionEnabled ? 0x0001 : 0x0000
    }
  });

  // Fixed anchor (static)
  const anchor = Bodies.circle(ax, ay, 4, {
    isStatic: true,
    collisionFilter: { mask: 0x0000 },
    render: { visible: false }
  });

  // Pendulum constraint
  const constraint = Constraint.create({
    bodyA: anchor,
    bodyB: body,
    length:  stringLen,
    stiffness: 1.0,
    damping:  0.02,
    render: { visible: false }
  });

  Composite.add(engine.world, [body, anchor, constraint]);

  // DOM element
  const el = createCharmElement(charmCfg.id, charmCfg.type, size);
  document.getElementById('charms-container').appendChild(el);

  charms.set(charmCfg.id, {
    body,
    anchor,
    constraint,
    el,
    config: { ...charmCfg, size, stringLen }
  });

  // Give it a slight initial nudge
  setTimeout(() => {
    if (charms.has(charmCfg.id)) {
      Body.applyForce(body, body.position, {
        x: (Math.random() - 0.5) * 0.0005,
        y: 0
      });
    }
  }, 200 + Math.random() * 800);
}

function createCharmElement(id, type, size) {
  const el = document.createElement('div');
  el.className = 'charm';
  el.dataset.id = id;
  el.style.width  = size + 'px';
  el.style.height = size + 'px';

  const img = document.createElement('img');
  img.src = CHARM_IMAGES[type] || CHARM_IMAGES['nazar'];
  img.alt = type;
  img.draggable = false;
  el.appendChild(img);

  return el;
}

// ─────────────────────────────────────────────
// Remove Charm
// ─────────────────────────────────────────────
function removeCharm(id) {
  const charm = charms.get(id);
  if (!charm) return;

  Composite.remove(engine.world, charm.body);
  Composite.remove(engine.world, charm.anchor);
  Composite.remove(engine.world, charm.constraint);
  charm.el.remove();
  charms.delete(id);
}

// ─────────────────────────────────────────────
// Change Charm Type
// ─────────────────────────────────────────────
function changeCharmType(id, newType) {
  const charm = charms.get(id);
  if (!charm) return;
  charm.config.type = newType;
  const img = charm.el.querySelector('img');
  if (img) {
    img.src = CHARM_IMAGES[newType] || CHARM_IMAGES['nazar'];
    img.alt = newType;
  }
}

// ─────────────────────────────────────────────
// Render Loop
// ─────────────────────────────────────────────
function startRenderLoop() {
  function loop() {
    animFrameId = requestAnimationFrame(loop);
    renderFrame();
  }
  loop();
}

function renderFrame() {
  // Clear canvas
  ctx.clearRect(0, 0, W, H);

  // Clamp physics values to prevent explosions
  charms.forEach(({ body, anchor, constraint, el, config: charmCfg }) => {
    // Speed clamping
    const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2);
    if (speed > MAX_SPEED) {
      Body.setVelocity(body, {
        x: (body.velocity.x / speed) * MAX_SPEED,
        y: (body.velocity.y / speed) * MAX_SPEED
      });
    }

    // Angular velocity clamping
    if (Math.abs(body.angularVelocity) > MAX_ANGULAR_VELOCITY) {
      Body.setAngularVelocity(body, Math.sign(body.angularVelocity) * MAX_ANGULAR_VELOCITY);
    }

    // Keep body from escaping screen
    if (body.position.y > H - 20) {
      Body.setPosition(body, { x: body.position.x, y: H - 20 });
      Body.setVelocity(body, { x: body.velocity.x * 0.5, y: 0 });
    }
    if (body.position.x < 10) {
      Body.setPosition(body, { x: 10, y: body.position.y });
      Body.setVelocity(body, { x: 0, y: body.velocity.y });
    }
    if (body.position.x > W - 10) {
      Body.setPosition(body, { x: W - 10, y: body.position.y });
      Body.setVelocity(body, { x: 0, y: body.velocity.y });
    }

    // Draw string
    if (config && config.showStrings) {
      drawString(anchor.position, body.position, charmCfg);
    }

    // Update DOM element position
    const size = charmCfg.size;
    const x = body.position.x - size / 2;
    const y = body.position.y - size / 2;
    const angle = body.angle;

    el.style.transform = `translate(${x}px, ${y}px) rotate(${angle}rad)`;
  });
}

function drawString(from, to, charmCfg) {
  const thickness = (config && config.stringThickness) || 1.5;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);

  // Slight curve for natural look
  const midX = (from.x + to.x) / 2 + (to.x - from.x) * 0.05;
  const midY = (from.y + to.y) / 2 + 8;
  ctx.quadraticCurveTo(midX, midY, to.x, to.y);

  ctx.strokeStyle = 'rgba(180, 160, 120, 0.65)';
  ctx.lineWidth   = thickness;
  ctx.lineCap     = 'round';
  ctx.stroke();

  // Draw anchor dot
  ctx.beginPath();
  ctx.arc(from.x, from.y, 2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(200, 180, 140, 0.8)';
  ctx.fill();
}

// ─────────────────────────────────────────────
// Idle Motion
// ─────────────────────────────────────────────
function setupIdleMotion() {
  function nudge() {
    if (!config || !config.idleMovement) return;
    charms.forEach(({ body }) => {
      // Only nudge if nearly still
      const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2);
      if (speed < 0.3) {
        const force = IDLE_FORCE * (config.animationIntensity || 0.5);
        Body.applyForce(body, body.position, {
          x: (Math.random() - 0.5) * force * 2,
          y: 0
        });
      }
    });
  }

  idleTimer = setInterval(nudge, IDLE_INTERVAL);
}

// ─────────────────────────────────────────────
// Mouse / Drag Handling
// ─────────────────────────────────────────────
function setupMouseHandlers() {
  const container = document.getElementById('charms-container');

  // Track mouse over charms for click-through
  document.addEventListener('mousemove', (e) => {
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const charmEl = target && target.closest('.charm');
    const newOverCharm = !!charmEl;

    if (newOverCharm !== isOverCharm) {
      isOverCharm = newOverCharm;
      window.hanglyAPI.setIgnoreMouse(!isOverCharm);
    }
  });

  // Mousedown on charm → start drag
  container.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // Left click only
    const charmEl = e.target.closest('.charm');
    if (!charmEl) return;

    e.preventDefault();
    e.stopPropagation();

    const id = charmEl.dataset.id;
    startDrag(id, e.clientX, e.clientY);
  });

  // Mousemove → update drag
  document.addEventListener('mousemove', (e) => {
    if (isDragging && dragCharmId) {
      updateDrag(e.clientX, e.clientY);
    }
  });

  // Mouseup → end drag
  document.addEventListener('mouseup', (e) => {
    if (isDragging) {
      endDrag();
    }
  });
}

let dragStartPos = null;
let dragOffset = { x: 0, y: 0 };
let prevMousePos = { x: 0, y: 0 };
let mouseVelocity = { x: 0, y: 0 };
let lastMouseTime = 0;

function startDrag(id, mx, my) {
  const charm = charms.get(id);
  if (!charm) return;

  isDragging   = true;
  dragCharmId  = id;

  dragOffset = {
    x: mx - charm.body.position.x,
    y: my - charm.body.position.y
  };

  prevMousePos  = { x: mx, y: my };
  lastMouseTime = performance.now();
  mouseVelocity = { x: 0, y: 0 };

  charm.el.classList.add('dragging');

  // Make body kinematic-ish during drag
  Body.setStatic(charm.body, false);
}

function updateDrag(mx, my) {
  const charm = charms.get(dragCharmId);
  if (!charm) return;

  const now = performance.now();
  const dt  = (now - lastMouseTime) || 16;

  mouseVelocity = {
    x: (mx - prevMousePos.x) / dt * 16,
    y: (my - prevMousePos.y) / dt * 16
  };

  prevMousePos  = { x: mx, y: my };
  lastMouseTime = now;

  const targetX = mx - dragOffset.x;
  const targetY = my - dragOffset.y;

  Body.setPosition(charm.body, { x: targetX, y: targetY });
  Body.setVelocity(charm.body, { x: 0, y: 0 });
}

function endDrag() {
  const charm = charms.get(dragCharmId);
  if (charm) {
    charm.el.classList.remove('dragging');

    // Release with momentum
    Body.setVelocity(charm.body, {
      x: mouseVelocity.x * 0.8,
      y: mouseVelocity.y * 0.8
    });

    // Save new anchor X position
    const newAnchorX = charm.body.position.x / W;
    Body.setPosition(charm.anchor, {
      x: charm.body.position.x,
      y: ANCHOR_Y
    });
    Body.setVelocity(charm.body, { x: mouseVelocity.x * 0.8, y: mouseVelocity.y * 0.8 });

    window.hanglyAPI.saveCharmAnchor(dragCharmId, Math.max(0.02, Math.min(0.98, newAnchorX)));
  }

  isDragging  = false;
  dragCharmId = null;
  mouseVelocity = { x: 0, y: 0 };
}

// ─────────────────────────────────────────────
// Context Menu
// ─────────────────────────────────────────────
function setupContextMenu() {
  const menu = document.getElementById('context-menu');
  const container = document.getElementById('charms-container');

  // Right-click on charm
  container.addEventListener('contextmenu', (e) => {
    const charmEl = e.target.closest('.charm');
    if (!charmEl) return;
    e.preventDefault();

    contextMenuTargetId = charmEl.dataset.id;
    showContextMenu(e.clientX, e.clientY);
  });

  // Menu item clicks
  menu.addEventListener('click', (e) => {
    const item = e.target.closest('.menu-item');
    if (!item) return;

    const action = item.dataset.action;
    const type   = item.dataset.type;
    const id     = contextMenuTargetId;

    hideContextMenu();

    switch (action) {
      case 'change':
        if (id && type) {
          changeCharmType(id, type);
          window.hanglyAPI.changeCharmType(id, type);
        }
        break;
      case 'duplicate':
        if (id) window.hanglyAPI.duplicateCharm(id);
        break;
      case 'remove':
        if (id) {
          removeCharm(id);
          window.hanglyAPI.removeCharm(id);
        }
        break;
      case 'reset-position':
        if (id) resetCharmPosition(id);
        break;
      case 'open-settings':
        window.hanglyAPI.openSettings();
        break;
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!menu.classList.contains('hidden') && !menu.contains(e.target)) {
      hideContextMenu();
    }
  });

  // Prevent context menu from triggering overlay context menu
  menu.addEventListener('contextmenu', (e) => e.preventDefault());
}

function showContextMenu(x, y) {
  const menu = document.getElementById('context-menu');
  menu.classList.remove('hidden');

  // Clamp to screen
  const mw = menu.offsetWidth  || 190;
  const mh = menu.offsetHeight || 220;
  const cx = Math.min(x, W - mw - 8);
  const cy = Math.min(y, H - mh - 8);

  menu.style.left = cx + 'px';
  menu.style.top  = cy + 'px';
}

function hideContextMenu() {
  const menu = document.getElementById('context-menu');
  menu.classList.add('hidden');
  contextMenuTargetId = null;
}

function resetCharmPosition(id) {
  const charm = charms.get(id);
  if (!charm) return;

  const ax = charm.anchor.position.x;
  Body.setPosition(charm.body, { x: ax, y: ANCHOR_Y + charm.config.stringLen });
  Body.setVelocity(charm.body, { x: 0, y: 0 });
  Body.setAngularVelocity(charm.body, 0);
  Body.setAngle(charm.body, 0);
}

// ─────────────────────────────────────────────
// IPC Listeners
// ─────────────────────────────────────────────
function setupIPCListeners() {
  window.hanglyAPI.onConfigLoaded((newConfig) => {
    applyConfig(newConfig);
  });

  window.hanglyAPI.onConfigUpdated((newConfig) => {
    applyConfig(newConfig);
  });

  window.hanglyAPI.onCharmAdded((charmCfg) => {
    if (!charms.has(charmCfg.id)) {
      createCharm(charmCfg);
    }
  });

  window.hanglyAPI.onCharmRemoved((charmId) => {
    removeCharm(charmId);
  });

  window.hanglyAPI.onCharmTypeChanged(({ charmId, newType }) => {
    changeCharmType(charmId, newType);
  });

  window.hanglyAPI.onScreenResized(({ width, height }) => {
    W = width;
    H = height;
    canvas.width  = W;
    canvas.height = H;
  });
}

function applyConfig(newConfig) {
  config = newConfig;

  // Update engine gravity
  if (engine) {
    engine.gravity.y = config.gravity;
  }

  // Update charm friction (damping)
  charms.forEach(({ body }) => {
    body.frictionAir = config.damping;
  });

  // Update collision filters
  charms.forEach(({ body }) => {
    body.collisionFilter.mask = config.collisionEnabled ? 0x0001 : 0x0000;
  });

  // Rebuild charms if the set changed
  const newIds  = new Set((config.charms || []).map(c => c.id));
  const oldIds  = new Set(charms.keys());

  // Remove charms not in new config
  oldIds.forEach(id => {
    if (!newIds.has(id)) removeCharm(id);
  });

  // Add charms from new config that don't exist
  (config.charms || []).forEach(charmCfg => {
    if (!charms.has(charmCfg.id)) {
      createCharm(charmCfg);
    }
  });
}

// ─────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
