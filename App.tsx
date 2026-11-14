import { Component, type ReactNode, useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { newRun } from './src/game/engine';
import { applyRunResult, buyUpgrade, defaultMeta, type MetaState, type UpgradeId } from './src/game/meta';
import { randomSeed } from './src/game/rng';
import type { RunState } from './src/game/types';
import { clearRun, loadMeta, loadRun, saveMeta, saveRun } from './src/storage';
import { GameScreen } from './src/ui/GameScreen';
import { MenuScreen, ShopScreen, SummaryScreen } from './src/ui/screens';
import { colors } from './src/ui/theme';

type Screen = { name: 'loading' } | { name: 'menu' } | { name: 'shop' } | { name: 'game' } | { name: 'summary'; run: RunState };

function Game() {
  const [screen, setScreen] = useState<Screen>({ name: 'loading' });
  const [meta, setMeta] = useState<MetaState>(defaultMeta);
  const [run, setRun] = useState<RunState | undefined>();

  useEffect(() => {
    let alive = true;
    Promise.all([loadMeta(), loadRun()]).then(([m, r]) => {
      if (!alive) return;
      setMeta(m);
      setRun(r);
      setScreen({ name: 'menu' });
    });
    return () => {
      alive = false;
    };
  }, []);

  const updateMeta = useCallback((next: MetaState) => {
    setMeta(next);
    saveMeta(next);
  }, []);

  const startRun = useCallback(() => {
    const r = newRun(randomSeed(), meta);
    setRun(r);
    saveRun(r);
    setScreen({ name: 'game' });
  }, [meta]);

  const onRunChange = useCallback((r: RunState) => {
    setRun(r);
    if (r.status === 'playing') saveRun(r);
  }, []);

  const onRunEnd = useCallback(
    (r: RunState) => {
      updateMeta(applyRunResult(meta, r));
      setRun(undefined);
      clearRun();
      setScreen({ name: 'summary', run: r });
    },
    [meta, updateMeta]
  );

  const onBuy = useCallback((id: UpgradeId) => updateMeta(buyUpgrade(meta, id)), [meta, updateMeta]);

  switch (screen.name) {
    case 'loading':
      return <View style={styles.fill} />;
    case 'menu':
      return (
        <MenuScreen
          meta={meta}
          hasSavedRun={!!run}
          onNewRun={startRun}
          onContinue={() => setScreen({ name: 'game' })}
          onShop={() => setScreen({ name: 'shop' })}
        />
      );
    case 'shop':
      return <ShopScreen meta={meta} onBuy={onBuy} onBack={() => setScreen({ name: 'menu' })} />;
    case 'summary':
      return <SummaryScreen run={screen.run} onContinue={() => setScreen({ name: 'menu' })} />;
    case 'game':
      if (!run) return <View style={styles.fill} />;
      return <GameScreen run={run} onChange={onRunChange} onEnd={onRunEnd} onMenu={() => setScreen({ name: 'menu' })} />;
  }
}

/** Last line of defence: show a recoverable screen instead of a white crash. */
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
      <StatusBar style="light" />
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
  errBtn: { marginTop: 8, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, backgroundColor: colors.accent },
});
