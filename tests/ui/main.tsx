import React from "react";
import { createRoot } from "react-dom/client";
import { Tracker } from "../../src/components/tracker";
import { Landing } from "../../src/components/landing";
import { themeScript } from "../../src/lib/theme";
import "../../src/app/globals.css";
const params = new URLSearchParams(window.location.search);
const theme = document.createElement("script"); theme.textContent = themeScript; document.head.append(theme);
if (params.has("landing")) {
  createRoot(document.getElementById("root")!).render(<Landing ready={!params.has("notReady")} error={params.get("error") ?? undefined} onSignIn={async () => { document.documentElement.dataset.signIn = "google"; }} />);
} else {
  const { initialData } = await import("./actions");
  createRoot(document.getElementById("root")!).render(<Tracker initial={initialData()} today="2026-10-02" userName="Ari" />);
}
