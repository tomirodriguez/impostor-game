import { useState } from "react";
import { useInstallPrompt } from "../hooks/useInstallPrompt";
import IOSInstallModal from "./IOSInstallModal";

export default function InstallPWAButton() {
  const { isInstalled, isIOS, canInstall, promptInstall } = useInstallPrompt();
  const [showIOSModal, setShowIOSModal] = useState(false);

  // No mostrar si ya está instalada
  if (isInstalled) return null;

  // No mostrar si no se puede instalar y no es iOS
  if (!canInstall && !isIOS) return null;

  const handleClick = () => {
    if (isIOS) {
      setShowIOSModal(true);
    } else {
      promptInstall();
    }
  };

  return (
    <>
      <button className="btn btn-install" onClick={handleClick}>
        <svg
          className="install-icon"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
        </svg>
        Instalar App
      </button>

      <IOSInstallModal isOpen={showIOSModal} onClose={() => setShowIOSModal(false)} />
    </>
  );
}
