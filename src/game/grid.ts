import { Tile, type GameMap, type Vec } from './types';

export function idx(map: GameMap, x: number, y: number): number {
  return y * map.w + x;
}

export function inBounds(map: GameMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.w && y < map.h;
}

export function tileAt(map: GameMap, x: number, y: number): Tile {
  if (!inBounds(map, x, y)) return Tile.Wall;
  return map.tiles[idx(map, x, y)] ?? Tile.Wall;
}

export function isWalkable(map: GameMap, x: number, y: number): boolean {
  return tileAt(map, x, y) !== Tile.Wall;
}

export function manhattan(a: Vec, b: Vec): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

const NEIGHBORS: readonly Vec[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

/** BFS distance (4-directional) from `from` to every walkable tile; -1 = unreachable. */
export function distanceMap(map: GameMap, from: Vec): Int16Array {
  const dist = new Int16Array(map.w * map.h).fill(-1);
  const queue: number[] = [idx(map, from.x, from.y)];
  dist[queue[0] as number] = 0;
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head] as number;
    const cx = cur % map.w;
    const cy = Math.floor(cur / map.w);
    const d = dist[cur] as number;
    for (const n of NEIGHBORS) {
      const nx = cx + n.x;
      const ny = cy + n.y;
      if (!isWalkable(map, nx, ny)) continue;
      const ni = idx(map, nx, ny);
      if (dist[ni] !== -1) continue;
      dist[ni] = d + 1;
      queue.push(ni);
    }
  }
  return dist;
}

export { NEIGHBORS };

/** Cells on the line from a to b (Bresenham), excluding a, including b. */
export function line(a: Vec, b: Vec): Vec[] {
  const out: Vec[] = [];
  let x = a.x;
  let y = a.y;
  const dx = Math.abs(b.x - a.x);
  const dy = -Math.abs(b.y - a.y);
  const sx = a.x < b.x ? 1 : -1;
  const sy = a.y < b.y ? 1 : -1;
  let err = dx + dy;
  while (x !== b.x || y !== b.y) {
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
    out.push({ x, y });
  }
  return out;
}

/** True if nothing but the endpoint itself blocks the view from a to b. */
export function hasLineOfSight(map: GameMap, a: Vec, b: Vec): boolean {
  const cells = line(a, b);
  for (let i = 0; i < cells.length - 1; i++) {
    const c = cells[i] as Vec;
    if (!isWalkable(map, c.x, c.y)) return false;
  }
  return true;
}

/** Set of tile indices visible from `from` within `radius`. */
export function computeFov(map: GameMap, from: Vec, radius: number): Set<number> {
  const visible = new Set<number>([idx(map, from.x, from.y)]);
  const r2 = radius * radius + radius;
  for (let y = from.y - radius; y <= from.y + radius; y++) {
    for (let x = from.x - radius; x <= from.x + radius; x++) {
      if (!inBounds(map, x, y)) continue;
      const dx = x - from.x;
      const dy = y - from.y;
      if (dx * dx + dy * dy > r2) continue;
      if (hasLineOfSight(map, from, { x, y })) visible.add(idx(map, x, y));
    }
  }
  return visible;
}
