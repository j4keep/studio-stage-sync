import type { CapacitorConfig } from "@capacitor/cli";

/**
 * YAJ native shell configuration.
 * Install @capacitor/core, @capacitor/cli, @capacitor/ios and @capacitor/android
 * before running `npx cap add ios` / `npx cap add android`.
 * Do not use server.url for production builds: ship the built web assets.
 */
const config: CapacitorConfig = {
  appId: "com.yaj.app",
  appName: "YAJ",
  webDir: "dist",
  server: {
    androidScheme: "https",
    iosScheme: "capacitor",
  },
};

export default config;
