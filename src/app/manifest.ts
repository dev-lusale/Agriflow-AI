import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AgriFlow AI Zambia",
    short_name: "AgriFlow AI",
    description: "Grow Smarter. Trade Better. Harvest More. Farm management, Grok AI advice and agricultural marketplace for Zambia.",
    id: "/",
    start_url: "/auth/login?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#EEF3F5",
    theme_color: "#E7F0F4",
    categories: ["business", "productivity", "utilities"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      ...[48, 72, 96, 128, 144, 192, 256, 384, 512].map((s) => ({ src: `/icons/icon-${s}.png`, sizes: `${s}x${s}`, type: "image/png", purpose: "any" as const })),
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "AI Assistant", url: "/farmer/assistant" },
      { name: "Record activity", url: "/offline" },
      { name: "Marketplace", url: "/marketplace" },
    ],
  };
}
