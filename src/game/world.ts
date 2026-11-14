import {
  ENEMIES,
  ENEMY_BULLET,
  MAX_ENEMIES,
  MAX_PARTICLES,
  PLAYER,
  RUN_SECONDS,
  UPGRADE_IDS,
  UPGRADES,
  enemyScale,
  spawnRate,
  xpToNext,
  type EnemyKind,
  type UpgradeId,
} from './config';
import { Rng } from './rng';
import type { Enemy, InputState, RunMods, World, WorldEvents } from './types';

export const DEFAULT_MODS: RunMods = { damageMul: 1, hpBonus: 0, speedMul: 1, xpMul: 1 };

/** Half-size of the area enemies spawn around (just outside a phone screen). */
const SPAWN_RADIUS = 520;
const DESPAWN_RADIUS = 1100;
const CELL = 64;

function emptyEvents(): WorldEvents {
  return { kills: 0, hurt: 0, levelUp: false, bossSpawned: false, bossKilled: false, died: false, pickups: 0 };
}

export function createWorld(seed: number, mods: RunMods = DEFAULT_MODS): World {
  const upgrades = Object.fromEntries(UPGRADE_IDS.map((id) => [id, 0])) as Record<UpgradeId, number>;
  const hp = PLAYER.hp + mods.hpBonus;
  return {
    seed,
    rng: seed >>> 0,
    time: 0,
    phase: 'playing',
    player: { x: 0, y: 0, hp, maxHp: hp, invuln: 0, aim: -Math.PI / 2 },
    enemies: [],
    bullets: [],
    enemyBullets: [],
    gems: [],
    particles: [],
    novas: [],
    upgrades,
    level: 1,
    xp: 0,
    kills: 0,
    offer: [],
    pendingLevels: 0,
    spawnBudget: 0,
    fireCooldown: 0.3,
    novaCooldown: 3,
    novaCounter: 0,
    orbitAngle: 0,
    bossSpawned: false,
    shake: 0,
    nextId: 1,
    mods,
    events: emptyEvents(),
  };
}

// ---------- derived stats ----------

export function stats(w: World) {
  const u = w.upgrades;
  return {
    damage: 3 * (1 + 0.25 * u.damage) * w.mods.damageMul,
    fireInterval: 0.42 / (1 + 0.18 * u.firerate),
    projectiles: 1 + u.multishot,
    pierce: u.pierce,
    bulletSpeed: 430 * (1 + 0.25 * u.blaster),
    bulletRadius: 4 * (1 + 0.15 * u.blaster),
    speed: PLAYER.speed * (1 + 0.1 * u.speed) * w.mods.speedMul,
    magnet: PLAYER.magnet * (1 + 0.45 * u.magnet),
    orbitCount: u.orbit === 0 ? 0 : u.orbit + 1,
    orbitRadius: 62 + u.orbit * 4,
    orbitSpeed: 2.6 + u.orbit * 0.35,
    orbitDamage: 5 * (1 + 0.2 * u.orbit) * (1 + 0.25 * u.damage) * w.mods.damageMul,
    novaInterval: u.nova === 0 ? Infinity : Math.max(1.4, 3.2 - u.nova * 0.35),
    novaRadius: 120 + u.nova * 28,
    novaDamage: 8 * (1 + 0.35 * u.nova) * (1 + 0.25 * u.damage) * w.mods.damageMul,
  };
}

// ---------- helpers ----------

function burst(w: World, rng: Rng, x: number, y: number, color: string, count: number, speed: number, size = 3) {
  for (let i = 0; i < count && w.particles.length < MAX_PARTICLES; i++) {
    const a = rng.next() * Math.PI * 2;
    const s = speed * (0.3 + rng.next() * 0.9);
    const life = 0.35 + rng.next() * 0.45;
    w.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, maxLife: life, size: size * (0.6 + rng.next() * 0.8), color });
  }
}

function spawnEnemy(w: World, rng: Rng, kind: EnemyKind, x?: number, y?: number) {
  const def = ENEMIES[kind];
  const scale = kind === 'boss' ? 1 : enemyScale(w.time);
  let ex = x;
  let ey = y;
  if (ex === undefined || ey === undefined) {
    const a = rng.next() * Math.PI * 2;
    ex = w.player.x + Math.cos(a) * SPAWN_RADIUS;
    ey = w.player.y + Math.sin(a) * SPAWN_RADIUS;
  }
  const hp = Math.round(def.hp * scale);
  w.enemies.push({
    id: w.nextId++,
    kind,
    x: ex,
    y: ey,
    hp,
    maxHp: hp,
    speed: def.speed * (kind === 'boss' ? 1 : 0.9 + rng.next() * 0.25),
    radius: def.radius,
    damage: Math.round(def.damage * (kind === 'boss' ? 1 : Math.sqrt(scale))),
    flash: 0,
    kx: 0,
    ky: 0,
    cooldown: 1 + rng.next() * 2,
    angle: rng.next() * Math.PI * 2,
    novaHit: -1,
  });
}

function pickKind(w: World, rng: Rng): EnemyKind {
  const pool = (Object.keys(ENEMIES) as EnemyKind[]).filter((k) => ENEMIES[k].from <= w.time && ENEMIES[k].weight > 0);
  const total = pool.reduce((s, k) => s + ENEMIES[k].weight, 0);
  let r = rng.next() * total;
  for (const k of pool) {
    r -= ENEMIES[k].weight;
    if (r < 0) return k;
  }
  return 'drone';
}

function damageEnemy(w: World, rng: Rng, e: Enemy, amount: number, fromX: number, fromY: number, knock: number) {
  e.hp -= amount;
  e.flash = 0.08;
  if (e.kind !== 'boss') {
    const dx = e.x - fromX;
    const dy = e.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    e.kx += (dx / d) * knock;
    e.ky += (dy / d) * knock;
  }
  if (e.hp <= 0) killEnemy(w, rng, e);
}

function killEnemy(w: World, rng: Rng, e: Enemy) {
  if (e.hp > -1e8) e.hp = -1e9; // mark dead; removed at end of step
  const def = ENEMIES[e.kind];
  w.kills += 1;
  w.events.kills += 1;
  burst(w, rng, e.x, e.y, def.color, e.kind === 'boss' ? 120 : 10 + Math.round(e.radius * 0.6), e.kind === 'boss' ? 420 : 220);
  burst(w, rng, e.x, e.y, '#ffffff', e.kind === 'boss' ? 40 : 3, 160, 2);
  w.shake = Math.min(18, w.shake + (e.kind === 'boss' ? 30 : e.radius > 15 ? 4 : 1.2));
  if (def.xp > 0) w.gems.push({ x: e.x, y: e.y, value: def.xp, pulled: false });
  if (e.kind === 'splitter') {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      spawnEnemy(w, rng, 'drone', e.x + Math.cos(a) * 14, e.y + Math.sin(a) * 14);
    }
  }
  if (e.kind === 'boss') {
    w.events.bossKilled = true;
    w.phase = 'won';
  }
}

function rollOffer(w: World, rng: Rng): UpgradeId[] {
  const available = UPGRADE_IDS.filter((id) => w.upgrades[id] < UPGRADES[id].maxLevel);
  // New weapons are a bit more likely early so runs diverge quickly.
  const weighted: UpgradeId[] = [];
  for (const id of available) {
    const weight = (id === 'orbit' || id === 'nova') && w.upgrades[id] === 0 ? 3 : 2;
    for (let i = 0; i < weight; i++) weighted.push(id);
  }
  const out: UpgradeId[] = [];
  while (out.length < 3 && weighted.length) {
    const pick = rng.pick(weighted);
    out.push(pick);
    for (let i = weighted.length - 1; i >= 0; i--) if (weighted[i] === pick) weighted.splice(i, 1);
  }
  return out;
}

function gainXp(w: World, rng: Rng, amount: number) {
  w.xp += amount * w.mods.xpMul;
  while (w.xp >= xpToNext(w.level)) {
    w.xp -= xpToNext(w.level);
    w.level += 1;
    w.pendingLevels += 1;
  }
  if (w.pendingLevels > 0 && w.phase === 'playing') {
    w.offer = rollOffer(w, rng);
    if (w.offer.length) {
      w.phase = 'levelup';
      w.events.levelUp = true;
    } else {
      w.pendingLevels = 0;
    }
  }
}

function hurtPlayer(w: World, rng: Rng, amount: number) {
  const p = w.player;
  if (p.invuln > 0 || w.phase !== 'playing') return;
  p.hp -= amount;
  p.invuln = PLAYER.invulnSeconds;
  w.events.hurt += amount;
  w.shake = Math.min(18, w.shake + 9);
  burst(w, rng, p.x, p.y, '#ff4d4d', 14, 200);
  if (p.hp <= 0) {
    p.hp = 0;
    w.phase = 'dead';
    w.events.died = true;
    burst(w, rng, p.x, p.y, '#3df5ff', 80, 380, 4);
  }
}

/** Applies a chosen level-up upgrade and resumes (or offers the next queued level). */
export function chooseUpgrade(w: World, id: UpgradeId): void {
  if (w.phase !== 'levelup' || !w.offer.includes(id)) return;
  w.upgrades[id] += 1;
  if (id === 'vitality') {
    w.player.maxHp += 25;
    w.player.hp = w.player.maxHp;
  }
  if (id === 'nova' && w.upgrades.nova === 1) w.novaCooldown = 0.5;
  w.pendingLevels -= 1;
  w.offer = [];
  w.phase = 'playing';
  const rng = new Rng(w.rng);
  if (w.pendingLevels > 0) {
    w.offer = rollOffer(w, rng);
    if (w.offer.length) {
      w.phase = 'levelup';
      w.events.levelUp = true;
    } else w.pendingLevels = 0;
  }
  w.rng = rng.state;
}

// ---------- spatial hash ----------

function buildGrid(enemies: Enemy[]) {
  const grid = new Map<number, Enemy[]>();
  for (const e of enemies) {
    const k = cellKey(Math.floor(e.x / CELL), Math.floor(e.y / CELL));
    const list = grid.get(k);
    if (list) list.push(e);
    else grid.set(k, [e]);
  }
  return grid;
}

function cellKey(cx: number, cy: number) {
  return (cx + 32768) * 65536 + (cy + 32768);
}

function forNearby(grid: Map<number, Enemy[]>, x: number, y: number, r: number, fn: (e: Enemy) => void) {
  const x0 = Math.floor((x - r) / CELL);
  const x1 = Math.floor((x + r) / CELL);
  const y0 = Math.floor((y - r) / CELL);
  const y1 = Math.floor((y + r) / CELL);
  for (let cx = x0; cx <= x1; cx++)
    for (let cy = y0; cy <= y1; cy++) {
      const list = grid.get(cellKey(cx, cy));
      if (list) for (const e of list) fn(e);
    }
}

// ---------- main step ----------

/** Advances the world by `dt` seconds. Mutates `w` in place (it is the game's hot loop). */
export function stepWorld(w: World, input: InputState, dt: number): void {
  w.events = emptyEvents();
  // Particles keep animating on the death/victory screen.
  const rng = new Rng(w.rng);
  updateParticles(w, dt);
  w.shake = Math.max(0, w.shake - dt * 40);
  if (w.phase !== 'playing') {
    w.rng = rng.state;
    return;
  }

  const p = w.player;
  const s = stats(w);
  w.time += dt;

  // Player movement
  const len = Math.hypot(input.mx, input.my);
  if (len > 0.01) {
    const k = Math.min(1, len) / len;
    p.x += input.mx * k * s.speed * dt;
    p.y += input.my * k * s.speed * dt;
  }
  p.invuln = Math.max(0, p.invuln - dt);

  // Spawning
  if (w.time < RUN_SECONDS) {
    w.spawnBudget += spawnRate(w.time) * dt;
    while (w.spawnBudget >= 1) {
      w.spawnBudget -= 1;
      if (w.enemies.length < MAX_ENEMIES) spawnEnemy(w, rng, pickKind(w, rng));
    }
  } else if (!w.bossSpawned) {
    w.bossSpawned = true;
    w.events.bossSpawned = true;
    spawnEnemy(w, rng, 'boss');
    w.shake = 14;
  } else if (w.enemies.length < 40 && rng.chance(dt * 2)) {
    spawnEnemy(w, rng, 'drone');
  }

  let grid = buildGrid(w.enemies);

  // Enemy movement, separation, contact damage, shooting
  for (const e of w.enemies) {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    let vx = (dx / d) * e.speed;
    let vy = (dy / d) * e.speed;
    if (e.kind === 'shooter' && d < 200) {
      vx = -vx * 0.6; // keep distance
      vy = -vy * 0.6;
    }
    // Soft separation so swarms spread into satisfying blobs instead of one dot.
    forNearby(grid, e.x, e.y, e.radius * 2, (o) => {
      if (o === e) return;
      const ox = e.x - o.x;
      const oy = e.y - o.y;
      const od = Math.hypot(ox, oy);
      const min = e.radius + o.radius;
      if (od > 0 && od < min) {
        const push = ((min - od) / min) * 60;
        vx += (ox / od) * push;
        vy += (oy / od) * push;
      }
    });
    e.x += (vx + e.kx) * dt;
    e.y += (vy + e.ky) * dt;
    const decay = Math.exp(-dt * 10);
    e.kx *= decay;
    e.ky *= decay;
    e.flash = Math.max(0, e.flash - dt);
    e.angle += dt * (e.kind === 'boss' ? 0.6 : 2);

    if (d < e.radius + PLAYER.radius) hurtPlayer(w, rng, e.damage);

    if (e.kind === 'shooter' || e.kind === 'boss') {
      e.cooldown -= dt;
      if (e.cooldown <= 0 && d < 520) {
        if (e.kind === 'shooter') {
          e.cooldown = 2.2;
          w.enemyBullets.push({ x: e.x, y: e.y, vx: (dx / d) * ENEMY_BULLET.speed, vy: (dy / d) * ENEMY_BULLET.speed, life: 5 });
        } else {
          e.cooldown = 1.6;
          const n = 16;
          const off = rng.next() * Math.PI;
          for (let i = 0; i < n; i++) {
            const a = off + (i / n) * Math.PI * 2;
            w.enemyBullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 130, vy: Math.sin(a) * 130, life: 6 });
          }
          if (rng.chance(0.5)) for (let i = 0; i < 4; i++) spawnEnemy(w, rng, 'dart');
        }
      }
    }
    if (d > DESPAWN_RADIUS && e.kind !== 'boss') {
      // Teleport stragglers back in front of the player so the pressure stays on.
      const a = rng.next() * Math.PI * 2;
      e.x = p.x + Math.cos(a) * SPAWN_RADIUS;
      e.y = p.y + Math.sin(a) * SPAWN_RADIUS;
    }
  }
  grid = buildGrid(w.enemies);

  // Auto-aim at the nearest enemy and fire
  w.fireCooldown -= dt;
  let target: Enemy | undefined;
  let best = 420 * 420;
  for (const e of w.enemies) {
    const dd = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (dd < best) {
      best = dd;
      target = e;
    }
  }
  if (target) p.aim = Math.atan2(target.y - p.y, target.x - p.x);
  if (target && w.fireCooldown <= 0) {
    w.fireCooldown = s.fireInterval;
    const spread = 0.13;
    for (let i = 0; i < s.projectiles; i++) {
      const a = p.aim + (i - (s.projectiles - 1) / 2) * spread;
      w.bullets.push({
        x: p.x + Math.cos(a) * 16,
        y: p.y + Math.sin(a) * 16,
        vx: Math.cos(a) * s.bulletSpeed,
        vy: Math.sin(a) * s.bulletSpeed,
        radius: s.bulletRadius,
        damage: s.damage,
        pierce: s.pierce,
        life: 1.1,
        hit: [],
      });
    }
  }

  // Bullets vs enemies
  for (const b of w.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    forNearby(grid, b.x, b.y, b.radius + 50, (e) => {
      if (b.life <= 0 || e.hp <= 0 || b.hit.includes(e.id)) return;
      if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 > (e.radius + b.radius) ** 2) return;
      b.hit.push(e.id);
      damageEnemy(w, rng, e, b.damage, b.x - b.vx, b.y - b.vy, 90);
      burst(w, rng, b.x, b.y, '#bff9ff', 3, 120, 2);
      if (b.pierce > 0) b.pierce -= 1;
      else b.life = 0;
    });
  }
  w.bullets = w.bullets.filter((b) => b.life > 0);

  // Orbit blades
  if (s.orbitCount > 0) {
    w.orbitAngle += s.orbitSpeed * dt;
    for (let i = 0; i < s.orbitCount; i++) {
      const a = w.orbitAngle + (i / s.orbitCount) * Math.PI * 2;
      const bx = p.x + Math.cos(a) * s.orbitRadius;
      const by = p.y + Math.sin(a) * s.orbitRadius;
      forNearby(grid, bx, by, 60, (e) => {
        if (e.hp <= 0 || e.flash > 0.02) return; // flash doubles as a short hit cooldown
        if ((e.x - bx) ** 2 + (e.y - by) ** 2 > (e.radius + 10) ** 2) return;
        damageEnemy(w, rng, e, s.orbitDamage, p.x, p.y, 160);
      });
    }
  }

  // Nova pulse
  w.novaCooldown -= dt;
  if (w.novaCooldown <= 0 && Number.isFinite(s.novaInterval)) {
    w.novaCooldown = s.novaInterval;
    w.novaCounter += 1;
    w.novas.push({ id: w.novaCounter, x: p.x, y: p.y, radius: 10, maxRadius: s.novaRadius, damage: s.novaDamage, life: 0.45 });
    w.shake = Math.min(18, w.shake + 3);
  }
  for (const n of w.novas) {
    n.life -= dt;
    n.radius += ((n.maxRadius - 10) / 0.45) * dt;
    n.x = p.x;
    n.y = p.y;
    forNearby(grid, n.x, n.y, n.radius, (e) => {
      if (e.hp <= 0 || e.novaHit === n.id) return;
      if (Math.hypot(e.x - n.x, e.y - n.y) > n.radius + e.radius) return;
      e.novaHit = n.id;
      damageEnemy(w, rng, e, n.damage, n.x, n.y, 260);
    });
  }
  w.novas = w.novas.filter((n) => n.life > 0);

  // Enemy bullets
  for (const b of w.enemyBullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 < (ENEMY_BULLET.radius + PLAYER.radius - 3) ** 2) {
      b.life = 0;
      hurtPlayer(w, rng, ENEMY_BULLET.damage);
    }
  }
  w.enemyBullets = w.enemyBullets.filter((b) => b.life > 0);

  w.enemies = w.enemies.filter((e) => e.hp > 0);

  // Gems: magnet and pickup
  let gained = 0;
  for (const g of w.gems) {
    const dx = p.x - g.x;
    const dy = p.y - g.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < s.magnet) g.pulled = true;
    if (g.pulled) {
      const pull = 520 * dt;
      g.x += (dx / d) * Math.min(pull, d);
      g.y += (dy / d) * Math.min(pull, d);
    }
    if (d < PLAYER.radius + 6) {
      gained += g.value;
      g.value = 0;
    }
  }
  if (gained > 0) {
    w.gems = w.gems.filter((g) => g.value > 0);
    w.events.pickups += gained;
    gainXp(w, rng, gained);
  }
  // Keep the gem list bounded on long runs: far, forgotten gems are merged away.
  if (w.gems.length > 400) w.gems = w.gems.filter((g) => Math.hypot(g.x - p.x, g.y - p.y) < 900);

  w.rng = rng.state;
}

function updateParticles(w: World, dt: number) {
  const drag = Math.exp(-dt * 4);
  for (const pt of w.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= drag;
    pt.vy *= drag;
    pt.life -= dt;
  }
  w.particles = w.particles.filter((pt) => pt.life > 0);
}
