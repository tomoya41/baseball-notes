#!/usr/bin/env bash
set -euo pipefail

repo="$(pwd)"
scratch="$(mktemp -d)"
trap 'rm -rf -- "$scratch"' EXIT
mkdir -p "$scratch/bin"
cat > "$scratch/bin/adb" <<'ADB'
#!/usr/bin/env bash
set -euo pipefail
case "$*" in
  'get-state')
    if [ -f disconnected ]; then echo 'error: test transport disappeared' >&2; exit 1; fi
    echo device ;;
  'devices -l') echo 'List of devices attached' ;;
  'shell getconf PAGE_SIZE') echo 16384 ;;
  'shell pidof com.tomoya41.baseballnotes') echo 123 ;;
  'shell cat /proc/meminfo') echo 'MemAvailable: 1024 kB' ;;
  'shell dumpsys activity exit-info com.tomoya41.baseballnotes') echo 'timestamp=fixture pid=123' ;;
  'shell dumpsys activity activities'|'shell dumpsys webviewupdate'|logcat\ *) : ;;
  'shell am instrument -w '*)
    if [[ "$*" == *native_counter_phase* ]]; then echo 'OK (1 test)'; exit 0; fi
    echo 'partial instrumentation output'
    if [ "$QA_TRANSPORT_MODE" = disconnect ]; then
      touch disconnected
      exec sleep 30
    fi
    exit 23 ;;
  'shell cmd connectivity airplane-mode enable') touch offline ;;
  'shell cmd connectivity airplane-mode disable') rm -f -- offline ;;
  'shell dumpsys connectivity')
    if [ -f offline ]; then
      echo 'Active default network: none'
    else
      printf '%s\n' 'Active default network: 1' 'Current Networks:' \
        'NetworkAgentInfo{network{1} nc{[ Capabilities: INTERNET&VALIDATED&NOT_VPN ]}' \
        'Network Requests:'
    fi ;;
  'pull /sdcard/window.xml '*) echo 'オフライン' > "$3" ;;
  install\ *|shell\ svc\ *|shell\ wm\ *|shell\ am\ force-stop\ *|shell\ am\ start\ *|shell\ input\ *|shell\ rm\ *|shell\ uiautomator\ *|exec-out\ screencap\ *) : ;;
  *) printf 'Unexpected adb command: %s\n' "$*" >&2; exit 99 ;;
esac
ADB
chmod +x "$scratch/bin/adb"

for mode in disconnect test_failure; do
  mkdir -p "$scratch/$mode/scripts"
  cp "$repo/scripts/android-default-network-validated.awk" "$scratch/$mode/scripts/"
  (
    cd "$scratch/$mode"
    export PATH="$scratch/bin:$PATH" EXPECTED_ANDROID_PAGE_SIZE=16384 QA_TRANSPORT_MODE="$mode"
    status=0
    timeout 15s bash "$repo/scripts/android-emulator-smoke.sh" > run.log 2>&1 || status=$?
    grep -q 'partial instrumentation output' .data/android-emulator/instrumentation.txt
    test -s .data/android-emulator/host-at-failure.txt
    if [ "$mode" = disconnect ]; then
      test "$status" -eq 1
      grep -q 'ADB no longer reports a connected emulator' run.log
      grep -q 'test transport disappeared' .data/android-emulator/host-at-failure.txt
      test ! -e .data/android-emulator/16kb-app-exit-info.txt
    else
      test "$status" -eq 23
      grep -q 'timestamp=fixture pid=123' .data/android-emulator/16kb-app-exit-info.txt
    fi
  )
done
echo 'PASS emulator disconnect and connected instrumentation failure diagnostics'
