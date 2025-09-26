const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 800;
canvas.height = 600;

const FRAME_WIDTH = 192;
const FRAME_HEIGHT = 192;

const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const images = {
  background: new Image(),
  idle: new Image(),
  run: new Image(),
  attack: new Image(),
  redRun: new Image(),
  redAttack: new Image()
};

images.background.src = "knightout/assets/background.png";
images.idle.src = "knightout/assets/idle.png";
images.run.src = "knightout/assets/run.png";
images.attack.src = "knightout/assets/attack.png";
images.redRun.src = "knightout/assets/red_run.png";
images.redAttack.src = "knightout/assets/red_attack.png";

const attackSound = new Audio("knightout/assets/attack.mp3");
attackSound.volume = 0.7;

function loadImages(imageMap) {
  const entries = Object.entries(imageMap);
  return Promise.all(entries.map(([key, img]) => {
    return new Promise(resolve => {
      img.onload = resolve;
      img.src = img.src;
    });
  }));
}

const animations = {
  idle: 8,
  run: 6,
  attack: 4,
  redRun: 6,
  redAttack: 4
};

let player, enemies, keys, lastTime, gameOver, killCount, waveTimer;
let paused = false;
let gameStarted = false;

let touchX = null;
let touchY = null;
let isDragging = false;
let lastTapTime = 0;

function resetGame() {
  player = {
    x: canvas.width / 2 - FRAME_WIDTH / 2,
    y: canvas.height / 2 - FRAME_HEIGHT / 2,
    speed: 4,
    facing: "right",
    state: "idle",
    frame: 0,
    frameTimer: 0,
    frameInterval: 100,
    attacking: false,
    health: 100,
    maxHealth: 100
  };
  enemies = [];
  keys = {};
  lastTime = 0;
  gameOver = false;
  killCount = 0;
  waveTimer = 2000;
}

function startGame() {
  resetGame();
  document.getElementById("start-btn").style.display = "none";
  document.getElementById("restart-btn").style.display = "none";
  document.getElementById("pause-btn").style.display = "inline-block";
  gameStarted = true;
  paused = false;
  setInterval(spawnEnemy, 2000);
  requestAnimationFrame(gameLoop);
  canvas.addEventListener("touchmove", preventScroll, { passive: false });

}

function restartGame() {
  resetGame();
  document.getElementById("restart-btn").style.display = "none";
  requestAnimationFrame(gameLoop);
}

function togglePause() {
  paused = !paused;
  if (!paused && gameStarted) {
    requestAnimationFrame(gameLoop);
  }
  canvas.removeEventListener("touchmove", preventScroll);
}

document.addEventListener("DOMContentLoaded", () => {
  // Button event listeners
  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("restart-btn").addEventListener("click", restartGame);
  document.getElementById("pause-btn").addEventListener("click", togglePause);

  // Mobile joystick visibility
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const mobileControls = document.getElementById("mobile-controls");
  if (mobileControls) {
    mobileControls.style.display = isMobile ? "flex" : "none";
  }
});

// Keyboard input
document.addEventListener("keydown", e => {
  if (!keys) return;
  keys[e.code] = true;
});

document.addEventListener("keyup", e => {
  if (!keys) return;
  keys[e.code] = false;
});


if (isMobile) {
  canvas.addEventListener("touchstart", e => {
    const touch = e.touches[0];
    touchX = touch.clientX;
    touchY = touch.clientY;
    isDragging = false;
    lastTapTime = Date.now();
  });

  canvas.addEventListener("touchmove", e => {
    const touch = e.touches[0];
    touchX = touch.clientX;
    touchY = touch.clientY;
    isDragging = true;
  });

  canvas.addEventListener("touchend", () => {
    const now = Date.now();
    if (!isDragging && now - lastTapTime < 300 && !player.attacking) {
      player.state = "attack";
      player.attacking = true;
      player.frame = 0;
      attackSound.currentTime = 0;
      attackSound.play();
    }
    touchX = null;
    touchY = null;
    isDragging = false;
  });
}

function preventScroll(e) {
  e.preventDefault();
}


function spawnEnemy() {
  if (gameOver || paused || !gameStarted) return;
  const edge = Math.floor(Math.random() * 4);
  let x, y;
  switch (edge) {
    case 0: x = Math.random() * canvas.width; y = -FRAME_HEIGHT; break;
    case 1: x = Math.random() * canvas.width; y = canvas.height + FRAME_HEIGHT; break;
    case 2: x = -FRAME_WIDTH; y = Math.random() * canvas.height; break;
    case 3: x = canvas.width + FRAME_WIDTH; y = Math.random() * canvas.height; break;
  }
  enemies.push({
    x,
    y,
    speed: 1.5,
    facing: "right",
    state: "run",
    frame: 0,
    frameTimer: 0,
    frameInterval: 100,
    damageCooldown: 0
  });
}

function updatePlayer() {
  let moving = false;

  // PC attack
  if (keys["Space"] && !player.attacking) {
    player.state = "attack";
    player.attacking = true;
    player.frame = 0;
    attackSound.currentTime = 0;
    attackSound.play();
    return;
  }

  // PC movement
  if (keys["ArrowLeft"] || keys["KeyA"]) {
    player.x -= player.speed;
    player.facing = "left";
    moving = true;
  }
  if (keys["ArrowRight"] || keys["KeyD"]) {
    player.x += player.speed;
    player.facing = "right";
    moving = true;
  }
  if (keys["ArrowUp"] || keys["KeyW"]) {
    player.y -= player.speed;
    moving = true;
  }
  if (keys["ArrowDown"] || keys["KeyS"]) {
    player.y += player.speed;
    moving = true;
  }

  // Mobile drag-to-move
  if (isMobile && touchX !== null && touchY !== null) {
    const rect = canvas.getBoundingClientRect();
    const targetX = touchX - rect.left - FRAME_WIDTH / 2;
    const targetY = touchY - rect.top - FRAME_HEIGHT / 2;

    const dx = targetX - player.x;
    const dy = targetY - player.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 5) {
      player.x += (dx / dist) * player.speed;
      player.y += (dy / dist) * player.speed;
      player.facing = dx < 0 ? "left" : "right";
      moving = true;
    }
  }

  // Clamp to canvas bounds
  player.x = Math.max(0, Math.min(canvas.width - FRAME_WIDTH, player.x));
  player.y = Math.max(0, Math.min(canvas.height - FRAME_HEIGHT, player.y));

  // Set animation state
  if (!player.attacking) {
    player.state = moving ? "run" : "idle";
  }
}

if (!player.attacking) {
  player.state = moving ? "run" : "idle";
}

player.x = Math.max(0, Math.min(canvas.width - FRAME_WIDTH, player.x));
player.y = Math.max(0, Math.min(canvas.height - FRAME_HEIGHT, player.y));

if (!player.attacking) {
  player.state = moving ? "run" : "idle";
}

function updateEnemies(deltaTime) {
  enemies.forEach(enemy => {
    const dx = player.x + FRAME_WIDTH / 2 - (enemy.x + FRAME_WIDTH / 2);
    const dy = player.y + FRAME_HEIGHT / 2 - (enemy.y + FRAME_HEIGHT / 2);
    const dist = Math.hypot(dx, dy);
    if (dist < 80) {
      enemy.state = "attack";
    } else {
      enemy.state = "run";
      enemy.x += (dx / dist) * enemy.speed;
      enemy.y += (dy / dist) * enemy.speed;
      enemy.facing = dx < 0 ? "left" : "right";
    }
    if (
      enemy.state === "attack" &&
      enemy.damageCooldown <= 0 &&
      player.x < enemy.x + FRAME_WIDTH &&
      player.x + FRAME_WIDTH > enemy.x &&
      player.y < enemy.y + FRAME_HEIGHT &&
      player.y + FRAME_HEIGHT > enemy.y
    ) {
      player.health -= 10;
      enemy.damageCooldown = 1000;
      attackSound.currentTime = 0;
      attackSound.play();
      if (player.health <= 0) {
        gameOver = true;
        document.getElementById("restart-btn").style.display = "inline-block";
      }
    }
    enemy.damageCooldown -= deltaTime;
  });
}

function checkAttackHit() {
  if (player.state !== "attack") return;
  const hitbox = {
    x: player.facing === "right" ? player.x + FRAME_WIDTH - 30 : player.x - 30,
    y: player.y + FRAME_HEIGHT / 2 - 25,
    width: 60,
    height: 50
  };
  enemies.forEach((enemy, index) => {
    if (
      hitbox.x < enemy.x + FRAME_WIDTH &&
      hitbox.x + hitbox.width > enemy.x &&
      hitbox.y < enemy.y + FRAME_HEIGHT &&
      hitbox.y + hitbox.height > enemy.y
    ) {
      enemies.splice(index, 1);
      killCount++;
    }
  });
}

function drawBackground() {
  ctx.drawImage(images.background, 0, 0, canvas.width, canvas.height);
}

function drawPlayer() {
  const img = images[player.state];
  const frameX = player.frame * FRAME_WIDTH;
  ctx.save();
  if (player.facing === "left") {
    ctx.translate(player.x + FRAME_WIDTH, player.y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, frameX, 0, FRAME_WIDTH, FRAME_HEIGHT, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  } else {
    ctx.drawImage(img, frameX, 0, FRAME_WIDTH, FRAME_HEIGHT, player.x, player.y, FRAME_WIDTH, FRAME_HEIGHT);
  }
  ctx.restore();
}

function drawEnemies() {
  enemies.forEach(enemy => {
    const img = enemy.state === "attack" ? images.redAttack : images.redRun;
    const frameX = enemy.frame * FRAME_WIDTH;
    ctx.save();
    if (enemy.facing === "left") {
      ctx.translate(enemy.x + FRAME_WIDTH, enemy.y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, frameX, 0, FRAME_WIDTH, FRAME_HEIGHT, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
    } else {
      ctx.drawImage(img, frameX, 0, FRAME_WIDTH, FRAME_HEIGHT, enemy.x, enemy.y, FRAME_WIDTH, FRAME_HEIGHT);
    }
    ctx.restore();
  });
}

function drawHUD(deltaTime) {
  const barWidth = 200;
  const barHeight = 20;
  const healthRatio = player.health / player.maxHealth;

  ctx.fillStyle = "black";
  ctx.fillRect(20, 20, barWidth, barHeight);

  const gradient = ctx.createLinearGradient(20, 20, 20 + barWidth, 20);
  gradient.addColorStop(0, "lime");
  gradient.addColorStop(0.5, "orange");
  gradient.addColorStop(1, "red");

  ctx.fillStyle = gradient;
  ctx.fillRect(20, 20, barWidth * healthRatio, barHeight);

  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, barWidth, barHeight);

  ctx.fillStyle = "white";
  ctx.font = "18px Arial";
  ctx.fillText(`Kills: ${killCount}`, 20, 60);

  waveTimer -= deltaTime;
  if (waveTimer <= 0) waveTimer = 2000;
  ctx.fillText(`Next wave: ${Math.ceil(waveTimer / 1000)}s`, 20, 100);
}

function updateAnimation(deltaTime) {
  player.frameTimer += deltaTime;
  if (player.frameTimer >= player.frameInterval) {
    player.frame++;
    player.frameTimer = 0;

    if (player.state === "attack" && player.frame >= animations.attack) {
      player.attacking = false;
      player.state = "idle";
      player.frame = 0;
    } else if (player.frame >= animations[player.state]) {
      player.frame = 0;
    }
  }

  enemies.forEach(enemy => {
    enemy.frameTimer += deltaTime;
    if (enemy.frameTimer >= enemy.frameInterval) {
      enemy.frame++;
      enemy.frameTimer = 0;

      const maxFrames = enemy.state === "attack" ? animations.redAttack : animations.redRun;
      if (enemy.frame >= maxFrames) {
        enemy.frame = 0;
      }
    }
  });
}

function drawGameOver() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ff4444";
  ctx.font = "48px Bungee, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 40);
  ctx.fillStyle = "#ffffff";
  ctx.font = "24px Orbitron, sans-serif";
  ctx.fillText(`Kills: ${killCount}`, canvas.width / 2, canvas.height / 2 + 10);
  ctx.fillText("Tap Restart to try again", canvas.width / 2, canvas.height / 2 + 50);
  canvas.removeEventListener("touchmove", preventScroll);
}

function gameLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const deltaTime = timestamp - lastTime;
  lastTime = timestamp;

  if (paused || !gameStarted) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();

  if (!gameOver) {
    updatePlayer();
    updateEnemies(deltaTime);
    checkAttackHit();
    updateAnimation(deltaTime);
    drawPlayer();
    drawEnemies();
    drawHUD(deltaTime);
    requestAnimationFrame(gameLoop);
  } else {
    drawPlayer();
    drawEnemies();
    drawHUD(0);
    drawGameOver();
  }
}

loadImages(images).then(() => {
  document.getElementById("start-btn").style.display = "inline-block";
});


