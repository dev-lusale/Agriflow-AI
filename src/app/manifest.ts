import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AgriFlow AI Zambia",
    short_name: "AgriFlow AI",
    description: "Grow Smarter. Trade Better. Harvest More. Farm management, Grok AI advice and agricultural marketplace for Zambia.",
    start_url: "/auth/login?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F8FAFC",
    theme_color: "#14532D",
    categories: ["business", "productivity", "utilities"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "AI Assistant", url: "/farmer/assistant" },
      { name: "Record activity", url: "/offline" },
      { name: "Marketplace", url: "/marketplace" },
    ],
  };
}
