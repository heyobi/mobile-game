import { PLAYER_BASE } from './content';
import type { Player, RunState } from './types';

/** Progress that survives between runs. Bump `version` and migrate in `normalizeMeta` on shape changes. */
export interface MetaState {
  version: 1;
  shards: number;
  upgrades: Record<UpgradeId, number>;
  stats: { runs: number; wins: number; bestDepth: number; kills: number };
}

export type UpgradeId = 'vitality' | 'power' | 'guard' | 'satchel';

export interface UpgradeDef {
  name: string;
  description: string;
  maxLevel: number;
  baseCost: number;
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  vitality: { name: 'Vitality', description: '+3 max HP', maxLevel: 5, baseCost: 8 },
  power: { name: 'Power', description: '+1 attack', maxLevel: 3, baseCost: 20 },
  guard: { name: 'Guard', description: '+1 defense', maxLevel: 3, baseCost: 20 },
  satchel: { name: 'Satchel', description: '+1 starting potion', maxLevel: 3, baseCost: 12 },
};

export const UPGRADE_IDS = Object.keys(UPGRADES) as UpgradeId[];

export function defaultMeta(): MetaState {
  return {
    version: 1,
    shards: 0,
    upgrades: { vitality: 0, power: 0, guard: 0, satchel: 0 },
    stats: { runs: 0, wins: 0, bestDepth: 0, kills: 0 },
  };
}

/** Accepts anything (e.g. parsed storage) and returns a valid MetaState. */
export function normalizeMeta(raw: unknown): MetaState {
  const base = defaultMeta();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<MetaState>;
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : d);
  const upgrades = { ...base.upgrades };
  for (const id of UPGRADE_IDS) upgrades[id] = Math.min(num(r.upgrades?.[id], 0), UPGRADES[id].maxLevel);
  return {
    version: 1,
    shards: num(r.shards, 0),
    upgrades,
    stats: {
      runs: num(r.stats?.runs, 0),
      wins: num(r.stats?.wins, 0),
      bestDepth: num(r.stats?.bestDepth, 0),
      kills: num(r.stats?.kills, 0),
    },
  };
}

export function upgradeCost(id: UpgradeId, currentLevel: number): number {
  return UPGRADES[id].baseCost * (currentLevel + 1);
}

export function canBuy(meta: MetaState, id: UpgradeId): boolean {
  const lvl = meta.upgrades[id];
  return lvl < UPGRADES[id].maxLevel && meta.shards >= upgradeCost(id, lvl);
}

export function buyUpgrade(meta: MetaState, id: UpgradeId): MetaState {
  if (!canBuy(meta, id)) return meta;
  const lvl = meta.upgrades[id];
  return {
    ...meta,
    shards: meta.shards - upgradeCost(id, lvl),
    upgrades: { ...meta.upgrades, [id]: lvl + 1 },
  };
}

export function startingPlayer(meta: MetaState): Omit<Player, 'x' | 'y'> {
  const maxHp = PLAYER_BASE.hp + 3 * meta.upgrades.vitality;
  return {
    hp: maxHp,
    maxHp,
    atk: PLAYER_BASE.atk + meta.upgrades.power,
    def: PLAYER_BASE.def + meta.upgrades.guard,
    potions: PLAYER_BASE.potions + meta.upgrades.satchel,
    level: 1,
    xp: 0,
  };
}

/** Banks a finished run into meta progress. Shards are kept on death too. */
export function applyRunResult(meta: MetaState, run: RunState): MetaState {
  return {
    ...meta,
    shards: meta.shards + run.shards,
    stats: {
      runs: meta.stats.runs + 1,
      wins: meta.stats.wins + (run.status === 'won' ? 1 : 0),
      bestDepth: Math.max(meta.stats.bestDepth, run.depth),
      kills: meta.stats.kills + run.kills,
    },
  };
}
