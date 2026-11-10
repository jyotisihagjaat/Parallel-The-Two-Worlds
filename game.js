
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const $ = id => document.getElementById(id);

const W = 800;
const H = 400;

const screens = [
  "menu-screen", "level-screen", "game-screen",
  "pause-screen", "complete-screen"
];

// Each platform: [x, y, width, height, world]
// World 0 = Light, World 1 = Shadow
const levels = [
  {
    name: "First Contact",
    start: [35, 315],
    platforms: [
      [0,350,800,50,0],
      [0,350,800,50,1],
      [120,300,110,16,1],
      [260,250,110,16,0],
      [400,300,110,16,1],
      [540,250,110,16,0]
    ],
    crystal: [310,215,0],
    portal: [735,325,0],
    hazards: []
  },
  {
    name: "Broken Signal",
    start: [35,315],
    platforms: [
      [0,350,800,50,0],
      [0,350,800,50,1],
      [110,300,100,16,1],
      [240,250,100,16,0],
      [370,200,110,16,1],
      [510,250,100,16,0],
      [650,300,100,16,1]
    ],
    crystal: [425,165,1],
    portal: [735,325,1],
    hazards: [[290,230,13,0]]
  },
  {
    name: "The Void",
    start: [35,315],
    platforms: [
      [0,350,800,50,0],
      [0,350,800,50,1],
      [100,300,100,16,1],
      [220,250,100,16,0],
      [340,200,100,16,1],
      [460,250,100,16,0],
      [580,300,100,16,1]
    ],
    crystal: [385,165,1],
    portal: [735,325,0],
    hazards: [[270,230,12,0],[530,230,12,1]]
  },
  {
    name: "Dark Matter",
    start: [35,315],
    platforms: [
      [0,350,800,50,0],
      [0,350,800,50,1],
      [100,300,95,16,1],
      [215,250,95,16,0],
      [330,200,95,16,1],
      [445,250,95,16,0],
      [560,300,95,16,1],
      [670,250,95,16,0]
    ],
    crystal: [370,165,1],
    portal: [735,325,0],
    hazards: [[265,230,12,0],[610,280,12,1]]
  },
  {
    name: "Final Paradox",
    start: [35,315],
    platforms: [
      [0,350,800,50,0],
      [0,350,800,50,1],
      [90,300,90,16,1],
      [195,250,90,16,0],
      [300,200,90,16,1],
      [405,150,90,16,0],
      [510,200,90,16,1],
      [615,250,90,16,0]
    ],
    crystal: [450,115,0],
    portal: [735,325,0],
    hazards: [[245,230,12,0],[555,180,12,1]]
  }
];

const SAVE_KEY = "parallel_v3";

let progress;

try {
  progress = JSON.parse(localStorage.getItem(SAVE_KEY)) ||
    { unlocked: 1, highScore: 0, scores: {} };
} catch {
  progress = { unlocked: 1, highScore: 0, scores: {} };
}

progress.unlocked = Math.max(1, Math.min(5, progress.unlocked || 1));

let levelIndex = 0;
let world = 0;
let score = 0;
let elapsed = 0;
let collected = false;
let running = false;
let paused = false;
let lastTime = 0;
let animationId = 0;
let soundEnabled = true;
let toastTimer = null;
let particles = [];

const player = {
  x: 35, y: 315, w: 23, h: 35,
  vx: 0, vy: 0,
  grounded: false
};

const input = { left: false, right: false };

function saveProgress() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
  } catch (e) {
    console.warn("Progress could not be saved", e);
  }
}

function showScreen(id) {
  screens.forEach(name => {
    $(name).classList.toggle("active", name === id);
  });
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.max(320, rect.width * dpr);
  canvas.height = Math.max(300, rect.height * dpr);

  ctx.setTransform(
    canvas.width / W, 0,
    0, canvas.height / H,
    0, 0
  );
}

window.addEventListener("resize", resizeCanvas);

function currentLevel() {
  return levels[levelIndex];
}

function updateHUD() {
  $("level-number").textContent = String(levelIndex + 1).padStart(2, "0");
  $("crystal-count").textContent = collected ? "1 / 1" : "0 / 1";
  $("score").textContent = score;
  $("world-label").textContent = world === 0 ? "LIGHT WORLD" : "SHADOW WORLD";
  $("world-toast").textContent = world === 0 ? "LIGHT WORLD" : "SHADOW WORLD";
}

function showToast(message) {
  const toast = $("world-toast");
  toast.textContent = message;

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (running && !paused) updateHUD();
  }, 1100);
}

function playTone(frequency = 440) {
  if (!soundEnabled) return;

  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;

    const audio = new Audio();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.value = 0.045;
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.16);

    oscillator.connect(gain);
    gain.connect(audio.destination);

    oscillator.start();
    oscillator.stop(audio.currentTime + 0.16);
    oscillator.onended = () => audio.close();
  } catch (e) {}
}

function startLevel(index) {
  levelIndex = index;

  const level = currentLevel();

  player.x = level.start[0];
  player.y = level.start[1];
  player.vx = 0;
  player.vy = 0;
  player.grounded = false;

  world = 0;
  score = 0;
  elapsed = 0;
  collected = false;
  particles = [];

  running = true;
  paused = false;
  lastTime = 0;

  cancelAnimationFrame(animationId);

  resizeCanvas();
  updateHUD();
  showScreen("game-screen");

  animationId = requestAnimationFrame(gameLoop);
}

function jump() {
  if (!running || paused || !player.grounded) return;

  player.vy = -0.55;
  player.grounded = false;
  playTone(320);
}

function switchWorld() {
  if (!running || paused) return;

  const nextWorld = 1 - world;

  // Only block a switch if a platform would overlap
  // the character's body in the destination world.
  const blocked = currentLevel().platforms.some(p => {
    if (p[4] !== nextWorld) return false;

    const horizontal =
      player.x + player.w > p[0] + 3 &&
      player.x < p[0] + p[2] - 3;

    const vertical =
      player.y + player.h > p[1] + 3 &&
      player.y < p[1] + p[3] - 3;

    return horizontal && vertical;
  });

  if (blocked) {
    showToast("WORLD BLOCKED");
    playTone(150);
    return;
  }

  world = nextWorld;
  updateHUD();
  playTone(520);

  for (let i = 0; i < 12; i++) {
    particles.push({
      x: player.x + player.w / 2,
      y: player.y + player.h / 2,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      life: 1
    });
  }
}

function respawn() {
  const start = currentLevel().start;

  player.x = start[0];
  player.y = start[1];
  player.vx = 0;
  player.vy = 0;
  player.grounded = false;

  world = 0;
  updateHUD();
  showToast("CHECKPOINT RESET");
}

function update(dt) {
  const level = currentLevel();
  elapsed += dt;

  let direction = 0;
  if (input.left) direction--;
  if (input.right) direction++;

  player.vx = direction * 0.27 * dt;
  player.x += player.vx;
  player.x = Math.max(0, Math.min(W - player.w, player.x));

  const oldBottom = player.y + player.h;

  player.vy += 0.0015 * dt;
  player.y += player.vy * dt;
  player.grounded = false;

  // Platform landing
  for (const p of level.platforms) {
    if (p[4] !== world) continue;

    const horizontal =
      player.x + player.w > p[0] &&
      player.x < p[0] + p[2];

    const newBottom = player.y + player.h;

    if (
      horizontal &&
      oldBottom <= p[1] &&
      newBottom >= p[1] &&
      player.vy >= 0
    ) {
      player.y = p[1] - player.h;
      player.vy = 0;
      player.grounded = true;
    }
  }

  // Moving hazards
  level.hazards.forEach((hazard, i) => {
    if (hazard[3] !== undefined && hazard[3] !== world) return;

    const hx = hazard[0] + Math.sin(elapsed / 500 + i) * 24;
    const hy = hazard[1];

    const dx = player.x + player.w / 2 - hx;
    const dy = player.y + player.h / 2 - hy;

    if (Math.hypot(dx, dy) < hazard[2] + 9) {
      respawn();
    }
  });

  if (player.y > H + 50) {
    respawn();
  }

  // Crystal collection
  const c = level.crystal;

  if (!collected && c[2] === world) {
    const dx = player.x + player.w / 2 - c[0];
    const dy = player.y + player.h / 2 - c[1];

    if (Math.hypot(dx, dy) < 28) {
      collected = true;
      score += 250;
      updateHUD();
      showToast("ENERGY CORE COLLECTED");
      playTone(760);
    }
  }

  // Portal completion: generous interaction radius
  const portal = level.portal;

  if (collected && portal[2] === world) {
    const dx = player.x + player.w / 2 - portal[0];
    const dy = player.y + player.h / 2 - portal[1];

    if (Math.hypot(dx, dy) < 52) {
      finishLevel();
    }
  }

  // Particle movement
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.025;
  });

  particles = particles.filter(p => p.life > 0);
}

function finishLevel() {
  if (!running) return;

  running = false;

  score += Math.max(0, Math.floor(600 - elapsed / 100));

  progress.scores[levelIndex + 1] = Math.max(
    progress.scores[levelIndex + 1] || 0,
    score
  );

  progress.highScore = Math.max(progress.highScore, score);
  progress.unlocked = Math.max(
    progress.unlocked,
    Math.min(levels.length, levelIndex + 2)
  );

  saveProgress();

  $("final-score").textContent = score;

  $("complete-message").textContent =
    levelIndex === levels.length - 1
      ? "Both realities have been restored. You completed the journey."
      : "Portal stabilised. The next sector is now unlocked.";

  $("next-btn").textContent =
    levelIndex === levels.length - 1 ? "PLAY AGAIN →" : "NEXT LEVEL →";

  showScreen("complete-screen");
  playTone(850);
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, H);

  if (world === 0) {
    gradient.addColorStop(0, "#102a48");
    gradient.addColorStop(0.6, "#0c162b");
    gradient.addColorStop(1, "#070d19");
  } else {
    gradient.addColorStop(0, "#38204b");
    gradient.addColorStop(0.6, "#1a102e");
    gradient.addColorStop(1, "#090a19");
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  // Stars
  for (let i = 0; i < 90; i++) {
    const x = (i * 137) % W;
    const y = (i * 71) % 280;

    ctx.globalAlpha = 0.2 + Math.sin(elapsed / 450 + i) * 0.12;
    ctx.fillStyle = world === 0 ? "#a6e9ff" : "#e5b3ff";
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.globalAlpha = 1;

  // Distant buildings
  for (let i = 0; i < 12; i++) {
    const x = i * 75;
    const height = 65 + (i * 31) % 115;

    ctx.fillStyle = world === 0 ? "#142c48" : "#342044";
    ctx.fillRect(x, H - height, 48, height);

    ctx.fillStyle = world === 0 ? "#56b8dd55" : "#c184e455";
    for (let j = 0; j < 3; j++) {
      ctx.fillRect(x + 9 + j * 12, H - height + 18, 4, 17);
    }
  }

  // Horizon glow
  const glow = ctx.createRadialGradient(400, 300, 10, 400, 300, 280);
  glow.addColorStop(0, world === 0 ? "#3ca6e522" : "#bd72ff22");
  glow.addColorStop(1, "transparent");

  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
}

function drawPlatform(p) {
  ctx.save();

  const color = world === 0 ? "#5bd5ff" : "#ca8bff";

  ctx.shadowBlur = 18;
  ctx.shadowColor = color;

  const gradient = ctx.createLinearGradient(p[0], p[1], p[0], p[1] + p[3]);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, world === 0 ? "#174c72" : "#643d83");

  ctx.fillStyle = gradient;
  ctx.fillRect(p[0], p[1], p[2], p[3]);

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffffff66";
  ctx.fillRect(p[0] + 4, p[1] + 3, p[2] - 8, 2);

  ctx.fillStyle = "#07152588";
  ctx.fillRect(p[0], p[1] + p[3] - 4, p[2], 4);

  ctx.restore();
}

function drawCrystal() {
  if (collected) return;

  const c = currentLevel().crystal;
  if (c[2] !== world) return;

  const pulse = 1 + Math.sin(elapsed / 120) * 0.12;

  ctx.save();
  ctx.translate(c[0], c[1]);
  ctx.rotate(elapsed / 1000);
  ctx.scale(pulse, pulse);

  ctx.shadowBlur = 30;
  ctx.shadowColor = "#ffe58a";
  ctx.fillStyle = "#ffe58a";

  ctx.beginPath();
  ctx.moveTo(0, -17);
  ctx.lineTo(11, 0);
  ctx.lineTo(0, 17);
  ctx.lineTo(-11, 0);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawPortal() {
  const p = currentLevel().portal;
  if (p[2] !== world) return;

  const pulse = 1 + Math.sin(elapsed / 180) * 0.06;

  ctx.save();
  ctx.translate(p[0], p[1]);
  ctx.scale(pulse, pulse);

  ctx.shadowBlur = collected ? 35 : 12;
  ctx.shadowColor = collected ? "#7af3ff" : "#8990a7";

  ctx.strokeStyle = collected ? "#7af3ff" : "#6b728c";
  ctx.lineWidth = 7;

  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 30, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = collected ? "#7af3ff25" : "#8990a710";
  ctx.fill();

  ctx.restore();
}

function drawPlayer() {
  const x = player.x;
  const y = player.y;

  ctx.save();

  // Character shadow
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(x + 12, y + 36, 15, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;

  ctx.shadowBlur = 22;
  ctx.shadowColor = world === 0 ? "#69dcff" : "#d4a0ff";

  const gradient = ctx.createLinearGradient(x, y, x + 25, y + 35);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.45, world === 0 ? "#67d9ff" : "#e0b1ff");
  gradient.addColorStop(1, world === 0 ? "#176da9" : "#7644a5");

  ctx.fillStyle = gradient;

  ctx.beginPath();
  ctx.roundRect(x, y + 8, 23, 27, 7);
  ctx.fill();

  ctx.fillStyle = "#effaff";
  ctx.beginPath();
  ctx.arc(x + 11.5, y + 7, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#14203a";
  ctx.fillRect(x + 7, y + 6, 3, 3);
  ctx.fillRect(x + 15, y + 6, 3, 3);

  ctx.restore();
}

function drawParticles() {
  particles.forEach(p => {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = world === 0 ? "#73dcff" : "#d5a0ff";
    ctx.fillRect(p.x, p.y, 4, 4);
  });

  ctx.globalAlpha = 1;
}

function draw() {
  drawBackground();

  currentLevel().platforms.forEach(p => {
    if (p[4] === world) drawPlatform(p);
  });

  currentLevel().hazards.forEach((h, i) => {
    if (h[3] !== undefined && h[3] !== world) return;

    const x = h[0] + Math.sin(elapsed / 500 + i) * 24;

    ctx.save();
    ctx.shadowBlur = 22;
    ctx.shadowColor = "#ff526f";
    ctx.fillStyle = "#ff526f";

    ctx.beginPath();
    ctx.arc(x, h[1], h[2], 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  });

  drawCrystal();
  drawPortal();
  drawParticles();
  drawPlayer();
}

function gameLoop(timestamp) {
  if (!running || paused) return;

  if (!lastTime) lastTime = timestamp;

  const dt = Math.min(timestamp - lastTime, 32);
  lastTime = timestamp;

  update(dt);

  if (!running) return;

  draw();
  animationId = requestAnimationFrame(gameLoop);
}

function renderLevels() {
  const grid = $("level-grid");
  grid.innerHTML = "";

  levels.forEach((level, index) => {
    const button = document.createElement("button");

    button.className = "level-card";
    button.textContent = index + 1 <= progress.unlocked
      ? String(index + 1).padStart(2, "0")
      : "🔒";

    button.disabled = index + 1 > progress.unlocked;

    if (!button.disabled) {
      button.classList.add("unlocked");
      button.title = level.name;
      button.addEventListener("click", () => startLevel(index));
    }

    grid.appendChild(button);
  });
}

// Keyboard controls
window.addEventListener("keydown", event => {
  const key = event.key.toLowerCase();

  if (["arrowleft", "arrowright", " ", "arrowup"].includes(key)) {
    event.preventDefault();
  }

  if (key === "escape") {
    if (paused) resumeGame();
    else pauseGame();
    return;
  }

  if (key === "arrowleft" || key === "a") input.left = true;
  if (key === "arrowright" || key === "d") input.right = true;

  if ((key === " " || key === "arrowup" || key === "w") && !event.repeat) {
    jump();
  }

  if (key === "e" && !event.repeat) switchWorld();
});

window.addEventListener("keyup", event => {
  const key = event.key.toLowerCase();

  if (key === "arrowleft" || key === "a") input.left = false;
  if (key === "arrowright" || key === "d") input.right = false;
});

function holdButton(id, direction) {
  const button = $(id);

  button.addEventListener("pointerdown", event => {
    event.preventDefault();
    input[direction] = true;
    button.setPointerCapture(event.pointerId);
  });

  const release = () => input[direction] = false;

  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
}

holdButton("left-btn", "left");
holdButton("right-btn", "right");

function pauseGame() {
  if (!running) return;

  paused = true;
  showScreen("pause-screen");
}

function resumeGame() {
  if (!paused) return;

  paused = false;
  lastTime = 0;
  showScreen("game-screen");
  animationId = requestAnimationFrame(gameLoop);
}

// Buttons
$("start-btn").addEventListener("click", () => startLevel(0));

$("levels-btn").addEventListener("click", () => {
  renderLevels();
  showScreen("level-screen");
});

document.querySelector(".back-btn").addEventListener("click", () => {
  showScreen("menu-screen");
});

$("switch-btn").addEventListener("click", switchWorld);
$("jump-btn").addEventListener("click", jump);
$("pause-btn").addEventListener("click", pauseGame);
$("resume-btn").addEventListener("click", resumeGame);

$("restart-btn").addEventListener("click", () => startLevel(levelIndex));

$("home-btn").addEventListener("click", () => {
  running = false;
  paused = false;
  cancelAnimationFrame(animationId);
  showScreen("menu-screen");
});

$("complete-home-btn").addEventListener("click", () => {
  showScreen("menu-screen");
});

$("next-btn").addEventListener("click", () => {
  startLevel(levelIndex === levels.length - 1 ? 0 : levelIndex + 1);
});

$("sound-btn").addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  $("sound-btn").textContent = soundEnabled ? "♫" : "♪";
});

resizeCanvas();
updateHUD();
