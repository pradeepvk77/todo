import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lets Do It",
    short_name: "Lets Do",
    description: "A simple shared task planner.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // display_override gives the browser more install-banner flexibility
    display_override: ["standalone", "minimal-ui"],
    background_color: "#09090b",
    theme_color: "#09090b",
    orientation: "portrait-primary",
    // Multiple icon sizes are required for reliable install banners on Android & iOS
    icons: [
      { src: "/image.png", sizes: "192x192", type: "image/png" },
      { src: "/image.png", sizes: "512x512", type: "image/png" },
      // "maskable" lets Android adapt the icon to its shape (circle, squircle, etc.)
      { src: "/image.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    categories: ["productivity", "utilities"],
    prefer_related_applications: false,
  };
}
