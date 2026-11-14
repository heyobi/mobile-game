import type { ItemKind, MonsterKind } from './types';

export const FINAL_DEPTH = 5;
export const MAP_W = 30;
export const MAP_H = 22;
export const FOV_RADIUS = 7;

export const PLAYER_BASE = { hp: 20, atk: 3, def: 0, potions: 1 } as const;
export const POTION_HEAL = 10;
export const ELIXIR_MAX_HP = 4;

export interface MonsterDef {
  name: string;
  hp: number;
  atk: number;
  def: number;
  xp: number;
  /** First depth where it can spawn. */
  minDepth: number;
  /** Relative spawn weight. */
  weight: number;
  /** Acts only every other turn. */
  slow?: boolean;
  /** Attacks in a straight line up to this many tiles. */
  range?: number;
}

export const MONSTERS: Record<MonsterKind, MonsterDef> = {
  slime: { name: 'Slime', hp: 5, atk: 2, def: 0, xp: 2, minDepth: 1, weight: 5 },
  goblin: { name: 'Goblin', hp: 8, atk: 3, def: 1, xp: 4, minDepth: 1, weight: 4 },
  archer: { name: 'Archer', hp: 6, atk: 3, def: 0, xp: 5, minDepth: 2, weight: 3, range: 5 },
  brute: { name: 'Brute', hp: 16, atk: 5, def: 2, xp: 8, minDepth: 3, weight: 2, slow: true },
  warden: { name: 'The Warden', hp: 45, atk: 6, def: 2, xp: 0, minDepth: 99, weight: 0 },
};

export const ITEM_NAMES: Record<ItemKind, string> = {
  potion: 'potion',
  shard: 'shards',
  blade: 'sharper blade (+1 ATK)',
  plate: 'iron plate (+1 DEF)',
  elixir: 'elixir (+4 max HP)',
};

/** Monster stats grow a little with depth. */
export function depthScale(depth: number): number {
  return 1 + 0.15 * (depth - 1);
}

export function xpToNext(level: number): number {
  return 10 * level;
}
