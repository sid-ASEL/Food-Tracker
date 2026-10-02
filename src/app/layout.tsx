import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Mealbook · Food Tracker", description: "Your meals, services, and payments in one place.", applicationName: "Mealbook" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f7f8f2" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
