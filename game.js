// ============================================================
//  CAPYBARA RUN!  –  A 2D Endless Runner
//  Jump over obstacles and survive as long as you can!
//
//  HOW IT WORKS (great for learning!):
//    1. We draw everything onto an HTML <canvas> element.
//    2. requestAnimationFrame runs our loop ~60 times per second.
//    3. Each frame we: update positions → check collisions → draw.
// ============================================================

// ── Setup ────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

// The "logical" size of the game world (always 900 × 500 inside).
// CSS will scale the canvas element to fit the screen.
canvas.width  = 900;
canvas.height = 500;

function resizeCanvas() {
  const w = Math.min(window.innerWidth - 32, 900);
  canvas.style.width  = w + 'px';
  canvas.style.height = Math.round(w * (500 / 900)) + 'px';
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ── Constants ─────────────────────────────────────────────────
const GROUND    = 430;   // y-coordinate of the ground surface
const GRAVITY   = 0.70;  // pulls the capybara down each frame
const JUMP_VEL  = -13;   // upward velocity when jumping (negative = up)
const BASE_SPD  = 5;     // starting scroll speed (pixels per frame)

// ── Game state ────────────────────────────────────────────────
// state can be: 'start' | 'playing' | 'over'
let state     = 'start';
let score     = 0;
let highScore = 0;
let speed     = BASE_SPD;
let frame     = 0;        // counts frames while playing
let nextSpawn = 90;       // pixels until next obstacle spawn

// ── Capybara object ───────────────────────────────────────────
const capy = {
  x: 130,
  y: GROUND - 52,   // top-left corner of the bounding box
  w: 88,
  h: 52,
  vy: 0,            // vertical velocity
  grounded: true,   // is the capybara on the ground?
  jumpsLeft: 2,     // allows one double-jump
  legPhase: 0,      // drives the leg-swing animation
  blinkIn: 120,     // frames until next blink
  blinking: false,
};

// ── World objects ─────────────────────────────────────────────
let obstacles = [];   // array of obstacle objects
let clouds    = [];   // array of cloud objects

// ── Ground decoration (small dots that scroll for speed feel) ─
let groundDots = [];
for (let i = 0; i < 20; i++) {
  groundDots.push({
    x: Math.random() * canvas.width,
    y: GROUND + 6 + Math.random() * 18,
    r: 1 + Math.random() * 2,
  });
}

// =============================================================
//  INPUT
// =============================================================
function onAction() {
  if (state === 'start' || state === 'over') {
    startGame();
    return;
  }
  // Jump (or double-jump)
  if (capy.jumpsLeft > 0) {
    capy.vy        = JUMP_VEL;
    capy.grounded  = false;
    capy.jumpsLeft--;
  }
}

document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    onAction();
  }
});
canvas.addEventListener('pointerdown', onAction);

// =============================================================
//  GAME FLOW
// =============================================================
function startGame() {
  score      = 0;
  speed      = BASE_SPD;
  frame      = 0;
  nextSpawn  = 90;
  obstacles  = [];

  capy.y         = GROUND - capy.h;
  capy.vy        = 0;
  capy.grounded  = true;
  capy.jumpsLeft = 2;

  state = 'playing';
}

function endGame() {
  if (score > highScore) highScore = score;
  state = 'over';
}

// =============================================================
//  OBSTACLES
// =============================================================
// Each obstacle definition: type name, width, height.
// The game picks one at random each spawn.
const OBS_DEFS = [
  { type: 'log',      w: 46, h: 38 },
  { type: 'log',      w: 46, h: 38 },   // listed twice = more common
  { type: 'cactus',   w: 32, h: 64 },
  { type: 'cactus',   w: 32, h: 64 },
  { type: 'bigCactus',w: 36, h: 92 },
  { type: 'twinLogs', w: 72, h: 38 },
];

function spawnObstacle() {
  // Pick a random obstacle type (skip twinLogs until score > 200)
  let def;
  do { def = OBS_DEFS[Math.floor(Math.random() * OBS_DEFS.length)]; }
  while (def.type === 'twinLogs' && score < 200);

  obstacles.push({
    type: def.type,
    x: canvas.width + 20,
    y: GROUND - def.h,
    w: def.w,
    h: def.h,
  });
}

// =============================================================
//  CLOUDS
// =============================================================
function initClouds() {
  clouds = [];
  for (let i = 0; i < 6; i++) {
    clouds.push({
      x:   Math.random() * canvas.width,
      y:   35 + Math.random() * 110,
      r:   35 + Math.random() * 50,
      spd: 0.4 + Math.random() * 0.5,
    });
  }
}

// =============================================================
//  UPDATE  (called every frame while state === 'playing')
// =============================================================
function update() {
  frame++;

  // Score is based on how far we have traveled
  score = Math.floor(frame * speed / 28);

  // Speed ramps up smoothly as score rises, capped at 16
  speed = Math.min(BASE_SPD + Math.sqrt(score) * 0.26, 16);

  // ── Capybara physics ──────────────────────────────────────
  capy.vy += GRAVITY;
  capy.y  += capy.vy;

  if (capy.y >= GROUND - capy.h) {
    capy.y         = GROUND - capy.h;
    capy.vy        = 0;
    capy.grounded  = true;
    capy.jumpsLeft = 2;
  }

  // Animate legs only when running on the ground
  if (capy.grounded) capy.legPhase += speed * 0.11;

  // ── Blinking ──────────────────────────────────────────────
  capy.blinkIn--;
  if (capy.blinkIn <= 0) {
    capy.blinking = true;
    if (capy.blinkIn < -4) {
      capy.blinking = false;
      capy.blinkIn  = 90 + Math.random() * 140;
    }
  }

  // ── Obstacle spawning ─────────────────────────────────────
  nextSpawn -= speed;
  if (nextSpawn <= 0) {
    spawnObstacle();
    // Gap between obstacles shrinks as score grows (gets harder)
    const minGap = Math.max(130, 340 - score * 0.09);
    nextSpawn = minGap + Math.random() * 160;
  }

  // Move obstacles left
  obstacles.forEach(o => { o.x -= speed; });
  // Remove obstacles that have scrolled off the left edge
  obstacles = obstacles.filter(o => o.x + o.w > -20);

  // ── Clouds ────────────────────────────────────────────────
  clouds.forEach(c => {
    c.x -= c.spd;
    if (c.x + c.r * 2 < 0) {
      c.x = canvas.width + c.r;
      c.y = 35 + Math.random() * 110;
    }
  });

  // ── Ground dots (parallax feel) ───────────────────────────
  groundDots.forEach(d => {
    d.x -= speed * 0.8;
    if (d.x < -4) d.x += canvas.width + 8;
  });

  // ── Collision detection ───────────────────────────────────
  // Use a slightly smaller hitbox than the full sprite (more forgiving)
  const hx = capy.x + 14;
  const hy = capy.y + 7;
  const hw = capy.w - 28;
  const hh = capy.h - 9;

  for (const o of obstacles) {
    if (hx < o.x + o.w && hx + hw > o.x &&
        hy < o.y + o.h && hy + hh > o.y) {
      endGame();
      return;
    }
  }
}

// =============================================================
//  DRAWING HELPERS
// =============================================================

// Draws a rounded rectangle path (does not fill/stroke itself)
function roundRect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x,     y + h, x,     y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x,     y,     x + r, y);
  ctx.closePath();
}

// =============================================================
//  DRAW BACKGROUND
// =============================================================
function drawBackground() {
  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, '#42a5f5');
  sky.addColorStop(1, '#bbdefb');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, GROUND);

  // Sun with glow
  ctx.save();
  ctx.shadowColor = '#ffee58';
  ctx.shadowBlur  = 28;
  ctx.fillStyle   = '#fff176';
  ctx.beginPath();
  ctx.arc(canvas.width - 95, 72, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// =============================================================
//  DRAW CLOUDS
// =============================================================
function drawClouds() {
  ctx.fillStyle = 'rgba(255,255,255,0.90)';
  clouds.forEach(({ x, y, r }) => {
    ctx.beginPath();
    ctx.arc(x,            y,            r,           0, Math.PI * 2);
    ctx.arc(x + r * 0.8,  y - r * 0.18, r * 0.68,   0, Math.PI * 2);
    ctx.arc(x + r * 1.5,  y + r * 0.08, r * 0.54,   0, Math.PI * 2);
    ctx.fill();
  });
}

// =============================================================
//  DRAW GROUND
// =============================================================
function drawGround() {
  // Dirt
  const dirt = ctx.createLinearGradient(0, GROUND, 0, canvas.height);
  dirt.addColorStop(0, '#8d6e63');
  dirt.addColorStop(1, '#5d4037');
  ctx.fillStyle = dirt;
  ctx.fillRect(0, GROUND, canvas.width, canvas.height - GROUND);

  // Grass
  ctx.fillStyle = '#43a047';
  ctx.fillRect(0, GROUND, canvas.width, 10);
  ctx.fillStyle = '#66bb6a';
  ctx.fillRect(0, GROUND, canvas.width, 4);

  // Moving ground dots to convey speed
  ctx.fillStyle = '#6d4c41';
  groundDots.forEach(({ x, y, r }) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });
}

// =============================================================
//  DRAW CAPYBARA
//  Capybaras have: barrel body, large flat-snouted head, small
//  round ears, short legs, and beady little eyes.
// =============================================================
function drawCapybara() {
  const { x, y, w, h, legPhase, grounded, blinking } = capy;
  ctx.save();

  // ── Four legs (drawn before body so body covers the tops) ──
  const legDefs = [
    { lx: x + 14, lag: 0 },
    { lx: x + 32, lag: Math.PI },
    { lx: x + 52, lag: 0.4 },
    { lx: x + 70, lag: Math.PI + 0.4 },
  ];
  legDefs.forEach(({ lx, lag }) => {
    const swing  = grounded ? Math.sin(legPhase + lag) * 9 : 0;
    const footX  = lx + swing * 0.4;
    const footY  = y + h + 12 + (grounded ? Math.abs(swing) * 0.2 : 0);

    ctx.strokeStyle = '#6d4c41';
    ctx.lineWidth   = 7;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(lx, y + h - 4);
    ctx.lineTo(footX, footY);
    ctx.stroke();

    // Foot pad
    ctx.fillStyle = '#5d4037';
    ctx.beginPath();
    ctx.ellipse(footX, footY + 2, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // ── Body ──────────────────────────────────────────────────
  ctx.fillStyle = '#8d6e63';
  roundRect(x + 4, y + 10, w - 10, h - 12, 20);
  ctx.fill();

  // Lighter belly area
  ctx.fillStyle = '#bcaaa4';
  roundRect(x + 14, y + 22, w - 38, h - 34, 12);
  ctx.fill();

  // ── Head (at the RIGHT = front of the running direction) ──
  const hx = x + w - 28;   // head left edge
  const hy = y + 2;         // head top edge
  const HW = 44;            // head width
  const HH = 30;            // head height

  ctx.fillStyle = '#8d6e63';
  roundRect(hx, hy, HW, HH, 10);
  ctx.fill();

  // ── Ear ───────────────────────────────────────────────────
  ctx.fillStyle = '#795548';
  ctx.beginPath();
  ctx.ellipse(hx + 9, hy - 1, 8, 6, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ef9a9a';
  ctx.beginPath();
  ctx.ellipse(hx + 9, hy - 1, 5, 3.5, -0.25, 0, Math.PI * 2);
  ctx.fill();

  // ── Broad, flat snout (very capybara!) ───────────────────
  ctx.fillStyle = '#795548';
  roundRect(hx + HW - 16, hy + 8, 20, 16, 5);
  ctx.fill();

  // Nostrils
  ctx.fillStyle = '#4e342e';
  ctx.beginPath();
  ctx.ellipse(hx + HW + 1, hy + 13, 4.5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Nostril dividing line
  ctx.strokeStyle = '#3e2723';
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.moveTo(hx + HW + 1, hy + 10);
  ctx.lineTo(hx + HW + 1, hy + 14);
  ctx.stroke();

  // ── Eye ───────────────────────────────────────────────────
  if (!blinking) {
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(hx + 15, hy + 13, 5, 0, Math.PI * 2);
    ctx.fill();
    // Shine dot
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(hx + 17, hy + 11, 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Blink: closed-eye line
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(hx + 10, hy + 13);
    ctx.lineTo(hx + 20, hy + 13);
    ctx.stroke();
  }

  ctx.restore();
}

// =============================================================
//  DRAW OBSTACLES
// =============================================================
function drawObstacle(o) {
  ctx.save();

  if (o.type === 'log' || o.type === 'twinLogs') {
    // How many logs side-by-side?
    const count = o.type === 'twinLogs' ? 2 : 1;
    const lw    = o.type === 'twinLogs' ? (o.w - 8) / 2 : o.w;

    for (let i = 0; i < count; i++) {
      const lx = o.x + i * (lw + 8);

      // Log body
      ctx.fillStyle = '#795548';
      roundRect(lx, o.y, lw, o.h, 6);
      ctx.fill();

      // End-grain rings on top
      ctx.strokeStyle = '#6d4c41';
      ctx.lineWidth   = 1.5;
      for (let r = 4; r < 12; r += 4) {
        ctx.beginPath();
        ctx.ellipse(lx + lw / 2, o.y + 6, lw / 2 - r, 5 - r * 0.3, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Vertical grain lines on the side
      ctx.strokeStyle = '#a1887f';
      ctx.lineWidth   = 1;
      const strips = Math.floor(lw / 12);
      for (let j = 1; j <= strips; j++) {
        const gx = lx + j * (lw / (strips + 1));
        ctx.beginPath();
        ctx.moveTo(gx, o.y + 12);
        ctx.quadraticCurveTo(gx + 3, o.y + o.h / 2, gx, o.y + o.h - 5);
        ctx.stroke();
      }
    }

  } else if (o.type === 'cactus' || o.type === 'bigCactus') {

    // Main trunk
    ctx.fillStyle = '#388e3c';
    roundRect(o.x + 7, o.y, o.w - 14, o.h, 8);
    ctx.fill();

    // Arms on the big cactus
    if (o.type === 'bigCactus') {
      ctx.fillStyle = '#388e3c';
      // Left arm (horizontal then up)
      roundRect(o.x,           o.y + 30, 16, 11, 5);  ctx.fill();
      roundRect(o.x,           o.y + 18, 10, 17, 5);  ctx.fill();
      // Right arm
      roundRect(o.x + o.w - 16, o.y + 38, 16, 11, 5); ctx.fill();
      roundRect(o.x + o.w - 10, o.y + 26, 10, 17, 5); ctx.fill();
    }

    // Spines
    ctx.strokeStyle = '#2e7d32';
    ctx.lineWidth   = 1.5;
    const spines = Math.floor(o.h / 16);
    for (let i = 0; i < spines; i++) {
      const sy = o.y + 14 + i * 16;
      ctx.beginPath(); ctx.moveTo(o.x + 7, sy);   ctx.lineTo(o.x + 1,     sy - 5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(o.x + o.w - 7, sy); ctx.lineTo(o.x + o.w - 1, sy - 5); ctx.stroke();
    }

    // Highlight stripe
    ctx.fillStyle = '#4caf50';
    roundRect(o.x + 10, o.y + 5, 5, o.h - 12, 3);
    ctx.fill();
  }

  ctx.restore();
}

// =============================================================
//  DRAW HUD (score display)
// =============================================================
function drawHUD() {
  ctx.textAlign = 'left';
  ctx.fillStyle = '#1a237e';
  ctx.font      = 'bold 22px "Courier New", monospace';
  ctx.fillText('Score: ' + String(score).padStart(5, '0'), 20, 36);

  if (highScore > 0) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#5c6bc0';
    ctx.font      = '16px "Courier New", monospace';
    ctx.fillText('BEST: ' + String(highScore).padStart(5, '0'), canvas.width - 20, 36);
  }
}

// =============================================================
//  DRAW OVERLAY SCREENS  (start / game over)
// =============================================================
function drawOverlay(title, lines) {
  // Dim the scene behind the overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign  = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur  = 10;

  ctx.fillStyle = '#ffffff';
  ctx.font      = 'bold 54px Arial, sans-serif';
  ctx.fillText(title, canvas.width / 2, 178);

  ctx.shadowBlur = 0;

  lines.forEach((line, i) => {
    ctx.font      = `${line.size || 22}px Arial, sans-serif`;
    ctx.fillStyle = line.color || '#e0f7fa';
    ctx.fillText(line.text, canvas.width / 2, 236 + i * 48);
  });
}

// =============================================================
//  MAIN GAME LOOP
// =============================================================
function loop() {
  // 1. Update game state
  if (state === 'playing') update();

  // 2. Draw the frame
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBackground();
  drawClouds();
  drawGround();

  // Always draw the capybara (even on start/game-over screens)
  obstacles.forEach(drawObstacle);
  drawCapybara();

  if (state === 'playing') {
    drawHUD();
  }

  if (state === 'start') {
    drawOverlay('CAPYBARA RUN!', [
      { text: 'Press SPACE or tap to start',      size: 24, color: '#fff9c4' },
      { text: 'Tap again mid-air to double jump!', size: 19, color: '#b2ebf2' },
      { text: 'Dodge logs and cacti for ever!',    size: 19, color: '#b2ebf2' },
    ]);
  }

  if (state === 'over') {
    const newRecord = score > 0 && score >= highScore;
    drawOverlay('GAME OVER', [
      { text: 'Score: ' + score,                         size: 30, color: '#fff9c4' },
      newRecord
        ? { text: 'New High Score!',                     size: 25, color: '#ffd54f' }
        : { text: 'Best:  ' + highScore,                 size: 22, color: '#b2ebf2' },
      { text: 'Press SPACE or tap to try again',         size: 20, color: '#e0f7fa' },
    ]);
  }

  // 3. Schedule the next frame
  requestAnimationFrame(loop);
}

// =============================================================
//  START
// =============================================================
initClouds();
loop();
