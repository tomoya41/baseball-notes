import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { androidPackageId, compareAndroidApks, verifyAndroidApk } from "./lib/android-apk-verification";

// Read-only inspection. No adb, install, data reset, key generation, signing, or network calls.
const allowed = new Set(["apk", "baseline", "sdk-build-tools", "java", "report"]), options = new Map<string, string>();
try {
  for (const argument of process.argv.slice(2)) {
    const match = /^--([^=]+)=(.+)$/.exec(argument);
    if (!match || !allowed.has(match[1]!) || options.has(match[1]!)) throw Error("invalid_arguments");
    options.set(match[1]!, match[2]!);
  }
  const apk = options.get("apk"), tools = options.get("sdk-build-tools");
  if (!apk || !tools) throw Error("apk_and_sdk_build_tools_required");
  const candidate = verifyAndroidApk(apk, tools, options.get("java") ?? "java");
  const baselinePath = options.get("baseline");
  const baseline = baselinePath ? verifyAndroidApk(baselinePath, tools, options.get("java") ?? "java") : null;
  const updateCompatibility = baseline ? compareAndroidApks(baseline, candidate) : null;
  const status = candidate.packageId !== androidPackageId || updateCompatibility?.status === "held" ? "held" : "verified_artifact";
  const report = { schemaVersion: 1, status, candidate, baseline, updateCompatibility,
    installedDeviceVerified: false, storeSubmissionReady: false,
    scope: "Official SDK cryptographic verification and local APK comparison only. Device/policy/Play signing and release gates remain separate." };
  const reportPath = options.get("report");
  if (reportPath) {
    const target = resolve(reportPath), privateRoot = resolve(".data") + sep;
    if (!target.startsWith(privateRoot) || !target.endsWith(".json") || target === resolve(apk) || (baselinePath && target === resolve(baselinePath)))
      throw Error("report_must_be_private_json_under_data");
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  }
  console.log(JSON.stringify(report));
  if (status === "held") process.exitCode = 2;
} catch (error) {
  const allowedErrors = /^(invalid_arguments|apk_and_sdk_build_tools_required|invalid_apk_metadata|invalid_apksigner_result|apk_size_outside_inspection_budget|apk_metadata_inspection_failed|apk_signature_verification_failed|apk_changed_during_inspection|report_must_be_private_json_under_data)$/;
  console.error(JSON.stringify({ status: "held", reason: error instanceof Error && allowedErrors.test(error.message) ? error.message : "inspection_unavailable", installedDeviceVerified: false, storeSubmissionReady: false }));
  process.exitCode = 2;
}
