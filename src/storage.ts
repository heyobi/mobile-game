import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeMeta, type MetaState } from './game/meta';

const META_KEY = 'neon-swarm/meta/v2';
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

export async function loadMeta(): Promise<MetaState> {
  try {
    const raw = await withTimeout(AsyncStorage.getItem(META_KEY), READ_TIMEOUT_MS);
    return normalizeMeta(raw ? JSON.parse(raw) : undefined);
  } catch (e) {
    console.warn('storage: failed to load meta', e);
    return normalizeMeta(undefined);
  }
}

export async function saveMeta(meta: MetaState): Promise<void> {
  try {
    await AsyncStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch (e) {
    console.warn('storage: failed to save meta', e);
  }
}
