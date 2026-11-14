# Shard Delve — game design (living document)

Working title. Turn-based dungeon roguelike for iPhone, played one-handed in 5–10 minute runs.

## Pillars

1. **One more run.** Short runs, instant restart, meta-progress that is always moving.
2. **Readable at a glance.** Minimal geometric art, one shape + colour per thing, no clutter.
3. **Every turn is a decision.** Nothing moves until you do; positioning matters more than reflexes.

## Core loop

Menu → run (5 depths, depth 5 is the Warden's lair) → death or victory → shards are banked →
spend on upgrades → next run.

## Controls

- Swipe in a direction, or tap a tile beside you, to move one step. Walking into an enemy attacks it.
- Tap yourself or **Wait** to pass a turn. **Potion** heals 10 HP.
- Stepping on the golden stairs descends immediately.

## Systems (v1)

| System | Rules |
| --- | --- |
| Map | 30×22 grid, 6–9 rooms joined by corridors plus 2 loops; field of view radius 7, explored tiles remembered |
| Player | 20 HP, 3 ATK, 0 DEF, 1 potion. Level up every 10×level XP: +4 max HP, +1 ATK |
| Damage | `max(1, ATK − DEF ± 1)` |
| Slime ● | weak, depth 1+ |
| Goblin ▲ | standard melee, depth 1+ |
| Archer ◆ | shoots in a straight clear line up to 5 tiles, depth 2+ |
| Brute ■ | tough, moves every other turn, depth 3+ |
| Warden ⬢ | boss, 45 HP, depth 5 — killing it wins the run (+25 shards) |
| Items | potion, shards (currency), blade (+1 ATK), plate (+1 DEF), elixir (+4 max HP); one potion guaranteed per floor |
| Meta | Vitality (+3 HP), Power (+1 ATK), Guard (+1 DEF), Satchel (+1 starting potion); shards kept on death |

Monster stats scale ×(1 + 0.15·(depth−1)) for HP and ×(1 + 0.1·(depth−1)) for ATK.

## Technical rules

- `src/game/` is pure TypeScript with no React/React Native imports: deterministic from the run
  seed, fully unit tested (`npm test`). `step(state, action)` never mutates its input.
- Runs and meta progress are versioned JSON in AsyncStorage; an in-progress run survives the app being killed.
- The seed is shown on the run summary so a bug report can reproduce the exact dungeon.

## Backlog / ideas

- Smooth movement tweens and death/hit particles (Reanimated + Skia)
- Sound effects and music; settings screen (haptics/sound toggles)
- More enemy behaviours (fleeing, summoners), traps, keys/doors, shrines with trade-offs
- Character classes unlocked with shards; daily seeded run
- Crash reporting and analytics (needs a decision on a free tier service)
- Localization (TR/EN), accessibility (VoiceOver labels, colour-blind palette)
- App Store assets: final name, icon, screenshots, privacy details
