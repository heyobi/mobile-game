import * as Haptics from 'expo-haptics';
import type { WorldEvents } from '../game/types';

const ignore = () => {};
let lastKillBuzz = 0;

/** Maps one frame's world events to haptics (throttled so swarms do not buzz constantly). */
export function hapticsFor(e: WorldEvents, now: number) {
  if (e.died) return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(ignore);
  if (e.bossKilled) return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignore);
  if (e.bossSpawned) return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(ignore);
  if (e.levelUp) return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignore);
  if (e.hurt > 0) return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(ignore);
  if (e.kills > 0 && now - lastKillBuzz > 90) {
    lastKillBuzz = now;
    return Haptics.impactAsync(e.kills > 2 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(ignore);
  }
  return undefined;
}
