import { useEffect, useState } from "react";

let deferredPrompt: any = null;

export const usePWAInstall = () => {
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    window.addEventListener("beforeinstallprompt", (e: any) => {
      e.preventDefault();
      deferredPrompt = e;
      setIsInstallable(true);
    });
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) {
      alert("Install not available. Please use browser menu.");
      return;
    }

    deferredPrompt.prompt();

    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === "accepted") {
      console.log("✅ App installed");
    } else {
      console.log("❌ Install cancelled");
    }

    deferredPrompt = null;
    setIsInstallable(false);
  };

  return { isInstallable, installApp };
};
