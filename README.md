# STREAKS

A native iOS and Android habit tracker built with **Expo SDK 57**, React Native 0.86 and Expo Router. The UI is implemented from the Google Stitch designs archived in [`design/stitch`](design/stitch/README.md).

## Run

```bash
npm install
npx expo start            # press i / a, or scan with Expo Go
```

Stage 1 runs in **Expo Go**. Later stages (Firebase, purchases, widgets) need a development build: `npx expo run:ios|android` or `eas build --profile development`.

## Checks

```bash
npm run typecheck
npm run lint
npm test                  # streak engine unit tests
npx expo-doctor
```

## Layout

```
src/app/            Routes (Expo Router). Thin files that render feature screens.
src/features/       Screens and view models, grouped by feature.
src/components/     ui/ (design-system primitives), shell/, streaks/, habits/
src/theme/          Design tokens (generated from Stitch) and fonts.
src/domain/         Pure logic: dates, cadence, streak engine, plans, templates.
src/db/             SQLite migrations, repositories, live queries, sync outbox.
design/stitch/      Archived Stitch export: the UI source of truth.
docs/               Architecture (database, Firebase plan) and roadmap.
scripts/            Stitch export, token and icon generators.
```

## Docs

- [Roadmap](docs/roadmap.md)
- [Local database architecture](docs/architecture/database.md)
- [Firebase integration plan](docs/architecture/firebase-plan.md)
- [Stitch archive & design discrepancies](design/stitch/README.md)
