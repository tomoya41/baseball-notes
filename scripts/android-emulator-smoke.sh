#!/usr/bin/env bash
set -euo pipefail
mkdir -p .data/android-emulator
: > .data/android-emulator/app-pids.txt
record_app_pid() {
  adb shell pidof com.tomoya41.baseballnotes | tr -d '\r' >> .data/android-emulator/app-pids.txt || true
}
wait_screen() {
  local expected="$1" target="$2"
  for attempt in $(seq 1 15); do
    adb shell rm -f /sdcard/window.xml
    if adb shell uiautomator dump /sdcard/window.xml >/dev/null &&
       adb pull /sdcard/window.xml "$target" >/dev/null &&
       grep -q "$expected" "$target"; then return 0; fi
    sleep 2
  done
  echo "Expected screen not visible: $expected" >&2
  adb exec-out screencap -p > .data/android-emulator/screen-timeout.png
  adb logcat -d -s AndroidRuntime:E Capacitor:V Capacitor/Console:V > .data/android-emulator/screen-timeout.txt
  return 1
}
adb install artifacts/apk/debug/app-debug.apk
adb install artifacts/apk/androidTest/debug/app-debug-androidTest.apk
adb shell wm size 360x800
adb shell wm density 160
# Fresh install has no data cache: the bundled shell still starts offline.
adb shell svc wifi disable
adb shell svc data disable
adb shell am start -W -n com.tomoya41.baseballnotes/jp.baseballdata.app.MainActivity > .data/android-emulator/cold-launch.txt
record_app_pid
wait_screen 'オフライン' .data/android-emulator/offline-first-launch.xml
adb exec-out screencap -p > .data/android-emulator/offline-first-launch.png
adb shell svc wifi enable
adb shell svc data enable
adb shell input keyevent KEYCODE_HOME
adb shell am start -W -n com.tomoya41.baseballnotes/jp.baseballdata.app.MainActivity > .data/android-emulator/warm-launch.txt
record_app_pid
# Instrumentation can restart the target process. Keep every observed app PID
# so the crash check also covers a process which exited before the final read.
adb shell am instrument -w com.tomoya41.baseballnotes.test/androidx.test.runner.AndroidJUnitRunner > .data/android-emulator/instrumentation.txt &
instrumentation_pid=$!
while kill -0 "$instrumentation_pid" 2>/dev/null; do record_app_pid; sleep 1; done
wait "$instrumentation_pid"
cat .data/android-emulator/instrumentation.txt
adb logcat -d -s System.out:I > .data/android-emulator/performance.txt
adb logcat -d -s Capacitor:V Capacitor/Console:V > .data/android-emulator/bridge.txt
adb exec-out screencap -p > .data/android-emulator/instrumentation-screen.png
grep -q 'OK (' .data/android-emulator/instrumentation.txt
adb pull /sdcard/Android/data/com.tomoya41.baseballnotes/files/ui-redesign .data/android-emulator/ui-redesign
adb shell svc wifi disable
adb shell svc data disable
adb shell am force-stop com.tomoya41.baseballnotes
adb shell am start -W -a android.intent.action.VIEW -d 'baseballnotes://MLB/players/mlb%3Aplayer%3Ae70b8d12-aa41-50c0-9c1b-d468d451355f' com.tomoya41.baseballnotes > .data/android-emulator/deep-link.txt
record_app_pid
wait_screen '大谷翔平' .data/android-emulator/offline-process-restart.xml
grep -q '保存済みデータ' .data/android-emulator/offline-process-restart.xml
adb exec-out screencap -p > .data/android-emulator/offline-process-restart.png
adb shell dumpsys meminfo com.tomoya41.baseballnotes > .data/android-emulator/memory.txt
adb shell svc wifi enable
adb shell svc data enable
wait_screen '大谷翔平' .data/android-emulator/online-restored.xml
adb shell run-as com.tomoya41.baseballnotes du -k . > .data/android-emulator/storage.txt
adb exec-out screencap -p > .data/android-emulator/android-360.png
adb shell cmd uimode night yes
sleep 2
adb exec-out screencap -p > .data/android-emulator/android-360-dark.png
adb shell cmd uimode night no
adb shell wm size 600x1000
sleep 2
adb exec-out screencap -p > .data/android-emulator/android-600.png
adb logcat -d -v threadtime -s AndroidRuntime:E > .data/android-emulator/crashes.txt
adb logcat -d -s Capacitor:V Capacitor/Console:V > .data/android-emulator/bridge.txt
# Preserve all runtime diagnostics, but fail only on an app-process crash.
# UIAutomator and other emulator utilities have their own AndroidRuntime PID.
test -s .data/android-emulator/app-pids.txt
if awk 'NR==FNR { for (i=1;i<=NF;i++) app[$i]=1; next } $3 in app && /FATAL EXCEPTION/ { found=1 } END { exit !found }' \
  .data/android-emulator/app-pids.txt .data/android-emulator/crashes.txt; then
  echo "Application process crashed; see crashes.txt and app-pids.txt" >&2
  exit 1
fi
