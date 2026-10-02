"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download } from "lucide-react";
import { Modal } from "./modal";

type InstallChoice = { outcome: "accepted" | "dismissed"; platform?: string };
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<InstallChoice> };

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function subscribeToInstallation(callback: () => void) {
  const displayMode = window.matchMedia("(display-mode: standalone)");
  displayMode.addEventListener("change", callback);
  window.addEventListener("appinstalled", callback);
  return () => {
    displayMode.removeEventListener("change", callback);
    window.removeEventListener("appinstalled", callback);
  };
}

function isAppleMobile() {
  return /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function InstallApp() {
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [promptAccepted, setPromptAccepted] = useState(false);
  const [instructions, setInstructions] = useState<"apple" | "browser" | null>(null);
  const installed = useSyncExternalStore(subscribeToInstallation, isStandalone, () => false);

  useEffect(() => {
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  async function install() {
    if (!installPrompt) {
      setInstructions(isAppleMobile() ? "apple" : "browser");
      return;
    }
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setPromptAccepted(true);
      setInstallPrompt(null);
    } catch {
      setInstructions(isAppleMobile() ? "apple" : "browser");
    }
  }

  if (installed || promptAccepted) return null;

  return <>
    <button className="icon-button install-button" type="button" aria-label="Install Mealbook" title="Install Mealbook" onClick={install}>
      <Download size={17} /><span className="install-label">Install</span>
    </button>
    {instructions && <Modal title="Add Mealbook to your home screen" onClose={() => setInstructions(null)}>
      {instructions === "apple" ? <div className="install-instructions">
        <p>On your iPhone or iPad:</p>
        <ol><li>Open this page in Safari and tap <strong>Share</strong>.</li><li>Scroll down and tap <strong>Add to Home Screen</strong>.</li><li>Tap <strong>Add</strong> to finish.</li></ol>
      </div> : <div className="install-instructions">
        <p>Open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. The wording depends on your browser and device.</p>
      </div>}
      <div className="button-row"><button className="button primary" type="button" onClick={() => setInstructions(null)}>Got it</button></div>
    </Modal>}
  </>;
}
