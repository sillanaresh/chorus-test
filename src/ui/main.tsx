// Import polyfills first.
import "../polyfills";

import { StrictMode } from "react";
import ReactDOM from "react-dom/client";

window.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled promise rejection:", event.reason);
});

async function renderApp() {
    const rootModule =
        import.meta.env.VITE_CHORUS_MOBILE === "1"
            ? await import("./MobileRoot")
            : await import("./DesktopRoot");
    const Root = rootModule.default;

    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
        <StrictMode>
            <Root />
        </StrictMode>,
    );
}

void renderApp();
