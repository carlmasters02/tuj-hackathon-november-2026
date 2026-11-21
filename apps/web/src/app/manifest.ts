import type { MetadataRoute } from "next";

/** Web app manifest: lets Android (and desktop Chrome) install Humagination with the light-bulb icon. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Humagination",
    short_name: "Humagination",
    description: "Learn and create with your own mind — checked by code, never by AI.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f7f0e1",
    theme_color: "#f7f0e1",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
