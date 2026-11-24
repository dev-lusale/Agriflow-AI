# AgriFlow AI — Flutter Android app

Source: `mobile_app/`. A native Flutter app (not a web wrapper) for farmers, suppliers, distributors,
buyers, transporters, agricultural experts and administrators. It talks to the AgriFlow server through
the mobile API ([MOBILE_API.md](MOBILE_API.md)); Grok, database and e-mail credentials stay on the server.

| | |
|---|---|
| App name / package | AgriFlow AI · `zm.agriflow.ai` |
| Flutter / Dart | Flutter stable (3.50+), Dart 3.14 |
| Android | min API 24 (Android 7), target = Flutter default |
| Architecture | Feature folders (`lib/features/*`), Riverpod 3 state, GoRouter 18 navigation with auth guards, Dio client with single-flight token refresh, Flutter Secure Storage for tokens, Hive for offline cache and sync queue, SharedPreferences for settings |
| Design | Coral (#F26752) on warm off-white (#FAF6F4), black 1.6 px outlines, offset "sticker" shadows, Plus Jakarta Sans; "G + leaves" logo |

## Downloads

Every push builds the app on GitHub Actions and publishes the
**[`flutter-latest` release](https://github.com/dev-lusale/Agriflow-AI/releases/tag/flutter-latest)**:
debug APK (install directly), release APK and AAB (signed only when signing secrets exist — see
[ANDROID.md](ANDROID.md#release-signing-one-time-done-by-the-owner); otherwise named `-UNSIGNED`),
emulator screenshots on two screen sizes and the test logs.

## Build locally

```bash
cd mobile_app
flutter pub get
dart run flutter_launcher_icons && dart run flutter_native_splash:create
flutter analyze && flutter test
flutter build apk --debug            # build/app/outputs/flutter-apk/app-debug.apk
flutter build apk --release          # build/app/outputs/flutter-apk/app-release.apk
flutter build appbundle --release    # build/app/outputs/bundle/release/app-release.aab
```

Point a build at another server: `--dart-define=API_BASE_URL=https://your-deployment`.

## Optional services (the app works without them and says so honestly)

| Feature | What to provide | Where |
|---|---|---|
| Grok AI answers & photo checks | `XAI_API_KEY` | Vercel environment variables (server) |
| E-mailed verification & reset codes | `RESEND_API_KEY`, `EMAIL_FROM` | Vercel environment variables |
| Push notifications (FCM) | Firebase project: `FIREBASE_API_KEY`, `FIREBASE_APP_ID`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_PROJECT_ID` | `--dart-define` at build time (GitHub repository variables). The server stores device tokens (`POST /me/push-token`). |
| Google / Apple / Facebook sign-in | OAuth client IDs (`GOOGLE_OAUTH_CLIENT_ID`, `APPLE_OAUTH_CLIENT_ID`, `FACEBOOK_APP_ID`) and the provider console setup | Not implemented yet; buttons are shown and explain that they are not set up |
| Payments | A payment provider (e.g. mobile money aggregator) | Not implemented: orders are agreed and paid directly between buyer and seller, and the app says so |

## Offline behaviour

- Everything loaded once is kept on the phone (per account) and shown with an "Offline copy saved … —
  not live data" banner when there is no connection.
- Farm activities, tasks and task completions recorded offline are queued and synced automatically
  (Profile → Offline records shows the queue). Marketplace listings can be saved as drafts.
- AI chat, crop-health checks, orders and payments need a connection; the app explains this.

## Tests

`mobile_app/test/`: auth redirect rules, roles, validation (same rules as the server), API error
parsing, token refresh (single refresh for parallel 401s, network failure never signs out, rejected
refresh ends the session, login never refreshes), login and registration widgets on three screen sizes.
CI also installs the APK on two emulators (Pixel 6 / Android 14 and Nexus 4 / Android 11) and walks
through welcome, login (including a real wrong-password call to the live API), sign-up and an offline start.
