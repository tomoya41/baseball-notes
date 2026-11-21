#!/usr/bin/env bash
set -euo pipefail
mkdir -p .data/android-emulator
: > .data/android-emulator/app-pids.txt
bounded_adb() {
  timeout --kill-after=2s 5s adb "$@"
}
emulator_connected() {
  [ "$(bounded_adb get-state 2>/dev/null)" = device ]
}
# A requested 16KB run must actually boot that kernel; the ordinary API number
# or a compatibility-mode launch is not evidence of its memory page size.
page_size="$(bounded_adb shell getconf PAGE_SIZE | tr -d '\r')"
case "$page_size" in 4096|16384) ;; *) echo 'Unknown emulator memory page size' >&2; exit 1 ;; esac
printf '%s\n' "$page_size" > .data/android-emulator/page-size.txt
expected_page_size="${EXPECTED_ANDROID_PAGE_SIZE:-}"
if [ -n "$expected_page_size" ]; then
  case "$expected_page_size" in 4096|16384) ;; *) echo 'Invalid expected page size' >&2; exit 1 ;; esac
  test "$page_size" = "$expected_page_size" || { echo 'Emulator page size does not match requested test environment' >&2; exit 1; }
fi
native_counter_session="$(cat /proc/sys/kernel/random/uuid)"
record_app_pid() {
  bounded_adb shell pidof com.tomoya41.baseballnotes | tr -d '\r' >> .data/android-emulator/app-pids.txt || true
}
diagnose_host() {
  {
    printf 'ADB state: '
    bounded_adb get-state || true
    bounded_adb devices -l || true
    printf '\nRunner memory:\n'
    grep -E '^(MemTotal|MemAvailable|SwapTotal|SwapFree):' /proc/meminfo
    printf '\nADB and emulator processes:\n'
    ps -eo pid,ppid,stat,rss,comm | awk 'NR==1 || $5 ~ /^(adb|emulator|qemu-system)/'
    if [ -r /sys/fs/cgroup/memory.events ]; then
      printf '\nCgroup memory events:\n'
      cat /sys/fs/cgroup/memory.events
    fi
    printf '\nKernel memory and emulator termination messages (when accessible):\n'
    timeout 5s dmesg --level=err,warn | grep -Ei 'out of memory|oom.kill|killed process|qemu|emulator' | tail -50
  } > .data/android-emulator/host-at-failure.txt 2>&1
}
diagnose_16kb_failure() {
  # Only the disposable test emulator is inspected. Keep bounded logs belonging
  # to observed target PIDs/the target package, including its native tombstone.
  record_app_pid
  bounded_adb shell dumpsys activity exit-info com.tomoya41.baseballnotes | head -c 32000 > .data/android-emulator/16kb-app-exit-info.txt
  # A low-memory kill can occur before the first live-PID poll. Recover only
  # PIDs from this package's bounded exit records so its crash lines aren't lost.
  awk '/timestamp=/ { for (i=1;i<=NF;i++) if ($i ~ /^pid=[0-9]+$/) { sub(/^pid=/,"",$i); print $i } }' \
    .data/android-emulator/16kb-app-exit-info.txt >> .data/android-emulator/app-pids.txt
  bounded_adb shell cat /proc/meminfo | grep -E '^(MemTotal|MemFree|MemAvailable|SwapTotal|SwapFree):' > .data/android-emulator/16kb-memory-at-failure.txt
  bounded_adb shell dumpsys activity activities | grep -E 'com\.tomoya41\.baseballnotes|topResumedActivity|mResumedActivity' | head -c 16000 > .data/android-emulator/16kb-resumed-state.txt
  bounded_adb shell dumpsys webviewupdate | grep -E 'Current WebView package|Preferred WebView package|Minimum targetSdkVersion|Multiprocess enabled' | head -c 4000 > .data/android-emulator/16kb-webview-provider.txt
  bounded_adb logcat -b main -d -v threadtime -t 500 -s System.out:I | grep 'BASEBALL_PERF native_counter' | head -c 16000 > .data/android-emulator/native-16kb-performance.txt
  bounded_adb logcat -b main -b system -b crash -d -v threadtime -t 1500 \
    'libc:V' 'DEBUG:V' 'AndroidRuntime:V' 'ActivityManager:V' 'ActivityTaskManager:V' 'chromium:V' 'WebViewLibraryLoader:V' '*:S' |
    awk 'FILENAME!="-" { for (i=1;i<=NF;i++) own[$i]=1; next }
      /Cmdline:|>>>/ { own_tombstone=index($0,"com.tomoya41.baseballnotes")>0 }
      $3 in own || index($0,"com.tomoya41.baseballnotes")>0 || (own_tombstone && / DEBUG /) { print }
      /Tombstone written to:/ { own_tombstone=0 }' .data/android-emulator/app-pids.txt - |
    head -c 128000 > .data/android-emulator/16kb-target-crash-diagnostics.txt
}
# A host-side ADB connection can disappear even while the runner stays alive.
# Save host evidence first. Guest-only diagnostics require a live transport.
set -E
trap 'failure_status=$?; trap - ERR; set +e; diagnose_host; if [ "$page_size" = 16384 ] && emulator_connected; then diagnose_16kb_failure; fi; exit "$failure_status"' ERR

run_instrumentation() {
  local target="$1" test_pid status=0
  shift
  adb shell am instrument -w "$@" \
    -e expected_page_size "$page_size" \
    com.tomoya41.baseballnotes.test/androidx.test.runner.AndroidJUnitRunner > "$target" &
  test_pid=$!
  while kill -0 "$test_pid" 2>/dev/null; do
    if ! emulator_connected; then
      kill -KILL "$test_pid" 2>/dev/null || true
      break
    fi
    record_app_pid
    sleep 1
  done
  wait "$test_pid" || status=$?
  cat "$target"
  if ! emulator_connected; then
    echo "ADB no longer reports a connected emulator; see host-at-failure.txt and $target" >&2
    return 1
  fi

  return "$status"
}
native_counter_check() {
  local phase="$1" session="$2" target="$3"
  run_instrumentation "$target" -e class jp.baseballdata.app.ReleaseQualityTest#nativeSharedCounterLoadsAndPersistsAtActualPageSize \
    -e native_counter_session "$session" -e native_counter_phase "$phase"
  grep -q 'OK (1 test)' "$target"
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
    record_app_pid
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
if [ "$page_size" = 16384 ]; then
  # Run the real JNI mmap/atomic/persistence check before any WebView/UI launch.
  # It isolates a native-library failure from a later cold-shell/WebView failure.
  adb shell cat /proc/meminfo | grep -E '^(MemTotal|MemFree|MemAvailable|SwapTotal|SwapFree):' > .data/android-emulator/16kb-memory-before-native.txt
  native_counter_check prepare "preflight-$native_counter_session" .data/android-emulator/native-16kb-prepare.txt
  adb shell am force-stop com.tomoya41.baseballnotes
  native_counter_check reopen "preflight-$native_counter_session" .data/android-emulator/native-16kb-reopen.txt
  adb shell am force-stop com.tomoya41.baseballnotes
  adb logcat -d -s System.out:I > .data/android-emulator/native-16kb-performance.txt
fi
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
run_instrumentation .data/android-emulator/instrumentation.txt -e native_counter_session "$native_counter_session"
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
native_counter_check reopen "$native_counter_session" .data/android-emulator/native-counter-restart.txt
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
