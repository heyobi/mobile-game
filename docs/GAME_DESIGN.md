# Neon Swarm — game design (living document)

Working title. Free-to-play neon horde-survival roguelite for iPhone. One thumb, 5-minute runs.

## Goal and constraints

- Free, no marketing budget → growth must be organic: App Store search, short-form video (TikTok/Reels/Shorts),
  word of mouth. The game must look spectacular in a 10-second clip and hook in the first 30 seconds of play.
- Every visual is drawn in code (Skia): no art pipeline, consistent neon style, tiny download size.

## Pillars

1. **Instant power fantasy.** Shooting starts automatically; within 20 seconds the screen is full of explosions.
2. **A new build every run.** Level-up choices (1 of 3) change how the run plays: blaster, orbit blades, nova pulse.
3. **One more run.** 5 minutes, instant restart, crystals for permanent upgrades, records to beat.

## Core loop

Play (drag anywhere = floating joystick, auto-fire at nearest enemy) → collect XP gems → level up → pick an
upgrade → survive escalating waves → at 5:00 the Overseer boss arrives → win or die → crystals → permanent upgrades.

## Content (v1)

| Enemy | Shape | Behaviour | From |
| --- | --- | --- | --- |
| Drone | magenta triangle | chases | 0:00 |
| Dart | yellow triangle | fast chaser, faster than you | 0:40 |
| Tank | red square | slow, very tough | 1:20 |
| Splitter | green hexagon | splits into 3 drones | 2:10 |
| Shooter | purple diamond | keeps distance, fires bullets | 2:50 |
| Overseer | orange octagon | boss: radial bullet bursts, summons darts | 5:00 |

Upgrades: Split Shot, Overclock, Plasma Core, Railgun (pierce), Blaster, Orbit Blades, Nova Pulse, Thrusters,
Tractor Beam, Hull Plating. Meta (crystals): Might, Hull, Engine, Greed.

All numbers are in `src/game/config.ts`. Balance is checked with the autopilot (`src/game/bot.ts`): it should reach
the boss at level ~22–27; humans are expected to do worse than the bot.

## Technical

- `src/game/` is pure TypeScript, deterministic from the seed, fixed 60 Hz step, unit tested (`npm test`).
- `src/render/neon.ts` draws each frame into one SkPicture with additive glow sprites.
- CI smoke test plays 60 s with the autopilot in the iOS simulator, logs FPS and captures screenshots + video
  (also useful as raw material for store videos).

## Next (ordered by expected impact on organic growth)

1. Sound: punchy synth SFX + music (biggest missing piece of "juice").
2. Daily challenge (same seed for everyone) + Game Center leaderboards (free, gives a reason to return and share).
3. App Store page: final name, icon, 6 screenshots and a 15–30 s preview video cut from autoplay captures.
4. More weapons/evolutions (weapon + passive combos), 2–3 more enemy types, a second boss.
5. Monetisation that does not hurt retention: optional rewarded ads (revive / double crystals), later a one-time
   "remove ads / supporter" purchase.
6. Localisation (EN, TR, ES, PT-BR, DE, FR, JA, KO, ZH) for App Store search reach.
