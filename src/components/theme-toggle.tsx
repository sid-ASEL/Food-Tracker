"use client";
import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { THEME_KEY } from "@/lib/theme";

function preference() {
  try { return localStorage.getItem(THEME_KEY); } catch { return null; }
}
function setTheme(theme: "light" | "dark") {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#000000" : "#f3fbed");
}
function subscribe(callback: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const changed = () => {
    const saved = preference();
    setTheme(saved === "light" || saved === "dark" ? saved : media.matches ? "dark" : "light");
    callback();
  };
  const storageChanged = (event: StorageEvent) => { if (event.key === THEME_KEY || event.key === null) changed(); };
  window.addEventListener("storage", storageChanged);
  window.addEventListener("mealbook-theme-change", callback);
  media.addEventListener("change", changed);
  changed();
  return () => { window.removeEventListener("storage", storageChanged); window.removeEventListener("mealbook-theme-change", callback); media.removeEventListener("change", changed); };
}
export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, () => document.documentElement.dataset.theme === "dark", () => false);
  return <button className="icon-button theme-toggle" type="button" role="switch" aria-label="Dark mode" aria-checked={dark} title={dark ? "Switch to light mode" : "Switch to dark mode"} onClick={() => {
    const theme = dark ? "light" : "dark";
    setTheme(theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* The toggle still works when storage is unavailable. */ }
    window.dispatchEvent(new Event("mealbook-theme-change"));
  }}>{dark ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}</button>;
}
