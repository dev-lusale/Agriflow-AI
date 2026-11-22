#!/usr/bin/env bash
# Emulator smoke test for the AgriFlow AI Flutter app. Usage: flutter-smoke.sh <label>
set -uo pipefail
LABEL="${1:-phone}"
OUT="flutter-results/$LABEL"
mkdir -p "$OUT"
APK=mobile_app/build/app/outputs/flutter-apk/app-debug.apk
PKG=zm.agriflow.ai
pass=0; fail=0
check() { if eval "$2"; then echo "PASS | [$LABEL] $1" | tee -a "$OUT/checks.txt"; pass=$((pass+1)); else echo "FAIL | [$LABEL] $1" | tee -a "$OUT/checks.txt"; fail=$((fail+1)); fi; }
shot() { adb exec-out screencap -p > "$OUT/$1.png"; }
dump() { adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1; adb pull /sdcard/ui.xml "$OUT/$1.xml" > /dev/null 2>&1; }
# Tap the centre of the first node whose text or content-desc contains $1
tap() {
  dump _tap
  local b
  b=$(python3 - "$OUT/_tap.xml" "$1" <<'PY'
import re, sys, xml.etree.ElementTree as ET
t = ET.parse(sys.argv[1]); want = sys.argv[2].lower()
for n in t.iter('node'):
    label = (n.get('text') or '') + ' ' + (n.get('content-desc') or '')
    if want in label.lower():
        x1, y1, x2, y2 = map(int, re.findall(r'\d+', n.get('bounds')))
        print((x1 + x2) // 2, (y1 + y2) // 2); break
PY
)
  [ -n "$b" ] && adb shell input tap $b && return 0
  return 1
}
has() { dump _has; grep -qi "$1" "$OUT/_has.xml"; }

adb wait-for-device
adb shell wm size > "$OUT/screen-size.txt"; adb shell wm density >> "$OUT/screen-size.txt"
adb logcat -c
check "APK installs" "adb install -r '$APK' > '$OUT/install.log' 2>&1"
adb shell am start -W -n "$PKG/.MainActivity" > "$OUT/launch.log" 2>&1
sleep 12; shot 01-welcome
check "App process running" "adb shell pidof $PKG > /dev/null"
check "Welcome screen shows 'Create an account' and 'Log in'" "has 'Create an account' && has 'Log in'"
check "Logo has an accessible label" "has 'AgriFlow AI logo'"

tap "Log in"; sleep 3; shot 02-login
check "Login screen: 'Welcome back!' heading" "has 'Welcome back'"
check "Login screen: email, password, forgot password, social buttons, sign-up link" "has 'Email address' && has 'Forgot Password' && has 'Log in with Google' && has 'Sign up'"

# Empty submit → validation messages, no crash
tap "Log In"; sleep 2; shot 03-login-validation
check "Empty login shows validation messages" "has 'Enter your email address'"

# Social button is honest about missing OAuth
tap "Log in with Google"; sleep 1; shot 04-social
check "Google button says it is not set up" "has 'not set up yet'"

# Real server call with a wrong password (no account is created or changed)
adb shell input keyevent KEYCODE_BACK; sleep 1
tap "Email address" || true
adb shell input tap 540 640 >/dev/null 2>&1 || true
dump _fields
python3 - "$OUT/_fields.xml" > "$OUT/_edit.txt" <<'PY'
import re, sys, xml.etree.ElementTree as ET
edits = [n for n in ET.parse(sys.argv[1]).iter('node') if n.get('class') == 'android.widget.EditText']
for n in edits[:2]:
    x1, y1, x2, y2 = map(int, re.findall(r'\d+', n.get('bounds')))
    print((x1 + x2) // 2, (y1 + y2) // 2)
PY
if [ "$(wc -l < "$OUT/_edit.txt")" -ge 2 ]; then
  adb shell input tap $(sed -n 1p "$OUT/_edit.txt"); adb shell input text "smoke.test.nobody@example.com"
  adb shell input tap $(sed -n 2p "$OUT/_edit.txt"); adb shell input text "WrongPass123"
  adb shell input keyevent KEYCODE_BACK
  tap "Log In"; sleep 10; shot 05-login-wrong-password
  check "Wrong password: live server answers 'Incorrect email or password'" "has 'Incorrect email or password'"
else
  echo "FAIL | [$LABEL] could not find the two text fields" | tee -a "$OUT/checks.txt"; fail=$((fail+1))
fi

# Registration screen renders with all fields
adb shell am force-stop $PKG; adb shell am start -W -n "$PKG/.MainActivity" > /dev/null 2>&1; sleep 8
tap "Create an account"; sleep 3; shot 06-register
check "Register screen: 'Create your account' with full name and phone" "has 'Create your account' && has 'Full name' && has 'Phone number'"
adb shell input swipe 500 1500 500 300 300; sleep 1; shot 07-register-scrolled
check "Register screen: province from the live API" "has 'Province'"
adb shell input swipe 500 1500 500 300 300; sleep 1; shot 08-register-roles
check "Register screen: account types incl. Expert and Distributor" "has 'Agricultural expert' && has 'Distributor'"

# Offline start: app must open (welcome) without crashing
adb shell am force-stop $PKG
adb shell svc wifi disable; adb shell svc data disable; sleep 2
adb shell am start -W -n "$PKG/.MainActivity" > /dev/null 2>&1; sleep 10; shot 09-offline
check "Offline launch: app stays open" "adb shell pidof $PKG > /dev/null"
adb shell svc wifi enable; adb shell svc data enable

adb logcat -d > "$OUT/logcat.txt"
check "No AgriFlow crash in logcat" "! grep -A3 'FATAL EXCEPTION' '$OUT/logcat.txt' | grep -q 'Process: $PKG'"
check "No Flutter framework errors" "! grep -q 'EXCEPTION CAUGHT BY' '$OUT/logcat.txt'"
adb shell dumpsys package $PKG | sed -n '/requested permissions:/,/install permissions:/p' > "$OUT/permissions.txt"
rm -f "$OUT"/_*.xml "$OUT"/_edit.txt
echo "passed=$pass failed=$fail" | tee "$OUT/totals.txt"
exit 0
