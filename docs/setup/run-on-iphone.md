# Run STREAKS on your iPhone

## Two blockers, both verified

1. **App Store Expo Go can't open this project.** Expo's docs say the public App Store build of Expo Go stops at **SDK 54**. STREAKS is on **SDK 57** (the required baseline), so scanning a QR code with App Store Expo Go shows *"Project is incompatible with this version of Expo Go"*. For SDK 55+ on a physical iPhone, Expo's supported options are a custom Expo Go built with `eas go` and installed through TestFlight, or a development build. Both need an **Apple Developer Program** membership, or a Mac with Xcode for a free-account build.
2. **A cloud session can't host the dev server for your phone.** In the Claude Code cloud container, `npx expo start --tunnel` fails. ngrok's tunnel protocol is cut off by the sandbox's TLS-intercepting egress proxy (`session closed`), and a Cloudflare quick tunnel can't reach Cloudflare's edge (`530`). Run the dev server on **your own computer** instead.

On a physical iPhone, Expo Go only opens a dev-server project when **the Expo CLI and the Expo Go app are signed in to the same Expo account.**

## Option A: you have an Apple Developer account ($99/yr) — closest to "scan a QR code"

On your Mac or PC (Node 20+):

```bash
git clone https://github.com/im-shubham/StreaksWebApp.git
cd StreaksWebApp
git checkout feat/expo-foundation
npm install
npx expo login                         # free Expo account
npx eas-cli@latest go --sdk-version 57 # builds Expo Go for SDK 57 and submits it to TestFlight
```

`eas go` asks for your Apple ID and sets up the signing credentials. The build and TestFlight processing take roughly 15–30 minutes. Then:

1. App Store Connect → your new "Expo Go" app → **TestFlight** → add your Apple ID as an **internal tester**.
2. On the iPhone, install **TestFlight** from the App Store, accept the invite, and install Expo Go.
3. Open that Expo Go and sign in with the **same Expo account** as `npx expo login`.
4. On your computer, run `npx expo start`. Scan the QR code with the iPhone **Camera** app.
   - Phone and computer on the same Wi-Fi: it connects over LAN.
   - Different networks, or the QR code times out: `npx expo start --tunnel` (this works from a normal computer).

## Option B: you have a Mac, no paid account

```bash
npm install
npx expo run:ios --device     # needs Xcode; sign with your free Apple ID ("Personal Team")
```

Plug in the iPhone, trust the computer, and turn on **Settings → Privacy & Security → Developer Mode**. This installs a development build, so no Expo Go is needed. Free-account signing expires after 7 days, so re-run the command to refresh it.

## Option C: an Android phone, for a look today

Install Expo Go for **SDK 57** from <https://expo.dev/go>, run `npx expo start` on your computer, and scan the QR code from Expo Go.

## Option D: downgrade to SDK 54 (needs your approval)

App Store Expo Go would work right away, but this goes against the SDK 57 baseline you set, so it hasn't been done.

## Google Sign-In

Google Sign-In works only in Option B or another development build; Expo Go (Option A) can't load it. See [google-sign-in.md](google-sign-in.md).

## Firebase

Without `.env.local` the app runs in guest mode, fully on-device. To turn on accounts and sync, follow [firebase-console.md](firebase-console.md) and restart `npx expo start`.
