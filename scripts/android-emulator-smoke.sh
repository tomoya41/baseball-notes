#!/usr/bin/env bash
set -euo pipefail
mkdir -p .data/android-emulator
: > .data/android-emulator/app-pids.txt
# A requested 16KB run must actually boot that kernel; the ordinary API number
# or a compatibility-mode launch is not evidence of its memory page size.
page_size="$(adb shell getconf PAGE_SIZE | tr -d '\r')"
case "$page_size" in 4096|16384) ;; *) echo 'Unknown emulator memory page size' >&2; exit 1 ;; esac
printf '%s\n' "$page_size" > .data/android-emulator/page-size.txt
expected_page_size="${EXPECTED_ANDROID_PAGE_SIZE:-}"
if [ -n "$expected_page_size" ]; then
  case "$expected_page_size" in 4096|16384) ;; *) echo 'Invalid expected page size' >&2; exit 1 ;; esac
  test "$page_size" = "$expected_page_size" || { echo 'Emulator page size does not match requested test environment' >&2; exit 1; }
fi
native_counter_session="$(cat /proc/sys/kernel/random/uuid)"
record_app_pid() {
  adb shell pidof com.tomoya41.baseballnotes | tr -d '\r' >> .data/android-emulator/app-pids.txt || true
}
network_offline() {
  # svc toggles alone can race the freshly booted emulator's cellular setup.
  # Establish and record a real disconnected transport before asserting UI.
  adb shell cmd connectivity airplane-mode enable
  adb shell svc wifi disable
  adb shell svc data disable
  for attempt in $(seq 1 15); do
    adb shell dumpsys connectivity > .data/android-emulator/offline-connectivity.txt
    if grep -q 'Active default network: none' .data/android-emulator/offline-connectivity.txt; then return 0; fi
    sleep 2
  done
  echo 'Emulator still has a default network; offline QA not established' >&2
  return 1
}
network_online() {
  adb shell cmd connectivity airplane-mode disable
  adb shell svc wifi enable
  adb shell svc data enable
  for attempt in $(seq 1 15); do
    adb shell dumpsys connectivity > .data/android-emulator/online-connectivity.txt
    # Read the entire dump: grep -q could SIGPIPE awk under pipefail on long
    # two-transport dumps. Verify the active default agent, not a secondary
    # validated network or a listener merely requesting VALIDATED.
    if awk -f scripts/android-default-network-validated.awk .data/android-emulator/online-connectivity.txt; then return 0; fi
    sleep 2
  done
  echo 'Emulator network is not validated; online QA not established' >&2
  return 1
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
network_offline
adb shell am start -W -n com.tomoya41.baseballnotes/jp.baseballdata.app.MainActivity > .data/android-emulator/cold-launch.txt
record_app_pid
wait_screen 'オフライン' .data/android-emulator/offline-first-launch.xml
adb exec-out screencap -p > .data/android-emulator/offline-first-launch.png
network_online
adb shell input keyevent KEYCODE_HOME
adb shell am start -W -n com.tomoya41.baseballnotes/jp.baseballdata.app.MainActivity > .data/android-emulator/warm-launch.txt
record_app_pid
# Instrumentation can restart the target process. Keep every observed app PID
# so the crash check also covers a process which exited before the final read.
adb shell am instrument -w -e expected_page_size "$page_size" -e native_counter_session "$native_counter_session" com.tomoya41.baseballnotes.test/androidx.test.runner.AndroidJUnitRunner > .data/android-emulator/instrumentation.txt &
instrumentation_pid=$!
while kill -0 "$instrumentation_pid" 2>/dev/null; do record_app_pid; sleep 1; done
wait "$instrumentation_pid"
cat .data/android-emulator/instrumentation.txt
adb logcat -d -s System.out:I > .data/android-emulator/performance.txt
adb logcat -d -s Capacitor:V Capacitor/Console:V > .data/android-emulator/bridge.txt
adb exec-out screencap -p > .data/android-emulator/instrumentation-screen.png
# Preserve per-screen diagnostics even when instrumentation fails. A successful
# QA run must still include its expected screenshots, not silently skip a pull.
screenshot_pull_status=0
adb pull /sdcard/Android/data/com.tomoya41.baseballnotes/files/ui-redesign .data/android-emulator/ui-redesign || screenshot_pull_status=$?
grep -q 'OK (' .data/android-emulator/instrumentation.txt
test "$screenshot_pull_status" -eq 0
# Kill the actual target process before checking the native mmap-backed value.
# The second invocation runs this one test only and cannot recreate a missing
# session file or synthesize its expected value in Java.
adb shell am force-stop com.tomoya41.baseballnotes
adb shell am instrument -w -e class jp.baseballdata.app.ReleaseQualityTest#nativeSharedCounterLoadsAndPersistsAtActualPageSize \
  -e expected_page_size "$page_size" -e native_counter_session "$native_counter_session" -e native_counter_phase reopen \
  com.tomoya41.baseballnotes.test/androidx.test.runner.AndroidJUnitRunner > .data/android-emulator/native-counter-restart.txt &
instrumentation_pid=$!
while kill -0 "$instrumentation_pid" 2>/dev/null; do record_app_pid; sleep 1; done
wait "$instrumentation_pid"
cat .data/android-emulator/native-counter-restart.txt
grep -q 'OK (1 test)' .data/android-emulator/native-counter-restart.txt
adb logcat -d -s System.out:I > .data/android-emulator/performance.txt
network_offline
adb shell am force-stop com.tomoya41.baseballnotes
adb shell am start -W -a android.intent.action.VIEW -d 'baseballnotes://MLB/players/mlb%3Aplayer%3Ae70b8d12-aa41-50c0-9c1b-d468d451355f' com.tomoya41.baseballnotes > .data/android-emulator/deep-link.txt
record_app_pid
wait_screen '大谷翔平' .data/android-emulator/offline-process-restart.xml
grep -q '保存済みデータ' .data/android-emulator/offline-process-restart.xml
adb exec-out screencap -p > .data/android-emulator/offline-process-restart.png
adb shell dumpsys meminfo com.tomoya41.baseballnotes > .data/android-emulator/memory.txt
network_online
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
