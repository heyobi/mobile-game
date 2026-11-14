import { ELIXIR_MAX_HP, FINAL_DEPTH, FOV_RADIUS, ITEM_NAMES, MONSTERS, POTION_HEAL, xpToNext } from './content';
import { generateFloor } from './dungeon';
import { computeFov, distanceMap, hasLineOfSight, idx, isWalkable, manhattan, NEIGHBORS, tileAt } from './grid';
import { startingPlayer, type MetaState } from './meta';
import { Rng } from './rng';
import { DIRS, Tile, type Action, type GameEvent, type Monster, type RunState, type StepResult } from './types';

const MAX_LOG = 30;

function log(state: RunState, msg: string) {
  state.log.push(msg);
  if (state.log.length > MAX_LOG) state.log.splice(0, state.log.length - MAX_LOG);
}

function revealAroundPlayer(state: RunState) {
  for (const i of computeFov(state.map, state.player, FOV_RADIUS)) state.map.seen[i] = 1;
}

function enterFloor(state: RunState, rng: Rng) {
  const floor = generateFloor(rng, state.depth, state.nextId);
  state.map = floor.map;
  state.monsters = floor.monsters;
  state.items = floor.items;
  state.nextId = floor.nextId;
  state.player.x = floor.start.x;
  state.player.y = floor.start.y;
  revealAroundPlayer(state);
}

export function newRun(seed: number, meta: MetaState): RunState {
  const rng = new Rng(seed);
  const state: RunState = {
    version: 1,
    seed,
    rng: 0,
    depth: 1,
    turn: 0,
    map: { w: 0, h: 0, tiles: [], seen: [] },
    player: { x: 0, y: 0, ...startingPlayer(meta) },
    monsters: [],
    items: [],
    log: ['You descend into the Shard Depths.'],
    status: 'playing',
    shards: 0,
    kills: 0,
    nextId: 1,
  };
  enterFloor(state, rng);
  state.rng = rng.state;
  return state;
}

function clone(state: RunState): RunState {
  return JSON.parse(JSON.stringify(state)) as RunState;
}

function damage(rng: Rng, atk: number, def: number): number {
  return Math.max(1, atk - def + rng.int(-1, 1));
}

function monsterAt(state: RunState, x: number, y: number): Monster | undefined {
  return state.monsters.find((m) => m.x === x && m.y === y);
}

function gainXp(state: RunState, amount: number, events: GameEvent[]) {
  const p = state.player;
  p.xp += amount;
  while (p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    p.level += 1;
    p.maxHp += 4;
    p.hp = Math.min(p.maxHp, p.hp + 4);
    p.atk += 1;
    events.push({ type: 'levelUp', level: p.level });
    log(state, `Level ${p.level}! +4 max HP, +1 ATK.`);
  }
}

function playerAttack(state: RunState, rng: Rng, m: Monster, events: GameEvent[]) {
  const dmg = damage(rng, state.player.atk, m.def);
  m.hp -= dmg;
  m.aware = true;
  events.push({ type: 'hit', x: m.x, y: m.y, amount: dmg, targetId: m.id });
  const name = MONSTERS[m.kind].name;
  if (m.hp <= 0) {
    state.monsters = state.monsters.filter((o) => o.id !== m.id);
    state.kills += 1;
    events.push({ type: 'kill', x: m.x, y: m.y, kind: m.kind });
    log(state, `You slay the ${name}.`);
    gainXp(state, MONSTERS[m.kind].xp, events);
    if (m.kind === 'warden') {
      state.status = 'won';
      state.shards += 25;
      events.push({ type: 'victory' });
      log(state, 'The Warden falls. The depths are yours! (+25 shards)');
    }
  } else {
    log(state, `You hit the ${name} for ${dmg}.`);
  }
}

function pickUp(state: RunState, events: GameEvent[]) {
  const p = state.player;
  const item = state.items.find((i) => i.x === p.x && i.y === p.y);
  if (!item) return;
  state.items = state.items.filter((i) => i.id !== item.id);
  events.push({ type: 'pickup', kind: item.kind, x: item.x, y: item.y });
  switch (item.kind) {
    case 'potion':
      p.potions += 1;
      log(state, 'You pick up a potion.');
      break;
    case 'shard':
      state.shards += item.amount;
      log(state, `You collect ${item.amount} shards.`);
      break;
    case 'blade':
      p.atk += 1;
      log(state, `You find a ${ITEM_NAMES.blade}.`);
      break;
    case 'plate':
      p.def += 1;
      log(state, `You find an ${ITEM_NAMES.plate}.`);
      break;
    case 'elixir':
      p.maxHp += ELIXIR_MAX_HP;
      p.hp += ELIXIR_MAX_HP;
      log(state, `You drink an ${ITEM_NAMES.elixir}.`);
      break;
  }
}

function hurtPlayer(state: RunState, m: Monster, dmg: number, events: GameEvent[], verb: string) {
  state.player.hp -= dmg;
  events.push({ type: 'hurt', amount: dmg, by: m.kind });
  log(state, `The ${MONSTERS[m.kind].name} ${verb} you for ${dmg}.`);
  if (state.player.hp <= 0) {
    state.player.hp = 0;
    state.status = 'dead';
    state.killedBy = m.kind;
    events.push({ type: 'death' });
    log(state, 'You die...');
  }
}

/** Is the monster in a straight, unobstructed line with the player within `range`? */
function canShoot(state: RunState, m: Monster, range: number): boolean {
  const p = state.player;
  if (m.x !== p.x && m.y !== p.y) return false;
  const d = manhattan(m, p);
  return d > 1 && d <= range && hasLineOfSight(state.map, m, p);
}

function monstersAct(state: RunState, rng: Rng, events: GameEvent[]) {
  const p = state.player;
  const dist = distanceMap(state.map, p);
  for (const m of [...state.monsters]) {
    if (state.status !== 'playing') return;
    const def = MONSTERS[m.kind];
    if (def.slow && state.turn % 2 === 1) continue;

    const near = manhattan(m, p) <= FOV_RADIUS + 1;
    if (!m.aware && near && hasLineOfSight(state.map, m, p)) m.aware = true;

    if (manhattan(m, p) === 1) {
      hurtPlayer(state, m, damage(rng, m.atk, p.def), events, 'hits');
      continue;
    }
    if (m.aware && def.range && canShoot(state, m, def.range)) {
      events.push({ type: 'shot', from: { x: m.x, y: m.y }, to: { x: p.x, y: p.y } });
      hurtPlayer(state, m, damage(rng, m.atk - 1, p.def), events, 'shoots');
      continue;
    }

    let options = NEIGHBORS.map((n) => ({ x: m.x + n.x, y: m.y + n.y })).filter(
      (c) => isWalkable(state.map, c.x, c.y) && !monsterAt(state, c.x, c.y) && !(c.x === p.x && c.y === p.y)
    );
    if (m.aware) {
      const here = dist[idx(state.map, m.x, m.y)] ?? -1;
      options = options.filter((c) => {
        const d = dist[idx(state.map, c.x, c.y)] ?? -1;
        return d >= 0 && d < here;
      });
    } else if (!rng.chance(0.3)) {
      options = [];
    }
    if (options.length) {
      const step = rng.pick(options);
      m.x = step.x;
      m.y = step.y;
    }
  }
}

/**
 * Applies one player action and lets the monsters respond. Pure: the input state is not mutated.
 */
export function step(prev: RunState, action: Action): StepResult {
  if (prev.status !== 'playing') return { state: prev, events: [], tookTurn: false };
  const state = clone(prev);
  const rng = new Rng(state.rng);
  const events: GameEvent[] = [];
  const p = state.player;

  if (action.type === 'quaff') {
    if (p.potions <= 0) {
      log(state, 'You have no potions.');
      return { state, events: [{ type: 'bump' }], tookTurn: false };
    }
    if (p.hp >= p.maxHp) {
      log(state, 'You are already at full health.');
      return { state, events: [{ type: 'bump' }], tookTurn: false };
    }
    p.potions -= 1;
    const healed = Math.min(POTION_HEAL, p.maxHp - p.hp);
    p.hp += healed;
    events.push({ type: 'heal', amount: healed });
    log(state, `You drink a potion (+${healed} HP).`);
  } else if (action.type === 'move') {
    const d = DIRS[action.dir];
    const tx = p.x + d.x;
    const ty = p.y + d.y;
    const target = monsterAt(state, tx, ty);
    if (target) {
      playerAttack(state, rng, target, events);
    } else if (!isWalkable(state.map, tx, ty)) {
      return { state: prev, events: [{ type: 'bump' }], tookTurn: false };
    } else {
      p.x = tx;
      p.y = ty;
      pickUp(state, events);
      if (tileAt(state.map, tx, ty) === Tile.Stairs && state.depth < FINAL_DEPTH) {
        state.depth += 1;
        state.turn += 1;
        enterFloor(state, rng);
        events.push({ type: 'descend', depth: state.depth });
        log(state, state.depth === FINAL_DEPTH ? 'You reach the Warden’s lair...' : `You descend to depth ${state.depth}.`);
        state.rng = rng.state;
        return { state, events, tookTurn: true };
      }
    }
  }
  // 'wait' just passes the turn.

  if (state.status === 'playing') monstersAct(state, rng, events);
  state.turn += 1;
  revealAroundPlayer(state);
  state.rng = rng.state;
  return { state, events, tookTurn: true };
}

/** Tile indices currently visible to the player (for rendering). */
export function visibleTiles(state: RunState): Set<number> {
  return computeFov(state.map, state.player, FOV_RADIUS);
}

/** Validates a deserialized run; returns undefined if it is not usable. */
export function restoreRun(raw: unknown): RunState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as RunState;
  if (r.version !== 1 || r.status !== 'playing') return undefined;
  if (!r.map || r.map.tiles.length !== r.map.w * r.map.h || r.map.seen.length !== r.map.tiles.length) return undefined;
  if (!r.player || !Array.isArray(r.monsters) || !Array.isArray(r.items) || !Array.isArray(r.log)) return undefined;
  return r;
}
