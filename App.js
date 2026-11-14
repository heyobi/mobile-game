// Tap Rush — yer tutucu oyun. Ekranda beliren daireler küçülerek kaybolur; kaybolmadan dokun.
// Çizim @shopify/react-native-skia ile, oyun döngüsü requestAnimationFrame ile yapılır.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Canvas, Circle, Group } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';

const COLORS = ['#ff5d73', '#ffb84d', '#4dd4ff', '#7cff6b', '#b98cff'];
const START_LIVES = 3;
const HUD_HEIGHT = 110;

let nextId = 1;

function spawnTarget(width, height, level) {
  const r = 28 + Math.random() * 22;
  return {
    id: nextId++,
    x: r + Math.random() * (width - 2 * r),
    y: HUD_HEIGHT + r + Math.random() * (height - HUD_HEIGHT - 2 * r - 40),
    r,
    maxR: r,
    // Seviye arttıkça daireler daha hızlı küçülür.
    shrink: 10 + level * 3 + Math.random() * 6,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
}

export default function App() {
  const { width, height } = useWindowDimensions();
  const [state, setState] = useState('menu'); // 'menu' | 'playing' | 'over'
  const [targets, setTargets] = useState([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(START_LIVES);
  const [best, setBest] = useState(0);

  const game = useRef({ targets: [], score: 0, lives: START_LIVES, spawnIn: 0, last: 0 });

  const start = useCallback(() => {
    game.current = { targets: [], score: 0, lives: START_LIVES, spawnIn: 0, last: 0 };
    setTargets([]);
    setScore(0);
    setLives(START_LIVES);
    setState('playing');
  }, []);

  useEffect(() => {
    if (state !== 'playing') return undefined;
    let raf;
    const tick = (now) => {
      const g = game.current;
      const dt = g.last ? Math.min((now - g.last) / 1000, 0.05) : 0;
      g.last = now;
      const level = Math.floor(g.score / 10);

      g.spawnIn -= dt;
      if (g.spawnIn <= 0 && g.targets.length < 6) {
        g.targets.push(spawnTarget(width, height, level));
        g.spawnIn = Math.max(0.35, 1.1 - level * 0.08);
      }

      let missed = 0;
      g.targets = g.targets.filter((t) => {
        t.r -= t.shrink * dt;
        if (t.r <= 4) {
          missed += 1;
          return false;
        }
        return true;
      });

      if (missed) {
        g.lives -= missed;
        setLives(Math.max(g.lives, 0));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      }
      if (g.lives <= 0) {
        setBest((b) => Math.max(b, g.score));
        setState('over');
        return;
      }
      setTargets(g.targets.map((t) => ({ ...t })));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state, width, height]);

  const onTouch = useCallback(
    (e) => {
      if (state !== 'playing') return;
      const { locationX, locationY } = e.nativeEvent;
      const g = game.current;
      const hit = g.targets.find((t) => (t.x - locationX) ** 2 + (t.y - locationY) ** 2 <= (t.r + 10) ** 2);
      if (!hit) return;
      g.targets = g.targets.filter((t) => t.id !== hit.id);
      g.score += 1;
      setScore(g.score);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    },
    [state]
  );

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={StyleSheet.absoluteFill} onTouchStart={onTouch}>
        <Canvas style={StyleSheet.absoluteFill}>
          {targets.map((t) => (
            <Group key={t.id}>
              <Circle cx={t.x} cy={t.y} r={t.maxR} color={t.color} opacity={0.15} />
              <Circle cx={t.x} cy={t.y} r={t.r} color={t.color} />
            </Group>
          ))}
        </Canvas>
      </View>

      <View style={styles.hud} pointerEvents="none">
        <Text style={styles.hudText}>Skor {score}</Text>
        <Text style={styles.hudText}>{'♥'.repeat(Math.max(lives, 0))}</Text>
      </View>

      {state !== 'playing' && (
        <View style={styles.overlay}>
          <Text style={styles.title}>Tap Rush</Text>
          {state === 'over' ? (
            <Text style={styles.subtitle}>Skor: {score} · En iyi: {best}</Text>
          ) : (
            <Text style={styles.subtitle}>Daireler kaybolmadan dokun!</Text>
          )}
          <Pressable style={styles.button} onPress={start}>
            <Text style={styles.buttonText}>{state === 'over' ? 'Tekrar oyna' : 'Başla'}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#14121f' },
  hud: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HUD_HEIGHT,
    paddingTop: 60,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hudText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,18,31,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: { color: '#fff', fontSize: 48, fontWeight: '800' },
  subtitle: { color: '#c9c4e8', fontSize: 18 },
  button: { marginTop: 12, backgroundColor: '#6c5cff', paddingHorizontal: 36, paddingVertical: 14, borderRadius: 28 },
  buttonText: { color: '#fff', fontSize: 20, fontWeight: '700' },
});
