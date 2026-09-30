#!/usr/bin/env bash
set -euo pipefail
mkdir -p .data/android-emulator
adb install artifacts/apk/debug/app-debug.apk
adb install artifacts/apk/androidTest/debug/app-debug-androidTest.apk
adb shell wm size 360x800
adb shell wm density 160
# Fresh install has no data cache: the bundled shell still starts offline.
adb shell svc wifi disable
adb shell svc data disable
adb shell am start -W -n com.tomoya41.baseballnotes/jp.baseballdata.app.MainActivity > .data/android-emulator/cold-launch.txt
sleep 3
adb exec-out screencap -p > .data/android-emulator/offline-first-launch.png
adb shell svc wifi enable
adb shell svc data enable
adb shell input keyevent KEYCODE_HOME
adb shell am start -W -n com.tomoya41.baseballnotes/jp.baseballdata.app.MainActivity > .data/android-emulator/warm-launch.txt
adb shell am instrument -w com.tomoya41.baseballnotes.test/androidx.test.runner.AndroidJUnitRunner > .data/android-emulator/instrumentation.txt
cat .data/android-emulator/instrumentation.txt
adb logcat -d -s System.out:I > .data/android-emulator/performance.txt
adb logcat -d -s Capacitor:V Capacitor/Console:V > .data/android-emulator/bridge.txt
adb exec-out screencap -p > .data/android-emulator/instrumentation-screen.png
grep -q 'OK (' .data/android-emulator/instrumentation.txt
adb shell dumpsys meminfo com.tomoya41.baseballnotes > .data/android-emulator/memory.txt
adb shell svc wifi disable
adb shell svc data disable
adb shell am force-stop com.tomoya41.baseballnotes
adb shell am start -W -a android.intent.action.VIEW -d 'baseballnotes://MLB/players/mlb%3Aplayer%3Ae70b8d12-aa41-50c0-9c1b-d468d451355f' com.tomoya41.baseballnotes > .data/android-emulator/deep-link.txt
sleep 3
adb exec-out screencap -p > .data/android-emulator/offline-process-restart.png
adb shell svc wifi enable
adb shell svc data enable
sleep 2
adb shell run-as com.tomoya41.baseballnotes du -k . > .data/android-emulator/storage.txt
adb exec-out screencap -p > .data/android-emulator/android-360.png
adb shell cmd uimode night yes
sleep 2
adb exec-out screencap -p > .data/android-emulator/android-360-dark.png
adb shell cmd uimode night no
adb shell wm size 600x1000
sleep 2
adb exec-out screencap -p > .data/android-emulator/android-600.png
adb logcat -d -s AndroidRuntime:E > .data/android-emulator/crashes.txt
! grep -q 'FATAL EXCEPTION' .data/android-emulator/crashes.txt
