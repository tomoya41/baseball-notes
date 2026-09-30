#!/usr/bin/env bash
set -euo pipefail
mkdir -p .data/android-emulator
adb install artifacts/apk/debug/app-debug.apk
adb install artifacts/apk/androidTest/debug/app-debug-androidTest.apk
adb shell wm size 360x800
adb shell wm density 160
adb shell am start -W -n com.tomoya41.baseballnotes/jp.baseballdata.app.MainActivity > .data/android-emulator/cold-launch.txt
adb shell input keyevent KEYCODE_HOME
adb shell am start -W -n com.tomoya41.baseballnotes/jp.baseballdata.app.MainActivity > .data/android-emulator/warm-launch.txt
adb shell am instrument -w com.tomoya41.baseballnotes.test/androidx.test.runner.AndroidJUnitRunner > .data/android-emulator/instrumentation.txt
cat .data/android-emulator/instrumentation.txt
grep -q 'OK (' .data/android-emulator/instrumentation.txt
adb shell dumpsys meminfo com.tomoya41.baseballnotes > .data/android-emulator/memory.txt
adb shell am start -W -a android.intent.action.VIEW -d 'baseballnotes://MLB/players/mlb%3Aplayer%3Ae70b8d12-aa41-50c0-9c1b-d468d451355f' com.tomoya41.baseballnotes > .data/android-emulator/deep-link.txt
adb shell run-as com.tomoya41.baseballnotes du -k . > .data/android-emulator/storage.txt
adb exec-out screencap -p > .data/android-emulator/android-360.png
adb logcat -d -s AndroidRuntime:E > .data/android-emulator/crashes.txt
! grep -q 'FATAL EXCEPTION' .data/android-emulator/crashes.txt
