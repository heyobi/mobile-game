/** All tunable numbers live here so balancing never touches simulation code. */

export const RUN_SECONDS = 300; // boss arrives at 5:00
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  speed: 175,
  hp: 100,
  invulnSeconds: 0.5,
  magnet: 105,
} as const;

export type EnemyKind = 'drone' | 'dart' | 'tank' | 'splitter' | 'shooter' | 'boss';

export interface EnemyDef {
  hp: number;
  speed: number;
  radius: number;
  damage: number;
  xp: number;
  color: string;
  /** Seconds into the run before it can spawn. */
  from: number;
  weight: number;
  sides: number;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  drone: { hp: 4, speed: 82, radius: 11, damage: 8, xp: 1, color: '#ff3df2', from: 0, weight: 10, sides: 3 },
  dart: { hp: 3, speed: 165, radius: 8, damage: 6, xp: 1, color: '#ffe23d', from: 40, weight: 6, sides: 3 },
  tank: { hp: 26, speed: 46, radius: 20, damage: 18, xp: 4, color: '#ff4d4d', from: 80, weight: 3, sides: 4 },
  splitter: { hp: 12, speed: 62, radius: 15, damage: 10, xp: 2, color: '#3dff8b', from: 130, weight: 3, sides: 6 },
  shooter: { hp: 10, speed: 58, radius: 13, damage: 8, xp: 3, color: '#a35dff', from: 170, weight: 3, sides: 4 },
  boss: { hp: 1400, speed: 40, radius: 46, damage: 30, xp: 0, color: '#ff8a1f', from: 1e9, weight: 0, sides: 8 },
};

export const ENEMY_BULLET = { speed: 150, radius: 5, damage: 10, color: '#ff8a1f' } as const;

export const MAX_ENEMIES = 260;
export const MAX_PARTICLES = 900;

/** Enemies spawned per second at time t (seconds). */
export function spawnRate(t: number): number {
  return Math.min(1.6 + t * 0.07, 20);
}

/** Enemy stat multiplier over time, so late drones still matter. */
export function enemyScale(t: number): number {
  return 1 + t / 100 + (t / 200) ** 2;
}

export function xpToNext(level: number): number {
  return Math.round(4 + level * 2.5 + level * level * 0.45);
}

export type UpgradeId =
  | 'blaster'
  | 'multishot'
  | 'firerate'
  | 'damage'
  | 'pierce'
  | 'orbit'
  | 'nova'
  | 'speed'
  | 'magnet'
  | 'vitality';

export interface UpgradeDef {
  name: string;
  /** Description of the NEXT level (index = current level). */
  describe: (nextLevel: number) => string;
  maxLevel: number;
  color: string;
  icon: string;
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  blaster: { name: 'Blaster', describe: () => '+25% bullet speed & size', maxLevel: 4, color: '#3df5ff', icon: '➤' },
  multishot: { name: 'Split Shot', describe: () => '+1 projectile per volley', maxLevel: 5, color: '#3df5ff', icon: '⋔' },
  firerate: { name: 'Overclock', describe: () => '+18% fire rate', maxLevel: 6, color: '#ffe23d', icon: '⚡' },
  damage: { name: 'Plasma Core', describe: () => '+25% damage', maxLevel: 6, color: '#ff3df2', icon: '✦' },
  pierce: { name: 'Railgun', describe: () => 'Bullets pierce +1 enemy', maxLevel: 4, color: '#a35dff', icon: '⟿' },
  orbit: {
    name: 'Orbit Blades',
    describe: (n) => (n === 1 ? 'Two blades circle you' : '+1 blade, faster spin'),
    maxLevel: 5,
    color: '#3dff8b',
    icon: '◎',
  },
  nova: {
    name: 'Nova Pulse',
    describe: (n) => (n === 1 ? 'Shockwave every 3s' : 'Bigger, stronger, more often'),
    maxLevel: 5,
    color: '#ff8a1f',
    icon: '✺',
  },
  speed: { name: 'Thrusters', describe: () => '+10% move speed', maxLevel: 4, color: '#9dffef', icon: '»' },
  magnet: { name: 'Tractor Beam', describe: () => '+45% pickup range', maxLevel: 4, color: '#3df5ff', icon: '⊕' },
  vitality: { name: 'Hull Plating', describe: () => '+25 max HP and full repair', maxLevel: 5, color: '#ff4d4d', icon: '✚' },
};

export const UPGRADE_IDS = Object.keys(UPGRADES) as UpgradeId[];
