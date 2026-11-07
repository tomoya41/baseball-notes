import { readFileSync } from "node:fs";
import { stdout } from "node:process";

const config = JSON.parse(readFileSync(0, "utf8"));
const nativeLibraries = config?.optimizations?.uncompressNativeLibraries;
if (nativeLibraries?.enabled !== true || nativeLibraries.alignment !== "PAGE_ALIGNMENT_16K") {
  throw new Error("Release AAB must request 16 KB alignment for uncompressed native libraries");
}
stdout.write("Release AAB requests PAGE_ALIGNMENT_16K\n");
