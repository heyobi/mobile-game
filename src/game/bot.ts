import { UPGRADES, type UpgradeId } from './config';
import type { InputState, World } from './types';

/**
 * A simple autopilot: flee from nearby enemies and bullets, drift towards gems.
 * Used by the attract/demo mode, the simulator smoke test and balance tests.
 */
export function botInput(w: World): InputState {
  const p = w.player;
  let mx = 0;
  let my = 0;
  for (const e of w.enemies) {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 260 * 260) continue;
    const d = Math.sqrt(d2) || 1;
    const weight = ((e.radius + 30) * 40) / (d2 + 1);
    mx += (dx / d) * weight;
    my += (dy / d) * weight;
  }
  for (const b of w.enemyBullets) {
    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 140 * 140) continue;
    const d = Math.sqrt(d2) || 1;
    mx += (dx / d) * (900 / (d2 + 1));
    my += (dy / d) * (900 / (d2 + 1));
  }
  let gem: { x: number; y: number } | undefined;
  let best = 300 * 300;
  for (const g of w.gems) {
    const d2 = (g.x - p.x) ** 2 + (g.y - p.y) ** 2;
    if (d2 < best) {
      best = d2;
      gem = g;
    }
  }
  if (gem) {
    const dx = gem.x - p.x;
    const dy = gem.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    mx += (dx / d) * 1.1;
    my += (dy / d) * 1.1;
  }
  // Gentle circling so the bot does not get cornered by a ring of enemies.
  mx += Math.cos(w.time * 0.7) * 0.25;
  my += Math.sin(w.time * 0.7) * 0.25;
  const len = Math.hypot(mx, my);
  return len > 1 ? { mx: mx / len, my: my / len } : { mx, my };
}

const PRIORITY: UpgradeId[] = ['multishot', 'orbit', 'nova', 'damage', 'firerate', 'pierce', 'vitality', 'blaster', 'magnet', 'speed'];

export function botChoice(w: World): UpgradeId {
  for (const id of PRIORITY) if (w.offer.includes(id) && w.upgrades[id] < UPGRADES[id].maxLevel) return id;
  return w.offer[0] as UpgradeId;
}
