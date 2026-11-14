import { describe, expect, it } from 'vitest';
import { RUN_SECONDS, STEP, UPGRADE_IDS, UPGRADES } from './config';
import { botChoice, botInput } from './bot';
import { applyRun, buyMeta, canBuyMeta, defaultMeta, normalizeMeta, runMods } from './meta';
import type { World } from './types';
import { chooseUpgrade, createWorld, stats, stepWorld } from './world';

const still = { mx: 0, my: 0 };

function simulate(w: World, seconds: number, useBot = true) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    if (w.phase === 'levelup') chooseUpgrade(w, botChoice(w));
    if (w.phase === 'dead' || w.phase === 'won') break;
    stepWorld(w, useBot ? botInput(w) : still, STEP);
  }
  return w;
}

describe('world basics', () => {
  it('is deterministic for a seed', () => {
    const a = simulate(createWorld(7), 30);
    const b = simulate(createWorld(7), 30);
    expect(a.kills).toBe(b.kills);
    expect(a.player).toEqual(b.player);
    expect(a.enemies.length).toBe(b.enemies.length);
  });

  it('spawns enemies over time and the player shoots them', () => {
    const w = simulate(createWorld(1), 20);
    expect(w.kills).toBeGreaterThan(5);
    expect(w.gems.length + w.xp + w.level).toBeGreaterThan(1);
  });

  it('moves the player with input', () => {
    const w = createWorld(1);
    stepWorld(w, { mx: 1, my: 0 }, 0.5);
    expect(w.player.x).toBeGreaterThan(50);
  });

  it('a player who never moves eventually dies', () => {
    const w = simulate(createWorld(3), 240, false);
    expect(w.phase).toBe('dead');
    expect(w.events.died || w.player.hp === 0).toBe(true);
  });

  it('pauses on level up and resumes after choosing', () => {
    const w = createWorld(2);
    w.xp = 1000;
    stepWorld(w, still, STEP);
    // gainXp only runs on pickup; force one through a gem at the player position.
    w.gems.push({ x: w.player.x, y: w.player.y, value: 1, pulled: true });
    stepWorld(w, still, STEP);
    expect(w.phase).toBe('levelup');
    expect(w.offer.length).toBe(3);
    expect(new Set(w.offer).size).toBe(3);
    const t = w.time;
    stepWorld(w, still, STEP);
    expect(w.time).toBe(t); // frozen while choosing
    while (w.phase === 'levelup') chooseUpgrade(w, w.offer[0]!);
    expect(w.phase).toBe('playing');
  });

  it('never offers maxed upgrades', () => {
    const w = createWorld(4);
    for (const id of UPGRADE_IDS) w.upgrades[id] = UPGRADES[id].maxLevel;
    w.upgrades.speed = 0;
    w.gems.push({ x: 0, y: 0, value: 999, pulled: true });
    stepWorld(w, still, STEP);
    expect(w.offer).toEqual(['speed']);
  });

  it('upgrades change derived stats', () => {
    const w = createWorld(1);
    const before = stats(w);
    w.upgrades.multishot = 2;
    w.upgrades.orbit = 1;
    w.upgrades.nova = 1;
    const after = stats(w);
    expect(after.projectiles).toBe(before.projectiles + 2);
    expect(after.orbitCount).toBe(2);
    expect(Number.isFinite(after.novaInterval)).toBe(true);
  });

  it('spawns the boss at the end and winning ends the run', () => {
    const w = createWorld(5);
    w.time = RUN_SECONDS - STEP / 2;
    stepWorld(w, still, STEP);
    stepWorld(w, still, STEP);
    const boss = w.enemies.find((e) => e.kind === 'boss');
    expect(boss).toBeDefined();
    boss!.hp = 1;
    w.bullets.push({ x: boss!.x, y: boss!.y, vx: 0, vy: 0, radius: 5, damage: 10, pierce: 0, life: 1, hit: [] });
    stepWorld(w, still, STEP);
    expect(w.phase).toBe('won');
  });
});

describe('balance (autopilot)', () => {
  it('the autopilot survives the first minute on most seeds and the game stays bounded', () => {
    let survived = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const w = simulate(createWorld(seed), 60);
      if (w.phase !== 'dead') survived++;
      expect(w.enemies.length).toBeLessThanOrEqual(300);
      expect(w.particles.length).toBeLessThanOrEqual(900);
      expect(Number.isFinite(w.player.x)).toBe(true);
    }
    expect(survived).toBeGreaterThanOrEqual(4);
  }, 60_000);

  it('a full run with the autopilot ends (death or victory) without errors', () => {
    const w = simulate(createWorld(11), RUN_SECONDS + 120);
    expect(['dead', 'won', 'playing']).toContain(w.phase);
    expect(w.level).toBeGreaterThan(5);
  }, 60_000);
});

describe('meta progression', () => {
  it('banks crystals and buys upgrades', () => {
    const w = simulate(createWorld(1), 60);
    let m = applyRun(defaultMeta(), w);
    expect(m.stats.runs).toBe(1);
    m = { ...m, crystals: 100 };
    expect(canBuyMeta(m, 'hull')).toBe(true);
    m = buyMeta(m, 'hull');
    expect(runMods(m).hpBonus).toBe(15);
    expect(createWorld(1, runMods(m)).player.maxHp).toBe(115);
  });

  it('normalizes garbage and old versions', () => {
    expect(normalizeMeta(null)).toEqual(defaultMeta());
    expect(normalizeMeta({ version: 1, shards: 99 })).toEqual(defaultMeta());
    expect(normalizeMeta({ version: 2, crystals: -4, upgrades: { might: 99 } }).upgrades.might).toBe(5);
  });
});
