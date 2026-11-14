import { Component, type ReactNode, useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { applyRun, buyMeta, defaultMeta, runMods, type MetaState, type MetaUpgradeId } from './src/game/meta';
import { randomSeed } from './src/game/rng';
import type { World } from './src/game/types';
import { createWorld } from './src/game/world';
import { loadMeta, saveMeta } from './src/storage';
import { GameScreen } from './src/ui/GameScreen';
import { MenuScreen, ShopScreen, SummaryScreen } from './src/ui/screens';
import { colors } from './src/ui/theme';

/** Set only in the simulator smoke-test build: skips the menu and lets the autopilot play. */
const AUTOPLAY = process.env.EXPO_PUBLIC_AUTOPLAY === '1';

// Keep the native splash until saved data is loaded, then hide it explicitly.
SplashScreen.preventAutoHideAsync().catch(() => {});

type Screen =
  | { name: 'loading' }
  | { name: 'menu' }
  | { name: 'shop' }
  | { name: 'game'; world: World }
  | { name: 'summary'; world: World; isRecord: boolean };

function Game() {
  const [screen, setScreen] = useState<Screen>({ name: 'loading' });
  const [meta, setMeta] = useState<MetaState>(defaultMeta);

  const newGame = useCallback((m: MetaState) => setScreen({ name: 'game', world: createWorld(randomSeed(), runMods(m)) }), []);

  useEffect(() => {
    let alive = true;
    loadMeta()
      .then((m) => {
        if (!alive) return;
        setMeta(m);
        if (AUTOPLAY) newGame(m);
        else setScreen({ name: 'menu' });
      })
      .finally(() => {
        SplashScreen.hide();
        // The simulator smoke test (ios-smoke.yml) waits for this line.
        console.log('[neon-swarm] APP_READY');
      });
    return () => {
      alive = false;
    };
  }, [newGame]);

  const updateMeta = useCallback((next: MetaState) => {
    setMeta(next);
    saveMeta(next);
  }, []);

  const finish = useCallback(
    (w: World) => {
      const isRecord = w.time > meta.stats.bestTime + 0.5 && meta.stats.runs > 0;
      updateMeta(applyRun(meta, w));
      if (AUTOPLAY) newGame(meta);
      else setScreen({ name: 'summary', world: w, isRecord });
    },
    [meta, updateMeta, newGame]
  );

  switch (screen.name) {
    case 'loading':
      return <View style={styles.fill} />;
    case 'menu':
      return <MenuScreen meta={meta} onPlay={() => newGame(meta)} onShop={() => setScreen({ name: 'shop' })} />;
    case 'shop':
      return <ShopScreen meta={meta} onBuy={(id: MetaUpgradeId) => updateMeta(buyMeta(meta, id))} onBack={() => setScreen({ name: 'menu' })} />;
    case 'summary':
      return (
        <SummaryScreen
          world={screen.world}
          isRecord={screen.isRecord}
          onAgain={() => newGame(meta)}
          onMenu={() => setScreen({ name: 'menu' })}
        />
      );
    case 'game':
      return <GameScreen key={screen.world.seed} world={screen.world} autoplay={AUTOPLAY} onEnd={finish} onQuit={finish} />;
  }
}

/** Last line of defence: show a recoverable screen instead of a frozen app. */
class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  override state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error) {
    console.error('Unhandled UI error', error);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={[styles.fill, styles.center]}>
        <Text style={styles.errTitle}>Something went wrong</Text>
        <Text style={styles.errText}>{this.state.error.message}</Text>
        <Pressable style={styles.errBtn} onPress={() => this.setState({ error: undefined })}>
          <Text style={styles.errTitle}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" hidden />
      <ErrorBoundary>
        <Game />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  errTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  errText: { color: colors.textDim, textAlign: 'center' },
  errBtn: { marginTop: 8, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, backgroundColor: '#5b3dff' },
});
