import type { CapacitorConfig } from "@capacitor/cli";

/**
 * AgriFlow AI Android app.
 * The app loads the live AgriFlow platform (same accounts, data and server-side security
 * as the website) inside a native Android shell. Grok and database credentials stay on the
 * server; nothing secret is bundled in the APK.
 * When the phone is offline at launch, the bundled offline screen (mobile/www/offline.html)
 * is shown instead of a browser error, and the web app's own offline mode (service worker +
 * on-device queue) takes over once it has been opened online at least once.
 */
const APP_URL = process.env.AGRIFLOW_APP_URL ?? "https://agriflow-ai-wheat.vercel.app";

const config: CapacitorConfig = {
  appId: "zm.agriflow.ai",
  appName: "AgriFlow AI",
  webDir: "mobile/www",
  server: {
    url: APP_URL,
    cleartext: false,
    androidScheme: "https",
    errorPath: "offline.html",
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#EEF3F5",
      androidScaleType: "CENTER_INSIDE",
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#E7F0F4",
      overlaysWebView: false,
    },
  },
};

export default config;
