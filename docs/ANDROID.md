# AgriFlow AI — Android app

The Android app is a native shell built with [Capacitor 8](https://capacitorjs.com). It opens the live
AgriFlow platform (`https://agriflow-ai-wheat.vercel.app`), so accounts, data, security and Grok
all stay on the server. **No API keys or secrets are inside the APK.**

| | |
|---|---|
| App name | AgriFlow AI |
| Application ID | `zm.agriflow.ai` |
| Min / target Android | 7.0 (API 24) / Android 16 (API 36) |
| Permissions | Internet, network state, camera (crop photos), location ("Use my location" for fields). Camera and location are asked only when used. |
| Offline | Bundled offline screen (auto-retries) + the web app's own offline records and sync queue |

## Where to download the builds

Every push to `main` (and `feat/**` branches) builds the app on GitHub Actions and publishes to the
**[`android-latest` release](https://github.com/dev-lusale/Agriflow-AI/releases/tag/android-latest)**:

| File | Use |
|---|---|
| `AgriFlowAI-<version>-debug.apk` | Install directly on a phone for testing |
| `AgriFlowAI-<version>-release.apk` | Signed release APK (only when signing secrets are set, see below) |
| `AgriFlowAI-<version>-release.aab` | Signed bundle for Google Play (only when signing secrets are set) |
| `…-release-UNSIGNED.apk/.aab` | Built without signing secrets — cannot be installed or uploaded until signed |
| `SHA256SUMS.txt` | Checksums |
| `android-test-results.zip`, `*.png` | Emulator test log, logcat, permission list and screenshots |

Install the debug APK: copy it to the phone, open it, and allow "Install unknown apps" for your file
manager when Android asks.

## Emulator test (runs on every build)

`.github/scripts/android-smoke.sh` on an Android 14 (API 34) emulator checks: install; launch; app in
the foreground; no crash; the live site is on screen 30 s after launch; the hardware back button;
and an offline launch (no Wi-Fi, no mobile data) shows AgriFlow's offline mode instead of an error.

## Release signing (one-time, done by the owner)

Signing keys are never stored in the repository. Create one on your own computer (needs a JDK):

```bash
keytool -genkeypair -v -keystore agriflow-release.jks -alias agriflow \
  -keyalg RSA -keysize 4096 -validity 10000
base64 -w0 agriflow-release.jks > agriflow-release.jks.b64     # macOS: base64 -i agriflow-release.jks
```

Then in GitHub → the repository → **Settings → Secrets and variables → Actions → New repository secret**, add:

| Secret | Value |
|---|---|
| `AGRIFLOW_KEYSTORE_BASE64` | contents of `agriflow-release.jks.b64` |
| `AGRIFLOW_KEYSTORE_PASSWORD` | the keystore password you chose |
| `AGRIFLOW_KEY_ALIAS` | `agriflow` |
| `AGRIFLOW_KEY_PASSWORD` | the key password you chose |

The next build produces signed `…-release.apk` and `…-release.aab`. **Back up the `.jks` file and its
passwords somewhere safe** — Google Play requires the same key (or Play App Signing) for every update.

## Building locally

Requires Node 20+, JDK 21 and the Android SDK (Android Studio).

```bash
npm ci
npm run android:debug      # → android/app/build/outputs/apk/debug/app-debug.apk
npm run android:release    # → apk/release + bundle/release (signed if AGRIFLOW_KEYSTORE_* env vars are set)
npx cap open android       # open in Android Studio
```

To point a test build at another server: `AGRIFLOW_APP_URL=https://… npx cap sync android`.

## Updating icons and splash

Source images live in `mobile/assets/` (generated from the brand logo). Regenerate with:

```bash
npx capacitor-assets generate --android --assetPath mobile/assets
```
