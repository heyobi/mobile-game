import AsyncStorage from '@react-native-async-storage/async-storage';
import { restoreRun } from './game/engine';
import { normalizeMeta, type MetaState } from './game/meta';
import type { RunState } from './game/types';

const META_KEY = 'shard-delve/meta/v1';
const RUN_KEY = 'shard-delve/run/v1';

async function readJson(key: string): Promise<unknown> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : undefined;
  } catch (e) {
    console.warn(`storage: failed to read ${key}`, e);
    return undefined;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`storage: failed to write ${key}`, e);
  }
}

export async function loadMeta(): Promise<MetaState> {
  return normalizeMeta(await readJson(META_KEY));
}

export function saveMeta(meta: MetaState): Promise<void> {
  return writeJson(META_KEY, meta);
}

/** The in-progress run, so the game resumes after the app is killed in the background. */
export async function loadRun(): Promise<RunState | undefined> {
  return restoreRun(await readJson(RUN_KEY));
}

export function saveRun(run: RunState): Promise<void> {
  return writeJson(RUN_KEY, run);
}

export async function clearRun(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RUN_KEY);
  } catch (e) {
    console.warn('storage: failed to clear run', e);
  }
}
