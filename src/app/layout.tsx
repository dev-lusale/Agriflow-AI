import type { Metadata, Viewport } from "next";
import { Urbanist } from "next/font/google";
import { Toaster } from "sonner";
import { ServiceWorkerRegister } from "@/components/offline/sw-register";
import "./globals.css";

const urbanist = Urbanist({ subsets: ["latin"], variable: "--font-urbanist", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: "AgriFlow AI Zambia — Grow Smarter. Trade Better. Harvest More.", template: "%s · AgriFlow AI" },
  description:
    "AgriFlow AI Zambia brings farm management, Grok-powered agricultural advice, a produce marketplace, input supply, logistics and farm finances into one platform for Zambian farmers and agribusinesses.",
  applicationName: "AgriFlow AI",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "AgriFlow AI", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: "AgriFlow AI Zambia",
    title: "AgriFlow AI Zambia — Grow Smarter. Trade Better. Harvest More.",
    description: "Farm management, Grok-powered agricultural advice, a produce marketplace, input supply, logistics and farm finances for Zambian farmers.",
    locale: "en_ZM",
  },
  twitter: { card: "summary_large_image", title: "AgriFlow AI Zambia", description: "Grow Smarter. Trade Better. Harvest More." },
  icons: { icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/icon.svg", type: "image/svg+xml" }], apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#E7F0F4",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZM" className={urbanist.variable}>
      <body className="font-sans">
        {children}
        <Toaster position="top-center" richColors closeButton toastOptions={{ classNames: { toast: "!rounded-2xl !border-white/80 !font-sans !shadow-[0_18px_40px_-16px_rgb(14_19_24/0.25)] !backdrop-blur-xl" } }} />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
