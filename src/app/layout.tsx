import type { Metadata, Viewport } from "next";
import "./globals.css";
import { themeScript } from "@/lib/theme";
export const metadata: Metadata = {
  title: "Mealbook · Food Tracker",
  description: "Your meals, services, and payments in one place.",
  applicationName: "Mealbook",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Mealbook" },
  icons: {
    icon: [
      { url: "/icons/mealbook-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/mealbook-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#f3fbed" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head><body>{children}</body></html>;
}
