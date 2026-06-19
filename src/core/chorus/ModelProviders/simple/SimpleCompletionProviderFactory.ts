import { ApiKeys } from "../../Models";
import { canProceedWithProvider } from "@core/utilities/ProxyUtils";
import type { ISimpleCompletionProvider } from "./ISimpleCompletionProvider";

type ProviderConfig = {
    name: string;
    key: keyof ApiKeys;
    create: (apiKey: string) => Promise<ISimpleCompletionProvider>;
};

const PROVIDER_PRECEDENCE: ProviderConfig[] = [
    {
        name: "anthropic",
        key: "anthropic",
        create: async (key) => {
            const { SimpleCompletionProviderAnthropic } = await import(
                "./SimpleCompletionProviderAnthropic"
            );
            return new SimpleCompletionProviderAnthropic(key);
        },
    },
    {
        name: "openai",
        key: "openai",
        create: async (key) => {
            const { SimpleCompletionProviderOpenAI } = await import(
                "./SimpleCompletionProviderOpenAI"
            );
            return new SimpleCompletionProviderOpenAI(key);
        },
    },
    {
        name: "google",
        key: "google",
        create: async (key) => {
            const { SimpleCompletionProviderGoogle } = await import(
                "./SimpleCompletionProviderGoogle"
            );
            return new SimpleCompletionProviderGoogle(key);
        },
    },
    {
        name: "openrouter",
        key: "openrouter",
        create: async (key) => {
            const { SimpleCompletionProviderOpenRouter } = await import(
                "./SimpleCompletionProviderOpenRouter"
            );
            return new SimpleCompletionProviderOpenRouter(key);
        },
    },
];

/**
 * Factory function that selects and returns an appropriate simple completion provider
 * based on available API keys. Follows explicit precedence order.
 *
 * @param apiKeys The API keys object from settings
 * @returns An ISimpleCompletionProvider instance
 * @throws Error if no suitable provider is configured
 */
export async function getSimpleCompletionProvider(
    apiKeys: ApiKeys,
): Promise<ISimpleCompletionProvider> {
    if (import.meta.env.VITE_CHORUS_MOBILE === "1") {
        const apiKey = apiKeys.openrouter;
        if (!apiKey) {
            throw new Error(
                "Please add an OpenRouter API key in Settings to generate chat titles.",
            );
        }
        const { SimpleCompletionProviderOpenRouter } = await import(
            "./SimpleCompletionProviderOpenRouter"
        );
        return new SimpleCompletionProviderOpenRouter(apiKey);
    }

    const reasons: string[] = [];

    for (const provider of PROVIDER_PRECEDENCE) {
        const check = canProceedWithProvider(provider.name, apiKeys);
        const apiKey = apiKeys[provider.key];

        if (check.canProceed && apiKey) {
            return await provider.create(apiKey);
        }

        if (!check.canProceed && check.reason) {
            reasons.push(check.reason);
        }
    }

    throw new Error(
        `Please add an Anthropic, OpenAI, Google, or OpenRouter API key in Settings to generate chat titles. ${reasons.join(" ")}`,
    );
}
