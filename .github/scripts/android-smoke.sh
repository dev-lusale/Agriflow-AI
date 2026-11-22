#!/usr/bin/env bash
# Emulator smoke test for the AgriFlow AI Android app.
# Installs the debug APK, launches it online and offline, and records screenshots + logs.
set -uo pipefail
OUT=android-results
mkdir -p "$OUT"
APK=android/app/build/outputs/apk/debug/app-debug.apk
PKG=zm.agriflow.ai
pass=0; fail=0
check() { if eval "$2"; then echo "PASS | $1" | tee -a "$OUT/emulator-checks.txt"; pass=$((pass+1)); else echo "FAIL | $1" | tee -a "$OUT/emulator-checks.txt"; fail=$((fail+1)); fi; }

adb wait-for-device
adb shell getprop ro.build.version.release > "$OUT/device-android-version.txt"
adb shell dumpsys package com.google.android.webview | grep -m1 versionName > "$OUT/device-webview-version.txt" || true
# Wait until the emulator can actually reach the internet (fresh emulators take a while)
net=no
for i in $(seq 1 40); do
  if adb shell "dumpsys connectivity | grep -q 'VALIDATED'" ; then net=yes; break; fi
  sleep 3
done
echo "emulator network ready: $net" | tee "$OUT/network.txt"
adb logcat -c

check "APK installs" "adb install -r -g '$APK' > '$OUT/install.log' 2>&1"
check "Package is registered" "adb shell pm list packages | grep -q '$PKG'"

# 1) Online launch
adb shell am start -W -n "$PKG/.MainActivity" > "$OUT/launch.log" 2>&1
sleep 4;  adb exec-out screencap -p > "$OUT/01-splash-or-start.png"
sleep 30; adb exec-out screencap -p > "$OUT/02-online-home.png"
check "App process is running" "adb shell pidof '$PKG' > /dev/null"
check "MainActivity is in the foreground" "adb shell dumpsys activity activities | grep -E 'mResumedActivity|topResumedActivity' | grep -q '$PKG'"
adb logcat -d > "$OUT/logcat-online.txt"
check "No AgriFlow crash (online)" "! grep -A2 'FATAL EXCEPTION' '$OUT/logcat-online.txt' | grep -q 'Process: $PKG'"
check "WebView requested the AgriFlow server" "grep -qi 'Loading app at https://agriflow-ai-wheat.vercel.app' '$OUT/logcat-online.txt'"
check "Online: live site shown, offline screen NOT used" "! grep -q 'localhost/offline.html' '$OUT/logcat-online.txt'"

# 2) Hardware back button: should not crash the app
adb shell input keyevent KEYCODE_BACK; sleep 3
adb exec-out screencap -p > "$OUT/03-after-back.png"
adb logcat -d > "$OUT/logcat-after-back.txt"
check "Back button handled without crash" "! grep -A2 'FATAL EXCEPTION' '$OUT/logcat-after-back.txt' | grep -q 'Process: $PKG'"

# 3) Offline launch: bundled offline screen instead of a browser error
adb shell am force-stop "$PKG"
adb shell svc wifi disable; adb shell svc data disable; sleep 3
adb logcat -c
adb shell am start -W -n "$PKG/.MainActivity" > "$OUT/launch-offline.log" 2>&1
sleep 15
# Emulators under memory pressure sometimes kill Google Play services and every app using its
# font provider. If the system killed us (not a crash), relaunch once and note it.
if ! adb shell pidof "$PKG" > /dev/null && grep -q "depends on provider.*in dying proc" <(adb logcat -d); then
  echo "INFO | offline: system killed the app with Play services (emulator memory); relaunched once" | tee -a "$OUT/emulator-checks.txt"
  adb shell am start -W -n "$PKG/.MainActivity" >> "$OUT/launch-offline.log" 2>&1; sleep 15
fi
adb exec-out screencap -p > "$OUT/04-offline.png"
adb logcat -d > "$OUT/logcat-offline.txt"
check "Offline: app opens and stays in the foreground" "adb shell dumpsys activity activities | grep -E 'mResumedActivity|topResumedActivity' | grep -q '$PKG'"
check "Offline: no AgriFlow crash" "! grep -A2 'FATAL EXCEPTION' '$OUT/logcat-offline.txt' | grep -q 'Process: $PKG'"
check "Offline: no raw WebView error (cached offline mode or bundled offline screen)" "! grep -q 'net::ERR_INTERNET_DISCONNECTED.*agriflow' '$OUT/logcat-offline.txt'"
if grep -q 'localhost/offline.html' "$OUT/logcat-offline.txt"; then echo "INFO | offline: bundled offline screen used" | tee -a "$OUT/emulator-checks.txt"; else echo "INFO | offline: web app's cached offline mode used" | tee -a "$OUT/emulator-checks.txt"; fi
adb shell svc wifi enable; adb shell svc data enable

# Permissions actually requested by the installed app
adb shell dumpsys package "$PKG" | sed -n '/requested permissions:/,/install permissions:/p' > "$OUT/permissions.txt"

echo "passed=$pass failed=$fail" | tee "$OUT/emulator-totals.txt"
exit 0
