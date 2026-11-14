import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type GestureResponderEvent, type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Canvas, Picture } from '@shopify/react-native-skia';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { botChoice, botInput } from '../game/bot';
import { RUN_SECONDS, UPGRADES, xpToNext, type UpgradeId } from '../game/config';
import type { World } from '../game/types';
import { chooseUpgrade } from '../game/world';
import type { Joystick } from '../render/neon';
import { hapticsFor } from './feedback';
import { colors, glowText } from './theme';
import { useWorldLoop } from './useWorldLoop';

const STICK_RADIUS = 54;

interface Hud {
  hp: number;
  maxHp: number;
  level: number;
  xpFrac: number;
  time: number;
  kills: number;
  bossFrac: number | null;
}

function formatTime(t: number) {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

interface Props {
  world: World;
  /** Autopilot (demo builds / smoke test). */
  autoplay?: boolean;
  onEnd: (w: World) => void;
  onQuit: (w: World) => void;
}

export function GameScreen({ world, autoplay, onEnd, onQuit }: Props) {
  const insets = useSafeAreaInsets();
  const worldRef = useRef<World | null>(world);
  const stick = useRef<Joystick>({ active: false, ox: 0, oy: 0, x: 0, y: 0 });
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [paused, setPaused] = useState(false);
  const [offer, setOffer] = useState<{ id: UpgradeId; next: number }[] | null>(null);
  const [hud, setHud] = useState<Hud>(() => readHud(world));
  const [banner, setBanner] = useState<string | null>('SURVIVE');
  const frameCount = useRef(0);
  const fps = useRef({ frames: 0, since: 0 });
  const ended = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setBanner(null), 1600);
    return () => clearTimeout(t);
  }, []);

  // Pause when the app goes to the background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') setPaused(true);
    });
    return () => sub.remove();
  }, []);

  const input = useCallback(() => {
    const w = worldRef.current;
    if (autoplay && w) return botInput(w);
    const s = stick.current;
    if (!s.active) return { mx: 0, my: 0 };
    return { mx: (s.x - s.ox) / STICK_RADIUS, my: (s.y - s.oy) / STICK_RADIUS };
  }, [autoplay]);

  const pick = useCallback((id: UpgradeId) => {
    const w = worldRef.current;
    if (!w) return;
    chooseUpgrade(w, id);
    setHud(readHud(w));
    setOffer(w.phase === 'levelup' ? offerFor(w) : null);
  }, []);

  const onFrame = useCallback(
    (w: World, events: World['events'], now: number) => {
      hapticsFor(events, now);
      if (autoplay) {
        // Performance probe for the simulator smoke test.
        const f = fps.current;
        if (!f.since) f.since = now;
        f.frames++;
        if (now - f.since > 5000) {
          console.log(`[neon-swarm] fps=${((f.frames * 1000) / (now - f.since)).toFixed(1)} enemies=${w.enemies.length} particles=${w.particles.length} t=${w.time.toFixed(0)}`);
          f.frames = 0;
          f.since = now;
        }
      }
      if (events.bossSpawned) {
        setBanner('WARNING: OVERSEER APPROACHING');
        setTimeout(() => setBanner(null), 2500);
      }
      if (w.phase === 'levelup' && !offer) {
        setOffer(offerFor(w));
        if (autoplay) setTimeout(() => pick(botChoice(w)), 700);
      }
      if ((w.phase === 'dead' || w.phase === 'won') && !ended.current) {
        ended.current = true;
        setTimeout(() => onEnd(w), 1800);
      }
      if (++frameCount.current % 5 === 0 || events.hurt || events.levelUp) setHud(readHud(w));
    },
    [offer, autoplay, onEnd, pick]
  );

  const picture = useWorldLoop({
    world: worldRef,
    view: size,
    input,
    joystick: stick,
    running: !paused && !offer,
    onFrame,
  });


  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width: Math.round(width), height: Math.round(height) });
  };

  const touchStart = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    stick.current = { active: true, ox: locationX, oy: locationY, x: locationX, y: locationY };
  };
  const touchMove = (e: GestureResponderEvent) => {
    const s = stick.current;
    if (!s.active) return;
    let dx = e.nativeEvent.locationX - s.ox;
    let dy = e.nativeEvent.locationY - s.oy;
    const d = Math.hypot(dx, dy);
    if (d > STICK_RADIUS) {
      // Drag the origin along so the stick never "runs out" (feels better than clamping).
      s.ox += (dx / d) * (d - STICK_RADIUS);
      s.oy += (dy / d) * (d - STICK_RADIUS);
      dx = e.nativeEvent.locationX - s.ox;
      dy = e.nativeEvent.locationY - s.oy;
    }
    s.x = s.ox + dx;
    s.y = s.oy + dy;
  };
  const touchEnd = () => {
    stick.current = { ...stick.current, active: false };
  };

  const hpFrac = hud.hp / hud.maxHp;
  const remaining = RUN_SECONDS - hud.time;

  return (
    <View style={styles.root}>
      <View
        style={StyleSheet.absoluteFill}
        onLayout={onLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={touchStart}
        onResponderMove={touchMove}
        onResponderRelease={touchEnd}
        onResponderTerminate={touchEnd}
      >
        {size.width > 0 && (
          <Canvas style={size}>
            {picture && <Picture picture={picture} />}
          </Canvas>
        )}
      </View>

      {/* HUD */}
      <View pointerEvents="box-none" style={[styles.hud, { paddingTop: insets.top + 4 }]}>
        <View style={styles.xpBar}>
          <View style={[styles.xpFill, { width: `${hud.xpFrac * 100}%` }]} />
        </View>
        <View style={styles.hudRow} pointerEvents="box-none">
          <Text style={styles.level}>LV {hud.level}</Text>
          <Text style={[styles.timer, remaining <= 0 && { color: colors.orange }]}>
            {remaining > 0 ? formatTime(remaining) : 'BOSS'}
          </Text>
          <Pressable hitSlop={14} onPress={() => setPaused(true)} accessibilityLabel="Pause">
            <Text style={styles.pause}>❚❚</Text>
          </Pressable>
        </View>
        <View style={styles.hudRow} pointerEvents="none">
          <View style={styles.hpBar}>
            <View style={[styles.hpFill, { width: `${Math.max(0, hpFrac) * 100}%`, backgroundColor: hpFrac < 0.3 ? colors.red : colors.green }]} />
          </View>
          <Text style={styles.kills}>✕ {hud.kills}</Text>
        </View>
        {hud.bossFrac !== null && (
          <View style={styles.bossBar} pointerEvents="none">
            <View style={[styles.bossFill, { width: `${hud.bossFrac * 100}%` }]} />
            <Text style={styles.bossLabel}>OVERSEER</Text>
          </View>
        )}
      </View>

      {banner && (
        <View pointerEvents="none" style={styles.bannerWrap}>
          <Text style={[styles.banner, glowText(banner.startsWith('WARNING') ? colors.orange : colors.cyan)]}>{banner}</Text>
          {banner === 'SURVIVE' && <Text style={styles.hint}>Drag anywhere to move. You fire automatically.</Text>}
        </View>
      )}

      {offer && (
        <View style={styles.overlay}>
          <Text style={[styles.overlayTitle, glowText(colors.yellow)]}>LEVEL UP</Text>
          <Text style={styles.overlaySub}>Choose one</Text>
          {offer.map(({ id, next }) => {
            const def = UPGRADES[id];
            return (
              <Pressable
                key={id}
                onPress={() => pick(id)}
                style={({ pressed }) => [styles.card, { borderColor: def.color, shadowColor: def.color }, pressed && styles.pressed]}
              >
                <Text style={[styles.cardIcon, glowText(def.color)]}>{def.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>
                    {def.name} <Text style={{ color: def.color }}>{next === 1 ? 'NEW' : `LV ${next}`}</Text>
                  </Text>
                  <Text style={styles.cardDesc}>{def.describe(next)}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {paused && (
        <View style={styles.overlay}>
          <Text style={[styles.overlayTitle, glowText(colors.cyan)]}>PAUSED</Text>
          <Pressable style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]} onPress={() => setPaused(false)}>
            <Text style={styles.buttonText}>Resume</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={() => worldRef.current && onQuit(worldRef.current)}
          >
            <Text style={styles.buttonText}>Give up</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function offerFor(w: World) {
  return w.offer.map((id) => ({ id, next: w.upgrades[id] + 1 }));
}

function readHud(w: World): Hud {
  const boss = w.enemies.find((e) => e.kind === 'boss');
  return {
    hp: Math.ceil(w.player.hp),
    maxHp: w.player.maxHp,
    level: w.level,
    xpFrac: Math.min(1, w.xp / xpToNext(w.level)),
    time: w.time,
    kills: w.kills,
    bossFrac: boss ? Math.max(0, boss.hp / boss.maxHp) : null,
  };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  hud: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 14, gap: 6 },
  xpBar: { height: 6, borderRadius: 3, backgroundColor: '#1d1640', overflow: 'hidden' },
  xpFill: { height: '100%', backgroundColor: colors.cyan },
  hudRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  level: { ...glowText(colors.cyan), fontSize: 18, fontWeight: '900', width: 70 },
  timer: { color: colors.text, fontSize: 26, fontWeight: '900', fontVariant: ['tabular-nums'] },
  pause: { color: colors.text, fontSize: 18, width: 70, textAlign: 'right' },
  hpBar: { flex: 1, height: 10, borderRadius: 5, backgroundColor: '#2a1430', overflow: 'hidden' },
  hpFill: { height: '100%' },
  kills: { color: colors.textDim, fontWeight: '800', fontSize: 14, fontVariant: ['tabular-nums'] },
  bossBar: { height: 16, borderRadius: 8, backgroundColor: '#2a1608', overflow: 'hidden', justifyContent: 'center', marginTop: 4 },
  bossFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.orange },
  bossLabel: { color: '#1a0c00', fontWeight: '900', fontSize: 11, textAlign: 'center', letterSpacing: 2 },
  bannerWrap: { position: 'absolute', left: 0, right: 0, top: '30%', alignItems: 'center', gap: 8, paddingHorizontal: 24 },
  banner: { fontSize: 30, fontWeight: '900', letterSpacing: 3, textAlign: 'center' },
  hint: { color: colors.textDim, fontSize: 15, textAlign: 'center' },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(6,4,15,0.82)',
    alignItems: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 22,
    gap: 14,
  },
  overlayTitle: { fontSize: 38, fontWeight: '900', textAlign: 'center', letterSpacing: 4 },
  overlaySub: { color: colors.textDim, textAlign: 'center', marginBottom: 6 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 2,
    backgroundColor: '#100b26',
    shadowOpacity: 0.7,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  cardIcon: { fontSize: 34, width: 44, textAlign: 'center' },
  cardName: { color: colors.text, fontSize: 18, fontWeight: '900' },
  cardDesc: { color: colors.textDim, fontSize: 14, marginTop: 2 },
  button: { paddingVertical: 16, borderRadius: 16, backgroundColor: '#1a1338', alignItems: 'center' },
  primary: { backgroundColor: '#5b3dff' },
  buttonText: { color: colors.text, fontSize: 18, fontWeight: '800' },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
});
