import * as Haptics from 'expo-haptics';
import type { GameEvent } from '../game/types';

const ignore = () => {};

/** Maps game events to haptic feedback (strongest event wins, one buzz per turn). */
export function hapticsFor(events: GameEvent[]) {
  const types = new Set(events.map((e) => e.type));
  if (types.has('death')) return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(ignore);
  if (types.has('victory') || types.has('levelUp') || types.has('descend'))
    return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignore);
  if (types.has('hurt')) return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(ignore);
  if (types.has('kill')) return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(ignore);
  if (types.has('hit') || types.has('pickup')) return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(ignore);
  if (types.has('bump')) return Haptics.selectionAsync().catch(ignore);
  return undefined;
}
