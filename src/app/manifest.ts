import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Mealbook — Food Expense Tracker",
    short_name: "Mealbook",
    description: "Your meals, services, and payments in one place.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f3fbed",
    theme_color: "#f3fbed",
    icons: [
      { src: "/icons/mealbook-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/mealbook-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/mealbook-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
