import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { ServiceWorkerRegister } from "@/components/offline/sw-register";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: "AgriFlow AI Zambia — Grow Smarter. Trade Better. Harvest More.", template: "%s · AgriFlow AI" },
  description:
    "AgriFlow AI Zambia brings farm management, Grok-powered agricultural advice, a produce marketplace, input supply, logistics and farm finances into one platform for Zambian farmers and agribusinesses.",
  applicationName: "AgriFlow AI",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "AgriFlow AI", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#14532D",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZM" className={jakarta.variable}>
      <body className="font-sans">
        {children}
        <Toaster position="top-center" richColors closeButton />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
