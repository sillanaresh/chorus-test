import { getProviderName, type ModelConfig } from "@core/chorus/Models";

export const MOBILE_BLOCKED_OPENROUTER_MODEL_IDS = new Set([
    "openrouter::x-ai/grok-4",
]);

export const MOBILE_PREFERRED_OPENROUTER_MODELS = [
    "openrouter::deepseek/deepseek-r1-0528",
    "openrouter::qwen/qwen3-32b",
    "openrouter::x-ai/grok-4.3",
    "openrouter::anthropic/claude-opus-4.5",
];

export function isMobileOpenRouterModelUsable(
    modelConfig: ModelConfig | undefined | null,
) {
    if (!modelConfig) return false;

    const isOpenRouterModel =
        modelConfig.id.startsWith("openrouter::") ||
        modelConfig.modelId.startsWith("openrouter::") ||
        getProviderName(modelConfig.modelId) === "openrouter";

    return (
        isOpenRouterModel &&
        modelConfig.isEnabled &&
        !modelConfig.isInternal &&
        !modelConfig.isDeprecated &&
        !MOBILE_BLOCKED_OPENROUTER_MODEL_IDS.has(modelConfig.id) &&
        !MOBILE_BLOCKED_OPENROUTER_MODEL_IDS.has(modelConfig.modelId)
    );
}

export function sortMobileOpenRouterModels(modelConfigs: ModelConfig[]) {
    return [...modelConfigs].sort((a, b) => {
        const preferredA = MOBILE_PREFERRED_OPENROUTER_MODELS.indexOf(a.id);
        const preferredB = MOBILE_PREFERRED_OPENROUTER_MODELS.indexOf(b.id);

        if (preferredA !== -1 || preferredB !== -1) {
            if (preferredA === -1) return 1;
            if (preferredB === -1) return -1;
            return preferredA - preferredB;
        }

        return a.displayName.localeCompare(b.displayName);
    });
}

