import { describe, expect, it } from 'vitest';
import { FINAL_DEPTH, MAP_H, MAP_W } from './content';
import { generateFloor, makeMonster } from './dungeon';
import { newRun, restoreRun, step, visibleTiles } from './engine';
import { distanceMap, idx } from './grid';
import { applyRunResult, buyUpgrade, defaultMeta, normalizeMeta, startingPlayer, upgradeCost } from './meta';
import { Rng } from './rng';
import { Tile, type Dir, type RunState } from './types';

const meta = defaultMeta();

/** Builds a tiny open arena for focused combat tests. */
function arena(): RunState {
  const s = newRun(1, meta);
  const w = 9;
  const h = 9;
  const tiles = new Array(w * h).fill(Tile.Floor).map((t, i) => {
    const x = i % w;
    const y = Math.floor(i / w);
    return x === 0 || y === 0 || x === w - 1 || y === h - 1 ? Tile.Wall : t;
  });
  s.map = { w, h, tiles, seen: new Array(w * h).fill(0) };
  s.player.x = 4;
  s.player.y = 4;
  s.monsters = [];
  s.items = [];
  return s;
}

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('int stays in range', () => {
    const r = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(-2, 3);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThanOrEqual(3);
    }
  });
});

describe('dungeon generation', () => {
  it('is deterministic for a seed', () => {
    const a = generateFloor(new Rng(123), 1, 1);
    const b = generateFloor(new Rng(123), 1, 1);
    expect(a.map.tiles).toEqual(b.map.tiles);
    expect(a.monsters).toEqual(b.monsters);
  });

  it.each(Array.from({ length: 200 }, (_, i) => i + 1))('seed %i: every floor tile, the stairs and all spawns are reachable', (seed) => {
    for (const depth of [1, 3, FINAL_DEPTH]) {
      const f = generateFloor(new Rng(seed), depth, 1);
      expect(f.map.tiles).toHaveLength(MAP_W * MAP_H);
      const dist = distanceMap(f.map, f.start);
      f.map.tiles.forEach((t, i) => {
        if (t !== Tile.Wall) expect(dist[i]).toBeGreaterThanOrEqual(0);
      });
      if (depth < FINAL_DEPTH) {
        expect(f.stairs).toBeDefined();
        expect(f.map.tiles[idx(f.map, f.stairs!.x, f.stairs!.y)]).toBe(Tile.Stairs);
      } else {
        expect(f.stairs).toBeUndefined();
        expect(f.monsters.some((m) => m.kind === 'warden')).toBe(true);
      }
      const cells = [...f.monsters, ...f.items].map((e) => idx(f.map, e.x, e.y));
      expect(new Set(cells).size).toBe(cells.length);
      expect(cells).not.toContain(idx(f.map, f.start.x, f.start.y));
    }
  });
});

describe('turns and combat', () => {
  it('does not mutate the previous state', () => {
    const s = newRun(5, meta);
    const before = JSON.stringify(s);
    step(s, { type: 'wait' });
    expect(JSON.stringify(s)).toBe(before);
  });

  it('walking into a wall costs no turn', () => {
    const s = arena();
    s.player.x = 1;
    const r = step(s, { type: 'move', dir: 'left' });
    expect(r.tookTurn).toBe(false);
    expect(r.state.turn).toBe(s.turn);
  });

  it('moves the player and passes a turn', () => {
    const s = arena();
    const r = step(s, { type: 'move', dir: 'right' });
    expect(r.tookTurn).toBe(true);
    expect(r.state.player.x).toBe(5);
    expect(r.state.turn).toBe(s.turn + 1);
  });

  it('attacking a monster damages and eventually kills it, granting xp', () => {
    let s = arena();
    s.player.atk = 50;
    s.monsters = [makeMonster('slime', { x: 5, y: 4 }, 1, 900)];
    const r = step(s, { type: 'move', dir: 'right' });
    expect(r.state.monsters).toHaveLength(0);
    expect(r.state.kills).toBe(1);
    expect(r.state.player.xp).toBeGreaterThan(0);
    expect(r.events.some((e) => e.type === 'kill')).toBe(true);
    s = r.state;
    expect(s.player.x).toBe(4); // attacking does not move
  });

  it('adjacent monsters hit back and can kill the player', () => {
    const s = arena();
    s.player.hp = 1;
    s.monsters = [makeMonster('goblin', { x: 5, y: 4 }, 1, 900)];
    const r = step(s, { type: 'wait' });
    expect(r.state.status).toBe('dead');
    expect(r.state.killedBy).toBe('goblin');
    expect(step(r.state, { type: 'wait' }).tookTurn).toBe(false);
  });

  it('aware monsters close in on the player', () => {
    const s = arena();
    const m = makeMonster('goblin', { x: 7, y: 4 }, 1, 900);
    m.aware = true;
    s.monsters = [m];
    const r = step(s, { type: 'wait' });
    expect(r.state.monsters[0]!.x).toBe(6);
  });

  it('archers shoot along a clear line', () => {
    const s = arena();
    s.monsters = [makeMonster('archer', { x: 4, y: 1 }, 2, 900)];
    s.monsters[0]!.aware = true;
    const r = step(s, { type: 'wait' });
    expect(r.events.some((e) => e.type === 'shot')).toBe(true);
    expect(r.state.player.hp).toBeLessThan(s.player.hp);
  });

  it('potions heal and are consumed; none left is rejected', () => {
    const s = arena();
    s.player.hp = 5;
    s.player.potions = 1;
    const r = step(s, { type: 'quaff' });
    expect(r.state.player.hp).toBeGreaterThan(5);
    expect(r.state.player.potions).toBe(0);
    expect(step(r.state, { type: 'quaff' }).tookTurn).toBe(false);
  });

  it('picks up items on step', () => {
    const s = arena();
    s.items = [{ id: 901, kind: 'shard', x: 5, y: 4, amount: 3 }];
    const r = step(s, { type: 'move', dir: 'right' });
    expect(r.state.shards).toBe(3);
    expect(r.state.items).toHaveLength(0);
  });

  it('stairs lead to the next depth', () => {
    const s = arena();
    s.map.tiles[idx(s.map, 5, 4)] = Tile.Stairs;
    const r = step(s, { type: 'move', dir: 'right' });
    expect(r.state.depth).toBe(2);
    expect(r.events.some((e) => e.type === 'descend')).toBe(true);
  });

  it('killing the Warden wins the run', () => {
    const s = arena();
    s.player.atk = 999;
    s.monsters = [makeMonster('warden', { x: 5, y: 4 }, FINAL_DEPTH, 900)];
    const r = step(s, { type: 'move', dir: 'right' });
    expect(r.state.status).toBe('won');
  });

  it('a full random run always ends or stays consistent (fuzz)', () => {
    const dirs: Dir[] = ['up', 'down', 'left', 'right'];
    for (let seed = 1; seed <= 10; seed++) {
      let s = newRun(seed, meta);
      const rng = new Rng(seed * 31);
      for (let i = 0; i < 600 && s.status === 'playing'; i++) {
        const r = rng.next();
        s = step(s, r < 0.05 ? { type: 'quaff' } : { type: 'move', dir: rng.pick(dirs) }).state;
        expect(s.player.hp).toBeGreaterThanOrEqual(0);
        expect(s.player.hp).toBeLessThanOrEqual(s.player.maxHp);
        for (const m of s.monsters) expect(s.map.tiles[idx(s.map, m.x, m.y)]).not.toBe(Tile.Wall);
        expect(visibleTiles(s).has(idx(s.map, s.player.x, s.player.y))).toBe(true);
      }
    }
  }, 30_000);
});

describe('persistence', () => {
  it('round-trips a run through JSON', () => {
    const s = step(newRun(9, meta), { type: 'wait' }).state;
    const restored = restoreRun(JSON.parse(JSON.stringify(s)));
    expect(restored).toEqual(s);
  });

  it('rejects broken or finished runs', () => {
    expect(restoreRun(null)).toBeUndefined();
    expect(restoreRun({ version: 2 })).toBeUndefined();
    const s = newRun(9, meta);
    expect(restoreRun({ ...s, status: 'dead' })).toBeUndefined();
  });
});

describe('meta progression', () => {
  it('upgrades cost shards and change the starting player', () => {
    let m = { ...defaultMeta(), shards: 100 };
    m = buyUpgrade(m, 'vitality');
    expect(m.shards).toBe(100 - upgradeCost('vitality', 0));
    expect(startingPlayer(m).maxHp).toBe(startingPlayer(defaultMeta()).maxHp + 3);
  });

  it('cannot buy without shards or past max level', () => {
    const poor = defaultMeta();
    expect(buyUpgrade(poor, 'power')).toBe(poor);
    let rich = { ...defaultMeta(), shards: 10_000 };
    for (let i = 0; i < 10; i++) rich = buyUpgrade(rich, 'power');
    expect(rich.upgrades.power).toBe(3);
  });

  it('banks shards and stats after a run', () => {
    const s = { ...newRun(1, meta), shards: 7, kills: 3, depth: 2, status: 'dead' as const };
    const m = applyRunResult(defaultMeta(), s);
    expect(m.shards).toBe(7);
    expect(m.stats).toEqual({ runs: 1, wins: 0, bestDepth: 2, kills: 3 });
  });

  it('normalizes garbage from storage', () => {
    expect(normalizeMeta('nope')).toEqual(defaultMeta());
    const m = normalizeMeta({ shards: -5, upgrades: { power: 99 } });
    expect(m.shards).toBe(0);
    expect(m.upgrades.power).toBe(3);
  });
});
