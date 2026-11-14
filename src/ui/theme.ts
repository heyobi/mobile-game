import type { ItemKind, MonsterKind } from '../game/types';

export const colors = {
  bg: '#0e0c17',
  wall: '#2a2540',
  wallSeen: '#1a1729',
  floor: '#1b1830',
  floorSeen: '#131122',
  stairs: '#ffd166',
  player: '#7cf3ff',
  text: '#f2efff',
  textDim: '#9a93c0',
  accent: '#7c6cff',
  danger: '#ff5d73',
  heal: '#62e39b',
  panel: 'rgba(14,12,23,0.88)',
  panelBorder: '#2f2950',
} as const;

export const monsterColors: Record<MonsterKind, string> = {
  slime: '#62e39b',
  goblin: '#ffb84d',
  archer: '#ff8fd1',
  brute: '#ff5d73',
  warden: '#c38cff',
};

export const itemColors: Record<ItemKind, string> = {
  potion: '#ff5d73',
  shard: '#7cf3ff',
  blade: '#f2efff',
  plate: '#9aa7c7',
  elixir: '#62e39b',
};
