import type { EnemyKind, UpgradeId } from './config';

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  damage: number;
  /** Seconds of white hit-flash left. */
  flash: number;
  /** Knockback velocity, decays quickly. */
  kx: number;
  ky: number;
  /** Shooter/boss weapon cooldown. */
  cooldown: number;
  /** Rotation for rendering. */
  angle: number;
  /** Last nova pulse id that hit this enemy, so each pulse hits once. */
  novaHit: number;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  pierce: number;
  life: number;
  /** Ids already hit, so piercing bullets do not hit the same enemy twice. */
  hit: number[];
}

export interface EnemyBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export interface Gem {
  x: number;
  y: number;
  value: number;
  /** Being pulled to the player. */
  pulled: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface Nova {
  id: number;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  damage: number;
  life: number;
}

export interface Player {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  invuln: number;
  /** Facing angle (towards the current target). */
  aim: number;
}

export type Phase = 'playing' | 'levelup' | 'dead' | 'won';

export interface InputState {
  /** Desired move direction; length 0..1. */
  mx: number;
  my: number;
}

export interface WorldEvents {
  kills: number;
  hurt: number;
  levelUp: boolean;
  bossSpawned: boolean;
  bossKilled: boolean;
  died: boolean;
  pickups: number;
}

export interface World {
  seed: number;
  rng: number;
  time: number;
  phase: Phase;
  player: Player;
  enemies: Enemy[];
  bullets: Bullet[];
  enemyBullets: EnemyBullet[];
  gems: Gem[];
  particles: Particle[];
  novas: Nova[];
  upgrades: Record<UpgradeId, number>;
  level: number;
  xp: number;
  kills: number;
  /** Upgrade choices offered while phase === 'levelup'. */
  offer: UpgradeId[];
  /** Pending level-ups (several can queue from one big gem pickup). */
  pendingLevels: number;
  spawnBudget: number;
  fireCooldown: number;
  novaCooldown: number;
  novaCounter: number;
  orbitAngle: number;
  bossSpawned: boolean;
  /** Screen shake intensity in px, decays. */
  shake: number;
  nextId: number;
  /** Meta-progression bonuses applied at run start. */
  mods: RunMods;
  events: WorldEvents;
}

export interface RunMods {
  damageMul: number;
  hpBonus: number;
  speedMul: number;
  xpMul: number;
}
