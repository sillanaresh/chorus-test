import { createContext } from "react";

interface AppContextType {
    isQuickChatWindow: boolean;
    isMobileApp: boolean;
    zoomLevel: number;
    setZoomLevel: (level: number) => void;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);
