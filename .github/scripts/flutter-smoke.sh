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
# Tap the centre of a node labelled exactly $1 (case-sensitive); else the first label containing it.
tap() {
  dump _tap
  local b
  b=$(python3 - "$OUT/_tap.xml" "$1" <<'PY'
import re, sys, xml.etree.ElementTree as ET
want = sys.argv[2]
nodes = []
for n in ET.parse(sys.argv[1]).iter('node'):
    labels = [(n.get('text') or '').strip(), (n.get('content-desc') or '').strip()]
    nodes.append((n, labels))
pick = next((n for n, ls in nodes if want in ls), None)
if pick is None:  # (an Element with no children is falsy, so never use `or` here)
    pick = next((n for n, ls in nodes if any(want.lower() in l.lower() for l in ls)), None)
if pick is not None:
    x1, y1, x2, y2 = map(int, re.findall(r'\d+', pick.get('bounds')))
    print((x1 + x2) // 2, (y1 + y2) // 2)
    print('#', pick.get('class'), repr(pick.get('content-desc')), pick.get('bounds'), file=sys.stderr)
PY
)
  TAPN=$((${TAPN:-0}+1)); cp "$OUT/_tap.xml" "$OUT/tap-$TAPN.xml" 2>/dev/null
  echo "tap $TAPN '$1' -> ${b:-NOT FOUND}" >> "$OUT/taps.log"
  [ -n "$b" ] && adb shell input tap $b && return 0
  return 1
}
# Screen size, for swipes that work on every phone
read -r SW SH < <(adb shell wm size | grep -o '[0-9]*x[0-9]*' | tail -1 | tr x ' ')
swipe_up() { adb shell input swipe $((SW/2)) $((SH*3/4)) $((SW/2)) $((SH/4)) 300; sleep 1; }
# Scroll down until $1 is on screen (max 6 swipes)
scroll_to() { local i; for i in 1 2 3 4 5 6; do has "$1" && return 0; swipe_up; done; has "$1"; }
# Dismiss "X isn't responding" system dialogs from a slow emulator (choose "Wait")
# The emulator's own launcher sometimes hangs; closing it does not touch AgriFlow.
calm() { local i; for i in 1 2 3; do dump _anr; grep -q "isn't responding" "$OUT/_anr.xml" 2>/dev/null || return 0; tap "Close app" >/dev/null 2>&1 || adb shell input keyevent KEYCODE_BACK; sleep 2; done; }
# has_now: read the screen immediately (for short-lived messages); has: dismiss system dialogs first
has_now() { dump _has; grep -qi "$1" "$OUT/_has.xml"; }
has() { calm; dump _has; grep -qi "$1" "$OUT/_has.xml"; }

adb wait-for-device
adb shell wm size > "$OUT/screen-size.txt"; adb shell wm density >> "$OUT/screen-size.txt"
adb logcat -c
check "APK installs" "adb install -r '$APK' > '$OUT/install.log' 2>&1"
adb shell am start -W -n "$PKG/.MainActivity" > "$OUT/launch.log" 2>&1
sleep 12; calm; shot 01-welcome
check "App process running" "adb shell pidof $PKG > /dev/null"
check "Welcome screen shows 'Create an account' and 'Log in'" "has 'Create an account' && has 'Log in'"
check "Logo has an accessible label" "has 'AgriFlow AI logo'"

tap "Log in"; sleep 3; shot 02-login
check "Login screen: 'Welcome back!' heading" "has 'Welcome back'"
check "Login screen: email, password and forgot password" "has 'Email address' && has 'Forgot Password'"
check "Login screen: social buttons and sign-up link" "scroll_to 'Sign up' && has 'Log in with Google'"

# Empty submit → validation messages, no crash
adb shell input swipe $((SW/2)) $((SH/4)) $((SW/2)) $((SH*3/4)) 300; sleep 1
tap "Log In"; sleep 2; shot 03-login-validation
check "Empty login shows validation messages" "has 'Enter your email address'"

# Social button is honest about missing OAuth
scroll_to "Sign up" >/dev/null; tap "Log in with Google"; sleep 1
check "Google button says it is not set up" "has_now 'not set up yet'"; shot 04-social

# Real server call with a wrong password (no account is created or changed)
sleep 4  # let the snackbar go
adb shell input swipe $((SW/2)) $((SH/4)) $((SW/2)) $((SH*3/4)) 300; sleep 1  # back to the top
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
  # typing clears the email error and moves the password field, so find it again
  adb shell input keyevent KEYCODE_BACK; sleep 1; dump _fields
  python3 - "$OUT/_fields.xml" > "$OUT/_edit.txt" <<'PY'
import re, sys, xml.etree.ElementTree as ET
edits = [n for n in ET.parse(sys.argv[1]).iter('node') if n.get('class') == 'android.widget.EditText']
for n in edits[:2]:
    x1, y1, x2, y2 = map(int, re.findall(r'\d+', n.get('bounds')))
    print((x1 + x2) // 2, (y1 + y2) // 2)
PY
  adb shell input tap $(sed -n 2p "$OUT/_edit.txt"); adb shell input text "WrongPass123"
  adb shell input keyevent KEYCODE_BACK
  scroll_to 'Log In' >/dev/null; tap "Log In"; sleep 10; shot 05-login-wrong-password
  check "Wrong password: live server answers 'Incorrect email or password'" "has 'Incorrect email or password'"
else
  echo "FAIL | [$LABEL] could not find the two text fields" | tee -a "$OUT/checks.txt"; fail=$((fail+1))
fi

# Registration screen renders with all fields
adb shell am force-stop $PKG; adb shell am start -W -n "$PKG/.MainActivity" > /dev/null 2>&1; sleep 8
tap "Create an account"; sleep 3; shot 06-register
check "Register screen: 'Create your account' with full name and phone" "has 'Create your account' && has 'Full name' && has 'Phone number'"
check "Register screen: province from the live API" "scroll_to 'Province'"; shot 07-register-scrolled
check "Register screen: account types incl. Expert and Distributor" "scroll_to 'Distributor' && has 'Agricultural expert'"; shot 08-register-roles

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
