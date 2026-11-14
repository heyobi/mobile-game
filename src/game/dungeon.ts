import { FINAL_DEPTH, MAP_H, MAP_W, MONSTERS, depthScale } from './content';
import { distanceMap, idx } from './grid';
import { Rng } from './rng';
import { Tile, type GameMap, type Item, type ItemKind, type Monster, type MonsterKind, type Vec } from './types';

export interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Floor {
  map: GameMap;
  rooms: Room[];
  start: Vec;
  /** Undefined on the final floor (the boss guards it instead). */
  stairs?: Vec;
  monsters: Monster[];
  items: Item[];
  nextId: number;
}

const center = (r: Room): Vec => ({ x: Math.floor(r.x + r.w / 2), y: Math.floor(r.y + r.h / 2) });

function overlaps(a: Room, b: Room, margin: number): boolean {
  return (
    a.x - margin < b.x + b.w && a.x + a.w + margin > b.x && a.y - margin < b.y + b.h && a.y + a.h + margin > b.y
  );
}

function carveRoom(map: GameMap, r: Room) {
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) map.tiles[idx(map, x, y)] = Tile.Floor;
}

function carveCorridor(map: GameMap, a: Vec, b: Vec, rng: Rng) {
  const horizontalFirst = rng.chance(0.5);
  const corner = horizontalFirst ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
  for (const [from, to] of [
    [a, corner],
    [corner, b],
  ] as const) {
    const dx = Math.sign(to.x - from.x);
    const dy = Math.sign(to.y - from.y);
    let x = from.x;
    let y = from.y;
    map.tiles[idx(map, x, y)] = Tile.Floor;
    while (x !== to.x || y !== to.y) {
      x += dx;
      y += dy;
      map.tiles[idx(map, x, y)] = Tile.Floor;
    }
  }
}

function placeRooms(rng: Rng, w: number, h: number, isBossFloor: boolean): Room[] {
  const rooms: Room[] = [];
  const target = isBossFloor ? 5 : rng.int(6, 9);
  for (let attempt = 0; attempt < 400 && rooms.length < target; attempt++) {
    // The boss floor ends in one big arena; it is placed first so it always fits.
    const big = isBossFloor && rooms.length === 0;
    const rw = big ? 10 : rng.int(4, 8);
    const rh = big ? 7 : rng.int(3, 6);
    const room = { x: rng.int(1, w - rw - 1), y: rng.int(1, h - rh - 1), w: rw, h: rh };
    if (rooms.some((r) => overlaps(r, room, 1))) continue;
    rooms.push(room);
  }
  if (isBossFloor) rooms.push(rooms.shift() as Room); // arena last
  return rooms;
}

function randomFreeCell(rng: Rng, room: Room, taken: Set<number>, map: GameMap): Vec | undefined {
  for (let i = 0; i < 30; i++) {
    const p = { x: rng.int(room.x, room.x + room.w - 1), y: rng.int(room.y, room.y + room.h - 1) };
    const k = idx(map, p.x, p.y);
    if (!taken.has(k) && map.tiles[k] === Tile.Floor) {
      taken.add(k);
      return p;
    }
  }
  return undefined;
}

export function makeMonster(kind: MonsterKind, pos: Vec, depth: number, id: number): Monster {
  const def = MONSTERS[kind];
  const scale = kind === 'warden' ? 1 : depthScale(depth);
  const hp = Math.round(def.hp * scale);
  return {
    id,
    kind,
    x: pos.x,
    y: pos.y,
    hp,
    maxHp: hp,
    atk: Math.round(def.atk * (kind === 'warden' ? 1 : 1 + 0.1 * (depth - 1))),
    def: def.def,
    aware: kind === 'warden',
  };
}

function rollMonsterKind(rng: Rng, depth: number): MonsterKind {
  const pool = (Object.keys(MONSTERS) as MonsterKind[]).filter((k) => MONSTERS[k].minDepth <= depth);
  const total = pool.reduce((s, k) => s + MONSTERS[k].weight, 0);
  let roll = rng.next() * total;
  for (const k of pool) {
    roll -= MONSTERS[k].weight;
    if (roll < 0) return k;
  }
  return pool[0] as MonsterKind;
}

function rollItemKind(rng: Rng): ItemKind {
  const r = rng.next();
  if (r < 0.45) return 'shard';
  if (r < 0.75) return 'potion';
  if (r < 0.85) return 'blade';
  if (r < 0.95) return 'plate';
  return 'elixir';
}

/**
 * Generates one floor: rooms joined by L-shaped corridors (room i to room i+1, so everything
 * is connected), the player in the first room and the stairs (or the boss) in the room farthest away.
 */
export function generateFloor(rng: Rng, depth: number, firstId: number): Floor {
  const w = MAP_W;
  const h = MAP_H;
  const isBossFloor = depth >= FINAL_DEPTH;
  const map: GameMap = { w, h, tiles: new Array(w * h).fill(Tile.Wall), seen: new Array(w * h).fill(0) };

  const rooms = placeRooms(rng, w, h, isBossFloor);
  rooms.forEach((r) => carveRoom(map, r));
  for (let i = 1; i < rooms.length; i++) carveCorridor(map, center(rooms[i - 1] as Room), center(rooms[i] as Room), rng);
  // A couple of extra loops make the layout less linear.
  if (!isBossFloor && rooms.length > 3) {
    for (let i = 0; i < 2; i++) {
      carveCorridor(map, center(rng.pick(rooms)), center(rng.pick(rooms)), rng);
    }
  }

  const startRoom = rooms[0] as Room;
  const start = center(startRoom);
  const dist = distanceMap(map, start);
  let farRoom = rooms[rooms.length - 1] as Room;
  if (!isBossFloor) {
    let best = -1;
    for (const r of rooms.slice(1)) {
      const d = dist[idx(map, center(r).x, center(r).y)] ?? -1;
      if (d > best) {
        best = d;
        farRoom = r;
      }
    }
  }

  const taken = new Set<number>([idx(map, start.x, start.y)]);
  let nextId = firstId;
  const monsters: Monster[] = [];
  const items: Item[] = [];
  let stairs: Vec | undefined;

  if (isBossFloor) {
    const pos = center(farRoom);
    taken.add(idx(map, pos.x, pos.y));
    monsters.push(makeMonster('warden', pos, depth, nextId++));
  } else {
    stairs = center(farRoom);
    map.tiles[idx(map, stairs.x, stairs.y)] = Tile.Stairs;
    taken.add(idx(map, stairs.x, stairs.y));
  }

  const otherRooms = rooms.slice(1);
  const monsterCount = Math.round(3 + depth * 1.5);
  for (let i = 0; i < monsterCount && otherRooms.length; i++) {
    const pos = randomFreeCell(rng, rng.pick(otherRooms), taken, map);
    if (pos) monsters.push(makeMonster(rollMonsterKind(rng, depth), pos, depth, nextId++));
  }

  const itemCount = rng.int(3, 5);
  for (let i = 0; i < itemCount; i++) {
    // Guarantee one potion per floor.
    const kind: ItemKind = i === 0 ? 'potion' : rollItemKind(rng);
    const pos = randomFreeCell(rng, rng.pick(rooms), taken, map);
    if (pos) items.push({ id: nextId++, kind, x: pos.x, y: pos.y, amount: kind === 'shard' ? rng.int(1, 2) + depth : 1 });
  }

  return { map, rooms, start, stairs, monsters, items, nextId };
}
