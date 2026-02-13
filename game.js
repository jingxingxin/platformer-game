const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const WORLD_WIDTH = 5200;
const GRAVITY = 0.72;
const GROUND_Y = 470;

const keys = Object.create(null);
const keyPressed = Object.create(null);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const MAIN_END_X = 3000;
const door = {
  x: 2760,
  y: 190,
  w: 150,
  h: 280,
  open: false
};

const bossRoomStart = 3240;
const bossGateLeft = bossRoomStart - 36;

const platforms = [
  { x: 0, y: GROUND_Y, w: WORLD_WIDTH, h: 70 },
  { x: 280, y: 380, w: 220, h: 20 },
  { x: 650, y: 330, w: 260, h: 20 },
  { x: 1080, y: 390, w: 220, h: 20 },
  { x: 1450, y: 320, w: 280, h: 20 },
  { x: 1870, y: 370, w: 220, h: 20 },
  { x: 2240, y: 310, w: 240, h: 20 },
  { x: 2520, y: 355, w: 200, h: 20 },
  { x: 3440, y: 380, w: 220, h: 20 },
  { x: 3800, y: 340, w: 260, h: 20 },
  { x: 4200, y: 390, w: 220, h: 20 },
  { x: 4560, y: 330, w: 260, h: 20 }
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
  hp: 120,
  maxHp: 120,
  invulnTimer: 0,
  attackTimer: 0,
  attackCooldown: 0,
  level: 1,
  exp: 0,
  kills: 0,
  hasKey: false,
  inBossRoom: false
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
  seedX: m.x,
  seedY: m.y,
  x: m.x,
  y: m.y,
  w: 44,
  h: 52,
  vx: Math.random() > 0.5 ? 1.2 : -1.2,
  vy: 0,
  hp: 36,
  maxHp: 36,
  damage: 11,
  left: m.left,
  right: m.right,
  alive: true,
  knock: 0,
  respawnTimer: 0
}));

const keyItem = {
  active: false,
  collected: false,
  x: 0,
  y: 0,
  w: 24,
  h: 18
};

const boss = {
  active: false,
  alive: true,
  x: 4620,
  y: 250,
  w: 180,
  h: 120,
  vx: -1.7,
  vy: 0,
  hp: 220,
  maxHp: 220,
  touchDamage: 20,
  attackTimer: 0,
  phase: "idle",
  chargeCooldown: 200,
  fireballCooldown: 95,
  flameCooldown: 170,
  chargeDir: -1
};

const fireballs = [];
const flamePillars = [];
const confetti = [];

let cameraX = 0;
let gameOver = false;
let gameWin = false;
let statusMessage = "击败怪物，满5击杀升级；击杀6只会掉落钥匙。";
let statusTimer = 400;

function aabb(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function setStatus(message, time = 240) {
  statusMessage = message;
  statusTimer = time;
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
  player.invulnTimer = 52;
  player.vx = fromX < player.x ? 5.8 : -5.8;
  player.vy = -6;
  if (player.hp <= 0) {
    gameOver = true;
  }
}

function playerAttackBox() {
  if (player.attackTimer <= 0) return null;
  return {
    x: player.face > 0 ? player.x + player.w - 4 : player.x - 58 + 4,
    y: player.y + 12,
    w: 58,
    h: player.h - 16
  };
}

function gainExpAndLevel() {
  player.kills += 1;
  player.exp += 20;
  const nextLevel = Math.floor(player.kills / 5) + 1;
  if (nextLevel > player.level) {
    player.level = nextLevel;
    player.maxHp += 14;
    player.hp = Math.min(player.maxHp, player.hp + 25);
    setStatus(`升级成功！当前 Lv.${player.level}`);
  }
}

function tryDropKey(x, y) {
  if (keyItem.active || keyItem.collected) return;
  if (player.kills >= 6) {
    keyItem.active = true;
    keyItem.x = x + 10;
    keyItem.y = y + 22;
    setStatus("钥匙掉落了！快去拾取。", 300);
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
  if (statusTimer > 0) statusTimer -= 1;

  player.vy += GRAVITY;
  player.x += player.vx;
  player.y += player.vy;
  solvePlatforms(player);

  if (!player.inBossRoom) {
    if (!door.open && player.x + player.w > door.x + 8) {
      player.x = door.x + 8 - player.w;
      player.vx = Math.min(player.vx, 0);
    }
    player.x = clamp(player.x, 0, MAIN_END_X - player.w);
  } else {
    player.x = clamp(player.x, bossGateLeft, WORLD_WIDTH - player.w);
    if (player.x < bossGateLeft + 4) {
      player.x = bossGateLeft + 4;
    }
  }

  if (player.y > HEIGHT + 300) {
    player.hp = 0;
    gameOver = true;
  }
}

function updateMonsters() {
  if (gameOver || gameWin) return;
  const atk = playerAttackBox();

  for (const m of monsters) {
    if (!m.alive) {
      if (m.respawnTimer > 0) {
        m.respawnTimer -= 1;
      } else {
        m.alive = true;
        m.hp = m.maxHp;
        m.x = m.seedX;
        m.y = m.seedY;
        m.vx = Math.random() > 0.5 ? 1.2 : -1.2;
        m.vy = 0;
      }
      continue;
    }

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
      m.hp -= 18;
      m.knock = 10;
      m.vx = player.face * 2.9;
      if (m.hp <= 0) {
        m.alive = false;
        m.respawnTimer = 520;
        gainExpAndLevel();
        tryDropKey(m.x, m.y);
      }
    }
  }
}

function updateKeyItem() {
  if (!keyItem.active || keyItem.collected || gameOver || gameWin) return;
  if (
    player.x + player.w > keyItem.x &&
    player.x < keyItem.x + keyItem.w &&
    player.y + player.h > keyItem.y &&
    player.y < keyItem.y + keyItem.h
  ) {
    keyItem.active = false;
    keyItem.collected = true;
    player.hasKey = true;
    setStatus("你拾取了钥匙！去右侧大厅门前按 E 开门。", 320);
  }
}

function updateDoorAndTransition() {
  if (gameOver || gameWin) return;
  const nearDoor =
    !player.inBossRoom &&
    player.x + player.w > door.x - 20 &&
    player.x < door.x + door.w + 20 &&
    player.y + player.h > door.y + 20;

  if (nearDoor && !door.open && !player.hasKey && keyPressed["e"]) {
    setStatus("门被封印，需要钥匙。");
  }

  if (nearDoor && !door.open && player.hasKey && keyPressed["e"]) {
    door.open = true;
    player.hasKey = false;
    setStatus("钥匙已消耗，大厅门开启！前往 Boss 房间。", 320);
  }

  if (!player.inBossRoom && door.open && player.x > door.x + door.w + 14) {
    player.inBossRoom = true;
    player.x = bossRoomStart + 40;
    player.y = 230;
    player.vx = 0;
    player.vy = 0;
    boss.active = true;
    setStatus("恶龙苏醒！小心它的三种攻击。", 300);
  }
}

function spawnFireball() {
  const dir = player.x > boss.x ? 1 : -1;
  fireballs.push({
    x: boss.x + (dir > 0 ? boss.w - 20 : 20),
    y: boss.y + 36,
    w: 22,
    h: 22,
    vx: dir * 5.1,
    damage: 16
  });
}

function spawnFlameWave() {
  for (let i = 0; i < 4; i += 1) {
    flamePillars.push({
      x: clamp(player.x - 140 + i * 90, bossGateLeft + 30, WORLD_WIDTH - 80),
      y: GROUND_Y - 10,
      w: 34,
      h: 0,
      life: 70,
      damage: 17
    });
  }
}

function updateBoss() {
  if (!boss.active || !boss.alive || gameOver || gameWin) return;
  const atk = playerAttackBox();

  boss.fireballCooldown -= 1;
  boss.chargeCooldown -= 1;
  boss.flameCooldown -= 1;

  if (boss.phase === "charge") {
    boss.attackTimer -= 1;
    boss.x += boss.chargeDir * 8;
    if (boss.x < bossGateLeft + 120 || boss.x + boss.w > WORLD_WIDTH - 40) {
      boss.chargeDir *= -1;
    }
    if (boss.attackTimer <= 0) {
      boss.phase = "idle";
      boss.vx = player.x > boss.x ? 1.8 : -1.8;
    }
  } else {
    boss.x += boss.vx;
    if (boss.x < bossGateLeft + 120 || boss.x + boss.w > WORLD_WIDTH - 40) boss.vx *= -1;

    if (boss.fireballCooldown <= 0) {
      spawnFireball();
      boss.fireballCooldown = 90;
    }
    if (boss.flameCooldown <= 0) {
      spawnFlameWave();
      boss.flameCooldown = 190;
    }
    if (boss.chargeCooldown <= 0) {
      boss.phase = "charge";
      boss.attackTimer = 44;
      boss.chargeDir = player.x > boss.x ? 1 : -1;
      boss.chargeCooldown = 210;
    }
  }

  if (aabb(player, boss)) {
    hitPlayer(boss.touchDamage, boss.x + boss.w / 2);
  }

  if (atk && aabb(atk, boss)) {
    boss.hp -= 20;
    boss.x += player.face * 8;
    if (boss.hp <= 0) {
      boss.hp = 0;
      boss.alive = false;
      gameWin = true;
      setStatus("恶龙倒下！城堡重归宁静。", 9999);
      for (let i = 0; i < 120; i += 1) {
        confetti.push({
          x: Math.random() * WIDTH,
          y: -Math.random() * HEIGHT,
          vx: (Math.random() - 0.5) * 4,
          vy: 2 + Math.random() * 4,
          size: 4 + Math.random() * 6,
          c: ["#f43f5e", "#22d3ee", "#f59e0b", "#a3e635", "#ffffff"][i % 5]
        });
      }
    }
  }
}

function updateBossProjectiles() {
  if (gameOver || gameWin) return;
  for (let i = fireballs.length - 1; i >= 0; i -= 1) {
    const f = fireballs[i];
    f.x += f.vx;
    if (f.x < bossGateLeft - 60 || f.x > WORLD_WIDTH + 50) {
      fireballs.splice(i, 1);
      continue;
    }
    if (aabb(player, f)) {
      hitPlayer(f.damage, f.x);
      fireballs.splice(i, 1);
    }
  }

  for (let i = flamePillars.length - 1; i >= 0; i -= 1) {
    const p = flamePillars[i];
    p.life -= 1;
    p.h = p.life > 45 ? p.h + 8 : Math.max(0, p.h - 6);
    p.y = GROUND_Y - p.h;
    if (p.life <= 0) {
      flamePillars.splice(i, 1);
      continue;
    }
    if (p.h > 20 && aabb(player, p)) {
      hitPlayer(p.damage, p.x);
    }
  }
}

function updateCamera() {
  const target = player.x - WIDTH * 0.35;
  cameraX += (target - cameraX) * 0.14;
  cameraX = clamp(cameraX, 0, WORLD_WIDTH - WIDTH);
}

function drawDoorAndCastle() {
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(door.x - 130, 60, 390, 420);
  ctx.fillStyle = "#111827";
  ctx.fillRect(door.x - 100, 95, 330, 375);
  ctx.fillStyle = "#374151";
  for (let i = 0; i < 8; i += 1) {
    const cx = door.x - 96 + i * 42;
    ctx.fillRect(cx, 70, 30, 30);
  }

  if (!door.open) {
    ctx.fillStyle = "#7c2d12";
    ctx.fillRect(door.x, door.y, door.w, door.h);
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(door.x + 60, door.y + 128, 18, 18);
  } else {
    ctx.fillStyle = "#7c2d1244";
    ctx.fillRect(door.x + 112, door.y, 38, door.h);
    ctx.fillStyle = "#fef3c7";
    ctx.fillRect(door.x + 2, door.y + 4, 110, door.h - 8);
  }
}

function drawBossRoomBackground() {
  ctx.fillStyle = "#1e1b4b";
  ctx.fillRect(bossRoomStart - 20, 0, WORLD_WIDTH - bossRoomStart + 20, GROUND_Y);
  ctx.fillStyle = "#312e81";
  for (let x = bossRoomStart; x < WORLD_WIDTH; x += 180) {
    ctx.fillRect(x + 30, 50, 70, 120);
  }
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(bossGateLeft, 0, 16, GROUND_Y + 70);
}

function drawWorld() {
  ctx.fillStyle = "#040714";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  ctx.translate(-cameraX, 0);

  for (let i = 0; i < MAIN_END_X; i += 160) {
    ctx.fillStyle = i % 320 === 0 ? "#1f2937" : "#172033";
    ctx.fillRect(i, 0, 80, GROUND_Y);
  }
  drawBossRoomBackground();
  drawDoorAndCastle();

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

  if (keyItem.active && !keyItem.collected) {
    ctx.fillStyle = "#fde68a";
    ctx.fillRect(keyItem.x, keyItem.y, keyItem.w, keyItem.h);
    ctx.fillStyle = "#ca8a04";
    ctx.fillRect(keyItem.x + 18, keyItem.y + 6, 10, 6);
  }

  for (const f of fireballs) {
    ctx.fillStyle = "#fb923c";
    ctx.beginPath();
    ctx.arc(f.x, f.y, 12, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const p of flamePillars) {
    ctx.fillStyle = "#f97316";
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = "#facc15";
    ctx.fillRect(p.x + 6, p.y + 8, p.w - 12, Math.max(0, p.h - 16));
  }

  if (boss.active && boss.alive) {
    ctx.fillStyle = "#991b1b";
    ctx.fillRect(boss.x, boss.y, boss.w, boss.h);
    ctx.fillStyle = "#fca5a5";
    ctx.fillRect(boss.x + 22, boss.y + 24, 16, 16);
    ctx.fillRect(boss.x + 130, boss.y + 24, 16, 16);
    ctx.fillStyle = "#111827";
    ctx.fillRect(boss.x + 26, boss.y + 28, 8, 8);
    ctx.fillRect(boss.x + 134, boss.y + 28, 8, 8);
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(boss.x - 22, boss.y + 44, 20, 42);
    ctx.fillRect(boss.x + boss.w + 2, boss.y + 44, 20, 42);
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
  ctx.fillRect(14, 12, 530, 132);
  ctx.strokeStyle = "#64748b";
  ctx.strokeRect(14, 12, 530, 132);

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "18px sans-serif";
  ctx.fillText(`等级 Lv.${player.level}`, 28, 38);
  ctx.fillText(`经验 ${player.exp}`, 28, 62);
  ctx.fillText(`击杀 ${player.kills} (每5击杀升1级)`, 28, 86);
  ctx.fillStyle = player.hasKey ? "#fde68a" : "#94a3b8";
  ctx.fillText(`钥匙: ${player.hasKey ? "已持有" : keyItem.collected ? "已使用" : "未获得"}`, 28, 110);

  const hpW = 190;
  ctx.fillStyle = "#334155";
  ctx.fillRect(290, 26, hpW, 18);
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(290, 26, hpW * (player.hp / player.maxHp), 18);
  ctx.strokeStyle = "#94a3b8";
  ctx.strokeRect(290, 26, hpW, 18);
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "14px sans-serif";
  ctx.fillText(`HP ${player.hp}/${player.maxHp}`, 333, 40);

  ctx.fillStyle = "#cbd5e1";
  ctx.fillText(door.open ? "大厅门: 已开启" : "大厅门: 锁定", 290, 66);
  if (statusTimer > 0) {
    ctx.fillStyle = "#f8fafc";
    ctx.fillText(`状态: ${statusMessage}`, 290, 90);
  }
  if (!player.inBossRoom) {
    ctx.fillStyle = "#fbbf24";
    ctx.fillText("提示: 到右侧大门前按 E 互动", 290, 114);
  }

  if (boss.active) {
    ctx.fillStyle = "#111827dd";
    ctx.fillRect(220, 150, 520, 30);
    ctx.strokeStyle = "#94a3b8";
    ctx.strokeRect(220, 150, 520, 30);
    ctx.fillStyle = "#7f1d1d";
    ctx.fillRect(223, 153, 514 * (boss.hp / boss.maxHp), 24);
    ctx.fillStyle = "#fee2e2";
    ctx.font = "16px sans-serif";
    ctx.fillText("恶龙血条", 232, 171);
  }
}

function drawResult() {
  if (!gameOver && !gameWin) return;
  ctx.fillStyle = "#000000aa";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  if (gameWin) {
    for (const c of confetti) {
      c.x += c.vx;
      c.y += c.vy;
      if (c.y > HEIGHT + 10) {
        c.y = -10;
        c.x = Math.random() * WIDTH;
      }
      ctx.fillStyle = c.c;
      ctx.fillRect(c.x, c.y, c.size, c.size);
    }
  }

  ctx.fillStyle = "#f8fafc";
  ctx.textAlign = "center";
  ctx.font = "46px sans-serif";
  ctx.fillText(gameWin ? "恶龙已被讨伐，通关成功！" : "你被击败了", WIDTH / 2, HEIGHT / 2 - 16);
  ctx.font = "24px sans-serif";
  ctx.fillText(gameWin ? "城堡大厅烟花庆祝中" : "刷新页面可重新开始", WIDTH / 2, HEIGHT / 2 + 34);
  ctx.textAlign = "start";
}

function loop() {
  updatePlayer();
  updateMonsters();
  updateKeyItem();
  updateDoorAndTransition();
  updateBoss();
  updateBossProjectiles();
  updateCamera();
  drawWorld();
  drawHud();
  drawResult();
}

window.addEventListener("keydown", (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (!keys[k]) keyPressed[k] = true;
  keys[k] = true;
  if (["ArrowLeft", "ArrowRight", "ArrowUp", " "].includes(k)) e.preventDefault();
});

window.addEventListener("keyup", (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  keys[k] = false;
});

function clearPressedKeys() {
  for (const k of Object.keys(keyPressed)) {
    keyPressed[k] = false;
  }
}

function gameLoopWithInputReset() {
  loop();
  clearPressedKeys();
  requestAnimationFrame(gameLoopWithInputReset);
}

gameLoopWithInputReset();
