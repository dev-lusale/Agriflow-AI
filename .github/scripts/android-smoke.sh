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
check "No fatal crash in logcat" "! grep -q 'FATAL EXCEPTION' '$OUT/logcat-online.txt'"
check "WebView loaded the AgriFlow server" "grep -qi 'agriflow-ai-wheat.vercel.app' '$OUT/logcat-online.txt'"

# 2) Hardware back button: should not crash the app
adb shell input keyevent KEYCODE_BACK; sleep 3
adb exec-out screencap -p > "$OUT/03-after-back.png"
adb logcat -d > "$OUT/logcat-after-back.txt"
check "Back button handled without crash" "! grep -q 'FATAL EXCEPTION' '$OUT/logcat-after-back.txt'"

# 3) Offline launch: bundled offline screen instead of a browser error
adb shell am force-stop "$PKG"
adb shell svc wifi disable; adb shell svc data disable; sleep 3
adb logcat -c
adb shell am start -W -n "$PKG/.MainActivity" > "$OUT/launch-offline.log" 2>&1
sleep 15; adb exec-out screencap -p > "$OUT/04-offline.png"
adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1 && adb pull /sdcard/ui.xml "$OUT/ui-offline.xml" > /dev/null 2>&1
adb logcat -d > "$OUT/logcat-offline.txt"
check "Offline screen shown when there is no connection" "grep -qi \"offline\" '$OUT/ui-offline.xml'"
check "No fatal crash offline" "! grep -q 'FATAL EXCEPTION' '$OUT/logcat-offline.txt'"
adb shell svc wifi enable; adb shell svc data enable

# Permissions actually requested by the installed app
adb shell dumpsys package "$PKG" | sed -n '/requested permissions:/,/install permissions:/p' > "$OUT/permissions.txt"

echo "passed=$pass failed=$fail" | tee "$OUT/emulator-totals.txt"
exit 0
