import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type GestureResponderEvent, type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FINAL_DEPTH, xpToNext } from '../game/content';
import { step, visibleTiles } from '../game/engine';
import type { Action, Dir, GameEvent, RunState } from '../game/types';
import { DungeonView, type Flash, makeCamera } from './DungeonView';
import { hapticsFor } from './feedback';
import { colors } from './theme';

const FLASH_MS = 260;
const FLOAT_MS = 700;
const SWIPE_MIN = 24;

interface Floater {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  born: number;
}

interface TimedFlash extends Omit<Flash, 'alpha'> {
  born: number;
}

interface Props {
  run: RunState;
  onChange: (run: RunState) => void;
  onEnd: (run: RunState) => void;
  onMenu: () => void;
}

export function GameScreen({ run, onChange, onEnd, onMenu }: Props) {
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [flashes, setFlashes] = useState<TimedFlash[]>([]);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [now, setNow] = useState(0);
  const [hurtAt, setHurtAt] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const floaterId = useRef(0);
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visible = useMemo(() => visibleTiles(run), [run]);
  const camera = useMemo(() => makeCamera(run, size.w, size.h), [run, size.w, size.h]);

  // Drive short-lived effects with rAF only while any are alive.
  const animating = flashes.length > 0 || floaters.length > 0 || now - hurtAt < FLASH_MS;
  useEffect(() => {
    if (!animating) return undefined;
    let raf = requestAnimationFrame(function tick(t) {
      setNow(t);
      setFlashes((f) => f.filter((x) => t - x.born < FLASH_MS));
      setFloaters((f) => f.filter((x) => t - x.born < FLOAT_MS));
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [animating]);

  useEffect(() => () => {
    if (endTimer.current) clearTimeout(endTimer.current);
  }, []);

  const showEffects = useCallback(
    (events: GameEvent[], player: { x: number; y: number }) => {
      const t = performance.now();
      const newFlashes: TimedFlash[] = [];
      const newFloaters: Floater[] = [];
      const float = (x: number, y: number, text: string, color: string) =>
        newFloaters.push({ id: floaterId.current++, x, y, text, color, born: t });
      for (const e of events) {
        if (e.type === 'hit') {
          newFlashes.push({ x: e.x, y: e.y, color: '#ffffff', born: t });
          float(e.x, e.y, `-${e.amount}`, colors.text);
        } else if (e.type === 'hurt') {
          newFlashes.push({ x: player.x, y: player.y, color: colors.danger, born: t });
          float(player.x, player.y, `-${e.amount}`, colors.danger);
          setHurtAt(t);
        } else if (e.type === 'heal') {
          float(player.x, player.y, `+${e.amount}`, colors.heal);
        } else if (e.type === 'levelUp') {
          float(player.x, player.y, 'LEVEL UP', colors.stairs);
        } else if (e.type === 'pickup' && e.kind === 'shard') {
          float(e.x, e.y, '+◆', colors.player);
        }
      }
      if (newFlashes.length) setFlashes((f) => [...f, ...newFlashes]);
      if (newFloaters.length) setFloaters((f) => [...f, ...newFloaters]);
      setNow(t);
    },
    []
  );

  const act = useCallback(
    (action: Action) => {
      if (run.status !== 'playing') return;
      const result = step(run, action);
      hapticsFor(result.events);
      showEffects(result.events, result.state.player);
      onChange(result.state);
      if (result.state.status !== 'playing') {
        // Give the final hit a moment to land before the summary.
        endTimer.current = setTimeout(() => onEnd(result.state), 900);
      }
    },
    [run, onChange, onEnd, showEffects]
  );

  const onTouchStart = (e: GestureResponderEvent) => {
    touchStart.current = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
  };

  const onTouchEnd = (e: GestureResponderEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || camera.tile === 0) return;
    const { locationX, locationY } = e.nativeEvent;
    const dx = locationX - start.x;
    const dy = locationY - start.y;
    let dir: Dir | undefined;
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= SWIPE_MIN) {
      dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    } else {
      // Tap: step towards the tapped tile; tapping yourself waits a turn.
      const tx = Math.floor(locationX / camera.tile + camera.originX) - run.player.x;
      const ty = Math.floor(locationY / camera.tile + camera.originY) - run.player.y;
      if (tx === 0 && ty === 0) return act({ type: 'wait' });
      dir = Math.abs(tx) >= Math.abs(ty) ? (tx > 0 ? 'right' : 'left') : ty > 0 ? 'down' : 'up';
    }
    act({ type: 'move', dir });
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: Math.round(width), h: Math.round(height) });
  };

  const p = run.player;
  const hpFrac = p.hp / p.maxHp;
  const hurtAlpha = Math.max(0, 1 - (now - hurtAt) / FLASH_MS);
  const lastLog = run.log.slice(-3);

  return (
    <View style={styles.root}>
      <View style={[styles.hud, { paddingTop: insets.top + 8 }]}>
        <View style={styles.hudRow}>
          <Text style={styles.depth}>
            {run.depth === FINAL_DEPTH ? 'Lair' : `Depth ${run.depth}`}
            <Text style={styles.dim}> / {FINAL_DEPTH}</Text>
          </Text>
          <Text style={styles.stat}>◆ {run.shards}</Text>
          <Pressable onPress={onMenu} hitSlop={12} accessibilityRole="button" accessibilityLabel="Pause">
            <Text style={styles.menuBtn}>☰</Text>
          </Pressable>
        </View>
        <View style={styles.hpBar}>
          <View style={[styles.hpFill, { width: `${Math.max(0, hpFrac) * 100}%`, backgroundColor: hpFrac < 0.3 ? colors.danger : colors.heal }]} />
          <Text style={styles.hpText}>
            HP {p.hp}/{p.maxHp}
          </Text>
        </View>
        <View style={styles.hudRow}>
          <Text style={styles.stat}>ATK {p.atk}</Text>
          <Text style={styles.stat}>DEF {p.def}</Text>
          <Text style={styles.stat}>
            LV {p.level} <Text style={styles.dim}>({p.xp}/{xpToNext(p.level)})</Text>
          </Text>
        </View>
      </View>

      <View style={styles.board} onLayout={onLayout} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {size.w > 0 && (
          <DungeonView
            state={run}
            visible={visible}
            camera={camera}
            width={size.w}
            height={size.h}
            flashes={flashes.map((f) => ({ ...f, alpha: Math.max(0, 1 - (now - f.born) / FLASH_MS) }))}
          />
        )}
        {floaters.map((f) => {
          const age = Math.min(1, Math.max(0, (now - f.born) / FLOAT_MS));
          return (
            <Text
              key={f.id}
              pointerEvents="none"
              style={[
                styles.floater,
                {
                  left: (f.x - camera.originX) * camera.tile - camera.tile,
                  top: (f.y - camera.originY) * camera.tile - age * camera.tile * 0.8,
                  width: camera.tile * 3,
                  color: f.color,
                  opacity: 1 - age,
                },
              ]}
            >
              {f.text}
            </Text>
          );
        })}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.danger, opacity: hurtAlpha * 0.18 }]} />
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.log}>
          {lastLog.map((line, i) => (
            <Text key={`${run.turn}-${i}`} style={[styles.logLine, i === lastLog.length - 1 && styles.logLatest]} numberOfLines={1}>
              {line}
            </Text>
          ))}
        </View>
        <View style={styles.actions}>
          <Pressable style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]} onPress={() => act({ type: 'wait' })}>
            <Text style={styles.actionText}>Wait</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, p.potions === 0 && styles.disabled, pressed && styles.pressed]}
            onPress={() => act({ type: 'quaff' })}
          >
            <Text style={styles.actionText}>Potion ×{p.potions}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  hud: { paddingHorizontal: 16, paddingBottom: 8, gap: 6, backgroundColor: colors.panel, borderBottomWidth: 1, borderColor: colors.panelBorder },
  hudRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  depth: { color: colors.text, fontSize: 18, fontWeight: '800' },
  dim: { color: colors.textDim, fontWeight: '500' },
  stat: { color: colors.text, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  menuBtn: { color: colors.text, fontSize: 22 },
  hpBar: { height: 20, borderRadius: 10, backgroundColor: '#2a2540', overflow: 'hidden', justifyContent: 'center' },
  hpFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 10 },
  hpText: { color: '#0e0c17', fontWeight: '800', fontSize: 12, textAlign: 'center' },
  board: { flex: 1, overflow: 'hidden' },
  floater: { position: 'absolute', textAlign: 'center', fontWeight: '900', fontSize: 16 },
  bottom: { paddingHorizontal: 16, paddingTop: 8, gap: 8, backgroundColor: colors.panel, borderTopWidth: 1, borderColor: colors.panelBorder },
  log: { minHeight: 54, justifyContent: 'flex-end' },
  logLine: { color: colors.textDim, fontSize: 13 },
  logLatest: { color: colors.text },
  actions: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#241f3d', alignItems: 'center' },
  actionText: { color: colors.text, fontWeight: '700', fontSize: 16 },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
});
