import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { unzipSync } from "fflate";

export const androidPackageId = "com.tomoya41.baseballnotes";
export interface VerifiedAndroidApk {
  sha256: string;
  bytes: number;
  packageId: string;
  versionCode: number;
  versionName: string;
  minSdk: number;
  targetSdk: number;
  debuggable: boolean;
  permissions: string[];
  signerCertificateSha256: string[];
  signatureSchemes: string[];
  nativeLibraryCount: number;
}
export type UpdateCompatibility = {
  status: "same_signer_and_non_decreasing_version" | "held";
  reasons: ("package_mismatch" | "signer_mismatch_or_unverified_rotation" | "version_downgrade")[];
  // Local APK comparison never proves which binary/certificate is installed on a handset.
  installedDeviceVerified: false;
};

export function parseApkBadging(output: string) {
  const packages = [...output.matchAll(/^package: name='([^']+)' versionCode='(\d+)' versionName='([^']*)'/gm)];
  // SDK 36 aapt2 emits minSdkVersion; older aapt uses sdkVersion.
  // Both denote the same field. Reject duplicates, including mixed aliases.
  const minSdk = [...output.matchAll(/^(?:minSdkVersion|sdkVersion):'(\d+)'\r?$/gm)];
  const targetSdk = [...output.matchAll(/^targetSdkVersion:'(\d+)'\r?$/gm)];
  if (packages.length !== 1 || minSdk.length !== 1 || targetSdk.length !== 1) throw Error("invalid_apk_metadata");
  const pkg = packages[0]!, versionCode = Number(pkg[2]);
  if (!Number.isSafeInteger(versionCode) || versionCode < 1 || Number(minSdk[0]![1]) < 1 || Number(targetSdk[0]![1]) < Number(minSdk[0]![1]))
    throw Error("invalid_apk_metadata");
  return { packageId: pkg[1]!, versionCode, versionName: pkg[3]!, minSdk: Number(minSdk[0]![1]), targetSdk: Number(targetSdk[0]![1]),
    debuggable: /^application-debuggable\r?$/m.test(output),
    permissions: [...new Set([...output.matchAll(/^uses-permission(?:-sdk-\d+)?: name='([^']+)'/gm)].map(row => row[1]!))].sort() };
}

/** Call only after the official apksigner process exited successfully. No DN/key material is retained. */
export function parseVerifiedApkSigners(output: string) {
  if (!/^Verifies\r?$/m.test(output)) throw Error("invalid_apksigner_result");
  const count = [...output.matchAll(/^Number of signers: (\d+)\r?$/gm)];
  const certificates = [...output.matchAll(/^Signer #(\d+) certificate SHA-256 digest: ([a-fA-F0-9]{64})\r?$/gm)];
  const schemes = [...output.matchAll(/^Verified using (v\d+(?:\.\d+)?) scheme[^\r\n]*: true\r?$/gm)].map(row => row[1]!);
  if (count.length !== 1 || Number(count[0]![1]) < 1 || certificates.length !== Number(count[0]![1]) || !schemes.length)
    throw Error("invalid_apksigner_result");
  const indexes = certificates.map(row => Number(row[1])).sort((a, b) => a - b);
  if (indexes.some((value, index) => value !== index + 1)) throw Error("invalid_apksigner_result");
  const signerCertificateSha256 = certificates.map(row => row[2]!.toLowerCase()).sort();
  if (new Set(signerCertificateSha256).size !== signerCertificateSha256.length) throw Error("invalid_apksigner_result");
  return { signerCertificateSha256, signatureSchemes: [...new Set(schemes)].sort() };
}

export function compareAndroidApks(previous: VerifiedAndroidApk, next: VerifiedAndroidApk): UpdateCompatibility {
  const reasons: UpdateCompatibility["reasons"] = [];
  if (previous.packageId !== androidPackageId || next.packageId !== androidPackageId) reasons.push("package_mismatch");
  if (!previous.signerCertificateSha256.length || !next.signerCertificateSha256.length ||
    JSON.stringify([...previous.signerCertificateSha256].sort()) !== JSON.stringify([...next.signerCertificateSha256].sort()))
    reasons.push("signer_mismatch_or_unverified_rotation");
  if (next.versionCode < previous.versionCode) reasons.push("version_downgrade");
  return { status: reasons.length ? "held" : "same_signer_and_non_decreasing_version", reasons, installedDeviceVerified: false };
}

export function verifyAndroidApk(apkPath: string, buildToolsPath: string, javaPath: string): VerifiedAndroidApk {
  const apk = resolve(apkPath), bytes = statSync(apk).size;
  if (bytes < 1 || bytes > 100 * 1024 * 1024) throw Error("apk_size_outside_inspection_budget");
  const input = readFileSync(apk), sha256 = createHash("sha256").update(input).digest("hex");
  function run(executable: string, args: string[], failure: string) {
    try { return execFileSync(executable, args, { encoding: "utf8", timeout: 30_000, maxBuffer: 1024 * 1024, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }); }
    catch { throw Error(failure); } // Do not print command/stderr: apksigner also emits certificate subject metadata.
  }
  const aapt = join(resolve(buildToolsPath), process.platform === "win32" ? "aapt2.exe" : "aapt2");
  const metadata = parseApkBadging(run(aapt, ["dump", "badging", apk], "apk_metadata_inspection_failed"));
  const signers = parseVerifiedApkSigners(run(javaPath,
    ["-jar", join(resolve(buildToolsPath), "lib", "apksigner.jar"), "verify", "--verbose", "--print-certs", apk], "apk_signature_verification_failed"));
  // Read only the ZIP file table: never inflate arbitrary libraries or read any keystore.
  let nativeLibraryCount = 0;
  unzipSync(input, { filter: entry => { if (/^lib\/[^/]+\/[^/]+\.so$/.test(entry.name)) nativeLibraryCount++; return false; } });
  if (createHash("sha256").update(readFileSync(apk)).digest("hex") !== sha256) throw Error("apk_changed_during_inspection");
  return { sha256, bytes, ...metadata, ...signers, nativeLibraryCount };
}
