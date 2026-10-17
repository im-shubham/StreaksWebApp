# MOMENTUM

*Small actions. Big momentum.*

MOMENTUM (formerly STREAKS; internal ids such as the bundle `app.streaks.mobile`, the `streaks` slug/scheme and `streaks.db` are unchanged) is a native iOS and Android habit tracker built with **Expo SDK 57**, React Native 0.86 and Expo Router. The UI is implemented from the Google Stitch designs archived in [`design/stitch`](design/stitch/README.md).

## Run

```bash
npm install
cp .env.example .env.local   # optional: Firebase config, see docs/setup/firebase-console.md
npx expo start
```

- **iPhone:** App Store Expo Go only supports up to SDK 54, and this app is SDK 57. See **[docs/setup/run-on-iphone.md](docs/setup/run-on-iphone.md)** for the working options.
- **Android:** install Expo Go for SDK 57 from <https://expo.dev/go> and scan the QR code.
- Without Firebase config the app runs in guest mode with all data on the device.

## Checks

```bash
npm run typecheck
npm run lint
npm test                  # streak engine, repositories, sync engine (real SQLite)
npm run test:emulator     # Firebase Auth + Firestore + rules against the Emulator Suite
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
- [Firebase Console setup](docs/setup/firebase-console.md)
- [Google Sign-In setup](docs/setup/google-sign-in.md)
- [Run on iPhone](docs/setup/run-on-iphone.md)
- [Stitch archive & design discrepancies](design/stitch/README.md)

## Brand assets

The logo source is `assets/brand/source/momentum-logo.webp`. Icon, Android adaptive foreground, splash and in-app logo PNGs are generated from it with `python3 scripts/build-brand-assets.py` (needs Pillow). Icon and splash changes only show up in a new native build, not in Expo Go.
