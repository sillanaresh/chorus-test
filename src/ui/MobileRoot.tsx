import {
    MutationCache,
    QueryClient,
    QueryClientProvider,
} from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AppContext } from "@ui/context/AppContext";
import { db } from "@core/chorus/DB";
import { AppMetadataProvider } from "@ui/providers/AppMetadataProvider";
import { DatabaseProvider } from "@ui/providers/DatabaseProvider";
import { ThemeProvider } from "@ui/themes/theme-provider";
import MobileApp from "@ui/components/mobile/MobileApp";
import "./App.css";

const mutationCache = new MutationCache({
    onError: (error, variables, context) => {
        console.error("Mutation error:", error, variables, context);
    },
});

const queryClient = new QueryClient({
    mutationCache,
    defaultOptions: {
        queries: {
            retry: false,
            networkMode: "always",
            refetchOnWindowFocus: false,
            staleTime: Infinity,
        },
    },
});

const mobileAppContext = {
    isQuickChatWindow: true,
    isMobileApp: true,
    zoomLevel: 100,
    setZoomLevel: () => undefined,
};

export default function MobileRoot() {
    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <ThemeProvider storageKey="melty-theme">
                    <DatabaseProvider db={db}>
                        <AppContext.Provider value={mobileAppContext}>
                            <AppMetadataProvider>
                                <MobileApp />
                            </AppMetadataProvider>
                        </AppContext.Provider>
                    </DatabaseProvider>
                </ThemeProvider>
            </BrowserRouter>
        </QueryClientProvider>
    );
}
