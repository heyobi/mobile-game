import { type ReactNode, useCallback, useRef, useState } from 'react';
import { type LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Canvas, Picture } from '@shopify/react-native-skia';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { botChoice, botInput } from '../game/bot';
import { canBuyMeta, crystalsFor, META_UPGRADE_IDS, META_UPGRADES, metaCost, type MetaState, type MetaUpgradeId } from '../game/meta';
import type { World } from '../game/types';
import { chooseUpgrade, createWorld } from '../game/world';
import { colors, glowText } from './theme';
import { useWorldLoop } from './useWorldLoop';

function formatTime(t: number) {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** A self-playing game behind the menu: the store screenshot and the first impression in one. */
function backdropWorld(seed: number): World {
  const w = createWorld(seed);
  w.time = 95; // start mid-action so the screen is busy immediately
  return w;
}

function Backdrop() {
  const [initial] = useState(() => backdropWorld(12345));
  const world = useRef<World | null>(initial);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const input = useCallback(() => (world.current ? botInput(world.current) : { mx: 0, my: 0 }), []);
  const onFrame = useCallback((w: World) => {
    if (w.phase === 'levelup') chooseUpgrade(w, botChoice(w));
    if (w.phase === 'dead' || w.phase === 'won' || w.time > 280) {
      world.current = backdropWorld(Math.floor(Math.random() * 1e9));
    }
  }, []);
  const picture = useWorldLoop({ world, view: { ...size, dim: 0.55 }, input, running: true, onFrame });
  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ width: Math.round(e.nativeEvent.layout.width), height: Math.round(e.nativeEvent.layout.height) });
  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none">
      {size.width > 0 && <Canvas style={size}>{picture && <Picture picture={picture} />}</Canvas>}
    </View>
  );
}

function Button({ label, onPress, primary, disabled }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, primary && styles.primary, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Text style={[styles.buttonText, primary && styles.primaryText]}>{label}</Text>
    </Pressable>
  );
}

function Shell({ children, backdrop }: { children: ReactNode; backdrop?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      {backdrop && <Backdrop />}
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 28 }]}>
        {children}
      </ScrollView>
    </View>
  );
}

export function MenuScreen({ meta, onPlay, onShop }: { meta: MetaState; onPlay: () => void; onShop: () => void }) {
  const version = Constants.expoConfig?.version ?? '';
  const build = Constants.expoConfig?.ios?.buildNumber ?? '';
  return (
    <Shell backdrop>
      <View style={styles.hero}>
        <Text style={[styles.title, glowText(colors.cyan)]}>NEON</Text>
        <Text style={[styles.title, glowText(colors.magenta)]}>SWARM</Text>
        <Text style={styles.tagline}>Survive 5 minutes. Destroy the Overseer.</Text>
      </View>
      <View style={styles.spacer} />
      <View style={styles.stack}>
        <Button primary label="PLAY" onPress={onPlay} />
        <Button label={`Upgrades   ◆ ${meta.crystals}`} onPress={onShop} />
      </View>
      <View style={styles.stats}>
        <Stat label="Best time" value={formatTime(meta.stats.bestTime)} />
        <Stat label="Best kills" value={String(meta.stats.bestKills)} />
        <Stat label="Wins" value={String(meta.stats.wins)} />
      </View>
      <Text style={styles.version}>
        v{version} ({build})
      </Text>
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function SummaryScreen({
  world,
  isRecord,
  onAgain,
  onMenu,
}: {
  world: World;
  isRecord: boolean;
  onAgain: () => void;
  onMenu: () => void;
}) {
  const won = world.phase === 'won';
  return (
    <Shell>
      <View style={styles.hero}>
        <Text style={[styles.title, glowText(won ? colors.yellow : colors.red)]}>{won ? 'VICTORY' : 'DESTROYED'}</Text>
        {isRecord && <Text style={[styles.record, glowText(colors.yellow)]}>NEW RECORD</Text>}
      </View>
      <View style={styles.stats}>
        <Stat label="Survived" value={formatTime(world.time)} />
        <Stat label="Kills" value={String(world.kills)} />
        <Stat label="Level" value={String(world.level)} />
      </View>
      <Text style={[styles.earned, glowText(colors.cyan)]}>+ ◆ {crystalsFor(world)} crystals</Text>
      <View style={styles.stack}>
        <Button primary label="PLAY AGAIN" onPress={onAgain} />
        <Button label="Menu" onPress={onMenu} />
      </View>
    </Shell>
  );
}

export function ShopScreen({ meta, onBuy, onBack }: { meta: MetaState; onBuy: (id: MetaUpgradeId) => void; onBack: () => void }) {
  return (
    <Shell>
      <Text style={[styles.heading, glowText(colors.cyan)]}>UPGRADES</Text>
      <Text style={styles.tagline}>◆ {meta.crystals} crystals · permanent for every run</Text>
      <View style={styles.stack}>
        {META_UPGRADE_IDS.map((id) => {
          const def = META_UPGRADES[id];
          const lvl = meta.upgrades[id];
          const maxed = lvl >= def.maxLevel;
          const ok = canBuyMeta(meta, id);
          return (
            <View key={id} style={styles.upgrade}>
              <View style={{ flex: 1 }}>
                <Text style={styles.upgradeName}>
                  {def.name}{' '}
                  <Text style={styles.dim}>
                    {lvl}/{def.maxLevel}
                  </Text>
                </Text>
                <Text style={styles.dim}>{def.description}</Text>
              </View>
              <Pressable
                disabled={!ok}
                onPress={() => onBuy(id)}
                style={({ pressed }) => [styles.buy, !ok && styles.disabled, pressed && styles.pressed]}
              >
                <Text style={styles.primaryText}>{maxed ? 'MAX' : `◆ ${metaCost(id, lvl)}`}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
      <Button label="Back" onPress={onBack} />
    </Shell>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, paddingHorizontal: 24, gap: 18 },
  hero: { alignItems: 'center', marginTop: 20 },
  title: { fontSize: 64, fontWeight: '900', letterSpacing: 8, lineHeight: 70 },
  tagline: { color: colors.textDim, fontSize: 16, textAlign: 'center', marginTop: 10 },
  spacer: { flexGrow: 1, minHeight: 40 },
  heading: { fontSize: 38, fontWeight: '900', letterSpacing: 4, textAlign: 'center' },
  record: { fontSize: 20, fontWeight: '900', letterSpacing: 4, marginTop: 6 },
  stack: { gap: 12 },
  button: {
    paddingVertical: 17,
    borderRadius: 18,
    backgroundColor: 'rgba(26,19,56,0.9)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  primary: {
    backgroundColor: colors.cyan,
    borderColor: colors.cyan,
    shadowColor: colors.cyan,
    shadowOpacity: 0.8,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  buttonText: { color: colors.text, fontSize: 18, fontWeight: '800' },
  primaryText: { color: '#06040f', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.35 },
  stats: {
    flexDirection: 'row',
    backgroundColor: colors.panel,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: colors.text, fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] },
  statLabel: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  earned: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  version: { color: '#4b437a', textAlign: 'center', fontSize: 12 },
  upgrade: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  upgradeName: { color: colors.text, fontSize: 18, fontWeight: '900' },
  dim: { color: colors.textDim, fontWeight: '500' },
  buy: { backgroundColor: colors.cyan, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, minWidth: 84, alignItems: 'center' },
});
