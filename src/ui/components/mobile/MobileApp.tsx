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
    BookHeartIcon,
    CircleCheckIcon,
    CircleXIcon,
    CheckIcon,
    ChevronDownIcon,
    CopyIcon,
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
    Share2Icon,
    ShieldCheckIcon,
    SettingsIcon,
    SparklesIcon,
    StopCircleIcon,
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
import { useEdgeSwipe } from "@ui/hooks/useEdgeSwipe";
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
import * as MemoryAPI from "@core/chorus/api/MemoryAPI";
import * as ExportAPI from "@core/chorus/api/ExportAPI";

const settingsManager = SettingsManager.getInstance();

const mobileType = {
    appTitle: "text-[1.75rem] font-semibold leading-8",
    screenTitle: "text-[1.375rem] font-semibold leading-7",
    headerTitle: "text-base font-medium leading-6",
    rowTitle: "text-[1.0625rem] font-medium leading-6",
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

// Collapsible settings category. Collapsed by default so the panel reads as a
// short list of categories instead of one long form; tap a row to expand it.
function MobileSettingsGroup({
    title,
    defaultOpen = false,
    children,
}: {
    title: string;
    defaultOpen?: boolean;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="overflow-hidden rounded-xl border">
            <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left active:bg-muted"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
            >
                <span className="text-base font-semibold leading-6">
                    {title}
                </span>
                <ChevronDownIcon
                    className={`size-5 shrink-0 text-muted-foreground transition-transform ${
                        open ? "rotate-180" : ""
                    }`}
                />
            </button>
            {open && <div className="border-t px-3 pb-4 pt-3">{children}</div>}
        </div>
    );
}

const mobileIconButton =
    "flex size-10 shrink-0 items-center justify-center rounded-full active:bg-muted";
const mobileHeaderAction =
    "flex size-10 shrink-0 items-center justify-center rounded-full border border-accent-800/70 text-accent-800 active:bg-accent-100 disabled:opacity-50 dark:text-accent-25 dark:active:bg-accent-900";
const mobileHeaderModelControl =
    "flex h-10 w-full min-w-0 items-center gap-2 rounded-full border border-accent-800/70 bg-background px-3 text-left text-accent-800 active:bg-accent-100 disabled:opacity-50 dark:text-accent-25 dark:active:bg-accent-900";

const mobileFab =
    "fixed bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] right-5 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-background shadow-md active:scale-95";

const mobileWebOn = "border-accent-800 bg-accent-800 !text-accent-25";
const MOBILE_SYSTEM_PROMPT_WORD_LIMIT = 500;

function normalizedModelName(model: ModelConfig) {
    return `${model.displayName} ${model.modelId}`
        .toLocaleLowerCase()
        .replace(/[^a-z0-9]+/g, " ");
}

function preferredMobileModels(
    models: ModelConfig[],
    currentModel?: ModelConfig,
) {
    const find = (...terms: string[]) =>
        models.find((model) => {
            const name = normalizedModelName(model);
            return terms.every((term) => name.includes(term));
        });
    const base = find("deepseek", "v4", "flash") ?? currentModel ?? models[0];
    const strong =
        find("deepseek", "v4", "pro") ??
        models.find((model) => model.id !== base?.id) ??
        base;
    return { base, strong };
}

function wordCount(value: string) {
    return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function limitWords(value: string, limit: number) {
    const words = value.trim().split(/\s+/);
    return words.length > limit ? words.slice(0, limit).join(" ") : value;
}

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
    placeholder = "Search chats",
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}) {
    return (
        <div className="mobile-chat-search flex h-11 items-center gap-2 rounded-md bg-foreground/[0.055] px-3 transition-colors focus-within:bg-foreground/[0.075] focus-within:ring-1 focus-within:ring-foreground/15">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
            <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                aria-label={placeholder}
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
            className={`mobile-chat-row flex min-h-[3.75rem] items-center rounded-md ${
                active ? "bg-highlight text-highlight-foreground" : ""
            }`}
        >
            <button
                type="button"
                className="flex min-h-[3.75rem] min-w-0 flex-1 items-center gap-3 rounded-md px-3 text-left active:bg-muted"
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
    const [isSharing, setIsSharing] = useState(false);

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
        renameChat.isPending ||
        deleteChat.isPending ||
        togglePin.isPending ||
        isSharing;

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
                            className={mobileType.label}
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
                            className="flex h-12 items-center gap-3 rounded-md px-3 text-left active:bg-muted"
                            onClick={() => {
                                setIsSharing(true);
                                void ExportAPI.shareChat(chat.id)
                                    .then((result) => {
                                        if (result === "saved") {
                                            toast.success(
                                                "Conversation exported",
                                            );
                                        }
                                        onClose();
                                    })
                                    .catch((error) => {
                                        if (
                                            error instanceof DOMException &&
                                            error.name === "AbortError"
                                        ) {
                                            return;
                                        }
                                        console.error(error);
                                        toast.error(
                                            "Could not share conversation",
                                        );
                                    })
                                    .finally(() => setIsSharing(false));
                            }}
                            disabled={isPending}
                        >
                            <Share2Icon className="size-5" />
                            <span className="font-medium">
                                {isSharing
                                    ? "Preparing files..."
                                    : "Share conversation"}
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
        const viewportMeta = document.querySelector<HTMLMetaElement>(
            'meta[name="viewport"]',
        );
        const originalViewport = viewportMeta?.content;
        viewportMeta?.setAttribute(
            "content",
            "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
        );

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

        const restoreViewportOrigin = () => {
            window.scrollTo({ left: 0, top: 0, behavior: "auto" });
            document.documentElement.scrollLeft = 0;
            document.body.scrollLeft = 0;
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
            return hasTextInputFocused;
        };
        const updateViewportState = () => {
            updateSafeAreas();
            const visualViewport = window.visualViewport;
            const hasTextInputFocused = updateKeyboardState();
            const visualOffsetTop = Math.max(0, visualViewport?.offsetTop ?? 0);
            const obscuredBottom = Math.max(
                0,
                window.innerHeight -
                    ((visualViewport?.height ?? window.innerHeight) +
                        visualOffsetTop),
            );
            html.style.setProperty(
                "--mobile-keyboard-inset",
                `${hasTextInputFocused ? obscuredBottom : 0}px`,
            );
            html.style.setProperty(
                "--mobile-visual-offset-top",
                `${hasTextInputFocused ? visualOffsetTop : 0}px`,
            );
            html.style.setProperty(
                "--mobile-composer-bottom-padding",
                hasTextInputFocused
                    ? "12px"
                    : "max(12px, env(safe-area-inset-bottom))",
            );
            restoreViewportOrigin();
            window.dispatchEvent(
                new CustomEvent("chorus-mobile-viewport-change", {
                    detail: {
                        keyboardOpen: hasTextInputFocused,
                        keyboardInset: obscuredBottom,
                    },
                }),
            );
        };
        const handleFocusOut = () => {
            window.setTimeout(() => {
                const activeElement = document.activeElement;
                const hasTextInputFocused =
                    activeElement instanceof HTMLInputElement ||
                    activeElement instanceof HTMLTextAreaElement ||
                    activeElement?.getAttribute("contenteditable") === "true";
                if (!hasTextInputFocused) {
                    updateViewportState();
                    restoreViewportOrigin();
                }
            }, 80);
        };
        const preventGesture = (event: Event) => event.preventDefault();
        const preventMultiTouch = (event: TouchEvent) => {
            if (event.touches.length > 1) event.preventDefault();
        };

        updateViewportState();
        window.addEventListener("orientationchange", updateViewportState);
        window.visualViewport?.addEventListener("resize", updateViewportState);
        window.visualViewport?.addEventListener("scroll", updateViewportState);
        document.addEventListener("focusin", updateViewportState);
        document.addEventListener("focusout", handleFocusOut);
        document.addEventListener("gesturestart", preventGesture, {
            passive: false,
        });
        document.addEventListener("gesturechange", preventGesture, {
            passive: false,
        });
        document.addEventListener("gestureend", preventGesture, {
            passive: false,
        });
        document.addEventListener("touchmove", preventMultiTouch, {
            passive: false,
        });

        return () => {
            window.removeEventListener(
                "orientationchange",
                updateViewportState,
            );
            window.visualViewport?.removeEventListener(
                "resize",
                updateViewportState,
            );
            window.visualViewport?.removeEventListener(
                "scroll",
                updateViewportState,
            );
            document.removeEventListener("focusin", updateViewportState);
            document.removeEventListener("focusout", handleFocusOut);
            document.removeEventListener("gesturestart", preventGesture);
            document.removeEventListener("gesturechange", preventGesture);
            document.removeEventListener("gestureend", preventGesture);
            document.removeEventListener("touchmove", preventMultiTouch);
            probe.remove();
            html.classList.remove("chorus-mobile-root");
            html.classList.remove("chorus-mobile-keyboard-open");
            body.classList.remove("chorus-mobile-root");
            html.style.removeProperty("--mobile-safe-area-top");
            html.style.removeProperty("--mobile-safe-area-bottom");
            html.style.removeProperty("--mobile-keyboard-inset");
            html.style.removeProperty("--mobile-visual-offset-top");
            html.style.removeProperty("--mobile-composer-bottom-padding");
            if (originalViewport) {
                viewportMeta?.setAttribute("content", originalViewport);
            }
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

function MobileModelPreferenceSelect({
    label,
    models,
    selectedModelId,
    onSelect,
}: {
    label: string;
    models: ModelConfig[];
    selectedModelId?: string;
    onSelect: (modelConfig: ModelConfig) => void;
}) {
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const selectedModel = models.find((model) => model.id === selectedModelId);

    return (
        <div className="flex flex-col gap-2">
            <label className={mobileSettingsType.section}>{label}</label>
            <button
                type="button"
                className={`flex h-11 w-full items-center gap-2 rounded-md border bg-background px-3 text-left active:bg-muted ${mobileSettingsType.control}`}
                onClick={() => setIsPickerOpen(true)}
                disabled={models.length === 0}
                aria-label={`Choose ${label.toLocaleLowerCase()}`}
            >
                {selectedModel && (
                    <ProviderLogo
                        provider={getProviderName(selectedModel.modelId)}
                        size="sm"
                    />
                )}
                <span className="min-w-0 flex-1 truncate">
                    {selectedModel?.displayName ?? "Choose a model"}
                </span>
                <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
            </button>
            {isPickerOpen && (
                <MobileModelPickerSheet
                    models={models}
                    selectedModelId={selectedModelId}
                    onClose={() => setIsPickerOpen(false)}
                    onSelect={(modelConfig) => {
                        onSelect(modelConfig);
                        setIsPickerOpen(false);
                    }}
                />
            )}
        </div>
    );
}

function MobileChatModelControl({ chatId }: { chatId?: string }) {
    const modelConfigsQuery = ModelsAPI.useModelConfigs();
    const selectedQuickChatModel = ModelsAPI.useSelectedModelConfigQuickChat();
    const preferences = AppMetadataAPI.useMobileModelPreferences();
    const chatSlots = AppMetadataAPI.useMobileChatModelSlots(chatId);
    const strongMode = AppMetadataAPI.useMobileChatStrongMode(chatId);
    const setStrongMode = AppMetadataAPI.useSetMobileChatStrongMode();
    const setChatSlots = AppMetadataAPI.useSetMobileChatModelSlots();
    const setChatSlotModel = AppMetadataAPI.useSetMobileChatSlotModel();
    const savedChatModel = ModelConfigChatAPI.useSavedModelConfigChat(chatId);
    const updateSavedChatModel =
        ModelConfigChatAPI.useUpdateSavedModelConfigChat();
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const models = useMemo(
        () => openRouterModelConfigs(modelConfigsQuery.data),
        [modelConfigsQuery.data],
    );
    const defaults = preferredMobileModels(
        models,
        selectedQuickChatModel.data ?? undefined,
    );
    const existingModel = models.find(
        (model) => model.id === savedChatModel.data?.[0],
    );
    const initialBaseModel =
        existingModel ??
        models.find((model) => model.id === preferences.baseModelId) ??
        defaults.base;
    const initialStrongModel =
        models.find((model) => model.id === preferences.strongModelId) ??
        defaults.strong;
    const baseModel =
        models.find((model) => model.id === chatSlots.baseModelId) ??
        initialBaseModel;
    const strongModel =
        models.find((model) => model.id === chatSlots.strongModelId) ??
        initialStrongModel;
    const activeModel = strongMode ? strongModel : baseModel;

    useEffect(() => {
        if (
            !chatId ||
            !initialBaseModel ||
            !initialStrongModel ||
            chatSlots.baseModelId ||
            chatSlots.strongModelId ||
            setChatSlots.isPending
        ) {
            return;
        }
        setChatSlots.mutate({
            chatId,
            baseModelId: initialBaseModel.id,
            strongModelId: initialStrongModel.id,
        });
    }, [
        chatId,
        chatSlots.baseModelId,
        chatSlots.strongModelId,
        initialBaseModel,
        initialStrongModel,
        setChatSlots,
    ]);

    useEffect(() => {
        if (!chatId || !activeModel || updateSavedChatModel.isPending) return;
        if (savedChatModel.data?.[0] === activeModel.id) return;
        updateSavedChatModel.mutate({
            chatId,
            modelIds: [activeModel.id],
        });
    }, [activeModel, chatId, savedChatModel.data, updateSavedChatModel]);

    const toggleMode = async () => {
        if (!chatId || !baseModel || !strongModel) return;
        const nextStrongMode = !strongMode;
        const nextModel = nextStrongMode ? strongModel : baseModel;
        await Promise.all([
            setStrongMode.mutateAsync({
                chatId,
                enabled: nextStrongMode,
            }),
            updateSavedChatModel.mutateAsync({
                chatId,
                modelIds: [nextModel.id],
            }),
        ]);
    };

    return (
        <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
                type="button"
                className={mobileHeaderModelControl}
                onClick={() => setIsPickerOpen(true)}
                disabled={!activeModel || models.length === 0}
                aria-label={`Choose model for the ${strongMode ? "strong" : "base"} slot. Current model: ${activeModel?.displayName ?? "unavailable"}`}
            >
                {activeModel && (
                    <ProviderLogo
                        provider={getProviderName(activeModel.modelId)}
                        size="sm"
                    />
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {activeModel?.displayName ?? "Choose model"}
                </span>
                <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
            </button>
            <button
                type="button"
                role="switch"
                aria-checked={strongMode}
                className={`${mobileHeaderAction} ${
                    strongMode ? mobileWebOn : ""
                }`}
                onClick={() => void toggleMode()}
                disabled={!chatId || !activeModel || setStrongMode.isPending}
                aria-label={
                    strongMode
                        ? "Use base model"
                        : "Think harder with strong model"
                }
            >
                <SparklesIcon className="size-5" />
            </button>
            {isPickerOpen && (
                <MobileModelPickerSheet
                    models={models}
                    selectedModelId={activeModel?.id}
                    onClose={() => setIsPickerOpen(false)}
                    onSelect={(modelConfig) => {
                        if (!chatId) return;
                        void Promise.all([
                            setChatSlotModel.mutateAsync({
                                chatId,
                                slot: strongMode ? "strong" : "base",
                                modelConfigId: modelConfig.id,
                            }),
                            updateSavedChatModel.mutateAsync({
                                chatId,
                                modelIds: [modelConfig.id],
                            }),
                        ]);
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
                            className={mobileSettingsType.section}
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
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { mode, setMode } = useTheme();
    const { data: apiKeys } = AppMetadataAPI.useApiKeys();
    const skipOnboarding = AppMetadataAPI.useSkipOnboarding();
    const mobileWebSearch = useMobileWebSearchToggle();
    const savedSystemPrompt = AppMetadataAPI.useMobileUserSystemPrompt();
    const setSystemPrompt = AppMetadataAPI.useSetMobileUserSystemPrompt();
    const modelPreferences = AppMetadataAPI.useMobileModelPreferences();
    const setModelPreferences = AppMetadataAPI.useSetMobileModelPreferences();
    const modelConfigsQuery = ModelsAPI.useModelConfigs();
    const selectedQuickChatModel = ModelsAPI.useSelectedModelConfigQuickChat();
    const [openRouterKey, setOpenRouterKey] = useState(
        apiKeys?.openrouter ?? "",
    );
    const [openAIKey, setOpenAIKey] = useState(apiKeys?.openai ?? "");
    const [systemPrompt, setSystemPromptDraft] = useState(savedSystemPrompt);
    const [baseModelId, setBaseModelId] = useState(
        modelPreferences.baseModelId ?? "",
    );
    const [strongModelId, setStrongModelId] = useState(
        modelPreferences.strongModelId ?? "",
    );
    const [isSaving, setIsSaving] = useState(false);
    const [isEditingSetting, setIsEditingSetting] = useState(false);
    const [connectionState, setConnectionState] = useState<
        "idle" | "testing" | "success" | "error"
    >("idle");
    const memorySettings = MemoryAPI.useMemorySettings();
    const setMemorySettings = MemoryAPI.useSetMemorySettings();
    const clearMemories = MemoryAPI.useClearMemories();
    const [memoryEnabled, setMemoryEnabled] = useState(false);
    const [memoryAutoLearn, setMemoryAutoLearn] = useState(false);
    const [openAIConnectionState, setOpenAIConnectionState] = useState<
        "idle" | "testing" | "success" | "error"
    >("idle");
    const panelRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    const footerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setOpenRouterKey(apiKeys?.openrouter ?? "");
        setConnectionState("idle");
    }, [apiKeys?.openrouter]);

    useEffect(() => {
        setOpenAIKey(apiKeys?.openai ?? "");
        setOpenAIConnectionState("idle");
    }, [apiKeys?.openai]);

    useEffect(() => {
        if (!memorySettings.data) return;
        setMemoryEnabled(memorySettings.data.enabled);
        setMemoryAutoLearn(memorySettings.data.autoLearn);
    }, [memorySettings.data]);

    useEffect(() => {
        setSystemPromptDraft(savedSystemPrompt);
    }, [savedSystemPrompt]);

    const openRouterModels = useMemo(
        () => openRouterModelConfigs(modelConfigsQuery.data),
        [modelConfigsQuery.data],
    );
    const preferredModels = preferredMobileModels(
        openRouterModels,
        selectedQuickChatModel.data ?? undefined,
    );

    useEffect(() => {
        setBaseModelId(
            modelPreferences.baseModelId ?? preferredModels.base?.id ?? "",
        );
        setStrongModelId(
            modelPreferences.strongModelId ?? preferredModels.strong?.id ?? "",
        );
    }, [
        modelPreferences.baseModelId,
        modelPreferences.strongModelId,
        preferredModels.base?.id,
        preferredModels.strong?.id,
    ]);

    useEffect(() => {
        const header = headerRef.current;
        const footer = footerRef.current;
        if (!header || !footer) return;

        const updateLayoutMeasurements = () => {
            document.documentElement.style.setProperty(
                "--mobile-settings-header-height",
                `${Math.ceil(header.getBoundingClientRect().height)}px`,
            );
            document.documentElement.style.setProperty(
                "--mobile-settings-footer-height",
                `${Math.ceil(footer.getBoundingClientRect().height)}px`,
            );
        };
        const observer = new ResizeObserver(updateLayoutMeasurements);
        observer.observe(header);
        observer.observe(footer);
        updateLayoutMeasurements();

        return () => {
            observer.disconnect();
            document.documentElement.style.removeProperty(
                "--mobile-settings-header-height",
            );
            document.documentElement.style.removeProperty(
                "--mobile-settings-footer-height",
            );
        };
    }, []);

    useEffect(() => {
        const handleViewportChange = (event: Event) => {
            const detail = (event as CustomEvent<{ keyboardOpen?: boolean }>)
                .detail;
            if (!detail?.keyboardOpen) return;

            window.setTimeout(() => {
                const activeElement = document.activeElement;
                if (
                    panelRef.current?.contains(activeElement) &&
                    (activeElement instanceof HTMLInputElement ||
                        activeElement instanceof HTMLTextAreaElement)
                ) {
                    activeElement.scrollIntoView({
                        block: "center",
                        behavior: "auto",
                    });
                }
            }, 120);
        };

        window.addEventListener(
            "chorus-mobile-viewport-change",
            handleViewportChange,
        );
        return () =>
            window.removeEventListener(
                "chorus-mobile-viewport-change",
                handleViewportChange,
            );
    }, []);

    const dismissSettingsKeyboard = useCallback(() => {
        const activeElement = document.activeElement;
        if (
            activeElement instanceof HTMLInputElement ||
            activeElement instanceof HTMLTextAreaElement
        ) {
            activeElement.blur();
        }
        setIsEditingSetting(false);
    }, []);

    const handleSettingsFocus = useCallback(
        (event: React.FocusEvent<HTMLDivElement>) => {
            if (
                event.target instanceof HTMLInputElement ||
                event.target instanceof HTMLTextAreaElement
            ) {
                setIsEditingSetting(true);
                window.setTimeout(() => {
                    event.target.scrollIntoView({
                        block: "center",
                        behavior: "smooth",
                    });
                }, 250);
            }
        },
        [],
    );

    const handleSettingsBlur = useCallback(() => {
        window.setTimeout(() => {
            const activeElement = document.activeElement;
            const panel = panelRef.current;
            const stillEditing =
                panel?.contains(activeElement) &&
                (activeElement instanceof HTMLInputElement ||
                    activeElement instanceof HTMLTextAreaElement);
            setIsEditingSetting(Boolean(stillEditing));
        }, 80);
    }, []);

    const testOpenRouterConnection = useCallback(async () => {
        const trimmedKey = openRouterKey.trim();
        if (!trimmedKey) return;

        setConnectionState("testing");
        const connected =
            await AppMetadataAPI.testOpenRouterConnection(trimmedKey);
        setConnectionState(connected ? "success" : "error");
    }, [openRouterKey]);

    const testOpenAIConnection = useCallback(async () => {
        const trimmedKey = openAIKey.trim();
        if (!trimmedKey) return;
        setOpenAIConnectionState("testing");
        const connected = await MemoryAPI.testOpenAIConnection(trimmedKey);
        setOpenAIConnectionState(connected ? "success" : "error");
    }, [openAIKey]);

    const saveOpenRouterKey = useCallback(async () => {
        dismissSettingsKeyboard();
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
                    openai: openAIKey.trim() || undefined,
                },
                quickChat: {
                    ...settings.quickChat,
                    enabled: true,
                },
            });
            await setSystemPrompt.mutateAsync(systemPrompt);
            if (baseModelId && strongModelId) {
                await setModelPreferences.mutateAsync({
                    baseModelId,
                    strongModelId,
                });
            }
            await setMemorySettings.mutateAsync({
                enabled: memoryEnabled,
                autoLearn: memoryEnabled && memoryAutoLearn,
            });

            await skipOnboarding.mutateAsync();
            await queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
            await queryClient.invalidateQueries(
                ModelsAPI.modelConfigQueries.listConfigs(),
            );
            await queryClient.invalidateQueries(
                ModelsAPI.modelConfigQueries.quickChat(),
            );
            toast.success("Settings saved");
            onClose?.();
        } catch (error) {
            console.error(error);
            toast.error("Could not save OpenRouter key");
        } finally {
            setIsSaving(false);
        }
    }, [
        openRouterKey,
        onClose,
        queryClient,
        dismissSettingsKeyboard,
        setSystemPrompt,
        setModelPreferences,
        skipOnboarding,
        systemPrompt,
        baseModelId,
        strongModelId,
        openAIKey,
        memoryEnabled,
        memoryAutoLearn,
        setMemorySettings,
    ]);

    const hasOpenRouterKey = Boolean(apiKeys?.openrouter);
    const systemPromptWordCount = wordCount(systemPrompt);

    return (
        <div
            ref={panelRef}
            className="mobile-settings-panel bg-background"
            onFocusCapture={handleSettingsFocus}
            onBlurCapture={handleSettingsBlur}
        >
            <div
                ref={headerRef}
                className="mobile-settings-header mobile-safe-top flex items-center justify-between border-b px-4 pb-3 pt-3"
            >
                <div className="flex items-center gap-2">
                    <KeyRoundIcon className="size-5 text-accent-800" />
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

            <div className="mobile-settings-scroll flex flex-col gap-3 overflow-y-auto px-4 py-5">
                <MobileSettingsGroup title="Appearance">
                <section className="flex flex-col gap-2">
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
                </MobileSettingsGroup>

                <MobileSettingsGroup title="Memory">
                <section className="flex flex-col gap-3">
                    <div>
                        <p className={mobileSettingsType.supporting}>
                            Memories stay on this device. OpenAI receives only
                            the text needed to extract or find relevant
                            memories.
                        </p>
                    </div>
                    <label
                        className={mobileSettingsType.section}
                        htmlFor="mobile-openai-key"
                    >
                        OpenAI API key
                    </label>
                    <input
                        id="mobile-openai-key"
                        value={openAIKey}
                        onChange={(event) => {
                            setOpenAIKey(event.target.value);
                            setOpenAIConnectionState("idle");
                        }}
                        placeholder="sk-..."
                        type="password"
                        autoCapitalize="none"
                        autoCorrect="off"
                        className={`h-11 rounded-md border bg-background px-3 outline-none focus:ring-2 focus:ring-ring ${mobileSettingsType.control}`}
                    />
                    <button
                        type="button"
                        className={`flex h-11 items-center justify-center gap-2 rounded-md border bg-background active:bg-muted disabled:opacity-55 ${mobileSettingsType.control}`}
                        onClick={() => void testOpenAIConnection()}
                        disabled={
                            !openAIKey.trim() ||
                            openAIConnectionState === "testing"
                        }
                        aria-live="polite"
                    >
                        {openAIConnectionState === "testing" ? (
                            <Loader2Icon className="size-4 animate-spin" />
                        ) : openAIConnectionState === "success" ? (
                            <CheckIcon className="size-4" />
                        ) : openAIConnectionState === "error" ? (
                            <XIcon className="size-4" />
                        ) : (
                            <ShieldCheckIcon className="size-4" />
                        )}
                        {openAIConnectionState === "testing"
                            ? "Testing connection"
                            : openAIConnectionState === "success"
                              ? "Connected"
                              : openAIConnectionState === "error"
                                ? "Connection failed"
                                : "Test OpenAI connection"}
                    </button>
                    <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-3">
                        <div className="min-w-0">
                            <div className={mobileSettingsType.section}>
                                Use memory
                            </div>
                            <div
                                className={`mt-1 ${mobileSettingsType.supporting}`}
                            >
                                Use saved facts as context in new chats.
                            </div>
                        </div>
                        <Switch
                            checked={memoryEnabled}
                            onCheckedChange={setMemoryEnabled}
                            aria-label="Use memory"
                            className="data-[state=checked]:bg-accent-800 data-[state=unchecked]:bg-muted-foreground/35"
                        />
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-3">
                        <div className="min-w-0">
                            <div className={mobileSettingsType.section}>
                                Learn automatically
                            </div>
                            <div
                                className={`mt-1 ${mobileSettingsType.supporting}`}
                            >
                                Review user messages after a chat becomes idle.
                            </div>
                        </div>
                        <Switch
                            checked={memoryAutoLearn}
                            onCheckedChange={setMemoryAutoLearn}
                            disabled={!memoryEnabled || !openAIKey.trim()}
                            aria-label="Learn memories automatically"
                            className="data-[state=checked]:bg-accent-800 data-[state=unchecked]:bg-muted-foreground/35"
                        />
                    </div>
                    <button
                        type="button"
                        className={`flex h-11 items-center justify-center gap-2 rounded-md border border-destructive/40 bg-background text-destructive active:bg-destructive/10 disabled:opacity-50 ${mobileSettingsType.control}`}
                        onClick={() => {
                            if (
                                window.confirm(
                                    "Delete every saved memory from this device?",
                                )
                            ) {
                                void clearMemories
                                    .mutateAsync()
                                    .then(() =>
                                        toast.success("All memories deleted"),
                                    );
                            }
                        }}
                        disabled={clearMemories.isPending}
                    >
                        <Trash2Icon className="size-4" />
                        Clear all memories
                    </button>
                    <button
                        type="button"
                        className={`flex h-11 items-center justify-center gap-2 rounded-md border bg-background active:bg-muted ${mobileSettingsType.control}`}
                        onClick={() => navigate("/privacy")}
                    >
                        <ShieldCheckIcon className="size-4" />
                        Privacy and data
                    </button>
                </section>
                </MobileSettingsGroup>

                <MobileSettingsGroup
                    title="Models & Chat"
                    defaultOpen={!hasOpenRouterKey}
                >
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

                {hasOpenRouterKey && (
                    <section className="flex flex-col gap-4">
                        <div>
                            <div className={mobileSettingsType.section}>
                                Model preferences
                            </div>
                            <p className={mobileSettingsType.supporting}>
                                New chats start with Base. Use the chat switch
                                when you need the Strong model.
                            </p>
                        </div>
                        <MobileModelPreferenceSelect
                            label="Base model"
                            models={openRouterModels}
                            selectedModelId={baseModelId}
                            onSelect={(model) => setBaseModelId(model.id)}
                        />
                        <MobileModelPreferenceSelect
                            label="Strong model"
                            models={openRouterModels}
                            selectedModelId={strongModelId}
                            onSelect={(model) => setStrongModelId(model.id)}
                        />
                        {baseModelId &&
                            strongModelId &&
                            baseModelId === strongModelId && (
                                <p className="text-sm leading-5 text-destructive">
                                    Base and Strong use the same model. Choose a
                                    different model for one slot if you want the
                                    switch to change models.
                                </p>
                            )}
                    </section>
                )}

                <section className="flex flex-col gap-2">
                    <div className="flex items-end justify-between gap-3">
                        <label
                            className={mobileSettingsType.section}
                            htmlFor="mobile-system-prompt"
                        >
                            System prompt
                        </label>
                        <span className={mobileSettingsType.supporting}>
                            {systemPromptWordCount}/
                            {MOBILE_SYSTEM_PROMPT_WORD_LIMIT} words
                        </span>
                    </div>
                    <textarea
                        id="mobile-system-prompt"
                        value={systemPrompt}
                        onChange={(event) =>
                            setSystemPromptDraft(
                                limitWords(
                                    event.target.value,
                                    MOBILE_SYSTEM_PROMPT_WORD_LIMIT,
                                ),
                            )
                        }
                        placeholder="Add context, preferences, tone, or instructions for every new response."
                        rows={7}
                        className={`min-h-40 resize-none rounded-md border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring ${mobileSettingsType.control}`}
                    />
                    <p className={mobileSettingsType.supporting}>
                        This private context is included with requests across
                        supported models.
                    </p>
                </section>

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
                </MobileSettingsGroup>
            </div>

            <div
                ref={footerRef}
                className="mobile-settings-footer flex border-t bg-background px-4 pt-2"
            >
                {isEditingSetting ? (
                    <button
                        type="button"
                        className={`flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-md border bg-background px-4 active:bg-muted ${mobileSettingsType.control}`}
                        onClick={dismissSettingsKeyboard}
                    >
                        <CheckIcon className="size-4" />
                        Done
                    </button>
                ) : (
                    <button
                        type="button"
                        className={`h-12 min-w-0 flex-1 rounded-md bg-primary px-4 text-background disabled:cursor-not-allowed disabled:opacity-60 ${mobileSettingsType.control}`}
                        onClick={() => void saveOpenRouterKey()}
                        disabled={
                            isSaving ||
                            setSystemPrompt.isPending ||
                            setMemorySettings.isPending
                        }
                    >
                        {isSaving ? "Saving..." : "Save"}
                    </button>
                )}
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

    // Slide the drawer in from the left when it opens.
    const [entered, setEntered] = useState(false);
    const swipeStart = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
        if (!open) {
            setEntered(false);
            return;
        }
        const frame = requestAnimationFrame(() => setEntered(true));
        return () => cancelAnimationFrame(frame);
    }, [open]);

    const handleSheetTouchStart = (event: React.TouchEvent) => {
        if (event.touches.length !== 1) {
            swipeStart.current = null;
            return;
        }
        const touch = event.touches[0];
        swipeStart.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleSheetTouchEnd = (event: React.TouchEvent) => {
        const start = swipeStart.current;
        swipeStart.current = null;
        if (!start) return;
        const touch = event.changedTouches[0];
        const dx = touch.clientX - start.x;
        const dy = touch.clientY - start.y;
        // Swipe left to dismiss the drawer.
        if (dx <= -64 && Math.abs(dx) > Math.abs(dy)) {
            onClose();
        }
    };

    if (!open) return null;

    return (
        <div
            className={`fixed inset-0 z-40 bg-background transition-transform duration-300 ease-out will-change-transform ${
                entered ? "translate-x-0" : "-translate-x-full"
            }`}
            onTouchStart={handleSheetTouchStart}
            onTouchEnd={handleSheetTouchEnd}
        >
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
    onBack,
    onOpenChats,
    onNewChat,
}: {
    chat?: Chat;
    onBack?: () => void;
    onOpenChats: () => void;
    onNewChat: () => void;
}) {
    const { chatId } = useParams();
    const mobileWebSearch = useMobileWebSearchToggle(chatId);

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
                <MobileChatModelControl chatId={chatId} />
                <div className="flex shrink-0 items-center gap-2">
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

function MobileMessageAction({
    icon,
    label,
    onClick,
    disabled = false,
}: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            className="flex min-h-10 items-center gap-1.5 rounded-md px-1 text-sm text-muted-foreground active:text-foreground disabled:opacity-45"
            onClick={onClick}
            disabled={disabled}
        >
            {icon}
            <span>{label}</span>
        </button>
    );
}

function MobileCopyAction({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    const resetTimerRef = useRef<number>();

    useEffect(
        () => () => {
            if (resetTimerRef.current !== undefined) {
                window.clearTimeout(resetTimerRef.current);
            }
        },
        [],
    );

    const copyMessage = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            if (resetTimerRef.current !== undefined) {
                window.clearTimeout(resetTimerRef.current);
            }
            resetTimerRef.current = window.setTimeout(
                () => setCopied(false),
                1600,
            );
        } catch (error) {
            console.error(error);
            toast.error("Could not copy message");
        }
    }, [text]);

    return (
        <MobileMessageAction
            icon={
                copied ? (
                    <CheckIcon className="size-4" strokeWidth={1.5} />
                ) : (
                    <CopyIcon className="size-4" strokeWidth={1.5} />
                )
            }
            label={copied ? "Copied" : "Copy"}
            onClick={() => void copyMessage()}
        />
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
    const stopMessage = MessageAPI.useStopMessage();
    const isStopping = stopMessage.isPending;

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
        <article className="w-full pt-3">
            <div
                className="relative w-full rounded-md border-[0.09rem] !border-special bg-background px-4 pb-4 pt-6"
                style={{ overflowWrap: "anywhere" }}
            >
                {modelConfig && (
                    <div className="absolute -top-3 left-3 flex h-6 max-w-[calc(100%-1.5rem)] items-center gap-2 bg-background px-2 text-sm text-foreground">
                        <ProviderLogo
                            size="sm"
                            modelId={modelConfig.modelId}
                            className="-mt-px shrink-0"
                        />
                        <span className="truncate">
                            {modelConfig.displayName}
                        </span>
                    </div>
                )}
                {partsWithContent.length > 0 ? (
                    <div className="mobile-chorus-markdown max-w-none break-words">
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
                        <div className="text-base font-medium leading-6">
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
            <div className="flex min-h-10 items-center gap-5 px-1">
                <MobileCopyAction text={fullText} />
                {message.state === "streaming" ? (
                    <MobileMessageAction
                        icon={
                            <StopCircleIcon
                                className="size-4"
                                strokeWidth={1.5}
                            />
                        }
                        label="Stop"
                        onClick={() =>
                            void stopMessage.mutateAsync({
                                chatId: message.chatId,
                                messageId: message.id,
                            })
                        }
                        disabled={isStopping}
                    />
                ) : (
                    <MobileMessageAction
                        icon={
                            <RefreshCcwIcon
                                className={`size-4 ${
                                    isRetrying ? "animate-spin" : ""
                                }`}
                                strokeWidth={1.5}
                            />
                        }
                        label="Regenerate"
                        onClick={retryResponse}
                        disabled={!modelConfig || isRetrying}
                    />
                )}
            </div>
        </article>
    );
}

function MobileUserMessage({ message }: { message: Message }) {
    const attachments = message.attachments ?? [];
    const editMessage = MessageAPI.useEditMessage(message.chatId, true);
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(message.text);

    useEffect(() => {
        if (!isEditing) setDraft(message.text);
    }, [isEditing, message.text]);

    const saveEdit = useCallback(async () => {
        const newText = draft.trim();
        if (!newText || newText === message.text) {
            setIsEditing(false);
            setDraft(message.text);
            return;
        }

        await editMessage.mutateAsync({
            messageId: message.id,
            messageSetId: message.messageSetId,
            newText,
        });
        setIsEditing(false);
    }, [draft, editMessage, message]);

    return (
        <article className="flex w-full flex-col items-end">
            <div className="max-w-[88%] rounded-md bg-highlight px-5 py-3 text-highlight-foreground">
                {isEditing ? (
                    <textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        className="min-h-24 w-[min(18rem,72vw)] resize-none border-0 bg-transparent p-0 text-[1rem] leading-6 text-highlight-foreground outline-none ring-0"
                        autoFocus
                        aria-label="Edit message"
                    />
                ) : (
                    <div className="whitespace-pre-wrap break-words text-[1rem] leading-6">
                        {message.text}
                    </div>
                )}
                {attachments.length > 0 && (
                    <AttachmentPillsList
                        attachments={attachments}
                        className="mt-2"
                    />
                )}
                {isEditing && (
                    <div className="mt-3 flex justify-end gap-2">
                        <button
                            type="button"
                            className="min-h-10 rounded-md px-3 text-sm font-medium active:bg-foreground/10"
                            onClick={() => {
                                setDraft(message.text);
                                setIsEditing(false);
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="min-h-10 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
                            onClick={() => void saveEdit()}
                            disabled={!draft.trim() || editMessage.isPending}
                        >
                            {editMessage.isPending ? "Saving" : "Save"}
                        </button>
                    </div>
                )}
            </div>
            {!isEditing && (
                <div className="flex min-h-10 items-center gap-5 px-1">
                    <MobileCopyAction text={message.text} />
                    <MobileMessageAction
                        icon={
                            <PencilIcon className="size-4" strokeWidth={1.5} />
                        }
                        label="Edit"
                        onClick={() => setIsEditing(true)}
                    />
                </div>
            )}
        </article>
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
    const scrollContainerRef = useRef<HTMLElement>(null);
    const streamingMessagesRef = useRef<Message[]>([]);
    const backgroundedStreamsRef = useRef<{
        hiddenAt: number;
        progressById: Map<string, string>;
    } | null>(null);
    const [isLoadSlow, setIsLoadSlow] = useState(false);

    // Swipe from the left edge to the right to reveal the chat list, the
    // standard iOS drawer gesture.
    // Open the chat list on a left-to-right swipe that can start anywhere on
    // the screen (like ChatGPT / Claude), not just from the very left edge.
    const chatListSwipe = useEdgeSwipe({
        onSwipeRight: onOpenChats,
        edgeWidth: Number.POSITIVE_INFINITY,
        threshold: 64,
    });

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
            const container = scrollContainerRef.current;
            container?.scrollTo({
                top: container.scrollHeight,
                behavior: "smooth",
            });
        });
    }, []);

    useEffect(() => {
        requestAnimationFrame(() => {
            const container = scrollContainerRef.current;
            container?.scrollTo({
                top: container.scrollHeight,
                behavior: "auto",
            });
        });
    }, [messageSetsQuery.data]);

    useEffect(() => {
        const handleViewportChange = (event: Event) => {
            const detail = (event as CustomEvent<{ keyboardOpen: boolean }>)
                .detail;
            if (!detail?.keyboardOpen) return;

            requestAnimationFrame(() => {
                const container = scrollContainerRef.current;
                container?.scrollTo({
                    top: container.scrollHeight,
                    behavior: "smooth",
                });
            });
        };

        window.addEventListener(
            "chorus-mobile-viewport-change",
            handleViewportChange,
        );
        return () =>
            window.removeEventListener(
                "chorus-mobile-viewport-change",
                handleViewportChange,
            );
    }, []);

    useEffect(() => {
        streamingMessagesRef.current = mobileAssistantMessages(
            messageSetsQuery.data ?? [],
        ).filter((message) => message.state === "streaming");
    }, [messageSetsQuery.data]);

    useEffect(() => {
        if (!chatId || (messageSetsQuery.data?.length ?? 0) === 0) return;
        const idleTimer = window.setTimeout(
            () => {
                void MemoryAPI.queueImplicitMemoryJob(chatId).then(() =>
                    MemoryAPI.processPendingMemoryJobs(),
                );
            },
            30 * 60 * 1000,
        );
        return () => window.clearTimeout(idleTimer);
    }, [chatId, messageSetsQuery.data]);

    useEffect(() => {
        const processWhenActive = () => {
            if (document.visibilityState === "visible") {
                void MemoryAPI.processPendingMemoryJobs();
            }
        };
        processWhenActive();
        document.addEventListener("visibilitychange", processWhenActive);
        return () =>
            document.removeEventListener("visibilitychange", processWhenActive);
    }, []);

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
            void MemoryAPI.queueImplicitMemoryJob(chatId).then(() =>
                MemoryAPI.processPendingMemoryJobs(),
            );
            await discardDisposableChat.mutateAsync({ chatId });
        }
        const newChatId = await createNewChatMutation.mutateAsync({
            projectId: "quick-chat",
        });
        navigate(`/chat/${newChatId}`);
    }, [chatId, createNewChatMutation, discardDisposableChat, navigate]);

    const leaveChat = useCallback(async () => {
        if (chatId) {
            void MemoryAPI.queueImplicitMemoryJob(chatId).then(() =>
                MemoryAPI.processPendingMemoryJobs(),
            );
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
        <div
            className="mobile-app-shell flex h-full flex-col bg-background"
            onTouchStart={chatListSwipe.onTouchStart}
            onTouchMove={chatListSwipe.onTouchMove}
            onTouchEnd={chatListSwipe.onTouchEnd}
        >
            <MobileHeader
                chat={chatQuery.data}
                onBack={() => void leaveChat()}
                onOpenChats={onOpenChats}
                onNewChat={() => void createNewChat()}
            />

            <main
                ref={scrollContainerRef}
                className="mobile-chat-scroll flex-1 overflow-y-auto overscroll-contain px-4 pt-4"
            >
                {messageSets.length === 0 ? (
                    <div className="flex h-full min-h-[45dvh] flex-col items-center justify-center px-6 text-center">
                        <p className="text-base leading-6 text-muted-foreground">
                            Send a message to get started.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4 pb-4">
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
                    <div className="flex min-w-0 items-center gap-3">
                        <img
                            src="/icon.png"
                            alt=""
                            className="size-10 shrink-0 scale-150 object-contain"
                        />
                        <div className="min-w-0">
                            <h1 className={mobileType.appTitle}>Chorus</h1>
                            <div className={`mt-0.5 ${mobileType.rowMeta}`}>
                                {totalChats === 1
                                    ? "1 chat"
                                    : `${totalChats} chats`}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            className={mobileHeaderAction}
                            onClick={() => navigate("/memories")}
                            aria-label="Open memories"
                        >
                            <BookHeartIcon className="size-5" strokeWidth={2} />
                        </button>
                        <button
                            type="button"
                            className={mobileHeaderAction}
                            onClick={() => navigate("/settings")}
                            aria-label="Open settings"
                        >
                            <SettingsIcon className="size-6" strokeWidth={2} />
                        </button>
                    </div>
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

function MobileMemoriesRoute() {
    const navigate = useNavigate();
    const memoriesQuery = MemoryAPI.useMemories();
    const deleteMemory = MemoryAPI.useDeleteMemory();
    const [query, setQuery] = useState("");
    const deferredQuery = useDeferredValue(query);
    const memories = useMemo(() => {
        const normalized = deferredQuery.trim().toLocaleLowerCase();
        const all = memoriesQuery.data ?? [];
        if (!normalized) return all;
        return all.filter(
            (memory) =>
                memory.content.toLocaleLowerCase().includes(normalized) ||
                memory.category.toLocaleLowerCase().includes(normalized),
        );
    }, [deferredQuery, memoriesQuery.data]);

    return (
        <div className="flex h-full flex-col bg-background mobile-safe-top">
            <header className="shrink-0 border-b px-4 pb-3">
                <div className="flex min-h-16 items-center gap-3">
                    <button
                        type="button"
                        className={mobileIconButton}
                        onClick={() => navigate("/")}
                        aria-label="Back to chats"
                    >
                        <ArrowLeftIcon className="size-5" />
                    </button>
                    <div className="min-w-0 flex-1">
                        <h1 className={mobileType.screenTitle}>Memory</h1>
                        <div className={mobileType.rowMeta}>
                            {memoriesQuery.data?.length ?? 0} saved
                        </div>
                    </div>
                    <button
                        type="button"
                        className={mobileHeaderAction}
                        onClick={() => navigate("/settings")}
                        aria-label="Open memory settings"
                    >
                        <SettingsIcon className="size-5" />
                    </button>
                </div>
                <MobileChatSearch
                    value={query}
                    onChange={setQuery}
                    placeholder="Search memories"
                />
            </header>

            <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                {memoriesQuery.isPending ? (
                    <div className="flex flex-col gap-2">
                        {[0, 1, 2].map((index) => (
                            <div
                                key={index}
                                className="h-20 animate-pulse rounded-md bg-muted/60"
                            />
                        ))}
                    </div>
                ) : memories.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                        <BookHeartIcon className="size-8 text-accent-800" />
                        <h2 className={`mt-4 ${mobileType.screenTitle}`}>
                            {query ? "No matching memories" : "No memories yet"}
                        </h2>
                        <p
                            className={`mt-2 ${mobileType.body} text-muted-foreground`}
                        >
                            {query
                                ? "Try another word or clear the search."
                                : 'Say "Remember that..." in a chat, or turn on automatic learning in Settings.'}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col divide-y">
                        {memories.map((memory) => (
                            <div
                                key={memory.id}
                                className="flex min-h-20 items-start gap-3 py-3"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                                            {memory.category}
                                        </span>
                                        <span className={mobileType.rowMeta}>
                                            {memory.source === "explicit"
                                                ? "You asked Chorus to remember"
                                                : "Learned from a chat"}
                                        </span>
                                    </div>
                                    <p className={`mt-2 ${mobileType.body}`}>
                                        {memory.content}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    className="flex size-10 shrink-0 items-center justify-center rounded-full text-destructive active:bg-destructive/10"
                                    onClick={() =>
                                        void deleteMemory
                                            .mutateAsync(memory)
                                            .then(() =>
                                                toast.success("Memory deleted"),
                                            )
                                    }
                                    aria-label={`Delete memory: ${memory.content}`}
                                >
                                    <Trash2Icon className="size-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

function MobilePrivacyRoute() {
    const navigate = useNavigate();

    return (
        <div className="flex h-full flex-col bg-background mobile-safe-top">
            <header className="flex min-h-16 shrink-0 items-center gap-3 border-b px-4">
                <button
                    type="button"
                    className={mobileIconButton}
                    onClick={() => navigate(-1)}
                    aria-label="Back"
                >
                    <ArrowLeftIcon className="size-5" />
                </button>
                <h1 className={mobileType.screenTitle}>Privacy and data</h1>
            </header>
            <main className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                <div className="mx-auto flex max-w-2xl flex-col gap-6">
                    <section>
                        <h2 className={mobileType.label}>
                            Stored on your device
                        </h2>
                        <p className={`mt-2 ${mobileType.body}`}>
                            Chorus stores chats, drafts, settings, attachments,
                            model choices, and memories in the app container on
                            this device. Chorus does not require a Chorus
                            account or a Chorus chat server.
                        </p>
                    </section>
                    <section>
                        <h2 className={mobileType.label}>Model providers</h2>
                        <p className={`mt-2 ${mobileType.body}`}>
                            When you send a chat message, Chorus sends that
                            request and its needed conversation context to the
                            provider you selected. The iPhone chat flow uses
                            OpenRouter. Provider terms and retention rules apply
                            to those requests.
                        </p>
                    </section>
                    <section>
                        <h2 className={mobileType.label}>Memory</h2>
                        <p className={`mt-2 ${mobileType.body}`}>
                            Memory is off until you enable it. When enabled,
                            Chorus may send selected user text to OpenAI to
                            extract durable facts and create search embeddings.
                            Saved memories remain in the local database. You can
                            inspect and delete them at any time.
                        </p>
                    </section>
                    <section>
                        <h2 className={mobileType.label}>Deletion</h2>
                        <p className={`mt-2 ${mobileType.body}`}>
                            Delete individual chats or memories from their
                            management screens. Use Clear all memories in
                            Settings to remove every saved memory. Removing the
                            app deletes its local app container from the device,
                            subject to any device backup you control.
                        </p>
                    </section>
                </div>
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
                <Route path="/memories" element={<MobileMemoriesRoute />} />
                <Route path="/privacy" element={<MobilePrivacyRoute />} />
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
