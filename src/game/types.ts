export interface Vec {
  x: number;
  y: number;
}

export type Dir = 'up' | 'down' | 'left' | 'right';

export const DIRS: Record<Dir, Vec> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const Tile = { Wall: 0, Floor: 1, Stairs: 2 } as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare -- value + type pair (enum replacement)
export type Tile = (typeof Tile)[keyof typeof Tile];

export interface GameMap {
  w: number;
  h: number;
  /** Row-major tiles, index = y * w + x. */
  tiles: Tile[];
  /** 1 if the player has ever seen the tile (stored as numbers to keep JSON small). */
  seen: number[];
}

export type MonsterKind = 'slime' | 'goblin' | 'archer' | 'brute' | 'warden';

export interface Monster {
  id: number;
  kind: MonsterKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  /** Has noticed the player; keeps chasing after losing sight. */
  aware: boolean;
}

export type ItemKind = 'potion' | 'shard' | 'blade' | 'plate' | 'elixir';

export interface Item {
  id: number;
  kind: ItemKind;
  x: number;
  y: number;
  /** Shards: amount. Others: unused (1). */
  amount: number;
}

export interface Player {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  potions: number;
  level: number;
  xp: number;
}

export type RunStatus = 'playing' | 'dead' | 'won';

export interface RunState {
  version: 1;
  seed: number;
  rng: number;
  depth: number;
  turn: number;
  map: GameMap;
  player: Player;
  monsters: Monster[];
  items: Item[];
  log: string[];
  status: RunStatus;
  shards: number;
  kills: number;
  nextId: number;
  /** Which monster killed the player, for the run summary. */
  killedBy?: MonsterKind;
}

export type Action = { type: 'move'; dir: Dir } | { type: 'wait' } | { type: 'quaff' };

export type GameEvent =
  | { type: 'hit'; x: number; y: number; amount: number; targetId: number }
  | { type: 'kill'; x: number; y: number; kind: MonsterKind }
  | { type: 'hurt'; amount: number; by: MonsterKind }
  | { type: 'shot'; from: Vec; to: Vec }
  | { type: 'pickup'; kind: ItemKind; x: number; y: number }
  | { type: 'heal'; amount: number }
  | { type: 'levelUp'; level: number }
  | { type: 'descend'; depth: number }
  | { type: 'bump' }
  | { type: 'death' }
  | { type: 'victory' };

export interface StepResult {
  state: RunState;
  events: GameEvent[];
  /** False when the action was rejected (e.g. walking into a wall) and no turn passed. */
  tookTurn: boolean;
}
