import { memo, useMemo } from 'react';
import { Canvas, Circle, Group, Path, Rect, RoundedRect } from '@shopify/react-native-skia';
import { MONSTERS } from '../game/content';
import { idx } from '../game/grid';
import { Tile, type Item, type Monster, type RunState } from '../game/types';
import { colors, itemColors, monsterColors } from './theme';

export interface Camera {
  tile: number;
  /** Top-left tile coordinate shown at the canvas origin (may be fractional/negative). */
  originX: number;
  originY: number;
}

export function makeCamera(state: RunState, width: number, height: number, tilesAcross = 11): Camera {
  const tile = Math.floor(width / tilesAcross);
  const rows = height / tile;
  return {
    tile,
    originX: state.player.x + 0.5 - width / tile / 2,
    originY: state.player.y + 0.5 - rows / 2,
  };
}

export interface Flash {
  x: number;
  y: number;
  color: string;
  /** 1 → 0 over the flash lifetime. */
  alpha: number;
}

interface Props {
  state: RunState;
  visible: Set<number>;
  camera: Camera;
  width: number;
  height: number;
  flashes: Flash[];
}

function polygon(cx: number, cy: number, r: number, sides: number, rotation: number): string {
  let d = '';
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i * 2 * Math.PI) / sides;
    d += `${i === 0 ? 'M' : 'L'}${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)} `;
  }
  return d + 'Z';
}

function MonsterShape({ m, sx, sy, t }: { m: Monster; sx: number; sy: number; t: number }) {
  const cx = sx + t / 2;
  const cy = sy + t / 2;
  const c = monsterColors[m.kind];
  const hpFrac = Math.max(0, m.hp / m.maxHp);
  let body;
  switch (m.kind) {
    case 'slime':
      body = <Circle cx={cx} cy={cy + t * 0.06} r={t * 0.3} color={c} />;
      break;
    case 'goblin':
      body = <Path path={polygon(cx, cy + t * 0.04, t * 0.34, 3, -Math.PI / 2)} color={c} />;
      break;
    case 'archer':
      body = <Path path={polygon(cx, cy, t * 0.34, 4, 0)} color={c} />;
      break;
    case 'brute':
      body = <RoundedRect x={sx + t * 0.16} y={sy + t * 0.16} width={t * 0.68} height={t * 0.68} r={t * 0.1} color={c} />;
      break;
    case 'warden':
      body = <Path path={polygon(cx, cy, t * 0.44, 6, Math.PI / 6)} color={c} />;
      break;
  }
  return (
    <Group>
      {body}
      {hpFrac < 1 && (
        <Group>
          <Rect x={sx + t * 0.12} y={sy + t * 0.04} width={t * 0.76} height={t * 0.08} color="#00000099" />
          <Rect x={sx + t * 0.12} y={sy + t * 0.04} width={t * 0.76 * hpFrac} height={t * 0.08} color={colors.danger} />
        </Group>
      )}
      {m.aware && MONSTERS[m.kind].range ? (
        <Circle cx={cx} cy={cy} r={t * 0.08} color={colors.bg} />
      ) : null}
    </Group>
  );
}

function ItemShape({ it, sx, sy, t }: { it: Item; sx: number; sy: number; t: number }) {
  const cx = sx + t / 2;
  const cy = sy + t / 2;
  const c = itemColors[it.kind];
  switch (it.kind) {
    case 'potion':
      return <Circle cx={cx} cy={cy} r={t * 0.16} color={c} />;
    case 'shard':
      return <Path path={polygon(cx, cy, t * 0.16, 4, 0)} color={c} />;
    case 'blade':
      return <Rect x={cx - t * 0.04} y={cy - t * 0.22} width={t * 0.08} height={t * 0.44} color={c} />;
    case 'plate':
      return <RoundedRect x={cx - t * 0.16} y={cy - t * 0.16} width={t * 0.32} height={t * 0.32} r={t * 0.06} color={c} />;
    case 'elixir':
      return <Path path={polygon(cx, cy, t * 0.2, 6, 0)} color={c} />;
  }
}

function DungeonViewImpl({ state, visible, camera, width, height, flashes }: Props) {
  const { map } = state;
  const t = camera.tile;
  const toScreen = (x: number, y: number) => ({ sx: (x - camera.originX) * t, sy: (y - camera.originY) * t });

  const tiles = useMemo(() => {
    const out: { key: number; x: number; y: number; color: string }[] = [];
    const x0 = Math.max(0, Math.floor(camera.originX));
    const y0 = Math.max(0, Math.floor(camera.originY));
    const x1 = Math.min(map.w - 1, Math.ceil(camera.originX + width / t));
    const y1 = Math.min(map.h - 1, Math.ceil(camera.originY + height / t));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = idx(map, x, y);
        const isVisible = visible.has(i);
        if (!isVisible && !map.seen[i]) continue;
        const tile = map.tiles[i];
        let color: string;
        if (tile === Tile.Wall) color = isVisible ? colors.wall : colors.wallSeen;
        else if (tile === Tile.Stairs) color = isVisible ? colors.stairs : '#7a6838';
        else color = isVisible ? colors.floor : colors.floorSeen;
        out.push({ key: i, x, y, color });
      }
    }
    return out;
  }, [map, visible, camera.originX, camera.originY, width, height, t]);

  const p = toScreen(state.player.x, state.player.y);

  return (
    <Canvas style={{ width, height }}>
      <Rect x={0} y={0} width={width} height={height} color={colors.bg} />
      {tiles.map(({ key, x, y, color }) => {
        const s = toScreen(x, y);
        return <Rect key={key} x={s.sx + 1} y={s.sy + 1} width={t - 2} height={t - 2} color={color} />;
      })}
      {state.items
        .filter((it) => visible.has(idx(map, it.x, it.y)))
        .map((it) => {
          const s = toScreen(it.x, it.y);
          return <ItemShape key={it.id} it={it} sx={s.sx} sy={s.sy} t={t} />;
        })}
      {state.monsters
        .filter((m) => visible.has(idx(map, m.x, m.y)))
        .map((m) => {
          const s = toScreen(m.x, m.y);
          return <MonsterShape key={m.id} m={m} sx={s.sx} sy={s.sy} t={t} />;
        })}
      <Circle cx={p.sx + t / 2} cy={p.sy + t / 2} r={t * 0.32} color={colors.player} />
      <Circle cx={p.sx + t / 2} cy={p.sy + t / 2} r={t * 0.14} color={colors.bg} />
      {flashes.map((f, i) => {
        const s = toScreen(f.x, f.y);
        return <Rect key={i} x={s.sx} y={s.sy} width={t} height={t} color={f.color} opacity={f.alpha * 0.6} />;
      })}
    </Canvas>
  );
}

export const DungeonView = memo(DungeonViewImpl);
