import React, { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AppContext } from "@ui/context/AppContext";
import * as AppMetadataAPI from "@core/chorus/api/AppMetadataAPI";

export const AppProvider: React.FC<{
    children: React.ReactNode;
    forceQuickChatWindow?: boolean;
    isMobileApp?: boolean;
}> = ({ children, forceQuickChatWindow, isMobileApp = false }) => {
    const [isQuickChatWindow, setIsQuickChatWindow] = useState(
        forceQuickChatWindow ?? false,
    );
    const [zoomLevel, setZoomLevelState] = useState(100);

    const savedZoomLevel = AppMetadataAPI.useZoomLevel();
    const setZoomLevelMutation = AppMetadataAPI.useSetZoomLevel();

    useEffect(() => {
        if (forceQuickChatWindow !== undefined) {
            setIsQuickChatWindow(forceQuickChatWindow);
            return;
        }

        const checkWindowType = () => {
            const window = getCurrentWindow();
            console.log("window label:", window.label);
            setIsQuickChatWindow(window.label === "quick-chat");
        };
        void checkWindowType();
    }, [forceQuickChatWindow]);

    useEffect(() => {
        if (savedZoomLevel !== undefined) {
            setZoomLevelState(savedZoomLevel);
            if (!isQuickChatWindow) {
                document.body.style.zoom = `${savedZoomLevel}%`;
            }
        }
    }, [savedZoomLevel, isQuickChatWindow]);

    const setZoomLevel = (level: number) => {
        setZoomLevelState(level);
        if (!isQuickChatWindow) {
            document.body.style.zoom = `${level}%`;
        }
        setZoomLevelMutation.mutate(level);
    };

    // Prevent backspace from navigating back unless in an input or contentEditable element
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Backspace") {
                const target = event.target as HTMLElement;
                const isInput =
                    target.tagName === "INPUT" ||
                    target.tagName === "TEXTAREA" ||
                    target.isContentEditable;

                if (!isInput) {
                    event.preventDefault();
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    return (
        <AppContext.Provider
            value={{
                isQuickChatWindow,
                isMobileApp,
                zoomLevel,
                setZoomLevel,
            }}
        >
            {children}
        </AppContext.Provider>
    );
};
