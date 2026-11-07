import { stdin, stdout } from "node:process";
import { text } from "node:stream/consumers";

const config = JSON.parse(await text(stdin));
const nativeLibraries = config?.optimizations?.uncompressNativeLibraries;
if (nativeLibraries?.enabled !== true || nativeLibraries.alignment !== "PAGE_ALIGNMENT_16K") {
  throw new Error("Release AAB must request 16 KB alignment for uncompressed native libraries");
}
stdout.write("Release AAB requests PAGE_ALIGNMENT_16K\n");
