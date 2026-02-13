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

// Hidden combat numbers: not displayed in HUD.
const hiddenStats = {
  playerBaseAttack: 22,
  playerAttackPerLevel: 3,
  monsterDefense: 4,
  eliteMaxHp: 3,
  eliteDefense: 10,
  bossMaxHp: 320,
  bossDefense: 7,
  bossMinHits: 10
};

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
  attackId: 0,
  crouching: false,
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
  respawnTimer: 0,
  lastHitAttackId: -1
}));

const keyItem = {
  active: false,
  collected: false,
  x: 0,
  y: 0,
  w: 24,
  h: 18
};

const eliteGuard = {
  x: 2620,
  y: 220,
  w: 64,
  h: 82,
  vx: 1.3,
  vy: 0,
  left: 2500,
  right: 2730,
  hp: hiddenStats.eliteMaxHp,
  maxHp: hiddenStats.eliteMaxHp,
  damage: 16,
  alive: true,
  hurtStun: 0,
  knock: 0,
  lastHitAttackId: -1
};

const boss = {
  active: false,
  alive: true,
  x: 4620,
  y: 250,
  w: 136,
  h: 92,
  vx: -1.7,
  vy: 0,
  hp: hiddenStats.bossMaxHp,
  maxHp: hiddenStats.bossMaxHp,
  touchDamage: 20,
  attackMode: "idle",
  modeTimer: 0,
  chargeCooldown: 240,
  fireballCooldown: 170,
  flameCooldown: 280,
  globalCooldown: 150,
  chargeDir: -1,
  chargeState: "none",
  chargeWindupFrames: 40,
  lastHitAttackId: -1
};

const fireballs = [];
const flamePillars = [];
const flameWarnings = [];
const confetti = [];

let cameraX = 0;
let gameOver = false;
let gameWin = false;
let statusMessage = "击败怪物，满5击杀升级；击败门口双角精英可掉落钥匙。";
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
  const attackY = player.crouching ? player.y + 30 : player.y + 12;
  const attackH = player.crouching ? 22 : player.h - 16;
  return {
    x: player.face > 0 ? player.x + player.w - 4 : player.x - 58 + 4,
    y: attackY,
    w: 58,
    h: attackH
  };
}

function getPlayerAttackPower() {
  return hiddenStats.playerBaseAttack + (player.level - 1) * hiddenStats.playerAttackPerLevel;
}

function getDamageAgainstMonster() {
  return 9999;
}

function getDamageAgainstElite() {
  const raw = Math.floor(getPlayerAttackPower() / 18) - hiddenStats.eliteDefense;
  return clamp(raw, 1, 1);
}

function getDamageAgainstBoss() {
  const raw = getPlayerAttackPower() - hiddenStats.bossDefense;
  const maxPerHit = Math.floor(hiddenStats.bossMaxHp / hiddenStats.bossMinHits) - 1;
  return clamp(raw, 12, maxPerHit);
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
  keyItem.active = true;
  keyItem.x = x + 10;
  keyItem.y = y + 22;
  setStatus("钥匙掉落了！快去拾取。", 300);
}

function updatePlayer() {
  if (gameOver || gameWin) return;

  const left = keys["a"] || keys["ArrowLeft"];
  const right = keys["d"] || keys["ArrowRight"];
  const jump = keys["w"] || keys["ArrowUp"] || keys[" "];
  const crouch = keys["s"] || keys["ArrowDown"];

  player.crouching = crouch && player.onGround;

  if (player.crouching) {
    player.vx *= 0.7;
    if (Math.abs(player.vx) < 0.15) player.vx = 0;
  } else if (left && !right) {
    player.vx = -player.speed;
    player.face = -1;
  } else if (right && !left) {
    player.vx = player.speed;
    player.face = 1;
  } else {
    player.vx *= 0.82;
    if (Math.abs(player.vx) < 0.15) player.vx = 0;
  }

  if (jump && player.onGround && !player.crouching) {
    player.vy = player.jumpPower;
    player.onGround = false;
  }

  if (player.attackCooldown > 0) player.attackCooldown -= 1;
  if (keys["j"] && player.attackCooldown <= 0) {
    player.attackTimer = 12;
    player.attackCooldown = 22;
    player.attackId += 1;
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

    if (atk && aabb(atk, m) && m.lastHitAttackId !== player.attackId) {
      m.lastHitAttackId = player.attackId;
      m.hp -= getDamageAgainstMonster();
      m.knock = 10;
      m.vx = player.face * 2.9;
      if (m.hp <= 0) {
        m.alive = false;
        m.respawnTimer = 520;
        gainExpAndLevel();
      }
    }
  }
}

function updateEliteGuard() {
  if (!eliteGuard.alive || gameOver || gameWin || player.inBossRoom) return;
  const atk = playerAttackBox();

  if (eliteGuard.hurtStun > 0) {
    eliteGuard.hurtStun -= 1;
    eliteGuard.x += eliteGuard.knock;
    eliteGuard.knock *= 0.84;
    if (Math.abs(eliteGuard.knock) < 0.2) eliteGuard.knock = 0;
  } else {
    eliteGuard.x += eliteGuard.vx;
    if (eliteGuard.x < eliteGuard.left || eliteGuard.x + eliteGuard.w > eliteGuard.right) {
      eliteGuard.vx *= -1;
    }
  }

  eliteGuard.vy += GRAVITY;
  eliteGuard.y += eliteGuard.vy;
  solvePlatforms(eliteGuard);

  if (aabb(player, eliteGuard)) {
    hitPlayer(eliteGuard.damage, eliteGuard.x + eliteGuard.w / 2);
  }

  if (atk && aabb(atk, eliteGuard) && eliteGuard.lastHitAttackId !== player.attackId) {
    eliteGuard.lastHitAttackId = player.attackId;
    eliteGuard.hp -= getDamageAgainstElite();
    eliteGuard.hurtStun = 18;
    eliteGuard.knock = player.face * 7.2;
    eliteGuard.vx = player.face * 1.4;
    if (eliteGuard.hp <= 0) {
      eliteGuard.hp = 0;
      eliteGuard.alive = false;
      gainExpAndLevel();
      tryDropKey(eliteGuard.x, eliteGuard.y);
      setStatus("双角精英守卫已被击败。", 260);
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
  const fx = clamp(player.x + player.w / 2 - 17, bossGateLeft + 30, WORLD_WIDTH - 80);
  flameWarnings.push({
    x: fx,
    y: GROUND_Y - 8,
    w: 34,
    h: 8,
    life: 26
  });
}

function spawnFlamePillarAt(x) {
  flamePillars.push({
    x,
    y: GROUND_Y - 10,
    w: 34,
    h: 0,
    life: 78,
    damage: 17
  });
}

function hasBossAttackRemnant() {
  return fireballs.length > 0 || flamePillars.length > 0 || flameWarnings.length > 0;
}

function chooseBossAttackMode() {
  if (boss.attackMode !== "idle") return;
  if (boss.globalCooldown > 0) return;
  if (hasBossAttackRemnant()) return;
  if (boss.flameCooldown <= 0) {
    boss.attackMode = "flame";
    boss.modeTimer = 0;
    return;
  }
  if (boss.chargeCooldown <= 0) {
    boss.attackMode = "charge";
    boss.modeTimer = boss.chargeWindupFrames;
    boss.chargeDir = player.x > boss.x ? 1 : -1;
    boss.chargeState = "windup";
    return;
  }
  if (boss.fireballCooldown <= 0) {
    boss.attackMode = "fireball";
    boss.modeTimer = 18;
  }
}

function updateBoss() {
  if (!boss.active || !boss.alive || gameOver || gameWin) return;
  const atk = playerAttackBox();

  boss.fireballCooldown -= 1;
  boss.chargeCooldown -= 1;
  boss.flameCooldown -= 1;
  if (boss.globalCooldown > 0) boss.globalCooldown -= 1;
  boss.x += boss.vx;
  if (boss.x < bossGateLeft + 120 || boss.x + boss.w > WORLD_WIDTH - 40) boss.vx *= -1;

  chooseBossAttackMode();
  if (boss.attackMode === "fireball") {
    boss.modeTimer -= 1;
    if (boss.modeTimer === 10) spawnFireball();
    if (boss.modeTimer <= 0) {
      boss.attackMode = "idle";
      boss.fireballCooldown = 210;
      boss.globalCooldown = 130;
    }
  } else if (boss.attackMode === "flame") {
    if (boss.modeTimer === 0) {
      spawnFlameWave();
      boss.modeTimer = -1;
    }
    if (flameWarnings.length === 0 && flamePillars.length === 0) {
      boss.attackMode = "idle";
      boss.flameCooldown = 320;
      boss.globalCooldown = 150;
      boss.modeTimer = 0;
    }
  } else if (boss.attackMode === "charge") {
    boss.modeTimer -= 1;
    if (boss.chargeState === "windup") {
      // Brief backstep before dashing, with red glow warning.
      boss.x -= boss.chargeDir * 2.2;
      if (boss.modeTimer <= 0) {
        boss.chargeState = "dash";
        boss.modeTimer = 34;
      }
    } else {
      boss.x += boss.chargeDir * 11.2;
      if (boss.x < bossGateLeft + 120 || boss.x + boss.w > WORLD_WIDTH - 40) {
        boss.chargeDir *= -1;
      }
      if (boss.modeTimer <= 0) {
        boss.attackMode = "idle";
        boss.chargeState = "none";
        boss.chargeCooldown = 260;
        boss.globalCooldown = 140;
        boss.vx = player.x > boss.x ? 2 : -2;
      }
    }
  }

  if (aabb(player, boss)) {
    hitPlayer(boss.touchDamage, boss.x + boss.w / 2);
  }

  if (atk && aabb(atk, boss) && boss.lastHitAttackId !== player.attackId) {
    boss.lastHitAttackId = player.attackId;
    boss.hp -= getDamageAgainstBoss();
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

  for (let i = flameWarnings.length - 1; i >= 0; i -= 1) {
    const w = flameWarnings[i];
    w.life -= 1;
    if (w.life <= 0) {
      spawnFlamePillarAt(w.x);
      flameWarnings.splice(i, 1);
    }
  }
}

function updateCamera() {
  const target = player.x - WIDTH * 0.35;
  cameraX += (target - cameraX) * 0.14;
  cameraX = clamp(cameraX, 0, WORLD_WIDTH - WIDTH);
}

function drawWallCandelabra(x, y, scale = 1) {
  ctx.fillStyle = "#6b7280";
  ctx.fillRect(x - 14 * scale, y, 28 * scale, 4 * scale);
  ctx.fillRect(x - 2 * scale, y - 8 * scale, 4 * scale, 10 * scale);
  ctx.fillStyle = "#d1d5db";
  ctx.fillRect(x - 10 * scale, y - 14 * scale, 6 * scale, 14 * scale);
  ctx.fillRect(x + 4 * scale, y - 14 * scale, 6 * scale, 14 * scale);
  ctx.fillStyle = "#fb923c";
  ctx.beginPath();
  ctx.arc(x - 7 * scale, y - 16 * scale, 3 * scale, 0, Math.PI * 2);
  ctx.arc(x + 7 * scale, y - 16 * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fde68a";
  ctx.fillRect(x - 8 * scale, y - 20 * scale, 2 * scale, 4 * scale);
  ctx.fillRect(x + 6 * scale, y - 20 * scale, 2 * scale, 4 * scale);
}

function drawCurtain(x, topY, h, w) {
  ctx.fillStyle = "#7f1d1d";
  ctx.fillRect(x, topY, w, h);
  ctx.fillStyle = "#991b1b";
  for (let i = 0; i < 4; i += 1) {
    ctx.fillRect(x + 6 + i * (w / 4), topY + 8, 5, h - 16);
  }
  ctx.fillStyle = "#f59e0b";
  ctx.fillRect(x - 2, topY, w + 4, 6);
}

function drawDoorAndCastle() {
  ctx.fillStyle = "#312e3d";
  ctx.fillRect(door.x - 180, 40, 500, 440);
  ctx.fillStyle = "#1f1b2e";
  ctx.fillRect(door.x - 140, 84, 420, 396);
  ctx.fillStyle = "#4b5563";
  for (let i = 0; i < 10; i += 1) {
    const cx = door.x - 136 + i * 40;
    ctx.fillRect(cx, 58, 26, 24);
  }

  drawCurtain(door.x - 126, 92, 250, 46);
  drawCurtain(door.x + 168, 92, 250, 46);
  drawWallCandelabra(door.x - 54, 214, 1.15);
  drawWallCandelabra(door.x + 202, 214, 1.15);

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
  ctx.fillStyle = "#2a1f33";
  ctx.fillRect(bossRoomStart - 20, 0, WORLD_WIDTH - bossRoomStart + 20, GROUND_Y);
  ctx.fillStyle = "#3f2b4a";
  for (let x = bossRoomStart; x < WORLD_WIDTH; x += 220) {
    ctx.fillRect(x + 26, 40, 86, 140);
  }
  for (let x = bossRoomStart + 140; x < WORLD_WIDTH - 120; x += 260) {
    drawWallCandelabra(x, 210, 1.35);
  }
  drawCurtain(bossRoomStart + 64, 70, 270, 52);
  drawCurtain(WORLD_WIDTH - 182, 70, 270, 52);

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
    // Regular demon
    ctx.fillStyle = "#7f1d1d";
    ctx.fillRect(m.x + 3, m.y + 6, m.w - 6, m.h - 6);
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(m.x + 11, m.y + 16, 8, 8);
    ctx.fillRect(m.x + 25, m.y + 16, 8, 8);
    ctx.fillStyle = "#111827";
    ctx.fillRect(m.x + 13, m.y + 18, 3, 3);
    ctx.fillRect(m.x + 27, m.y + 18, 3, 3);
    ctx.fillStyle = "#fef08a";
    ctx.beginPath();
    ctx.moveTo(m.x + 8, m.y + 7);
    ctx.lineTo(m.x + 14, m.y - 4);
    ctx.lineTo(m.x + 18, m.y + 7);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(m.x + m.w - 8, m.y + 7);
    ctx.lineTo(m.x + m.w - 14, m.y - 4);
    ctx.lineTo(m.x + m.w - 18, m.y + 7);
    ctx.fill();
    ctx.fillStyle = "#fca5a5";
    ctx.fillRect(m.x + 17, m.y + 30, 10, 6);
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

  for (const w of flameWarnings) {
    const pulse = w.life % 10 < 5;
    ctx.fillStyle = pulse ? "#ef4444cc" : "#fca5a599";
    ctx.fillRect(w.x - 2, w.y, w.w + 4, w.h);
    ctx.strokeStyle = "#fee2e2";
    ctx.strokeRect(w.x - 2, w.y, w.w + 4, w.h);
  }

  if (boss.active && boss.alive) {
    if (boss.attackMode === "charge" && boss.chargeState === "windup") {
      ctx.fillStyle = "#ef444466";
      ctx.fillRect(boss.x - 10, boss.y - 10, boss.w + 20, boss.h + 20);
    }
    const dragonFace = player.x >= boss.x ? 1 : -1;
    const headX = dragonFace > 0 ? boss.x + boss.w - 44 : boss.x + 8;
    const headEyeX = dragonFace > 0 ? headX + 26 : headX + 10;

    // Wings
    ctx.fillStyle = "#7f1d1d";
    ctx.beginPath();
    ctx.moveTo(boss.x + 16, boss.y + 40);
    ctx.lineTo(boss.x - 32, boss.y + 4);
    ctx.lineTo(boss.x + 4, boss.y + 62);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(boss.x + boss.w - 16, boss.y + 40);
    ctx.lineTo(boss.x + boss.w + 32, boss.y + 4);
    ctx.lineTo(boss.x + boss.w - 4, boss.y + 62);
    ctx.fill();

    // Tail
    ctx.fillStyle = "#991b1b";
    if (dragonFace > 0) {
      ctx.fillRect(boss.x - 26, boss.y + 58, 30, 12);
      ctx.beginPath();
      ctx.moveTo(boss.x - 26, boss.y + 58);
      ctx.lineTo(boss.x - 38, boss.y + 64);
      ctx.lineTo(boss.x - 26, boss.y + 70);
      ctx.fill();
    } else {
      ctx.fillRect(boss.x + boss.w - 4, boss.y + 58, 30, 12);
      ctx.beginPath();
      ctx.moveTo(boss.x + boss.w + 26, boss.y + 58);
      ctx.lineTo(boss.x + boss.w + 38, boss.y + 64);
      ctx.lineTo(boss.x + boss.w + 26, boss.y + 70);
      ctx.fill();
    }

    // Body
    ctx.fillStyle = "#991b1b";
    ctx.fillRect(boss.x + 10, boss.y + 22, boss.w - 20, boss.h - 16);
    ctx.fillStyle = "#fca5a5";
    ctx.fillRect(boss.x + 24, boss.y + 42, boss.w - 48, 24);

    // Head and jaw
    ctx.fillStyle = "#7f1d1d";
    ctx.fillRect(headX, boss.y + 16, 36, 26);
    ctx.fillRect(headX + (dragonFace > 0 ? 24 : -6), boss.y + 30, 20, 12);
    ctx.fillStyle = "#fecaca";
    ctx.fillRect(headX + (dragonFace > 0 ? 20 : -2), boss.y + 38, 12, 6);

    // Horns
    ctx.fillStyle = "#fef08a";
    ctx.beginPath();
    ctx.moveTo(headX + 6, boss.y + 16);
    ctx.lineTo(headX - 2, boss.y + 2);
    ctx.lineTo(headX + 12, boss.y + 16);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(headX + 28, boss.y + 16);
    ctx.lineTo(headX + 36, boss.y + 2);
    ctx.lineTo(headX + 22, boss.y + 16);
    ctx.fill();

    // Eye and nostril
    ctx.fillStyle = "#111827";
    ctx.fillRect(headEyeX, boss.y + 22, 6, 6);
    ctx.fillStyle = "#fb7185";
    ctx.fillRect(headEyeX + 1, boss.y + 23, 3, 3);
    ctx.fillStyle = "#111827";
    ctx.fillRect(headX + (dragonFace > 0 ? 34 : 0), boss.y + 34, 2, 2);

    // Claws
    ctx.fillStyle = "#7c2d12";
    ctx.fillRect(boss.x + 28, boss.y + boss.h - 2, 18, 8);
    ctx.fillRect(boss.x + boss.w - 46, boss.y + boss.h - 2, 18, 8);
  }

  if (eliteGuard.alive && !player.inBossRoom) {
    // Larger elite demon with exaggerated horns.
    ctx.fillStyle = "#7f1d1d";
    ctx.fillRect(eliteGuard.x, eliteGuard.y, eliteGuard.w, eliteGuard.h);
    ctx.fillStyle = "#fca5a5";
    ctx.fillRect(eliteGuard.x + 14, eliteGuard.y + 20, 10, 10);
    ctx.fillRect(eliteGuard.x + 40, eliteGuard.y + 20, 10, 10);
    ctx.fillStyle = "#111827";
    ctx.fillRect(eliteGuard.x + 16, eliteGuard.y + 22, 4, 4);
    ctx.fillRect(eliteGuard.x + 42, eliteGuard.y + 22, 4, 4);
    ctx.fillStyle = "#fef08a";
    ctx.beginPath();
    ctx.moveTo(eliteGuard.x + 10, eliteGuard.y + 6);
    ctx.lineTo(eliteGuard.x + 20, eliteGuard.y - 18);
    ctx.lineTo(eliteGuard.x + 30, eliteGuard.y + 6);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(eliteGuard.x + 54, eliteGuard.y + 6);
    ctx.lineTo(eliteGuard.x + 44, eliteGuard.y - 18);
    ctx.lineTo(eliteGuard.x + 34, eliteGuard.y + 6);
    ctx.fill();
    ctx.fillStyle = "#b91c1c";
    ctx.fillRect(eliteGuard.x + 20, eliteGuard.y + 44, 24, 12);
  }

  if (!(player.invulnTimer > 0 && player.invulnTimer % 8 < 4)) {
    if (player.crouching) {
      // Crouching adventurer pose.
      ctx.fillStyle = "#991b1b";
      if (player.face > 0) {
        ctx.beginPath();
        ctx.moveTo(player.x + 10, player.y + 28);
        ctx.lineTo(player.x + 3, player.y + 46);
        ctx.lineTo(player.x + 15, player.y + 58);
        ctx.lineTo(player.x + 22, player.y + 30);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(player.x + 32, player.y + 28);
        ctx.lineTo(player.x + 39, player.y + 46);
        ctx.lineTo(player.x + 27, player.y + 58);
        ctx.lineTo(player.x + 20, player.y + 30);
        ctx.fill();
      }
      ctx.fillStyle = "#1f2937";
      ctx.fillRect(player.x + 10, player.y + 24, 24, 24);
      ctx.fillStyle = "#f1c27d";
      ctx.fillRect(player.x + 15, player.y + 18, 12, 10);
      ctx.fillStyle = "#7c2d12";
      ctx.fillRect(player.x + 12, player.y + 50, 10, 8);
      ctx.fillRect(player.x + 22, player.y + 50, 10, 8);
      ctx.fillStyle = "#111827";
      ctx.fillRect(player.x + 18, player.y + 21, 2, 2);
      ctx.fillRect(player.x + 23, player.y + 21, 2, 2);
    } else {
      // Standing adventurer body.
      ctx.fillStyle = "#1f2937";
      ctx.fillRect(player.x + 11, player.y + 10, 20, 42);
      ctx.fillStyle = "#f1c27d";
      ctx.fillRect(player.x + 14, player.y + 2, 14, 12);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(player.x + 13, player.y, 16, 4);
      // Cape
      ctx.fillStyle = "#991b1b";
      if (player.face > 0) {
        ctx.beginPath();
        ctx.moveTo(player.x + 11, player.y + 14);
        ctx.lineTo(player.x + 2, player.y + 42);
        ctx.lineTo(player.x + 14, player.y + 58);
        ctx.lineTo(player.x + 20, player.y + 16);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(player.x + 31, player.y + 14);
        ctx.lineTo(player.x + 40, player.y + 42);
        ctx.lineTo(player.x + 28, player.y + 58);
        ctx.lineTo(player.x + 22, player.y + 16);
        ctx.fill();
      }
      ctx.fillStyle = "#7c2d12";
      ctx.fillRect(player.x + 12, player.y + 52, 7, 8);
      ctx.fillRect(player.x + 23, player.y + 52, 7, 8);
      ctx.fillStyle = "#111827";
      ctx.fillRect(player.x + 17, player.y + 6, 2, 2);
      ctx.fillRect(player.x + 23, player.y + 6, 2, 2);
    }
  }

  const atk = playerAttackBox();
  if (atk) {
    const swordBaseX = player.face > 0 ? player.x + player.w - 2 : player.x + 2;
    const swordBaseY = player.crouching ? player.y + 40 : player.y + 26;
    const bladeX = swordBaseX + player.face * 8;
    const bladeY = swordBaseY - 2;
    const bladeW = 36;
    const bladeH = 8;
    ctx.fillStyle = "#e5e7eb";
    if (player.face > 0) {
      ctx.fillRect(bladeX, bladeY, bladeW, bladeH);
      ctx.beginPath();
      ctx.moveTo(bladeX + bladeW, bladeY);
      ctx.lineTo(bladeX + bladeW + 8, bladeY + bladeH / 2);
      ctx.lineTo(bladeX + bladeW, bladeY + bladeH);
      ctx.fill();
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(bladeX - 8, bladeY + 1, 8, 6);
      ctx.fillStyle = "#7c2d12";
      ctx.fillRect(bladeX - 14, bladeY + 2, 6, 4);
    } else {
      ctx.fillRect(bladeX - bladeW, bladeY, bladeW, bladeH);
      ctx.beginPath();
      ctx.moveTo(bladeX - bladeW, bladeY);
      ctx.lineTo(bladeX - bladeW - 8, bladeY + bladeH / 2);
      ctx.lineTo(bladeX - bladeW, bladeY + bladeH);
      ctx.fill();
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(bladeX, bladeY + 1, 8, 6);
      ctx.fillStyle = "#7c2d12";
      ctx.fillRect(bladeX + 8, bladeY + 2, 6, 4);
    }
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
  updateEliteGuard();
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
