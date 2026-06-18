import React from "react";
import { usePWAInstall } from "../hooks/usePWAInstall";
import { getDeviceType } from "../lib/device";

export default function InstallButton() {
  const { isInstallable, installApp } = usePWAInstall();

  const handleInstall = async () => {
    const device = getDeviceType();

    // 🔥 ANDROID → REAL INSTALL
    if (device === "android") {
      if (isInstallable) {
        installApp(); // ✅ THIS TRIGGERS INSTALL
      } else {
        alert("Install not ready yet. Please refresh and try again.");
      }
    }

    // 🍎 IOS → SHOW STEPS
    else if (device === "ios") {
      alert(
        "To install this app:\n\n1. Tap Share (📤)\n2. Scroll down\n3. Tap 'Add to Home Screen'"
      );
    }

    // 💻 OTHER
    else {
      alert("Use Chrome browser to install this app.");
    }
  };

  return (
    <button
      onClick={handleInstall}
      className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium shadow-md hover:bg-blue-700 transition-colors"
    >
      Install App
    </button>
  );
}
