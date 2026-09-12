import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lets Do It",
    short_name: "Lets Do",
    description: "A simple shared task planner.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [{ src: "/image.png", sizes: "512x512", type: "image/png" }],
  };
}
