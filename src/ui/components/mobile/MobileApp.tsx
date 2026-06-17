import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Route,
    Routes,
    useLocation,
    useNavigate,
    useParams,
} from "react-router-dom";
import {
    CheckIcon,
    ChevronDownIcon,
    GlobeIcon,
    KeyRoundIcon,
    Loader2Icon,
    MenuIcon,
    MonitorIcon,
    MoonIcon,
    PlusIcon,
    RefreshCcwIcon,
    SettingsIcon,
    SunIcon,
    Trash2Icon,
    XIcon,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChatInput } from "@ui/components/ChatInput";
import { AttachmentPillsList } from "@ui/components/AttachmentsViews";
import RetroSpinner from "@ui/components/ui/retro-spinner";
import { ProviderLogo } from "@ui/components/ui/provider-logo";
import { MessageMarkdown } from "@ui/components/renderers/MessageMarkdown";
import { useTheme } from "@ui/hooks/useTheme";
import type { MouseTrackingEyeRef } from "@ui/components/MouseTrackingEye";
import { SettingsManager } from "@core/utilities/Settings";
import { getProviderName, type ModelConfig } from "@core/chorus/Models";
import {
    isMobileOpenRouterModelUsable,
    sortMobileOpenRouterModels,
} from "@ui/lib/mobileModels";
import type { Chat } from "@core/chorus/api/ChatAPI";
import type { Message, MessageSetDetail } from "@core/chorus/ChatState";
import * as AppMetadataAPI from "@core/chorus/api/AppMetadataAPI";
import * as ChatAPI from "@core/chorus/api/ChatAPI";
import * as MessageAPI from "@core/chorus/api/MessageAPI";
import * as ModelsAPI from "@core/chorus/api/ModelsAPI";
import * as ToolPermissionsAPI from "@core/chorus/api/ToolPermissionsAPI";

const settingsManager = SettingsManager.getInstance();

const mobileType = {
    screenTitle: "text-[22px] font-semibold leading-7",
    headerTitle: "text-[17px] font-medium leading-6",
    rowTitle: "text-[16px] font-medium leading-6",
    rowMeta: "text-[13px] leading-5 text-muted-foreground",
    body: "text-[15px] leading-6",
    label: "text-sm font-medium",
} as const;

const mobileIconButton =
    "flex size-10 items-center justify-center rounded-full active:bg-muted";

const mobileFab =
    "fixed bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] right-5 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-background shadow-md active:scale-95";

const mobileWebOn = "bg-accent-800 text-accent-25";
const mobileWebOff =
    "border border-accent-800/70 text-accent-800 dark:text-accent-25";

function isOpenRouterModel(modelConfig: ModelConfig | undefined | null) {
    if (!modelConfig) return false;

    return (
        modelConfig.id.startsWith("openrouter::") ||
        modelConfig.modelId.startsWith("openrouter::") ||
        getProviderName(modelConfig.modelId) === "openrouter"
    );
}

function chatTitle(chat: Chat | undefined) {
    if (!chat) return "Chorus";
    if (chat.isNewChat) return "New chat";
    return chat.title?.trim() || "Untitled";
}

function sortOpenRouterModels(modelConfigs: ModelConfig[]) {
    return sortMobileOpenRouterModels(modelConfigs);
}

function openRouterModelConfigs(modelConfigs: ModelConfig[] | undefined) {
    return sortOpenRouterModels(
        modelConfigs?.filter(
            (modelConfig) =>
                isOpenRouterModel(modelConfig) &&
                isMobileOpenRouterModelUsable(modelConfig),
        ) ?? [],
    );
}

function useMobileWebSearchToggle(chatId?: string) {
    const defaultEnabled = AppMetadataAPI.useMobileWebSearchEnabled();
    const chatEnabled = AppMetadataAPI.useMobileChatWebSearchEnabled(chatId);
    const enabled = chatId ? chatEnabled : defaultEnabled;
    const setMobileWebSearchDefaultEnabled =
        AppMetadataAPI.useSetMobileWebSearchEnabled();
    const setMobileChatWebSearchEnabled =
        AppMetadataAPI.useSetMobileChatWebSearchEnabled();
    const upsertToolPermission = ToolPermissionsAPI.useUpsertToolPermission();

    const setEnabled = useCallback(
        async (nextEnabled: boolean) => {
            if (chatId) {
                await setMobileChatWebSearchEnabled.mutateAsync({
                    chatId,
                    enabled: nextEnabled,
                });
            } else {
                await setMobileWebSearchDefaultEnabled.mutateAsync(nextEnabled);
            }

            if (nextEnabled) {
                await Promise.all(
                    ["fetch", "search"].map((toolName) =>
                        upsertToolPermission.mutateAsync({
                            toolsetName: "web",
                            toolName,
                            permissionType: "always_allow",
                            lastResponse: "allow",
                        }),
                    ),
                );
            }
        },
        [
            chatId,
            setMobileChatWebSearchEnabled,
            setMobileWebSearchDefaultEnabled,
            upsertToolPermission,
        ],
    );

    return {
        enabled,
        setEnabled,
        isPending:
            setMobileWebSearchDefaultEnabled.isPending ||
            setMobileChatWebSearchEnabled.isPending ||
            upsertToolPermission.isPending,
    };
}

function cssPixelValue(value: string | null | undefined) {
    const parsed = Number.parseFloat(value ?? "");
    return Number.isFinite(parsed) ? parsed : 0;
}

function useStableMobileViewport() {
    useEffect(() => {
        const html = document.documentElement;
        const body = document.body;
        html.classList.add("chorus-mobile-root");
        body.classList.add("chorus-mobile-root");

        const probe = document.createElement("div");
        probe.style.cssText = [
            "position:fixed",
            "top:0",
            "left:0",
            "width:0",
            "height:0",
            "visibility:hidden",
            "pointer-events:none",
            "padding-top:env(safe-area-inset-top)",
            "padding-bottom:env(safe-area-inset-bottom)",
        ].join(";");
        document.body.appendChild(probe);

        const updateSafeAreas = () => {
            const styles = window.getComputedStyle(probe);
            const compactPhoneFallbackTop = window.innerWidth <= 520 ? 44 : 24;
            const currentTop = cssPixelValue(
                html.style.getPropertyValue("--mobile-safe-area-top"),
            );
            const currentBottom = cssPixelValue(
                html.style.getPropertyValue("--mobile-safe-area-bottom"),
            );

            html.style.setProperty(
                "--mobile-safe-area-top",
                `${Math.max(
                    currentTop,
                    cssPixelValue(styles.paddingTop),
                    compactPhoneFallbackTop,
                )}px`,
            );
            html.style.setProperty(
                "--mobile-safe-area-bottom",
                `${Math.max(
                    currentBottom,
                    cssPixelValue(styles.paddingBottom),
                )}px`,
            );
        };

        const updateKeyboardState = () => {
            const activeElement = document.activeElement;
            const hasTextInputFocused =
                activeElement instanceof HTMLInputElement ||
                activeElement instanceof HTMLTextAreaElement ||
                activeElement?.getAttribute("contenteditable") === "true";

            html.classList.toggle(
                "chorus-mobile-keyboard-open",
                hasTextInputFocused,
            );
        };
        const updateViewportState = () => {
            updateSafeAreas();
            updateKeyboardState();
        };

        updateViewportState();
        if (
            document.activeElement instanceof HTMLInputElement ||
            document.activeElement instanceof HTMLTextAreaElement
        ) {
            document.activeElement.blur();
        }
        window.addEventListener("orientationchange", updateViewportState);
        window.visualViewport?.addEventListener("resize", updateViewportState);
        document.addEventListener("focusin", updateKeyboardState);
        document.addEventListener("focusout", updateKeyboardState);

        return () => {
            window.removeEventListener("orientationchange", updateViewportState);
            window.visualViewport?.removeEventListener(
                "resize",
                updateViewportState,
            );
            document.removeEventListener("focusin", updateKeyboardState);
            document.removeEventListener("focusout", updateKeyboardState);
            probe.remove();
            html.classList.remove("chorus-mobile-root");
            html.classList.remove("chorus-mobile-keyboard-open");
            body.classList.remove("chorus-mobile-root");
            html.style.removeProperty("--mobile-safe-area-top");
            html.style.removeProperty("--mobile-safe-area-bottom");
        };
    }, []);
}

function MobileModelBootstrap() {
    const { data: apiKeys } = AppMetadataAPI.useApiKeys();
    const modelConfigsQuery = ModelsAPI.useModelConfigs();
    const selectedQuickChatModel = ModelsAPI.useSelectedModelConfigQuickChat();
    const updateQuickChatModel = MessageAPI.useUpdateSelectedModelConfigQuickChat();

    const openRouterModels = useMemo(
        () => openRouterModelConfigs(modelConfigsQuery.data),
        [modelConfigsQuery.data],
    );

    useEffect(() => {
        if (
            !apiKeys?.openrouter ||
            openRouterModels.length === 0 ||
            updateQuickChatModel.isPending
        ) {
            return;
        }

        if (!isMobileOpenRouterModelUsable(selectedQuickChatModel.data)) {
            updateQuickChatModel.mutate({
                modelConfig: openRouterModels[0],
            });
        }
    }, [
        apiKeys?.openrouter,
        openRouterModels,
        selectedQuickChatModel.data,
        updateQuickChatModel,
    ]);

    return null;
}

function MobileModelSelect({ compact = false }: { compact?: boolean }) {
    const modelConfigsQuery = ModelsAPI.useModelConfigs();
    const selectedQuickChatModel = ModelsAPI.useSelectedModelConfigQuickChat();
    const updateQuickChatModel = MessageAPI.useUpdateSelectedModelConfigQuickChat();
    const refreshOpenRouterModels = ModelsAPI.useRefreshOpenRouterModels();
    const [isPickerOpen, setIsPickerOpen] = useState(false);

    const openRouterModels = useMemo(
        () => openRouterModelConfigs(modelConfigsQuery.data),
        [modelConfigsQuery.data],
    );
    const selectedModel = selectedQuickChatModel.data;

    if (modelConfigsQuery.isPending) {
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="size-3.5 animate-spin" />
                Models
            </div>
        );
    }

    return (
        <div
            className={
                compact
                    ? "min-w-0"
                    : "flex flex-col gap-2"
            }
        >
            {!compact && (
                <div className="flex items-center justify-between">
                    <label className={mobileType.label}>Model</label>
                    <button
                        type="button"
                        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                        onClick={() => refreshOpenRouterModels.mutate()}
                    >
                        <RefreshCcwIcon className="size-3.5" />
                        Refresh
                    </button>
                </div>
            )}
            <button
                type="button"
                className={
                    compact
                        ? "flex h-9 w-full min-w-0 items-center gap-2 rounded-md border bg-background px-2 text-left text-[13px] active:bg-muted"
                        : "flex h-11 w-full items-center gap-2 rounded-md border bg-background px-3 text-left text-sm active:bg-muted"
                }
                onClick={() => setIsPickerOpen(true)}
                disabled={openRouterModels.length === 0}
                aria-label="Choose model"
            >
                {selectedModel && (
                    <ProviderLogo
                        provider={getProviderName(
                            selectedModel.modelId,
                        )}
                        size="sm"
                    />
                )}
                <span className="min-w-0 flex-1 truncate">
                    {selectedModel?.displayName ?? "No OpenRouter models"}
                </span>
                <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
            </button>

            {isPickerOpen && (
                <MobileModelPickerSheet
                    models={openRouterModels}
                    selectedModelId={selectedModel?.id}
                    onClose={() => setIsPickerOpen(false)}
                    onSelect={(modelConfig) => {
                        updateQuickChatModel.mutate({ modelConfig });
                        setIsPickerOpen(false);
                    }}
                />
            )}
        </div>
    );
}

function MobileModelPickerSheet({
    models,
    selectedModelId,
    onClose,
    onSelect,
}: {
    models: ModelConfig[];
    selectedModelId?: string;
    onClose: () => void;
    onSelect: (modelConfig: ModelConfig) => void;
}) {
    return (
        <div className="fixed inset-0 z-[70] bg-background">
            <div className="flex h-full flex-col mobile-safe-top">
                <div className="flex h-14 items-center justify-between border-b px-4">
                    <h2 className={mobileType.headerTitle}>Choose model</h2>
                    <button
                        type="button"
                        className={mobileIconButton}
                        onClick={onClose}
                        aria-label="Close model picker"
                    >
                        <XIcon className="size-5" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto px-2 py-2">
                    {models.map((modelConfig) => {
                        const selected = modelConfig.id === selectedModelId;
                        return (
                            <button
                                key={modelConfig.id}
                                type="button"
                                className={`flex min-h-14 w-full items-center gap-3 rounded-md px-3 py-2 text-left ${
                                    selected
                                        ? "bg-highlight text-highlight-foreground"
                                        : "active:bg-muted"
                                }`}
                                onClick={() => onSelect(modelConfig)}
                            >
                                <ProviderLogo
                                    provider={getProviderName(
                                        modelConfig.modelId,
                                    )}
                                    size="sm"
                                />
                                <span className={`min-w-0 flex-1 truncate ${mobileType.rowTitle}`}>
                                    {modelConfig.displayName}
                                </span>
                                {selected && (
                                    <CheckIcon className="size-4 shrink-0" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function MobileSettingsPanel({
    onClose,
    showClose = true,
}: {
    onClose?: () => void;
    showClose?: boolean;
}) {
    const queryClient = useQueryClient();
    const { mode, setMode } = useTheme();
    const { data: apiKeys } = AppMetadataAPI.useApiKeys();
    const skipOnboarding = AppMetadataAPI.useSkipOnboarding();
    const mobileWebSearch = useMobileWebSearchToggle();
    const [openRouterKey, setOpenRouterKey] = useState(
        apiKeys?.openrouter ?? "",
    );
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setOpenRouterKey(apiKeys?.openrouter ?? "");
    }, [apiKeys?.openrouter]);

    const saveOpenRouterKey = useCallback(async () => {
        const trimmedKey = openRouterKey.trim();

        if (!trimmedKey) {
            toast.error("OpenRouter key is required");
            return;
        }

        setIsSaving(true);
        try {
            const settings = await settingsManager.get();
            await settingsManager.set({
                ...settings,
                apiKeys: {
                    ...settings.apiKeys,
                    openrouter: trimmedKey,
                },
                quickChat: {
                    ...settings.quickChat,
                    enabled: true,
                },
            });

            await skipOnboarding.mutateAsync();
            await queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
            await queryClient.invalidateQueries(
                ModelsAPI.modelConfigQueries.listConfigs(),
            );
            await queryClient.invalidateQueries(
                ModelsAPI.modelConfigQueries.quickChat(),
            );
            toast.success("OpenRouter key saved");
            onClose?.();
        } catch (error) {
            console.error(error);
            toast.error("Could not save OpenRouter key");
        } finally {
            setIsSaving(false);
        }
    }, [openRouterKey, onClose, queryClient, skipOnboarding]);

    const hasOpenRouterKey = Boolean(apiKeys?.openrouter);

    return (
        <div className="flex h-full flex-col bg-background mobile-safe-top">
            <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2">
                    <KeyRoundIcon className="size-4 text-muted-foreground" />
                    <h2 className={mobileType.headerTitle}>Settings</h2>
                </div>
                {showClose && (
                    <button
                        type="button"
                        className={mobileIconButton}
                        onClick={onClose}
                        aria-label="Close settings"
                    >
                        <XIcon className="size-4" />
                    </button>
                )}
            </div>

            <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-5">
                <section className="flex flex-col gap-2">
                    <div className={mobileType.label}>Appearance</div>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            {
                                id: "system",
                                label: "System",
                                icon: MonitorIcon,
                            },
                            { id: "light", label: "Light", icon: SunIcon },
                            { id: "dark", label: "Dark", icon: MoonIcon },
                        ].map((option) => {
                            const Icon = option.icon;
                            const active = mode === option.id;
                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    className={`flex h-10 items-center justify-center gap-1.5 rounded-md border text-sm ${
                                        active
                                            ? "border-primary bg-primary text-background"
                                            : "bg-background active:bg-muted"
                                    }`}
                                    onClick={() =>
                                        setMode(
                                            option.id as
                                                | "system"
                                                | "light"
                                                | "dark",
                                        )
                                    }
                                >
                                    <Icon className="size-4" />
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section className="flex flex-col gap-2">
                    <label
                        className={mobileType.label}
                        htmlFor="mobile-openrouter-key"
                    >
                        OpenRouter API key
                    </label>
                    <input
                        id="mobile-openrouter-key"
                        value={openRouterKey}
                        onChange={(event) =>
                            setOpenRouterKey(event.target.value)
                        }
                        placeholder="sk-or-v1-..."
                        type="password"
                        autoCapitalize="none"
                        autoCorrect="off"
                        className="h-11 rounded-md border bg-background px-3 text-[16px] outline-none focus:ring-2 focus:ring-ring"
                    />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {hasOpenRouterKey && (
                            <CheckIcon className="size-3.5 text-green-600" />
                        )}
                        <span>
                            {hasOpenRouterKey
                                ? "OpenRouter connected"
                                : "Required for iOS chat"}
                        </span>
                    </div>
                </section>

                {hasOpenRouterKey && <MobileModelSelect />}

                {hasOpenRouterKey && (
                    <section className="flex items-center justify-between gap-4 rounded-md border px-3 py-3">
                        <div className="min-w-0">
                            <div className={`flex items-center gap-2 ${mobileType.label}`}>
                                <GlobeIcon className="size-4 text-muted-foreground" />
                                Default web search
                            </div>
                            <div className="mt-1 text-xs leading-5 text-muted-foreground">
                                Use web search automatically in new chats.
                            </div>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={mobileWebSearch.enabled}
                            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                                mobileWebSearch.enabled
                                    ? "bg-accent-800"
                                    : "border border-accent-800/60 bg-transparent"
                            }`}
                            onClick={() =>
                                void mobileWebSearch.setEnabled(
                                    !mobileWebSearch.enabled,
                                )
                            }
                            disabled={mobileWebSearch.isPending}
                        >
                            <span
                                className={`absolute top-1 size-5 rounded-full bg-background transition-transform ${
                                    mobileWebSearch.enabled
                                        ? "translate-x-6 bg-accent-25"
                                        : "translate-x-1 bg-accent-800"
                                }`}
                            />
                        </button>
                    </section>
                )}

                <button
                    type="button"
                    className="mt-auto h-11 rounded-md bg-primary px-4 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => void saveOpenRouterKey()}
                    disabled={isSaving}
                >
                    {isSaving ? "Saving..." : "Save"}
                </button>
            </div>
        </div>
    );
}

function MobileChatListSheet({
    open,
    currentChatId,
    onClose,
    onOpenSettings,
}: {
    open: boolean;
    currentChatId?: string;
    onClose: () => void;
    onOpenSettings: () => void;
}) {
    const navigate = useNavigate();
    const chatsQuery = useQuery(ChatAPI.chatQueries.list());
    const createChat = ChatAPI.useCreateNewChat();
    const deleteChat = ChatAPI.useDeleteChat();

    const mobileChats = useMemo(
        () =>
            chatsQuery.data
                ?.filter((chat) => chat.quickChat && !chat.gcPrototype)
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) ?? [],
        [chatsQuery.data],
    );

    const createNewChat = useCallback(async () => {
        const chatId = await createChat.mutateAsync({
            projectId: "quick-chat",
        });
        navigate(`/chat/${chatId}`);
        onClose();
    }, [createChat, navigate, onClose]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-40 bg-background">
            <div className="flex h-full flex-col mobile-safe-top">
                <div className="flex items-center justify-between border-b px-4 py-3">
                    <h2 className={mobileType.headerTitle}>Chats</h2>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            className={mobileIconButton}
                            onClick={() => {
                                onClose();
                                onOpenSettings();
                            }}
                            aria-label="Open settings"
                        >
                            <SettingsIcon className="size-5" />
                        </button>
                        <button
                            type="button"
                            className={mobileIconButton}
                            onClick={onClose}
                            aria-label="Close chats"
                        >
                            <XIcon className="size-5" />
                        </button>
                    </div>
                </div>

                <div className="relative flex-1 overflow-y-auto px-3 py-3">
                    {mobileChats.map((chat) => (
                        <button
                            key={chat.id}
                            type="button"
                            className={`group flex min-h-16 w-full items-center gap-3 rounded-md px-3 text-left ${
                                chat.id === currentChatId
                                    ? "bg-highlight text-highlight-foreground"
                                    : "hover:bg-muted"
                            }`}
                            onClick={() => {
                                navigate(`/chat/${chat.id}`);
                                onClose();
                            }}
                        >
                            <div className="min-w-0 flex-1">
                                <div className={`truncate ${mobileType.rowTitle}`}>
                                    {chatTitle(chat)}
                                </div>
                                <div className={`mt-0.5 truncate ${mobileType.rowMeta}`}>
                                    {new Date(
                                        chat.updatedAt,
                                    ).toLocaleDateString()}
                                </div>
                            </div>
                            <span
                                role="button"
                                tabIndex={0}
                                className="flex size-8 items-center justify-center rounded-full text-muted-foreground opacity-80 hover:bg-background hover:text-destructive"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    void deleteChat
                                        .mutateAsync({ chatId: chat.id })
                                        .then(() => {
                                            if (chat.id === currentChatId) {
                                                navigate("/");
                                            }
                                        });
                                }}
                                onKeyDown={(event) => {
                                    if (
                                        event.key === "Enter" ||
                                        event.key === " "
                                    ) {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        void deleteChat.mutateAsync({
                                            chatId: chat.id,
                                        });
                                    }
                                }}
                                aria-label={`Delete ${chatTitle(chat)}`}
                            >
                                <Trash2Icon className="size-4" />
                            </span>
                        </button>
                    ))}

                    {mobileChats.length === 0 && (
                        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                            No chats yet
                        </div>
                    )}

                    <button
                        type="button"
                        className={mobileFab}
                        onClick={() => void createNewChat()}
                        aria-label="New chat"
                    >
                        <PlusIcon className="size-6" />
                    </button>
                </div>
            </div>
        </div>
    );
}

function MobileHeader({
    chat,
    onOpenChats,
    onNewChat,
}: {
    chat?: Chat;
    onOpenChats: () => void;
    onNewChat: () => void;
}) {
    const mobileWebSearch = useMobileWebSearchToggle(chat?.id);

    return (
        <header className="mobile-header mobile-safe-top border-b bg-background/95 backdrop-blur-xl">
            <div className="flex min-h-[6.25rem] flex-col justify-center gap-2 px-3 py-2">
                <div className="flex h-11 items-center gap-2">
                    <button
                        type="button"
                        className={mobileIconButton}
                        onClick={onOpenChats}
                        aria-label="Open chats"
                    >
                        <MenuIcon className="size-5" />
                    </button>
                    <div className="min-w-0 flex-1">
                        <div className={`truncate ${mobileType.headerTitle}`}>
                            {chatTitle(chat)}
                        </div>
                    </div>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={mobileWebSearch.enabled}
                        className={`flex size-10 items-center justify-center rounded-full active:bg-muted ${
                            mobileWebSearch.enabled ? mobileWebOn : mobileWebOff
                        }`}
                        onClick={() =>
                            void mobileWebSearch.setEnabled(
                                !mobileWebSearch.enabled,
                            )
                        }
                        disabled={mobileWebSearch.isPending}
                        aria-label={
                            mobileWebSearch.enabled
                                ? "Disable web search for this chat"
                                : "Enable web search for this chat"
                        }
                    >
                        <GlobeIcon className="size-5" />
                    </button>
                    <button
                        type="button"
                        className={mobileIconButton}
                        onClick={onNewChat}
                        aria-label="New chat"
                    >
                        <PlusIcon className="size-5" />
                    </button>
                </div>
                <div className="pl-12 pr-1">
                    <MobileModelSelect compact />
                </div>
            </div>
        </header>
    );
}

function MobileAssistantMessage({ message }: { message: Message }) {
    const modelConfigsQuery = ModelsAPI.useModelConfigs();
    const modelConfig = modelConfigsQuery.data?.find(
        (config) => config.id === message.model,
    );
    const partsWithContent = message.parts.filter(
        (part) => part.content.trim().length > 0,
    );
    const fullText = partsWithContent
        .map((part) => part.content)
        .join("\n")
        .trim();

    return (
        <div className="flex w-full justify-start">
            <div className="min-w-0 max-w-full rounded-md border bg-background px-3.5 py-3 shadow-sm">
                <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                    {modelConfig && (
                        <ProviderLogo
                            provider={getProviderName(modelConfig.modelId)}
                            size="sm"
                        />
                    )}
                    <span className="truncate">
                        {modelConfig?.displayName ?? "Assistant"}
                    </span>
                    {message.state === "streaming" && (
                        <Loader2Icon className="size-3 animate-spin" />
                    )}
                </div>

                {partsWithContent.length > 0 ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                        {partsWithContent.map((part) => (
                            <MessageMarkdown
                                key={`${message.id}-${part.level}`}
                                text={part.content}
                            />
                        ))}
                    </div>
                ) : message.state === "streaming" ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <RetroSpinner />
                        Thinking
                    </div>
                ) : fullText ? (
                    <MessageMarkdown text={fullText} />
                ) : null}

                {message.errorMessage && (
                    <div className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {message.errorMessage}
                    </div>
                )}
            </div>
        </div>
    );
}

function MobileUserMessage({ message }: { message: Message }) {
    const attachments = message.attachments ?? [];

    return (
        <div className="flex w-full justify-end">
            <div className="max-w-[88%] rounded-xl bg-highlight px-4 py-2.5 text-highlight-foreground">
                <div className="whitespace-pre-wrap break-words text-[15px] leading-6">
                    {message.text}
                </div>
                {attachments.length > 0 && (
                    <AttachmentPillsList
                        attachments={attachments}
                        className="mt-2"
                    />
                )}
            </div>
        </div>
    );
}

function MobileMessageSet({
    messageSet,
}: {
    messageSet: MessageSetDetail;
}) {
    if (messageSet.selectedBlockType === "user") {
        return messageSet.userBlock.message ? (
            <MobileUserMessage message={messageSet.userBlock.message} />
        ) : null;
    }

    const selectedToolsMessage =
        messageSet.toolsBlock.chatMessages.find((message) => message.selected) ??
        messageSet.toolsBlock.chatMessages[0];
    const selectedChatMessage = messageSet.chatBlock.message;
    const message = selectedToolsMessage ?? selectedChatMessage;

    if (!message) return null;

    return <MobileAssistantMessage message={message} />;
}

function MobileChatRoute({
    onOpenChats,
}: {
    onOpenChats: () => void;
}) {
    const { chatId } = useParams();
    const navigate = useNavigate();
    const { data: apiKeys } = AppMetadataAPI.useApiKeys();
    const chatQuery = ChatAPI.useChat(chatId ?? "");
    const createChat = ChatAPI.useCreateNewChat();
    const messageSetsQuery = MessageAPI.useMessageSets(chatId ?? "");
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const eyeRef = useRef<MouseTrackingEyeRef>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const scrollToLatestMessageSet = useCallback(() => {
        requestAnimationFrame(() => {
            scrollRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "end",
            });
        });
    }, []);

    useEffect(() => {
        scrollToLatestMessageSet();
    }, [messageSetsQuery.data, scrollToLatestMessageSet]);

    const createNewChat = useCallback(async () => {
        const nextChatId = await createChat.mutateAsync({
            projectId: "quick-chat",
        });
        navigate(`/chat/${nextChatId}`);
    }, [createChat, navigate]);

    if (!apiKeys?.openrouter) {
        return <MobileSettingsPanel showClose={false} />;
    }

    if (chatQuery.isPending || messageSetsQuery.isPending || !chatId) {
        return (
            <div className="flex h-full items-center justify-center bg-background text-sm text-muted-foreground">
                <RetroSpinner />
            </div>
        );
    }

    if (chatQuery.error) {
        return (
            <div className="flex h-full flex-col bg-background">
                <MobileHeader
                    onOpenChats={onOpenChats}
                    onNewChat={() => void createNewChat()}
                />
                <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
                    <div className="text-sm text-muted-foreground">
                        Chat not found
                    </div>
                    <button
                        type="button"
                        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-background"
                        onClick={() => void createNewChat()}
                    >
                        New chat
                    </button>
                </div>
            </div>
        );
    }

    const messageSets = messageSetsQuery.data ?? [];
    const currentMessageSet = messageSets[messageSets.length - 1];
    const isNewChat = chatQuery.data?.isNewChat || messageSets.length === 0;

    return (
        <div className="mobile-app-shell flex h-full flex-col bg-background">
            <MobileHeader
                chat={chatQuery.data}
                onOpenChats={onOpenChats}
                onNewChat={() => void createNewChat()}
            />

            <main className="mobile-chat-scroll flex-1 overflow-y-auto px-3 pt-4">
                {messageSets.length === 0 ? (
                    <div className="flex h-full min-h-[45dvh] flex-col items-center justify-center px-6 text-center">
                        <div className="font-geist-mono text-[11px] uppercase text-muted-foreground">
                            Chorus
                        </div>
                        <h1 className="mt-2 text-xl font-medium">
                            What can Chorus do for you?
                        </h1>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4 pb-4">
                        {messageSets.map((messageSet) => (
                            <MobileMessageSet
                                key={messageSet.id}
                                messageSet={messageSet}
                            />
                        ))}
                    </div>
                )}
                <div ref={scrollRef} />
            </main>

            <div className="relative shrink-0">
                <ChatInput
                    chatId={chatId}
                    isNewChat={isNewChat}
                    currentMessageSet={currentMessageSet}
                    inputRef={inputRef}
                    eyeRef={eyeRef}
                    scrollToLatestMessageSet={scrollToLatestMessageSet}
                    sentAttachmentTypes={[]}
                />
            </div>
        </div>
    );
}

function MobileHome() {
    const navigate = useNavigate();
    const { data: apiKeys } = AppMetadataAPI.useApiKeys();
    const chatsQuery = useQuery(ChatAPI.chatQueries.list());
    const createChat = ChatAPI.useCreateNewChat();

    const mobileChats = useMemo(
        () =>
            chatsQuery.data
                ?.filter((chat) => chat.quickChat && !chat.gcPrototype)
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) ?? [],
        [chatsQuery.data],
    );

    const createNewChat = useCallback(async () => {
        const chatId = await createChat.mutateAsync({
            projectId: "quick-chat",
        });
        navigate(`/chat/${chatId}`);
    }, [createChat, navigate]);

    if (!apiKeys?.openrouter) {
        return <MobileSettingsPanel showClose={false} />;
    }

    return (
        <div className="flex h-full flex-col bg-background mobile-safe-top">
            <header className="flex min-h-16 items-center justify-between border-b px-4">
                <div>
                    <h1 className={mobileType.screenTitle}>Chats</h1>
                    <div className={`mt-0.5 ${mobileType.rowMeta}`}>
                        {mobileChats.length === 1
                            ? "1 conversation"
                            : `${mobileChats.length} conversations`}
                    </div>
                </div>
                <button
                    type="button"
                    className={mobileIconButton}
                    onClick={() => navigate("/settings")}
                    aria-label="Open settings"
                >
                    <SettingsIcon className="size-5" />
                </button>
            </header>

            <main className="relative flex-1 overflow-y-auto px-3 py-3">
                {chatsQuery.isPending ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        <RetroSpinner />
                    </div>
                ) : mobileChats.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                        <h2 className="text-lg font-medium">No chats yet</h2>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            Start a chat and Chorus will keep it here.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-1 pb-24">
                        {mobileChats.map((chat) => (
                            <button
                                key={chat.id}
                                type="button"
                                className="flex min-h-16 w-full items-center rounded-md px-3 text-left active:bg-muted"
                                onClick={() => navigate(`/chat/${chat.id}`)}
                            >
                                <div className="min-w-0 flex-1">
                                    <div className={`truncate ${mobileType.rowTitle}`}>
                                        {chatTitle(chat)}
                                    </div>
                                    <div className={`mt-0.5 truncate ${mobileType.rowMeta}`}>
                                        {new Date(
                                            chat.updatedAt,
                                        ).toLocaleDateString()}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                <button
                    type="button"
                    className={mobileFab}
                    onClick={() => void createNewChat()}
                    aria-label="New chat"
                >
                    <PlusIcon className="size-6" />
                </button>
            </main>
        </div>
    );
}

function MobileSettingsRoute() {
    const navigate = useNavigate();

    return <MobileSettingsPanel onClose={() => navigate("/")} />;
}

export default function MobileApp() {
    useStableMobileViewport();

    const { mode } = useTheme();
    const [isChatListOpen, setIsChatListOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const currentChatId = location.pathname.match(/^\/chat\/([^/]+)$/)?.[1];

    const toasterTheme =
        mode === "system"
            ? window.matchMedia("(prefers-color-scheme: dark)").matches
                ? "dark"
                : "light"
            : mode;

    return (
        <div className="mobile-app overflow-hidden bg-background text-foreground">
            <MobileModelBootstrap />
            <Routes>
                <Route
                    path="/chat/:chatId"
                    element={
                        <MobileChatRoute
                            onOpenChats={() => setIsChatListOpen(true)}
                        />
                    }
                />
                <Route path="/settings" element={<MobileSettingsRoute />} />
                <Route path="*" element={<MobileHome />} />
            </Routes>

            <MobileChatListSheet
                open={isChatListOpen}
                currentChatId={currentChatId}
                onClose={() => setIsChatListOpen(false)}
                onOpenSettings={() => navigate("/settings")}
            />

            <Toaster
                theme={toasterTheme}
                position="bottom-center"
                closeButton
            />
        </div>
    );
}
