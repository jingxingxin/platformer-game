const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const WORLD_WIDTH = 2800;
const GRAVITY = 0.72;
const GROUND_Y = 470;

const keys = Object.create(null);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const platforms = [
  { x: 0, y: GROUND_Y, w: WORLD_WIDTH, h: 70 },
  { x: 280, y: 380, w: 220, h: 20 },
  { x: 650, y: 330, w: 260, h: 20 },
  { x: 1080, y: 390, w: 220, h: 20 },
  { x: 1450, y: 320, w: 280, h: 20 },
  { x: 1870, y: 370, w: 220, h: 20 },
  { x: 2240, y: 310, w: 240, h: 20 }
];

const player = {
  x: 100,
  y: 200,
  w: 42,
  h: 60,
  vx: 0,
  vy: 0,
  speed: 4.4,
  jumpPower: -14.8,
  onGround: false,
  face: 1,
  hp: 100,
  maxHp: 100,
  invulnTimer: 0,
  attackTimer: 0,
  attackCooldown: 0,
  level: 1,
  exp: 0,
  kills: 0
};

const monsterSeed = [
  { x: 420, y: 250, left: 300, right: 560 },
  { x: 780, y: 220, left: 680, right: 930 },
  { x: 1160, y: 260, left: 1040, right: 1280 },
  { x: 1540, y: 210, left: 1450, right: 1720 },
  { x: 1950, y: 230, left: 1880, right: 2080 },
  { x: 2360, y: 190, left: 2260, right: 2500 }
];

const monsters = monsterSeed.map((m) => ({
  x: m.x,
  y: m.y,
  w: 44,
  h: 52,
  vx: Math.random() > 0.5 ? 1.2 : -1.2,
  vy: 0,
  hp: 32,
  damage: 12,
  left: m.left,
  right: m.right,
  alive: true,
  knock: 0
}));

let cameraX = 0;
let gameOver = false;
let gameWin = false;

function aabb(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function solvePlatforms(body) {
  body.onGround = false;
  for (const p of platforms) {
    if (
      body.x + body.w > p.x &&
      body.x < p.x + p.w &&
      body.y + body.h > p.y &&
      body.y + body.h - body.vy <= p.y
    ) {
      body.y = p.y - body.h;
      body.vy = 0;
      body.onGround = true;
    }
  }
}

function hitPlayer(damage, fromX) {
  if (player.invulnTimer > 0 || gameOver || gameWin) return;
  player.hp = Math.max(0, player.hp - damage);
  player.invulnTimer = 50;
  player.vx = fromX < player.x ? 5 : -5;
  player.vy = -6;
  if (player.hp <= 0) gameOver = true;
}

function playerAttackBox() {
  const active = player.attackTimer > 0;
  if (!active) return null;
  const w = 54;
  return {
    x: player.face > 0 ? player.x + player.w - 4 : player.x - w + 4,
    y: player.y + 12,
    w,
    h: player.h - 16
  };
}

function gainExpAndLevel() {
  player.kills += 1;
  player.exp += 20;
  const nextLevel = Math.floor(player.kills / 5) + 1;
  if (nextLevel > player.level) {
    player.level = nextLevel;
    player.maxHp += 12;
    player.hp = Math.min(player.maxHp, player.hp + 22);
  }
}

function updatePlayer() {
  if (gameOver || gameWin) return;

  const left = keys["a"] || keys["ArrowLeft"];
  const right = keys["d"] || keys["ArrowRight"];
  const jump = keys["w"] || keys["ArrowUp"] || keys[" "];

  if (left && !right) {
    player.vx = -player.speed;
    player.face = -1;
  } else if (right && !left) {
    player.vx = player.speed;
    player.face = 1;
  } else {
    player.vx *= 0.82;
    if (Math.abs(player.vx) < 0.15) player.vx = 0;
  }

  if (jump && player.onGround) {
    player.vy = player.jumpPower;
    player.onGround = false;
  }

  if (player.attackCooldown > 0) player.attackCooldown -= 1;
  if (keys["j"] && player.attackCooldown <= 0) {
    player.attackTimer = 12;
    player.attackCooldown = 22;
  }
  if (player.attackTimer > 0) player.attackTimer -= 1;
  if (player.invulnTimer > 0) player.invulnTimer -= 1;

  player.vy += GRAVITY;
  player.x += player.vx;
  player.y += player.vy;
  solvePlatforms(player);

  player.x = clamp(player.x, 0, WORLD_WIDTH - player.w);
  if (player.y > HEIGHT + 300) {
    player.hp = 0;
    gameOver = true;
  }
}

function updateMonsters() {
  if (gameOver || gameWin) return;
  const atk = playerAttackBox();

  for (const m of monsters) {
    if (!m.alive) continue;

    if (m.knock > 0) {
      m.knock -= 1;
    } else {
      m.x += m.vx;
      if (m.x < m.left || m.x + m.w > m.right) m.vx *= -1;
    }

    m.vy += GRAVITY;
    m.y += m.vy;
    solvePlatforms(m);

    if (aabb(player, m)) {
      hitPlayer(m.damage, m.x);
    }

    if (atk && aabb(atk, m)) {
      m.hp -= 16;
      m.knock = 10;
      m.vx = player.face * 2.8;
      if (m.hp <= 0) {
        m.alive = false;
        gainExpAndLevel();
      }
    }
  }

  if (monsters.every((m) => !m.alive)) gameWin = true;
}

function updateCamera() {
  const target = player.x - WIDTH * 0.35;
  cameraX += (target - cameraX) * 0.14;
  cameraX = clamp(cameraX, 0, WORLD_WIDTH - WIDTH);
}

function drawWorld() {
  ctx.fillStyle = "#040714";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  ctx.translate(-cameraX, 0);

  for (let i = 0; i < WORLD_WIDTH; i += 160) {
    ctx.fillStyle = i % 320 === 0 ? "#1f2937" : "#172033";
    ctx.fillRect(i, 0, 80, GROUND_Y);
  }

  ctx.fillStyle = "#374151";
  for (const p of platforms) {
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = "#64748b";
    ctx.fillRect(p.x, p.y, p.w, 4);
    ctx.fillStyle = "#374151";
  }

  for (const m of monsters) {
    if (!m.alive) continue;
    ctx.fillStyle = "#b91c1c";
    ctx.fillRect(m.x, m.y, m.w, m.h);
    ctx.fillStyle = "#fca5a5";
    ctx.fillRect(m.x + 8, m.y + 10, 8, 8);
    ctx.fillRect(m.x + 28, m.y + 10, 8, 8);
    ctx.fillStyle = "#111827";
    ctx.fillRect(m.x + 10, m.y + 12, 4, 4);
    ctx.fillRect(m.x + 30, m.y + 12, 4, 4);
  }

  if (!(player.invulnTimer > 0 && player.invulnTimer % 8 < 4)) {
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(player.x, player.y, player.w, player.h);
    ctx.fillStyle = "#111827";
    ctx.fillRect(player.x + 10, player.y + 14, 6, 6);
    ctx.fillRect(player.x + 26, player.y + 14, 6, 6);
  }

  const atk = playerAttackBox();
  if (atk) {
    ctx.fillStyle = "#fde68a88";
    ctx.fillRect(atk.x, atk.y, atk.w, atk.h);
  }

  ctx.restore();
}

function drawHud() {
  ctx.fillStyle = "#020617cc";
  ctx.fillRect(14, 12, 320, 110);

  ctx.strokeStyle = "#64748b";
  ctx.strokeRect(14, 12, 320, 110);

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "18px sans-serif";
  ctx.fillText(`等级 Lv.${player.level}`, 28, 38);
  ctx.fillText(`经验 ${player.exp}`, 28, 62);
  ctx.fillText(`击杀 ${player.kills}/5 (下一级)`, 28, 86);

  const hpW = 170;
  ctx.fillStyle = "#334155";
  ctx.fillRect(146, 46, hpW, 18);
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(146, 46, hpW * (player.hp / player.maxHp), 18);
  ctx.strokeStyle = "#94a3b8";
  ctx.strokeRect(146, 46, hpW, 18);
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "14px sans-serif";
  ctx.fillText(`HP ${player.hp}/${player.maxHp}`, 176, 60);

  const aliveCount = monsters.filter((m) => m.alive).length;
  ctx.fillStyle = "#fde68a";
  ctx.fillText(`剩余怪物: ${aliveCount}`, 28, 108);
}

function drawResult() {
  if (!gameOver && !gameWin) return;
  ctx.fillStyle = "#000000aa";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#f8fafc";
  ctx.textAlign = "center";
  ctx.font = "48px sans-serif";
  ctx.fillText(gameWin ? "胜利！" : "你被击败了", WIDTH / 2, HEIGHT / 2 - 14);
  ctx.font = "24px sans-serif";
  ctx.fillText("刷新页面可重新开始", WIDTH / 2, HEIGHT / 2 + 34);
  ctx.textAlign = "start";
}

function loop() {
  updatePlayer();
  updateMonsters();
  updateCamera();
  drawWorld();
  drawHud();
  drawResult();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  keys[k] = true;
  if (["ArrowLeft", "ArrowRight", "ArrowUp", " "].includes(k)) e.preventDefault();
});

window.addEventListener("keyup", (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  keys[k] = false;
});

loop();
