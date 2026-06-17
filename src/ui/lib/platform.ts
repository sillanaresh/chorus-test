import { useEffect, useState } from "react";
import { platform } from "@tauri-apps/plugin-os";

const MOBILE_PREVIEW_STORAGE_KEY = "chorus-mobile-preview";

export function isMobileAppModeSync() {
    const searchParams = new URLSearchParams(window.location.search);
    const previewRequested =
        searchParams.get("mobile") === "1" ||
        localStorage.getItem(MOBILE_PREVIEW_STORAGE_KEY) === "1";

    if (previewRequested || import.meta.env.VITE_CHORUS_MOBILE === "1") {
        return true;
    }

    return /\b(iPhone|iPad|iPod)\b/i.test(window.navigator.userAgent);
}

export function setMobilePreviewMode(enabled: boolean) {
    if (enabled) {
        localStorage.setItem(MOBILE_PREVIEW_STORAGE_KEY, "1");
    } else {
        localStorage.removeItem(MOBILE_PREVIEW_STORAGE_KEY);
    }
}

export function useMobileAppMode() {
    const [isMobileApp, setIsMobileApp] = useState(isMobileAppModeSync);

    useEffect(() => {
        let cancelled = false;

        async function detectPlatform() {
            if (isMobileAppModeSync()) {
                setIsMobileApp(true);
                return;
            }

            try {
                const currentPlatform = platform();
                if (!cancelled && currentPlatform === "ios") {
                    setIsMobileApp(true);
                }
            } catch (error) {
                console.debug("Unable to detect Tauri platform", error);
            }
        }

        void detectPlatform();

        return () => {
            cancelled = true;
        };
    }, []);

    return isMobileApp;
}
