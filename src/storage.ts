import AsyncStorage from '@react-native-async-storage/async-storage';
import { restoreRun } from './game/engine';
import { normalizeMeta, type MetaState } from './game/meta';
import type { RunState } from './game/types';

const META_KEY = 'shard-delve/meta/v1';
const RUN_KEY = 'shard-delve/run/v1';

const READ_TIMEOUT_MS = 3000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

async function readJson(key: string): Promise<unknown> {
  try {
    const raw = await withTimeout(AsyncStorage.getItem(key), READ_TIMEOUT_MS);
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
