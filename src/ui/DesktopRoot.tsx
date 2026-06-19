import { PostHogProvider } from "posthog-js/react";
import App from "./App";

const postHogOptions = {
    api_host: "https://us.i.posthog.com",
};

export default function DesktopRoot() {
    return (
        <PostHogProvider
            apiKey="phc_CZDlvSwRIls38T9qDCmTsRq24Q6lfrsUYHSR2baHb1"
            options={postHogOptions}
        >
            <App />
        </PostHogProvider>
    );
}
