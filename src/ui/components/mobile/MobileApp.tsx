import {
    memo,
    useCallback,
    useDeferredValue,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { createPortal } from "react-dom";
import {
    Route,
    Routes,
    useLocation,
    useNavigate,
    useParams,
} from "react-router-dom";
import {
    ArrowLeftIcon,
    BrainCircuitIcon,
    CircleCheckIcon,
    CircleXIcon,
    CheckIcon,
    ChevronDownIcon,
    EllipsisVerticalIcon,
    GlobeIcon,
    InfoIcon,
    KeyRoundIcon,
    Loader2Icon,
    MenuIcon,
    MonitorIcon,
    MoonIcon,
    PencilIcon,
    PinIcon,
    PinOffIcon,
    PlusIcon,
    RefreshCcwIcon,
    SearchIcon,
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
import { Switch } from "@ui/components/ui/switch";
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
import * as ModelConfigChatAPI from "@core/chorus/api/ModelConfigChatAPI";
import * as ModelsAPI from "@core/chorus/api/ModelsAPI";
import * as ToolPermissionsAPI from "@core/chorus/api/ToolPermissionsAPI";

const settingsManager = SettingsManager.getInstance();

const mobileType = {
    appTitle: "text-[1.75rem] font-semibold leading-8",
    screenTitle: "text-[1.375rem] font-semibold leading-7",
    headerTitle: "text-base font-medium leading-6",
    rowTitle: "text-base font-medium leading-6",
    rowMeta: "text-sm leading-5 text-muted-foreground",
    body: "text-base leading-6",
    label: "text-base font-semibold leading-6",
    caption: "text-sm leading-5 text-muted-foreground",
} as const;

const mobileSettingsType = {
    title: mobileType.screenTitle,
    section: "text-base font-semibold leading-6",
    control: "text-base font-medium leading-6",
    supporting: "text-sm font-normal leading-5 text-muted-foreground",
} as const;

const mobileIconButton =
    "flex size-10 shrink-0 items-center justify-center rounded-full active:bg-muted";
const mobileHeaderAction =
    "flex size-10 shrink-0 items-center justify-center rounded-full border border-accent-800/70 text-accent-800 active:bg-accent-100 disabled:opacity-50 dark:text-accent-25 dark:active:bg-accent-900";

const mobileFab =
    "fixed bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] right-5 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-background shadow-md active:scale-95";

const mobileWebOn = "border-accent-800 bg-accent-800 !text-accent-25";

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
    if (chat.title?.trim()) return chat.title.trim();
    if (chat.isNewChat) return "New chat";
    return "Untitled";
}

function formatChatDate(updatedAt: string) {
    const date = new Date(updatedAt);
    const today = new Date();
    const sameDay =
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate();

    if (sameDay) {
        return date.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
        });
    }

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const wasYesterday =
        date.getFullYear() === yesterday.getFullYear() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getDate() === yesterday.getDate();

    if (wasYesterday) return "Yesterday";

    return date.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year:
            date.getFullYear() === today.getFullYear() ? undefined : "numeric",
    });
}

function mobileChatList(chats: Chat[] | undefined, query = "") {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    return (
        chats
            ?.filter((chat) => chat.quickChat && !chat.gcPrototype)
            .filter(
                (chat) =>
                    !normalizedQuery ||
                    chatTitle(chat)
                        .toLocaleLowerCase()
                        .includes(normalizedQuery),
            ) ?? []
    );
}

function MobileChatSearch({
    value,
    onChange,
}: {
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <div className="mobile-chat-search flex h-11 items-center gap-2 rounded-md bg-foreground/[0.055] px-3 transition-colors focus-within:bg-foreground/[0.075] focus-within:ring-1 focus-within:ring-foreground/15">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
            <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder="Search chats"
                aria-label="Search chats"
                className="mobile-chat-search-input min-w-0 flex-1 !border-0 !bg-transparent !p-0 text-base leading-6 !shadow-none !ring-0 outline-none placeholder:text-foreground/55 focus:!border-0 focus:!ring-0"
            />
            {value && (
                <button
                    type="button"
                    className="flex size-7 items-center justify-center rounded-full text-muted-foreground active:bg-foreground/10"
                    onClick={() => onChange("")}
                    aria-label="Clear chat search"
                >
                    <XIcon className="size-3.5" />
                </button>
            )}
        </div>
    );
}

const MobileChatRow = memo(function MobileChatRow({
    chat,
    active = false,
    onOpen,
    onManage,
}: {
    chat: Chat;
    active?: boolean;
    onOpen: () => void;
    onManage: () => void;
}) {
    return (
        <div
            className={`mobile-chat-row flex min-h-[4.5rem] items-center rounded-md ${
                active ? "bg-highlight text-highlight-foreground" : ""
            }`}
        >
            <button
                type="button"
                className="flex min-h-[4.5rem] min-w-0 flex-1 items-center gap-3 rounded-md px-3 text-left active:bg-muted"
                onClick={onOpen}
                aria-current={active ? "page" : undefined}
            >
                {chat.pinned && (
                    <PinIcon
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-label="Pinned"
                    />
                )}
                <div className="min-w-0 flex-1">
                    <div className={`truncate ${mobileType.rowTitle}`}>
                        {chatTitle(chat)}
                    </div>
                    <div className={`mt-0.5 truncate ${mobileType.rowMeta}`}>
                        {formatChatDate(chat.updatedAt)}
                    </div>
                </div>
            </button>
            <button
                type="button"
                className="mr-1 flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted active:text-foreground"
                onClick={onManage}
                aria-label={`Manage ${chatTitle(chat)}`}
            >
                <EllipsisVerticalIcon className="size-5" />
            </button>
        </div>
    );
});

function MobileChatActionsSheet({
    chat,
    onClose,
    onDeleted,
}: {
    chat: Chat | null;
    onClose: () => void;
    onDeleted: (chatId: string) => void;
}) {
    const renameChat = ChatAPI.useRenameChat();
    const deleteChat = ChatAPI.useDeleteChat();
    const togglePin = ChatAPI.useTogglePinChat();
    const [title, setTitle] = useState("");
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => {
        setTitle(chat ? chatTitle(chat) : "");
        setConfirmDelete(false);
    }, [chat]);

    useEffect(() => {
        if (!chat) return;

        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [chat, onClose]);

    if (!chat) return null;

    const trimmedTitle = title.trim();
    const titleChanged =
        trimmedTitle.length > 0 && trimmedTitle !== chatTitle(chat);
    const isPending =
        renameChat.isPending || deleteChat.isPending || togglePin.isPending;

    const saveTitle = async () => {
        if (!titleChanged) return;
        await renameChat.mutateAsync({
            chatId: chat.id,
            newTitle: trimmedTitle,
        });
        toast.success("Chat renamed");
        onClose();
    };

    const handleDelete = async () => {
        await deleteChat.mutateAsync({ chatId: chat.id });
        toast.success("Chat deleted");
        onDeleted(chat.id);
        onClose();
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[80] flex items-end bg-black/35"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-chat-actions-title"
            onClick={onClose}
        >
            <div
                className="w-full rounded-t-xl bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-lg"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/30" />
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2
                            id="mobile-chat-actions-title"
                            className={mobileType.headerTitle}
                        >
                            Manage chat
                        </h2>
                        <div className={`mt-1 truncate ${mobileType.caption}`}>
                            {chatTitle(chat)}
                        </div>
                    </div>
                    <button
                        type="button"
                        className={mobileIconButton}
                        onClick={onClose}
                        aria-label="Close chat actions"
                    >
                        <XIcon className="size-5" />
                    </button>
                </div>

                {confirmDelete ? (
                    <div className="py-5">
                        <div className="text-base font-medium">
                            Delete this chat?
                        </div>
                        <p
                            className={`mt-1 ${mobileType.body} text-muted-foreground`}
                        >
                            This permanently removes the conversation and its
                            messages from this device.
                        </p>
                        <div className="mt-5 grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                className="h-11 rounded-md border font-medium active:bg-muted"
                                onClick={() => setConfirmDelete(false)}
                                disabled={isPending}
                            >
                                Keep chat
                            </button>
                            <button
                                type="button"
                                className="h-11 rounded-md bg-destructive font-medium text-destructive-foreground disabled:opacity-60"
                                onClick={() => void handleDelete()}
                                disabled={isPending}
                            >
                                {deleteChat.isPending
                                    ? "Deleting..."
                                    : "Delete chat"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3 py-3">
                        <label className="flex flex-col gap-1.5">
                            <span className={mobileType.label}>Title</span>
                            <div className="flex gap-2">
                                <input
                                    value={title}
                                    onChange={(event) =>
                                        setTitle(event.target.value)
                                    }
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                            void saveTitle();
                                        }
                                    }}
                                    maxLength={120}
                                    className={`h-11 min-w-0 flex-1 rounded-md border bg-background px-3 outline-none focus:ring-2 focus:ring-ring ${mobileSettingsType.control}`}
                                />
                                <button
                                    type="button"
                                    className={`flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-background disabled:opacity-50 ${mobileSettingsType.control}`}
                                    onClick={() => void saveTitle()}
                                    disabled={!titleChanged || isPending}
                                >
                                    <PencilIcon className="size-4" />
                                    Save
                                </button>
                            </div>
                        </label>

                        <button
                            type="button"
                            className="flex h-12 items-center gap-3 rounded-md px-3 text-left active:bg-muted"
                            onClick={() =>
                                void togglePin
                                    .mutateAsync({
                                        chatId: chat.id,
                                        pinned: !chat.pinned,
                                    })
                                    .then(() => {
                                        toast.success(
                                            chat.pinned
                                                ? "Chat unpinned"
                                                : "Chat pinned",
                                        );
                                        onClose();
                                    })
                            }
                            disabled={isPending}
                        >
                            {chat.pinned ? (
                                <PinOffIcon className="size-5" />
                            ) : (
                                <PinIcon className="size-5" />
                            )}
                            <span className="font-medium">
                                {chat.pinned ? "Unpin chat" : "Pin chat"}
                            </span>
                        </button>

                        <button
                            type="button"
                            className="flex h-12 items-center gap-3 rounded-md px-3 text-left text-destructive active:bg-destructive/10"
                            onClick={() => setConfirmDelete(true)}
                            disabled={isPending}
                        >
                            <Trash2Icon className="size-5" />
                            <span className="font-medium">Delete chat</span>
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body,
    );
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
        window.addEventListener("orientationchange", updateViewportState);
        window.visualViewport?.addEventListener("resize", updateViewportState);
        document.addEventListener("focusin", updateKeyboardState);
        document.addEventListener("focusout", updateKeyboardState);

        return () => {
            window.removeEventListener(
                "orientationchange",
                updateViewportState,
            );
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
    const updateQuickChatModel =
        MessageAPI.useUpdateSelectedModelConfigQuickChat();
    const refreshOpenRouterModels = ModelsAPI.useRefreshOpenRouterModels();
    const refreshAttemptedRef = useRef(false);

    const openRouterModels = useMemo(
        () => openRouterModelConfigs(modelConfigsQuery.data),
        [modelConfigsQuery.data],
    );

    useEffect(() => {
        if (!apiKeys?.openrouter) {
            refreshAttemptedRef.current = false;
            return;
        }

        if (
            !modelConfigsQuery.isPending &&
            openRouterModels.length === 0 &&
            !refreshOpenRouterModels.isPending &&
            !refreshAttemptedRef.current
        ) {
            refreshAttemptedRef.current = true;
            refreshOpenRouterModels.mutate(undefined, {
                onError: () => {
                    refreshAttemptedRef.current = false;
                },
            });
        }
    }, [
        apiKeys?.openrouter,
        modelConfigsQuery.isPending,
        openRouterModels.length,
        refreshOpenRouterModels,
    ]);

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

function MobileModelSelect({
    compact = false,
    chatId,
}: {
    compact?: boolean;
    chatId?: string;
}) {
    const modelConfigsQuery = ModelsAPI.useModelConfigs();
    const selectedQuickChatModel = ModelsAPI.useSelectedModelConfigQuickChat();
    const updateQuickChatModel =
        MessageAPI.useUpdateSelectedModelConfigQuickChat();
    const savedChatModel = ModelConfigChatAPI.useSavedModelConfigChat(chatId);
    const updateSavedChatModel =
        ModelConfigChatAPI.useUpdateSavedModelConfigChat();
    const refreshOpenRouterModels = ModelsAPI.useRefreshOpenRouterModels();
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [refreshState, setRefreshState] = useState<
        "idle" | "success" | "error"
    >("idle");
    const refreshResetTimer = useRef<number>();

    const openRouterModels = useMemo(
        () => openRouterModelConfigs(modelConfigsQuery.data),
        [modelConfigsQuery.data],
    );
    const selectedModel =
        (chatId
            ? openRouterModels.find(
                  (model) => model.id === savedChatModel.data?.[0],
              )
            : undefined) ?? selectedQuickChatModel.data;

    useEffect(
        () => () => {
            if (refreshResetTimer.current) {
                window.clearTimeout(refreshResetTimer.current);
            }
        },
        [],
    );

    const refreshModels = () => {
        setRefreshState("idle");
        refreshOpenRouterModels.mutate(undefined, {
            onSuccess: () => {
                setRefreshState("success");
                refreshResetTimer.current = window.setTimeout(
                    () => setRefreshState("idle"),
                    2200,
                );
            },
            onError: () => {
                setRefreshState("error");
                refreshResetTimer.current = window.setTimeout(
                    () => setRefreshState("idle"),
                    2600,
                );
            },
        });
    };

    if (modelConfigsQuery.isPending && !selectedModel) {
        if (compact) {
            return (
                <button
                    type="button"
                    className={mobileHeaderAction}
                    disabled
                    aria-label="Loading models"
                >
                    <Loader2Icon className="size-5 animate-spin" />
                </button>
            );
        }

        return (
            <div
                className={`flex items-center gap-2 ${mobileSettingsType.supporting}`}
            >
                <Loader2Icon className="size-3.5 animate-spin" />
                Models
            </div>
        );
    }

    if (modelConfigsQuery.isError && !selectedModel) {
        if (compact) {
            return (
                <button
                    type="button"
                    className={mobileHeaderAction}
                    onClick={refreshModels}
                    disabled={refreshOpenRouterModels.isPending}
                    aria-label="Retry loading models"
                >
                    <RefreshCcwIcon
                        className={`size-5 ${
                            refreshOpenRouterModels.isPending
                                ? "animate-spin"
                                : ""
                        }`}
                    />
                </button>
            );
        }

        return (
            <button
                type="button"
                className={`flex h-11 w-full items-center gap-2 rounded-md border px-3 text-left active:bg-muted ${mobileSettingsType.control}`}
                onClick={refreshModels}
                disabled={refreshOpenRouterModels.isPending}
            >
                <RefreshCcwIcon
                    className={`size-4 ${
                        refreshOpenRouterModels.isPending ? "animate-spin" : ""
                    }`}
                />
                Retry models
            </button>
        );
    }

    return (
        <div className={compact ? "shrink-0" : "flex flex-col gap-2"}>
            {!compact && (
                <div className="flex items-center justify-between">
                    <label className={mobileSettingsType.section}>Model</label>
                    <button
                        type="button"
                        className={`flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-muted hover:text-foreground ${mobileSettingsType.supporting}`}
                        onClick={refreshModels}
                        disabled={refreshOpenRouterModels.isPending}
                        aria-live="polite"
                    >
                        {refreshOpenRouterModels.isPending ? (
                            <Loader2Icon className="size-3.5 animate-spin" />
                        ) : refreshState === "success" ? (
                            <CheckIcon className="size-3.5" />
                        ) : refreshState === "error" ? (
                            <XIcon className="size-3.5" />
                        ) : (
                            <RefreshCcwIcon className="size-3.5" />
                        )}
                        {refreshOpenRouterModels.isPending
                            ? "Refreshing"
                            : refreshState === "success"
                              ? "Updated"
                              : refreshState === "error"
                                ? "Retry"
                                : "Refresh"}
                    </button>
                </div>
            )}
            <button
                type="button"
                className={
                    compact
                        ? mobileHeaderAction
                        : `flex h-11 w-full items-center gap-2 rounded-md border bg-background px-3 text-left active:bg-muted ${mobileSettingsType.control}`
                }
                onClick={() => setIsPickerOpen(true)}
                disabled={openRouterModels.length === 0}
                aria-label={
                    selectedModel
                        ? `Choose model. Current model: ${selectedModel.displayName}`
                        : "Choose model"
                }
            >
                {compact ? (
                    <BrainCircuitIcon className="size-5" />
                ) : (
                    <>
                        {selectedModel && (
                            <ProviderLogo
                                provider={getProviderName(
                                    selectedModel.modelId,
                                )}
                                size="sm"
                            />
                        )}
                        <span className="min-w-0 flex-1 truncate">
                            {selectedModel?.displayName ??
                                "No OpenRouter models"}
                        </span>
                        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
                    </>
                )}
            </button>

            {isPickerOpen && (
                <MobileModelPickerSheet
                    models={openRouterModels}
                    selectedModelId={selectedModel?.id}
                    onClose={() => setIsPickerOpen(false)}
                    onSelect={(modelConfig) => {
                        if (chatId) {
                            updateSavedChatModel.mutate({
                                chatId,
                                modelIds: [modelConfig.id],
                            });
                        } else {
                            updateQuickChatModel.mutate({ modelConfig });
                        }
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
    const [query, setQuery] = useState("");
    const filteredModels = useMemo(() => {
        const normalizedQuery = query.trim().toLocaleLowerCase();
        if (!normalizedQuery) return models;

        return models.filter((model) =>
            `${model.displayName} ${model.modelId}`
                .toLocaleLowerCase()
                .includes(normalizedQuery),
        );
    }, [models, query]);

    useEffect(() => {
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [onClose]);

    return createPortal(
        <div
            className="fixed inset-0 z-[70] bg-background"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-model-picker-title"
        >
            <div className="flex h-full min-h-0 flex-col mobile-safe-top">
                <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
                    <div className="min-w-0">
                        <h2
                            id="mobile-model-picker-title"
                            className={mobileType.headerTitle}
                        >
                            Choose model
                        </h2>
                        <div className={mobileType.caption}>
                            {models.length} OpenRouter models
                        </div>
                    </div>
                    <button
                        type="button"
                        className={mobileIconButton}
                        onClick={onClose}
                        aria-label="Close model picker"
                    >
                        <XIcon className="size-5" />
                    </button>
                </div>
                <div className="shrink-0 border-b px-3 py-3">
                    <label className="flex h-11 items-center gap-2 rounded-md border bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
                        <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search models"
                            autoCapitalize="none"
                            autoCorrect="off"
                            className={`min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground ${mobileSettingsType.control}`}
                        />
                    </label>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
                    {filteredModels.map((modelConfig) => {
                        const selected = modelConfig.id === selectedModelId;
                        return (
                            <button
                                key={modelConfig.id}
                                type="button"
                                className={`mobile-model-row flex min-h-14 w-full items-center gap-3 rounded-md px-3 py-2 text-left ${
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
                                <span
                                    className={`min-w-0 flex-1 truncate ${mobileType.rowTitle}`}
                                >
                                    {modelConfig.displayName}
                                </span>
                                {selected && (
                                    <CheckIcon className="size-4 shrink-0" />
                                )}
                            </button>
                        );
                    })}
                    {filteredModels.length === 0 && (
                        <div className="flex min-h-40 items-center justify-center px-6 text-center text-sm text-muted-foreground">
                            No models match “{query.trim()}”
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body,
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
    const [connectionState, setConnectionState] = useState<
        "idle" | "testing" | "success" | "error"
    >("idle");

    useEffect(() => {
        setOpenRouterKey(apiKeys?.openrouter ?? "");
        setConnectionState("idle");
    }, [apiKeys?.openrouter]);

    const testOpenRouterConnection = useCallback(async () => {
        const trimmedKey = openRouterKey.trim();
        if (!trimmedKey) return;

        setConnectionState("testing");
        const connected =
            await AppMetadataAPI.testOpenRouterConnection(trimmedKey);
        setConnectionState(connected ? "success" : "error");
    }, [openRouterKey]);

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
                    <h2 className={mobileSettingsType.title}>Settings</h2>
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
                    <div className={mobileSettingsType.section}>Appearance</div>
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
                                    className={`flex h-11 items-center justify-center gap-1.5 rounded-md border ${mobileSettingsType.control} ${
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
                        className={mobileSettingsType.section}
                        htmlFor="mobile-openrouter-key"
                    >
                        OpenRouter API key
                    </label>
                    <input
                        id="mobile-openrouter-key"
                        value={openRouterKey}
                        onChange={(event) => {
                            setOpenRouterKey(event.target.value);
                            setConnectionState("idle");
                        }}
                        placeholder="sk-or-v1-..."
                        type="password"
                        autoCapitalize="none"
                        autoCorrect="off"
                        className={`h-11 rounded-md border bg-background px-3 outline-none focus:ring-2 focus:ring-ring ${mobileSettingsType.control}`}
                    />
                    <button
                        type="button"
                        className={`flex h-11 items-center justify-center gap-2 rounded-md border bg-background active:bg-muted disabled:opacity-55 ${mobileSettingsType.control}`}
                        onClick={() => void testOpenRouterConnection()}
                        disabled={
                            !openRouterKey.trim() ||
                            connectionState === "testing"
                        }
                        aria-live="polite"
                    >
                        {connectionState === "testing" ? (
                            <Loader2Icon className="size-4 animate-spin" />
                        ) : connectionState === "success" ? (
                            <CheckIcon className="size-4" />
                        ) : connectionState === "error" ? (
                            <XIcon className="size-4" />
                        ) : (
                            <KeyRoundIcon className="size-4" />
                        )}
                        {connectionState === "testing"
                            ? "Testing connection"
                            : connectionState === "success"
                              ? "Connected"
                              : connectionState === "error"
                                ? "Connection failed"
                                : "Test connection"}
                    </button>
                </section>

                {hasOpenRouterKey && <MobileModelSelect />}

                {hasOpenRouterKey && (
                    <section className="flex items-center justify-between gap-4 rounded-md border px-3 py-3">
                        <div className="min-w-0">
                            <div
                                className={`flex items-center gap-2 ${mobileSettingsType.section}`}
                            >
                                <GlobeIcon className="size-4 text-muted-foreground" />
                                Default web search
                            </div>
                            <div
                                className={`mt-1 ${mobileSettingsType.supporting}`}
                            >
                                Use web search automatically in new chats.
                            </div>
                        </div>
                        <Switch
                            checked={mobileWebSearch.enabled}
                            onCheckedChange={(checked) =>
                                void mobileWebSearch.setEnabled(checked)
                            }
                            disabled={mobileWebSearch.isPending}
                            aria-label="Use web search automatically in new chats"
                            className="data-[state=checked]:bg-accent-800 data-[state=unchecked]:bg-muted-foreground/35"
                        />
                    </section>
                )}

                <button
                    type="button"
                    className={`mt-auto h-12 rounded-md bg-primary px-4 text-background disabled:cursor-not-allowed disabled:opacity-60 ${mobileSettingsType.control}`}
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
    const openNewChat = ChatAPI.useGetOrCreateNewQuickChat();
    const [query, setQuery] = useState("");
    const deferredQuery = useDeferredValue(query);
    const [managedChat, setManagedChat] = useState<Chat | null>(null);

    const mobileChats = useMemo(
        () => mobileChatList(chatsQuery.data, deferredQuery),
        [chatsQuery.data, deferredQuery],
    );

    const createNewChat = useCallback(async () => {
        await openNewChat.mutateAsync();
        onClose();
    }, [onClose, openNewChat]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-40 bg-background">
            <div className="flex h-full flex-col mobile-safe-top">
                <header className="shrink-0 border-b px-4 pb-3">
                    <div className="flex min-h-14 items-center justify-between">
                        <div>
                            <h2 className={mobileType.headerTitle}>Chats</h2>
                            <div className={mobileType.caption}>
                                {mobileChatList(chatsQuery.data).length} chats
                            </div>
                        </div>
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
                    <MobileChatSearch value={query} onChange={setQuery} />
                </header>

                <div className="relative min-h-0 flex-1 overflow-y-auto px-3 py-3">
                    <div className="flex flex-col gap-1 pb-24">
                        {mobileChats.map((chat) => (
                            <MobileChatRow
                                key={chat.id}
                                chat={chat}
                                active={chat.id === currentChatId}
                                onOpen={() => {
                                    navigate(`/chat/${chat.id}`);
                                    onClose();
                                }}
                                onManage={() => setManagedChat(chat)}
                            />
                        ))}
                    </div>

                    {mobileChats.length === 0 && (
                        <div className="flex min-h-56 flex-col items-center justify-center px-8 text-center">
                            <div className="text-base font-medium">
                                {query ? "No matching chats" : "No chats yet"}
                            </div>
                            <div className="mt-1 text-sm leading-6 text-muted-foreground">
                                {query
                                    ? "Try a different title."
                                    : "Start a conversation and Chorus will keep it here."}
                            </div>
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
            <MobileChatActionsSheet
                chat={managedChat}
                onClose={() => setManagedChat(null)}
                onDeleted={(chatId) => {
                    if (chatId === currentChatId) {
                        navigate("/");
                        onClose();
                    }
                }}
            />
        </div>
    );
}

function MobileHeader({
    chat,
    onBack,
    onOpenChats,
    onNewChat,
}: {
    chat?: Chat;
    onBack?: () => void;
    onOpenChats: () => void;
    onNewChat: () => void;
}) {
    const mobileWebSearch = useMobileWebSearchToggle(chat?.id);
    const fullTitle = chatTitle(chat);

    return (
        <header className="mobile-header mobile-safe-top border-b bg-background/95 backdrop-blur-xl">
            <div className="flex h-16 items-center gap-2 px-3">
                <button
                    type="button"
                    className={mobileIconButton}
                    onClick={onBack ?? onOpenChats}
                    aria-label={onBack ? "Back to chats" : "Open chats"}
                >
                    {onBack ? (
                        <ArrowLeftIcon className="size-5" />
                    ) : (
                        <MenuIcon className="size-5" />
                    )}
                </button>
                <div className="min-w-0 flex-1">
                    <h1
                        className={`truncate ${mobileType.headerTitle}`}
                        title={fullTitle}
                        aria-label={`Chat title: ${fullTitle}`}
                    >
                        {fullTitle}
                    </h1>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <MobileModelSelect compact chatId={chat?.id} />
                    <button
                        type="button"
                        role="switch"
                        aria-checked={mobileWebSearch.enabled}
                        className={`${mobileHeaderAction} ${
                            mobileWebSearch.enabled ? mobileWebOn : ""
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
                        className={mobileHeaderAction}
                        onClick={onNewChat}
                        aria-label="New chat"
                    >
                        <PlusIcon className="size-5" />
                    </button>
                </div>
            </div>
        </header>
    );
}

function MobileAssistantMessage({
    message,
    modelConfig,
}: {
    message: Message;
    modelConfig?: ModelConfig;
}) {
    const restartToolsMessage = MessageAPI.useRestartMessage(
        message.chatId,
        message.messageSetId,
        message.id,
    );
    const restartLegacyMessage = MessageAPI.useRestartMessageLegacy(
        message.chatId,
        message.messageSetId,
        message.id,
    );
    const partsWithContent = message.parts.filter(
        (part) => part.content.trim().length > 0,
    );
    const fullText = partsWithContent
        .map((part) => part.content)
        .join("\n")
        .trim();
    const isRetrying =
        restartToolsMessage.isPending || restartLegacyMessage.isPending;

    const retryResponse = useCallback(() => {
        if (!modelConfig || isRetrying) return;

        const restart =
            message.blockType === "tools"
                ? restartToolsMessage
                : restartLegacyMessage;
        void restart.mutateAsync({ modelConfig });
    }, [
        isRetrying,
        message.blockType,
        modelConfig,
        restartLegacyMessage,
        restartToolsMessage,
    ]);

    return (
        <div className="flex w-full justify-start">
            <div className="relative max-w-full overflow-y-auto rounded-xl border !border-special px-3.5 py-2.5 text-base">
                {partsWithContent.length > 0 ? (
                    <div className="max-w-none break-words">
                        {partsWithContent.map((part) => (
                            <MessageMarkdown
                                key={`${message.id}-${part.level}`}
                                text={part.content}
                            />
                        ))}
                    </div>
                ) : message.state === "streaming" ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <RetroSpinner />
                    </div>
                ) : fullText ? (
                    <MessageMarkdown text={fullText} />
                ) : null}

                {message.errorMessage && (
                    <div className="mt-3 text-destructive">
                        <div className="font-medium">
                            {message.errorMessage}
                        </div>
                        <button
                            type="button"
                            className="mt-3 flex h-10 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium text-foreground active:bg-muted disabled:opacity-50"
                            onClick={retryResponse}
                            disabled={!modelConfig || isRetrying}
                        >
                            <RefreshCcwIcon
                                className={`size-4 ${
                                    isRetrying ? "animate-spin" : ""
                                }`}
                            />
                            Retry response
                        </button>
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
            <div className="max-w-[88%] rounded-xl bg-highlight px-4 py-2 text-highlight-foreground">
                <div className="whitespace-pre-wrap break-words text-base">
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

const MobileMessageSet = memo(function MobileMessageSet({
    messageSet,
    modelConfigsById,
}: {
    messageSet: MessageSetDetail;
    modelConfigsById: Map<string, ModelConfig>;
}) {
    if (messageSet.selectedBlockType === "user") {
        return messageSet.userBlock.message ? (
            <MobileUserMessage message={messageSet.userBlock.message} />
        ) : null;
    }

    const selectedToolsMessage =
        messageSet.toolsBlock.chatMessages.find(
            (message) => message.selected,
        ) ?? messageSet.toolsBlock.chatMessages[0];
    const selectedChatMessage = messageSet.chatBlock.message;
    const message = selectedToolsMessage ?? selectedChatMessage;

    if (!message) return null;

    return (
        <MobileAssistantMessage
            message={message}
            modelConfig={modelConfigsById.get(message.model)}
        />
    );
});

function mobileAssistantMessages(messageSets: MessageSetDetail[]) {
    return messageSets.flatMap((messageSet) => {
        if (messageSet.selectedBlockType === "user") return [];

        const selectedToolsMessage =
            messageSet.toolsBlock.chatMessages.find(
                (message) => message.selected,
            ) ?? messageSet.toolsBlock.chatMessages[0];
        const message = selectedToolsMessage ?? messageSet.chatBlock.message;
        return message ? [message] : [];
    });
}

function mobileMessageProgress(message: Message) {
    return `${message.text.length}:${message.parts
        .map((part) => part.content.length)
        .join(",")}`;
}

function MobileChatRoute({ onOpenChats }: { onOpenChats: () => void }) {
    const { chatId } = useParams();
    const navigate = useNavigate();
    const { data: apiKeys } = AppMetadataAPI.useApiKeys();
    const chatQuery = ChatAPI.useChat(chatId ?? "");
    const createNewChatMutation = ChatAPI.useCreateNewChat();
    const discardDisposableChat = ChatAPI.useDiscardDisposableQuickChat();
    const messageSetsQuery = MessageAPI.useMessageSets(chatId ?? "");
    const modelConfigsQuery = ModelsAPI.useModelConfigs();
    const stopMessage = MessageAPI.useStopMessage();
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const eyeRef = useRef<MouseTrackingEyeRef>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const streamingMessagesRef = useRef<Message[]>([]);
    const backgroundedStreamsRef = useRef<{
        hiddenAt: number;
        progressById: Map<string, string>;
    } | null>(null);
    const [isLoadSlow, setIsLoadSlow] = useState(false);

    const isLoading =
        chatQuery.isPending || messageSetsQuery.isPending || !chatId;
    const modelConfigsById = useMemo(
        () =>
            new Map(
                (modelConfigsQuery.data ?? []).map((config) => [
                    config.id,
                    config,
                ]),
            ),
        [modelConfigsQuery.data],
    );

    useEffect(() => {
        setIsLoadSlow(false);
        if (!isLoading) return;

        const timeout = window.setTimeout(() => setIsLoadSlow(true), 3000);
        return () => window.clearTimeout(timeout);
    }, [chatId, isLoading]);

    const scrollToLatestMessageSet = useCallback(() => {
        requestAnimationFrame(() => {
            scrollRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "end",
            });
        });
    }, []);

    useEffect(() => {
        requestAnimationFrame(() => {
            scrollRef.current?.scrollIntoView({
                behavior: "auto",
                block: "end",
            });
        });
    }, [messageSetsQuery.data]);

    useEffect(() => {
        streamingMessagesRef.current = mobileAssistantMessages(
            messageSetsQuery.data ?? [],
        ).filter((message) => message.state === "streaming");
    }, [messageSetsQuery.data]);

    useEffect(() => {
        if (!chatId) return;

        let recoveryTimer: number | undefined;
        const handleVisibilityChange = () => {
            if (document.visibilityState === "hidden") {
                const progressById = new Map(
                    streamingMessagesRef.current.map((message) => [
                        message.id,
                        mobileMessageProgress(message),
                    ]),
                );
                backgroundedStreamsRef.current =
                    progressById.size > 0
                        ? { hiddenAt: Date.now(), progressById }
                        : null;
                return;
            }

            const backgrounded = backgroundedStreamsRef.current;
            backgroundedStreamsRef.current = null;
            if (!backgrounded || Date.now() - backgrounded.hiddenAt < 5000) {
                return;
            }

            recoveryTimer = window.setTimeout(() => {
                void messageSetsQuery.refetch().then(async ({ data }) => {
                    const currentMessages = new Map(
                        mobileAssistantMessages(data ?? []).map((message) => [
                            message.id,
                            message,
                        ]),
                    );

                    await Promise.all(
                        Array.from(backgrounded.progressById).map(
                            async ([messageId, previousProgress]) => {
                                const message = currentMessages.get(messageId);
                                if (
                                    message?.state !== "streaming" ||
                                    mobileMessageProgress(message) !==
                                        previousProgress
                                ) {
                                    return;
                                }

                                await stopMessage.mutateAsync({
                                    chatId,
                                    messageId,
                                    errorMessage:
                                        "The response was interrupted while Chorus was in the background.",
                                });
                            },
                        ),
                    );
                });
            }, 2500);
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange,
            );
            if (recoveryTimer !== undefined) {
                window.clearTimeout(recoveryTimer);
            }
        };
    }, [chatId, messageSetsQuery, stopMessage]);

    const createNewChat = useCallback(async () => {
        if (chatId) {
            await discardDisposableChat.mutateAsync({ chatId });
        }
        const newChatId = await createNewChatMutation.mutateAsync({
            projectId: "quick-chat",
        });
        navigate(`/chat/${newChatId}`);
    }, [chatId, createNewChatMutation, discardDisposableChat, navigate]);

    const leaveChat = useCallback(async () => {
        if (chatId) {
            await discardDisposableChat.mutateAsync({ chatId });
        }
        navigate("/");
    }, [chatId, discardDisposableChat, navigate]);

    const retryChat = useCallback(() => {
        void Promise.all([
            chatQuery.refetch(),
            messageSetsQuery.refetch(),
            modelConfigsQuery.refetch(),
        ]);
    }, [chatQuery, messageSetsQuery, modelConfigsQuery]);

    if (!apiKeys?.openrouter) {
        return <MobileSettingsPanel showClose={false} />;
    }

    if (isLoading) {
        return (
            <div className="mobile-app-shell flex h-full flex-col bg-background">
                <MobileHeader
                    chat={chatQuery.data}
                    onBack={() => void leaveChat()}
                    onOpenChats={onOpenChats}
                    onNewChat={() => void createNewChat()}
                />
                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center text-sm text-muted-foreground">
                    <RetroSpinner />
                    <div>
                        {isLoadSlow
                            ? "This chat is taking longer than expected."
                            : "Loading chat..."}
                    </div>
                    {isLoadSlow && (
                        <div className="flex gap-2">
                            <button
                                type="button"
                                className="h-11 rounded-md bg-primary px-4 font-semibold text-background"
                                onClick={retryChat}
                            >
                                Retry
                            </button>
                            <button
                                type="button"
                                className="h-11 rounded-md border bg-background px-4 font-medium text-foreground active:bg-muted"
                                onClick={() => void leaveChat()}
                            >
                                Back to chats
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (chatQuery.error || messageSetsQuery.error) {
        return (
            <div className="flex h-full flex-col bg-background">
                <MobileHeader
                    chat={chatQuery.data}
                    onBack={() => void leaveChat()}
                    onOpenChats={onOpenChats}
                    onNewChat={() => void createNewChat()}
                />
                <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
                    <div>
                        <div className="text-base font-medium">
                            Could not open this chat
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                            Your chat list is still available.
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            className={`h-11 rounded-md bg-primary px-4 text-background ${mobileSettingsType.control}`}
                            onClick={retryChat}
                        >
                            Retry
                        </button>
                        <button
                            type="button"
                            className={`h-11 rounded-md border bg-background px-4 active:bg-muted ${mobileSettingsType.control}`}
                            onClick={() => void leaveChat()}
                        >
                            Back to chats
                        </button>
                    </div>
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
                onBack={() => void leaveChat()}
                onOpenChats={onOpenChats}
                onNewChat={() => void createNewChat()}
            />

            <main className="mobile-chat-scroll flex-1 overflow-y-auto overscroll-contain px-4 pt-4">
                {messageSets.length === 0 ? (
                    <div className="flex h-full min-h-[45dvh] flex-col items-center justify-center px-6 text-center">
                        <div className={mobileType.screenTitle}>Chorus</div>
                        <p
                            className={`mt-2 ${mobileType.body} text-muted-foreground`}
                        >
                            What can I help you with?
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-5 pb-4">
                        {messageSets.map((messageSet) => (
                            <div
                                className="mobile-message-set"
                                key={messageSet.id}
                            >
                                <MobileMessageSet
                                    messageSet={messageSet}
                                    modelConfigsById={modelConfigsById}
                                />
                            </div>
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
    const openNewChat = ChatAPI.useGetOrCreateNewQuickChat();
    const [query, setQuery] = useState("");
    const deferredQuery = useDeferredValue(query);
    const [managedChat, setManagedChat] = useState<Chat | null>(null);

    const allMobileChats = useMemo(
        () => mobileChatList(chatsQuery.data),
        [chatsQuery.data],
    );
    const mobileChats = useMemo(() => {
        const normalizedQuery = deferredQuery.trim().toLocaleLowerCase();
        if (!normalizedQuery) return allMobileChats;
        return allMobileChats.filter((chat) =>
            chatTitle(chat).toLocaleLowerCase().includes(normalizedQuery),
        );
    }, [allMobileChats, deferredQuery]);
    const totalChats = allMobileChats.length;

    const createNewChat = useCallback(async () => {
        await openNewChat.mutateAsync();
    }, [openNewChat]);

    if (!apiKeys?.openrouter) {
        return <MobileSettingsPanel showClose={false} />;
    }

    return (
        <div className="flex h-full flex-col bg-background mobile-safe-top">
            <header className="shrink-0 border-b px-4 pb-3">
                <div className="flex min-h-24 items-center justify-between">
                    <div>
                        <h1 className={mobileType.appTitle}>Chorus</h1>
                        <div className={`mt-0.5 ${mobileType.rowMeta}`}>
                            {totalChats === 1
                                ? "1 chat"
                                : `${totalChats} chats`}
                        </div>
                    </div>
                    <button
                        type="button"
                        className="flex size-12 shrink-0 items-center justify-center rounded-full active:bg-muted"
                        onClick={() => navigate("/settings")}
                        aria-label="Open settings"
                    >
                        <SettingsIcon className="size-6" strokeWidth={2.25} />
                    </button>
                </div>
                <MobileChatSearch value={query} onChange={setQuery} />
            </header>

            <main className="relative min-h-0 flex-1 overflow-y-auto px-3 py-3">
                {chatsQuery.isPending ? (
                    <div className="flex flex-col gap-2 px-3 py-2">
                        {[0, 1, 2, 3, 4].map((index) => (
                            <div
                                key={index}
                                className="h-16 animate-pulse rounded-md bg-muted/60"
                            />
                        ))}
                    </div>
                ) : mobileChats.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                        <h2 className={mobileType.screenTitle}>
                            {query ? "No matching chats" : "No chats yet"}
                        </h2>
                        <p
                            className={`mt-2 ${mobileType.body} text-muted-foreground`}
                        >
                            {query
                                ? "Try another title or clear the search."
                                : "Start a conversation and Chorus will keep it here."}
                        </p>
                        {query && (
                            <button
                                type="button"
                                className="mt-4 rounded-md border px-4 py-2 text-sm font-medium active:bg-muted"
                                onClick={() => setQuery("")}
                            >
                                Clear search
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col gap-1 pb-24">
                        {mobileChats.map((chat) => (
                            <MobileChatRow
                                key={chat.id}
                                chat={chat}
                                onOpen={() => navigate(`/chat/${chat.id}`)}
                                onManage={() => setManagedChat(chat)}
                            />
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
            <MobileChatActionsSheet
                chat={managedChat}
                onClose={() => setManagedChat(null)}
                onDeleted={() => undefined}
            />
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
                position="top-center"
                duration={2600}
                gap={8}
                visibleToasts={2}
                mobileOffset={{
                    top: "calc(var(--mobile-safe-area-top, env(safe-area-inset-top)) + 8px)",
                    left: "12px",
                    right: "12px",
                }}
                swipeDirections={["top", "right"]}
                icons={{
                    success: <CircleCheckIcon className="size-5" />,
                    error: <CircleXIcon className="size-5" />,
                    info: <InfoIcon className="size-5" />,
                    loading: <Loader2Icon className="size-5 animate-spin" />,
                }}
                toastOptions={{
                    unstyled: true,
                    classNames: {
                        toast: "mobile-ios-toast pointer-events-auto flex w-[calc(100vw-24px)] max-w-[28rem] items-start gap-3 rounded-lg border border-background/10 bg-foreground/95 px-4 py-3 text-background shadow-lg backdrop-blur-xl",
                        title: "min-w-0 flex-1 text-sm font-semibold leading-5",
                        description:
                            "mt-0.5 min-w-0 text-xs leading-[1.125rem] text-background/75",
                        content: "min-w-0 flex-1",
                        icon: "mt-0.5 shrink-0",
                        actionButton:
                            "rounded-md bg-background px-3 py-1.5 text-xs font-semibold text-foreground",
                        cancelButton:
                            "rounded-md bg-background/15 px-3 py-1.5 text-xs font-semibold text-background",
                    },
                }}
            />
        </div>
    );
}
