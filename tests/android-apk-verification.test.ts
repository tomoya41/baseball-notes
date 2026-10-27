import { describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, rmdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";
import { compareAndroidApks, parseApkBadging, parseVerifiedApkSigners, verifyAndroidApk, type VerifiedAndroidApk } from "../scripts/lib/android-apk-verification";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));

const sha = "a".repeat(64), other = "b".repeat(64);
const signed = `Verifies\nVerified using v1 scheme (JAR signing): false\nVerified using v2 scheme (APK Signature Scheme v2): true\nVerified using v3 scheme (APK Signature Scheme v3): true\nNumber of signers: 1\nSigner #1 certificate DN: CN=not-for-report\nSigner #1 certificate SHA-256 digest: ${sha}\n`;
const badging = "package: name='com.tomoya41.baseballnotes' versionCode='1' versionName='0.1.0-beta.1'\nsdkVersion:'24'\ntargetSdkVersion:'36'\n";
const apk = (overrides: Partial<VerifiedAndroidApk> = {}): VerifiedAndroidApk => ({ sha256: sha, bytes: 10,
  packageId: "com.tomoya41.baseballnotes", versionCode: 1, versionName: "0.1.0-beta.1", minSdk: 24, targetSdk: 36,
  debuggable: true, permissions: ["android.permission.INTERNET"], signerCertificateSha256: [sha], signatureSchemes: ["v2", "v3"], nativeLibraryCount: 0, ...overrides });

describe("read-only Android APK update evidence", () => {
  it("parses actual SDK field forms and records only verified certificate digests", () => {
    const metadata = parseApkBadging("package: name='com.tomoya41.baseballnotes' versionCode='1' versionName='0.1.0-beta.1' platformBuildVersionName='16'\nsdkVersion:'24'\ntargetSdkVersion:'36'\nuses-permission: name='android.permission.INTERNET'\nuses-permission: name='android.permission.POST_NOTIFICATIONS'\napplication-debuggable\n");
    expect(metadata).toMatchObject({ packageId: apk().packageId, versionCode: 1, minSdk: 24, targetSdk: 36, debuggable: true });
    expect(metadata.permissions).toEqual(["android.permission.INTERNET", "android.permission.POST_NOTIFICATIONS"]);
    expect(parseVerifiedApkSigners(signed.replaceAll("\n", "\r\n"))).toEqual({ signerCertificateSha256: [sha], signatureSchemes: ["v2", "v3"] });
    expect(JSON.stringify(parseVerifiedApkSigners(signed))).not.toContain("not-for-report");
  });
  it("rejects missing, malformed, duplicate and unverified signer metadata", () => {
    for (const output of [signed.replace("Verifies\n", ""), signed.replaceAll(": true", ": false"), signed.replace("Number of signers: 1", "Number of signers: 2"), signed.replace("Signer #1 certificate SHA", "Signer #2 certificate SHA"), signed.replace(sha, "bad"), signed + `Signer #1 certificate SHA-256 digest: ${other}\n`])
      expect(() => parseVerifiedApkSigners(output)).toThrow("invalid_apksigner_result");
    expect(() => parseApkBadging("package: name='wrong' versionCode='1' versionName=''\n")).toThrow("invalid_apk_metadata");
  });
  it("accepts the actual SDK 36 minSdkVersion field while rejecting conflicting aliases", () => {
    const actual = "package: name='com.tomoya41.baseballnotes' versionCode='1' versionName='0.1.0-beta.1' platformBuildVersionName='16' platformBuildVersionCode='36' compileSdkVersion='36' compileSdkVersionCodename='16'\nminSdkVersion:'24'\ntargetSdkVersion:'36'\n";
    expect(parseApkBadging(actual)).toMatchObject({ packageId: apk().packageId, minSdk: 24, targetSdk: 36 });
    expect(() => parseApkBadging(actual + "sdkVersion:'23'\n")).toThrow("invalid_apk_metadata");
    expect(() => parseApkBadging(actual + "minSdkVersion:'24'\n")).toThrow("invalid_apk_metadata");
  });
  it("holds signer mismatch, package mismatch and downgrade without proposing destructive fixes", () => {
    expect(compareAndroidApks(apk(), apk({ signerCertificateSha256: [other] }))).toEqual({ status: "held", reasons: ["signer_mismatch_or_unverified_rotation"], installedDeviceVerified: false });
    expect(compareAndroidApks(apk({ versionCode: 2 }), apk({ packageId: "other.package" }))).toEqual({ status: "held", reasons: ["package_mismatch", "version_downgrade"], installedDeviceVerified: false });
    expect(compareAndroidApks(apk(), apk({ signerCertificateSha256: [] })).status).toBe("held");
  });
  it("accepts exact signer continuity and equal/increasing version only as local evidence", () => {
    for (const versionCode of [1, 2]) expect(compareAndroidApks(apk(), apk({ versionCode }))).toEqual({ status: "same_signer_and_non_decreasing_version", reasons: [], installedDeviceVerified: false });
    expect(compareAndroidApks(apk({ signerCertificateSha256: [other, sha] }), apk({ signerCertificateSha256: [sha, other] })).status).toBe("same_signer_and_non_decreasing_version");
  });
  it("requires official verifier exit success even when a failed process prints plausible signers", () => {
    const folder = mkdtempSync(join(tmpdir(), "baseball-apk-verification-")), file = join(folder, "fixture.apk");
    writeFileSync(file, zipSync({ "assets/fixture.txt": strToU8("fixture, not a signed production APK") }));
    const command = vi.mocked(execFileSync); command.mockReset();
    command.mockReturnValueOnce(badging).mockImplementationOnce(() => { throw Object.assign(Error("not-for-report"), { stdout: signed, stderr: "not-for-report" }); });
    try {
      expect(() => verifyAndroidApk(file, "fixture-build-tools", "fixture-java")).toThrow(/^apk_signature_verification_failed$/);
      expect(command.mock.calls[1]?.[1]).toEqual(["-jar", expect.stringContaining("apksigner.jar"), "verify", "--verbose", "--print-certs", file]);
      expect(command.mock.calls.every(call => !call[1]?.includes("install"))).toBe(true);
    } finally { rmSync(file); rmdirSync(folder); command.mockReset(); }
  });
  it("rejects an APK replaced between metadata/hash capture and signature verification", () => {
    const folder = mkdtempSync(join(tmpdir(), "baseball-apk-verification-")), file = join(folder, "fixture.apk");
    writeFileSync(file, zipSync({ "assets/fixture.txt": strToU8("first fixture") }));
    const command = vi.mocked(execFileSync); command.mockReset();
    command.mockReturnValueOnce(badging).mockImplementationOnce(() => { writeFileSync(file, "replaced fixture"); return signed; });
    try { expect(() => verifyAndroidApk(file, "fixture-build-tools", "fixture-java")).toThrow("apk_changed_during_inspection"); }
    finally { rmSync(file); rmdirSync(folder); command.mockReset(); }
  });
});
