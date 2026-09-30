import { mkdir, writeFile } from "node:fs/promises";
const packageId = "com.tomoya41.baseballnotes";
const fingerprints = (process.env.ANDROID_APP_LINK_FINGERPRINTS ?? "").split(",").map(s => s.trim()).filter(Boolean);
if (!fingerprints.length || fingerprints.some(s => !/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/i.test(s)))
  throw Error("Verified Play app-signing SHA-256 fingerprints required; no placeholder assetlinks published");
// App Links require the HOST root, not the GitHub Pages project subdirectory.
// Copy this private preparation output to tomoya41.github.io/.well-known after verifying the signing key.
await mkdir(".data/app-link-host-root/.well-known", { recursive: true });
await writeFile(".data/app-link-host-root/.well-known/assetlinks.json", JSON.stringify([{ relation: ["delegate_permission/common.handle_all_urls"],
  target: { namespace: "android_app", package_name: packageId, sha256_cert_fingerprints: fingerprints } }], null, 2));
