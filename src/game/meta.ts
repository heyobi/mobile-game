import type { RunMods, World } from './types';

/** Progress that survives between runs. Bump `version` and migrate in `normalizeMeta` on shape changes. */
export interface MetaState {
  version: 2;
  crystals: number;
  upgrades: Record<MetaUpgradeId, number>;
  stats: { runs: number; wins: number; bestTime: number; bestKills: number; totalKills: number };
}

export type MetaUpgradeId = 'might' | 'hull' | 'engine' | 'greed';

export interface MetaUpgradeDef {
  name: string;
  description: string;
  maxLevel: number;
  baseCost: number;
}

export const META_UPGRADES: Record<MetaUpgradeId, MetaUpgradeDef> = {
  might: { name: 'Might', description: '+8% damage', maxLevel: 5, baseCost: 15 },
  hull: { name: 'Hull', description: '+15 max HP', maxLevel: 5, baseCost: 12 },
  engine: { name: 'Engine', description: '+5% move speed', maxLevel: 4, baseCost: 18 },
  greed: { name: 'Greed', description: '+10% XP', maxLevel: 5, baseCost: 20 },
};

export const META_UPGRADE_IDS = Object.keys(META_UPGRADES) as MetaUpgradeId[];

export function defaultMeta(): MetaState {
  return {
    version: 2,
    crystals: 0,
    upgrades: { might: 0, hull: 0, engine: 0, greed: 0 },
    stats: { runs: 0, wins: 0, bestTime: 0, bestKills: 0, totalKills: 0 },
  };
}

export function normalizeMeta(raw: unknown): MetaState {
  const base = defaultMeta();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<MetaState>;
  if (r.version !== 2) return base;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
  const upgrades = { ...base.upgrades };
  for (const id of META_UPGRADE_IDS) upgrades[id] = Math.min(Math.floor(num(r.upgrades?.[id])), META_UPGRADES[id].maxLevel);
  return {
    version: 2,
    crystals: Math.floor(num(r.crystals)),
    upgrades,
    stats: {
      runs: Math.floor(num(r.stats?.runs)),
      wins: Math.floor(num(r.stats?.wins)),
      bestTime: num(r.stats?.bestTime),
      bestKills: Math.floor(num(r.stats?.bestKills)),
      totalKills: Math.floor(num(r.stats?.totalKills)),
    },
  };
}

export function metaCost(id: MetaUpgradeId, level: number): number {
  return Math.round(META_UPGRADES[id].baseCost * (1 + level * 0.8));
}

export function canBuyMeta(m: MetaState, id: MetaUpgradeId): boolean {
  return m.upgrades[id] < META_UPGRADES[id].maxLevel && m.crystals >= metaCost(id, m.upgrades[id]);
}

export function buyMeta(m: MetaState, id: MetaUpgradeId): MetaState {
  if (!canBuyMeta(m, id)) return m;
  return { ...m, crystals: m.crystals - metaCost(id, m.upgrades[id]), upgrades: { ...m.upgrades, [id]: m.upgrades[id] + 1 } };
}

export function runMods(m: MetaState): RunMods {
  return {
    damageMul: 1 + 0.08 * m.upgrades.might,
    hpBonus: 15 * m.upgrades.hull,
    speedMul: 1 + 0.05 * m.upgrades.engine,
    xpMul: 1 + 0.1 * m.upgrades.greed,
  };
}

/** Crystals earned by a finished run. */
export function crystalsFor(w: World): number {
  return Math.floor(w.kills / 12) + Math.floor(w.time / 20) + (w.phase === 'won' ? 40 : 0);
}

export function applyRun(m: MetaState, w: World): MetaState {
  return {
    ...m,
    crystals: m.crystals + crystalsFor(w),
    stats: {
      runs: m.stats.runs + 1,
      wins: m.stats.wins + (w.phase === 'won' ? 1 : 0),
      bestTime: Math.max(m.stats.bestTime, w.time),
      bestKills: Math.max(m.stats.bestKills, w.kills),
      totalKills: m.stats.totalKills + w.kills,
    },
  };
}
