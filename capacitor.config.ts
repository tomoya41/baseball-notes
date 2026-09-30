import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tomoya41.baseballnotes",
  appName: "Baseball Notes",
  webDir: ".data/android-web",
  plugins: { SystemBars: { insetsHandling: "native" } },
};
export default config;
