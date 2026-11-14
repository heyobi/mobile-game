import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { FINAL_DEPTH, MONSTERS } from '../game/content';
import { canBuy, UPGRADE_IDS, UPGRADES, upgradeCost, type MetaState, type UpgradeId } from '../game/meta';
import type { RunState } from '../game/types';
import { colors } from './theme';

function Screen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}
    >
      {children}
    </ScrollView>
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
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export function MenuScreen({
  meta,
  hasSavedRun,
  onNewRun,
  onContinue,
  onShop,
}: {
  meta: MetaState;
  hasSavedRun: boolean;
  onNewRun: () => void;
  onContinue: () => void;
  onShop: () => void;
}) {
  const version = Constants.expoConfig?.version ?? '';
  const build = Constants.expoConfig?.ios?.buildNumber ?? '';
  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.logo}>◆</Text>
        <Text style={styles.title}>Shard Delve</Text>
        <Text style={styles.subtitle}>Descend {FINAL_DEPTH} depths. Defeat the Warden.</Text>
      </View>
      <View style={styles.stack}>
        {hasSavedRun && <Button primary label="Continue run" onPress={onContinue} />}
        <Button primary={!hasSavedRun} label={hasSavedRun ? 'Abandon & new run' : 'New run'} onPress={onNewRun} />
        <Button label={`Upgrades  ·  ◆ ${meta.shards}`} onPress={onShop} />
      </View>
      <View style={styles.statsBox}>
        <Stat label="Runs" value={meta.stats.runs} />
        <Stat label="Wins" value={meta.stats.wins} />
        <Stat label="Best depth" value={meta.stats.bestDepth} />
        <Stat label="Kills" value={meta.stats.kills} />
      </View>
      <View style={styles.help}>
        <Text style={styles.helpTitle}>How to play</Text>
        <Text style={styles.helpText}>Swipe or tap beside you to move. Walk into enemies to attack.</Text>
        <Text style={styles.helpText}>Tap yourself or “Wait” to skip a turn. Find the golden stairs.</Text>
        <Text style={styles.helpText}>Shards you collect are kept even if you fall — spend them on upgrades.</Text>
      </View>
      <Text style={styles.version}>
        v{version} ({build})
      </Text>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function SummaryScreen({ run, onContinue }: { run: RunState; onContinue: () => void }) {
  const won = run.status === 'won';
  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={[styles.logo, { color: won ? colors.stairs : colors.danger }]}>{won ? '★' : '✕'}</Text>
        <Text style={styles.title}>{won ? 'Victory' : 'You fell'}</Text>
        <Text style={styles.subtitle}>
          {won
            ? 'The Warden is defeated.'
            : `Slain by ${run.killedBy ? MONSTERS[run.killedBy].name : 'the depths'} on depth ${run.depth}.`}
        </Text>
      </View>
      <View style={styles.statsBox}>
        <Stat label="Depth" value={run.depth} />
        <Stat label="Kills" value={run.kills} />
        <Stat label="Level" value={run.player.level} />
        <Stat label="Turns" value={run.turn} />
      </View>
      <Text style={styles.earned}>+ ◆ {run.shards} shards banked</Text>
      <Text style={styles.seed}>Seed {run.seed}</Text>
      <View style={styles.stack}>
        <Button primary label="Continue" onPress={onContinue} />
      </View>
    </Screen>
  );
}

export function ShopScreen({ meta, onBuy, onBack }: { meta: MetaState; onBuy: (id: UpgradeId) => void; onBack: () => void }) {
  return (
    <Screen>
      <Text style={styles.title}>Upgrades</Text>
      <Text style={[styles.subtitle, { marginBottom: 20 }]}>◆ {meta.shards} shards</Text>
      <View style={styles.stack}>
        {UPGRADE_IDS.map((id) => {
          const def = UPGRADES[id];
          const lvl = meta.upgrades[id];
          const maxed = lvl >= def.maxLevel;
          return (
            <View key={id} style={styles.upgrade}>
              <View style={{ flex: 1 }}>
                <Text style={styles.upgradeName}>
                  {def.name} <Text style={styles.dim}>{lvl}/{def.maxLevel}</Text>
                </Text>
                <Text style={styles.upgradeDesc}>{def.description}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={!canBuy(meta, id)}
                onPress={() => onBuy(id)}
                style={({ pressed }) => [styles.buyBtn, !canBuy(meta, id) && styles.disabled, pressed && styles.pressed]}
              >
                <Text style={styles.buttonText}>{maxed ? 'MAX' : `◆ ${upgradeCost(id, lvl)}`}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
      <View style={[styles.stack, { marginTop: 24 }]}>
        <Button label="Back" onPress={onBack} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 24, gap: 20 },
  hero: { alignItems: 'center', gap: 6, marginBottom: 8 },
  logo: { fontSize: 56, color: colors.player },
  title: { color: colors.text, fontSize: 40, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: colors.textDim, fontSize: 16, textAlign: 'center' },
  stack: { gap: 12 },
  button: { paddingVertical: 16, borderRadius: 16, backgroundColor: '#241f3d', alignItems: 'center' },
  primary: { backgroundColor: colors.accent },
  buttonText: { color: colors.text, fontSize: 17, fontWeight: '800' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
  statsBox: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#17142a', borderRadius: 16, padding: 16 },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { color: colors.text, fontSize: 22, fontWeight: '800' },
  statLabel: { color: colors.textDim, fontSize: 12 },
  help: { gap: 4 },
  helpTitle: { color: colors.text, fontWeight: '800', fontSize: 15 },
  helpText: { color: colors.textDim, fontSize: 14, lineHeight: 20 },
  version: { color: '#5d5780', textAlign: 'center', fontSize: 12 },
  earned: { color: colors.player, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  seed: { color: '#5d5780', textAlign: 'center', fontSize: 12 },
  dim: { color: colors.textDim, fontWeight: '500' },
  upgrade: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#17142a', borderRadius: 16, padding: 16 },
  upgradeName: { color: colors.text, fontSize: 17, fontWeight: '800' },
  upgradeDesc: { color: colors.textDim, fontSize: 14 },
  buyBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.accent, minWidth: 80, alignItems: 'center' },
});
