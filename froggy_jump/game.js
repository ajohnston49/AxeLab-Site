function initFroggyJump() {
  const canvas = document.getElementById("froggyCanvas");
  const ctx = canvas.getContext("2d");

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const PLAYER_W = 40, PLAYER_H = 40;
  const PLATFORM_W = 60, PLATFORM_H = 10;
  const GRAVITY = 0.4;
  const JUMP_VEL = -20;
  const MOVE_SPEED = 3;
  const NUM_PLATFORMS = 8;

  let score = 0;
  let gameActive = false;
  let gameOver = false;
  let startMenuShown = false;
  let currentDeathScreen = null;
  let loopId = null;

  const keys = {};
  let mobileDir = 0;
  let mobileJumpQueued = false;

  document.addEventListener("keydown", e => keys[e.key] = true);
  document.addEventListener("keyup", e => keys[e.key] = false);

  canvas.addEventListener("touchstart", e => {
    const touch = e.touches[0];
    const x = touch.clientX - canvas.getBoundingClientRect().left;
    mobileJumpQueued = true;
    mobileDir = x < WIDTH / 2 ? -1 : 1;
  });

  canvas.addEventListener("touchend", () => {
    mobileDir = 0;
  });

  const loadImage = src => { const img = new Image(); img.src = src; return img; };
  const loadSound = src => { const audio = new Audio(src); return audio; };

  const assets = {
    bg: loadImage("froggy_jump/assets/background.png"),
    platform: loadImage("froggy_jump/assets/platform.png"),
    spider: loadImage("froggy_jump/assets/spider.png"),
    spiderFlipped: loadImage("froggy_jump/assets/spider_flipped.png"),
    playerRight: loadImage("froggy_jump/assets/player.png"),
    playerLeft: loadImage("froggy_jump/assets/player_flipped.png"),
    playerJumpRight: loadImage("froggy_jump/assets/player_jump.png"),
    playerJumpLeft: loadImage("froggy_jump/assets/player_jump_flipped.png"),
    playerFallRight: loadImage("froggy_jump/assets/player_fall.png"),
    playerFallLeft: loadImage("froggy_jump/assets/player_fall_flipped.png"),
    startMenu: loadImage("froggy_jump/assets/start_menu.png"),
    deathScreens: Array.from({length: 12}, (_, i) => loadImage(`froggy_jump/assets/gameover${i+1}.png`)),
    music: loadSound("froggy_jump/assets/background.mp3"),
    jumpSfx: loadSound("froggy_jump/assets/jump.wav"),
    hurtSfx: loadSound("froggy_jump/assets/hurt.wav"),
    dieSfx: loadSound("froggy_jump/assets/die.wav")
  };

  assets.music.loop = true;

  class Spider {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.width = PLATFORM_W;
      this.height = PLATFORM_H;
      this.images = [assets.spider, assets.spiderFlipped];
      this.current = 0;
      this.lastSwitch = Date.now();
      this.interval = randInt(3000, 5000);
    }

    update() {
      if (Date.now() - this.lastSwitch > this.interval) {
        this.current ^= 1;
        this.lastSwitch = Date.now();
        this.interval = randInt(3000, 5000);
      }
    }

    draw() {
      ctx.drawImage(this.images[this.current], this.x, this.y);
    }

    move(dy) {
      this.y += dy;
    }

    repositionAbove(platform) {
      this.x = platform.x;
      this.y = platform.y - PLATFORM_H;
    }

    getRect() {
      return { x: this.x, y: this.y, width: this.width, height: this.height };
    }
  }

  class Platform {
    constructor(x, y, hasSpider = true) {
      this.x = x;
      this.y = y;
      this.width = PLATFORM_W;
      this.height = PLATFORM_H;
      this.spider = hasSpider ? new Spider(x, y - PLATFORM_H) : null;
    }

    draw() {
      ctx.drawImage(assets.platform, this.x, this.y);
      if (this.spider) {
        this.spider.update();
        this.spider.draw();
      }
    }

    move(dy) {
      this.y += dy;
      if (this.spider) this.spider.move(dy);
    }

    recycle() {
      this.x = randInt(0, WIDTH - PLATFORM_W);
      this.y = randInt(-120, -40);
      if (Math.random() < 0.08) {
        if (!this.spider) this.spider = new Spider(this.x, this.y - PLATFORM_H);
        else this.spider.repositionAbove(this);
      } else {
        this.spider = null;
      }
    }

    getRect() {
      return { x: this.x + 10, y: this.y + PLATFORM_H / 2, width: PLATFORM_W - 20, height: 4 };
    }
  }

  class Player {
    constructor() {
      this.x = WIDTH / 2;
      this.y = HEIGHT - 80;
      this.vx = 0;
      this.vy = 0;
      this.width = PLAYER_W;
      this.height = PLAYER_H;
      this.onGround = false;
      this.disabled = false;
      this.facingRight = true;
      this.image = assets.playerRight;
    }

    update() {
      this.vy += GRAVITY;
      this.x += this.vx;
      this.y += this.vy;

      for (let plat of platforms) {
        if (plat.spider && checkCollision(this, plat.spider.getRect())) {
          assets.hurtSfx.play();
          this.vy = Math.max(0, this.vy);
          this.disabled = true;
        }
      }

      if (!this.disabled) {
        this.onGround = false;
        for (let plat of platforms) {
          if (checkCollision(this, plat.getRect()) && this.vy >= 0) {
            this.y = plat.getRect().y - this.height;
            this.vy = 0;
            this.onGround = true;
          }
        }
      }

      if (this.y < HEIGHT / 3) {
        let dy = HEIGHT / 3 - this.y;
        this.y += dy;
        for (let plat of platforms) {
          plat.move(dy);
          if (plat.y > HEIGHT) plat.recycle();
        }
        score += Math.floor(dy);
      }

      if (this.y > HEIGHT) {
        assets.dieSfx.play();
        gameActive = false;
        gameOver = true;
        score = 0;
        currentDeathScreen = assets.deathScreens[randInt(0, 11)];
      }

      this.updateImage();
    }

    jump() {
      if (this.onGround) {
        this.vy = JUMP_VEL;
        assets.jumpSfx.play();
      }
    }

    setDir(d) {
      this.vx = d * MOVE_SPEED;
      if (d !== 0) this.facingRight = d > 0;
    }

    updateImage() {
      if (this.vy < -1) {
        this.image = this.facingRight ? assets.playerJumpRight : assets.playerJumpLeft;
      } else if (this.vy > 1) {
        this.image = this.facingRight ? assets.playerFallRight : assets.playerFallLeft;
      } else {
        this.image = this.facingRight ? assets.playerRight : assets.playerLeft;
      }
    }

    draw() {
      ctx.drawImage(this.image, this.x, this.y);
    }
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function checkCollision(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x &&
           a.y < b.y + b.height && a.y + a.height > b.y;
  }

  function generatePlatforms() {
    const plats = [];
    const spacing = HEIGHT / NUM_PLATFORMS;
    for (let i = 0; i < NUM_PLATFORMS; i++) {
      let x = randInt(0, WIDTH - PLATFORM_W);
      let y = HEIGHT - (i + 1) * spacing;
      let hasSpider = i !== 0 && Math.random() < 0.08;
      let plat = new Platform(x, y, hasSpider);
      plats.push(plat);
      if (i === 0) {
        player.x = plat.getRect().x + (plat.getRect().width - PLAYER_W) / 2;
        player.y = plat.getRect().y - PLAYER_H;
      }
    }
    return plats;
  }

  let player = new Player();
  let platforms = generatePlatforms();

    function drawScore() {
    ctx.fillStyle = "#000";
    ctx.font = "16px Arial";
    ctx.fillText(`Score: ${score}`, 10, 20);
  }

  function drawStartMenu() {
    ctx.drawImage(assets.startMenu, 0, 0);
  }

  function drawDeathScreen() {
    if (currentDeathScreen) {
      ctx.drawImage(currentDeathScreen, 0, 0);
    }
  }

  function gameLoop() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    if (!startMenuShown) {
      drawStartMenu();
    } else if (!gameActive) {
      gameOver ? drawDeathScreen() : drawStartMenu();
    } else {
      ctx.drawImage(assets.bg, 0, 0);

      // Keyboard controls
      let dir = 0;
      if (keys["a"]) dir -= 1;
      if (keys["d"]) dir += 1;
      player.setDir(dir);



      if (keys["w"]) player.jump();

      // Mobile controls
      if (mobileJumpQueued) {
        player.jump();
        mobileJumpQueued = false;
      }
      if (mobileDir !== 0) player.setDir(mobileDir);


      player.update();
      for (let plat of platforms) plat.draw();
      player.draw();
      drawScore();
    }

    loopId = requestAnimationFrame(gameLoop);
  }

  // 🔘 Button Wiring
  document.getElementById("start-froggy").onclick = () => {
    if (loopId) cancelAnimationFrame(loopId);
    assets.music.play();
    gameActive = true;
    startMenuShown = true;
    gameOver = false;
    player = new Player();
    platforms = generatePlatforms();
    gameLoop();
  };

  document.getElementById("restart-froggy").onclick = () => {
    if (loopId) cancelAnimationFrame(loopId);
    gameActive = true;
    gameOver = false;
    player = new Player();
    platforms = generatePlatforms();
    gameLoop();
  };

  document.getElementById("pause-froggy").onclick = () => {
    gameActive = false;
  };
}

// 🚀 Initialize Froggy Jump on page load
document.addEventListener("DOMContentLoaded", () => {
  initFroggyJump();
});


