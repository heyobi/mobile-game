# Agent notes

Shard Delve: Expo SDK 57 / React Native turn-based roguelike, rendered with `@shopify/react-native-skia`.
Design: `docs/GAME_DESIGN.md`. Release pipeline: `README.md` (every push to `main` → TestFlight).

## Layout

- `src/game/` — pure game logic (no React imports). Deterministic from the seed; keep it that way.
- `src/ui/` — screens, Skia renderer (`DungeonView.tsx`), input/effects (`GameScreen.tsx`).
- `src/storage.ts` — versioned AsyncStorage persistence for meta progress and the in-progress run.
- `scripts/` — CI helpers (App Store Connect API, Xcode signing). `.github/workflows/ios-testflight.yml` — CI.

## Rules

- Use `npx expo install <pkg>` for anything native so versions match the SDK.
- Before pushing: `npm run check` (lint + typecheck + tests). CI runs the same gate before building.
- No Expo Router: the app has a small screen state machine in `App.tsx`.
- Changing `RunState` or `MetaState` shape: bump `version` and handle old data in `restoreRun` / `normalizeMeta`.
- Never commit signing material (`*.p12`, `*.p8`, `*.mobileprovision` are git-ignored).
