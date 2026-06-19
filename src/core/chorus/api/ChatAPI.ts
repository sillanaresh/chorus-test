import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { produce } from "immer";
import { useNavigate } from "react-router-dom";
import { db } from "../DB";
import { getVersion } from "@tauri-apps/api/app";
import { usePostHog } from "posthog-js/react";

const chatKeys = {
    all: () => ["chats"] as const,
    allDetails: () => [...chatKeys.all(), "detail"] as const,
};

export const chatQueries = {
    list: () => ({
        queryKey: [...chatKeys.all(), "list"] as const,
        queryFn: () => fetchChats(),
    }),
    detail: (chatId: string | undefined) => ({
        queryKey: [...chatKeys.allDetails(), chatId] as const,
        queryFn: () => fetchChat(chatId!),
        enabled: chatId !== undefined,
    }),
};

export type Chat = {
    id: string;
    title: string;
    projectId: string;
    updatedAt: string;
    createdAt: string;
    quickChat: boolean;
    summary: string | null;
    isNewChat: boolean;
    parentChatId: string | null;
    projectContextSummary: string | undefined;
    projectContextSummaryIsStale: boolean;
    replyToId: string | null;
    gcPrototype: boolean;

    pinned: boolean;
    totalCostUsd?: number;
};

type ChatDBRow = {
    id: string;
    title: string;
    project_id: string;
    updated_at: string;
    created_at: string;
    quick_chat: number;
    pinned: number;
    summary: string | null;
    is_new_chat: number;
    parent_chat_id: string | null;
    project_context_summary: string | null;
    project_context_summary_is_stale: number;
    reply_to_id: string | null;
    gc_prototype_chat: number;
    total_cost_usd: number | null;
};

function readChat(row: ChatDBRow): Chat {
    return {
        id: row.id,
        title: row.title,
        projectId: row.project_id,
        updatedAt: row.updated_at || row.created_at, // default to created_at bc sqlite won't let us add a default for updated_at
        createdAt: row.created_at,
        quickChat: row.quick_chat === 1,
        pinned: row.pinned === 1,
        summary: row.summary,
        isNewChat: row.is_new_chat === 1,
        parentChatId: row.parent_chat_id,
        projectContextSummary: row.project_context_summary ?? undefined,
        projectContextSummaryIsStale:
            row.project_context_summary_is_stale === 1,
        replyToId: row.reply_to_id,
        gcPrototype: row.gc_prototype_chat === 1,
        totalCostUsd: row.total_cost_usd ?? undefined,
    };
}

export function localChatTitle(message: string) {
    const normalized = message
        .replace(/https?:\/\/\S+/gi, "link")
        .replace(/[`*_>#~[\]{}()]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const title = normalized
        .split(" ")
        .slice(0, 6)
        .join(" ")
        .slice(0, 40)
        .trim()
        .replace(/[.,!?;:]+$/g, "");

    return title || "Untitled Chat";
}

async function repairUntitledChats() {
    const chats = await db.select<{ id: string; first_message: string }[]>(
        `SELECT chats.id,
                (
                    SELECT messages.text
                    FROM messages
                    JOIN message_sets ON message_sets.id = messages.message_set_id
                    WHERE messages.chat_id = chats.id
                      AND message_sets.type = 'user'
                      AND length(trim(messages.text)) > 0
                    ORDER BY message_sets.level ASC, message_sets.created_at ASC
                    LIMIT 1
                ) AS first_message
         FROM chats
         WHERE (length(trim(COALESCE(chats.title, ''))) = 0 OR chats.title = 'Untitled Chat')
           AND EXISTS (
               SELECT 1
               FROM messages
               JOIN message_sets ON message_sets.id = messages.message_set_id
               WHERE messages.chat_id = chats.id
                 AND message_sets.type = 'user'
                 AND length(trim(messages.text)) > 0
           )`,
    );

    await Promise.all(
        chats.map((chat) =>
            db.execute(
                "UPDATE chats SET title = $1, is_new_chat = 0 WHERE id = $2",
                [localChatTitle(chat.first_message), chat.id],
            ),
        ),
    );
}

export async function fetchChat(chatId: string): Promise<Chat> {
    const rows = await db.select<ChatDBRow[]>(
        `SELECT id, title, quick_chat, pinned, project_id, updated_at, created_at, summary, is_new_chat,
        parent_chat_id, project_context_summary, project_context_summary_is_stale, reply_to_id, gc_prototype_chat, total_cost_usd
        FROM chats
        WHERE id = $1;`,
        [chatId],
    );
    if (rows.length < 1) {
        throw new Error(`Chat not found: ${chatId}`);
    }
    return readChat(rows[0]);
}

function withChatQueryTimeout<T>(promise: Promise<T>, message: string) {
    let timeoutId: number | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error(message)), 10000);
    });

    return Promise.race([promise, timeout]).finally(() => {
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    });
}

export async function fetchChats(): Promise<Chat[]> {
    await repairUntitledChats();
    return await db
        .select<ChatDBRow[]>(
            `SELECT id, title, quick_chat, pinned, project_id, updated_at, created_at, summary, is_new_chat, parent_chat_id,
            project_context_summary, project_context_summary_is_stale, reply_to_id, gc_prototype_chat, total_cost_usd
            FROM chats
            WHERE reply_to_id IS NULL
              AND NOT (
                  is_new_chat = 1
                  AND quick_chat = 1
                  AND project_id = 'quick-chat'
                  AND gc_prototype_chat = 0
                  AND NOT EXISTS (
                      SELECT 1 FROM message_sets
                      WHERE message_sets.chat_id = chats.id
                  )
                  AND NOT EXISTS (
                      SELECT 1 FROM message_drafts
                      WHERE message_drafts.chat_id = chats.id
                        AND length(trim(message_drafts.content)) > 0
                  )
                  AND NOT EXISTS (
                      SELECT 1 FROM draft_attachments
                      WHERE draft_attachments.chat_id = chats.id
                  )
              )
            ORDER BY pinned DESC, updated_at DESC`,
        )
        .then((rows) => rows.map(readChat));
}

export async function fetchChatIsLoading(chatId: string): Promise<boolean> {
    const rows = await db.select<{ is_loading: number }[]>(
        `SELECT (
            -- check if there's a streaming message that's not a user message (for user messages, state behavior is undefined)
            EXISTS (SELECT 1 FROM messages WHERE chat_id = $1 AND messages.state = 'streaming' AND messages.model <> 'user')
        ) as is_loading
        FROM chats
        WHERE id = $1;`,
        [chatId],
    );
    return rows[0]?.is_loading === 1;
}

export function useCacheUpdateChat() {
    const queryClient = useQueryClient();
    return (chatId: string, updateFn: (chat: Chat) => void) => {
        queryClient.setQueryData(
            chatQueries.detail(chatId).queryKey,
            (chat: Chat | undefined) =>
                produce(chat, (draft) => {
                    if (draft) {
                        updateFn(draft);
                    }
                }),
        );
        queryClient.setQueryData(chatQueries.list().queryKey, (chats: Chat[]) =>
            produce(chats, (draft) => {
                if (draft === undefined) return;
                const chat = draft.find((c) => c.id === chatId);
                if (chat) {
                    updateFn(chat);
                    // NOTE: We don't always need to sort, if this becomes expensive we could gate
                    // this behind a flag
                    draft.sort((a, b) => {
                        // Sort pinned chats first, then by updatedAt
                        if (a.pinned !== b.pinned) {
                            return b.pinned ? 1 : -1;
                        }
                        return b.updatedAt.localeCompare(a.updatedAt);
                    });
                }
            }),
        );
    };
}

export const chatIsLoadingQueries = {
    detail: (chatId: string | undefined) => ({
        queryKey: ["chatIsLoading", chatId, "detail"] as const,
        queryFn: () => fetchChatIsLoading(chatId!),
        enabled: chatId !== undefined,
        initialData: false,
    }),
};

export function useChat(chatId: string) {
    return useQuery({
        ...chatQueries.detail(chatId),
        queryFn: () =>
            withChatQueryTimeout(
                fetchChat(chatId),
                "The chat took too long to load.",
            ),
    });
}

export function useUpdateNewChat() {
    const navigate = useNavigate();
    const cacheUpdateChat = useCacheUpdateChat();

    return useMutation({
        mutationKey: ["useUpdateNewChat"] as const,
        mutationFn: async ({ chatId }: { chatId: string }) => {
            // Update the chatId's updated_at to now
            await db.execute(
                "UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [chatId],
            );

            return chatId;
        },
        onSuccess: (chatId: string) => {
            cacheUpdateChat(chatId, (chat) => {
                console.log("updating chat", chat);
                chat.updatedAt = new Date().toISOString();
                console.log("updated chat", chat);
            });

            navigate(`/chat/${chatId}`);
        },
    });
}

export function useCreateNewChat() {
    const posthog = usePostHog();
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["createNewChat"] as const,
        mutationFn: async ({ projectId }: { projectId: string }) => {
            const result = await db.select<{ id: string }[]>(
                `INSERT INTO chats (id, created_at, updated_at, is_new_chat, project_id, quick_chat) 
                 VALUES (lower(hex(randomblob(16))), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1, ?, ?) 
                 RETURNING id`,
                [projectId, projectId === "quick-chat" ? 1 : 0],
            );

            if (!result.length) {
                throw new Error("Failed to create chat");
            }
            return result[0].id;
        },
        onSuccess: async (chatId: string) => {
            await queryClient.invalidateQueries(chatQueries.list());

            console.log("created new chat", chatId);

            const version = await getVersion();
            posthog?.capture("chat_created", {
                version,
            });
        },
    });
}

export function useCreateGroupChat() {
    const navigate = useNavigate();
    const posthog = usePostHog();
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["createGroupChat"] as const,
        mutationFn: async () => {
            const result = await db.select<{ id: string }[]>(
                `INSERT INTO chats (id, created_at, updated_at, is_new_chat, project_id, gc_prototype_chat) 
                 VALUES (lower(hex(randomblob(16))), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1, 'default', 1) 
                 RETURNING id`,
            );

            if (!result.length) {
                throw new Error("Failed to create group chat");
            }
            return result[0].id;
        },
        onSuccess: async (chatId: string) => {
            await queryClient.invalidateQueries(chatQueries.list());

            console.log("created new group chat", chatId);

            const version = await getVersion();
            posthog?.capture("gc_prototype_chat_created", {
                version,
            });

            navigate(`/chat/${chatId}`);
        },
    });
}

export function useGetOrCreateNewChat() {
    const navigate = useNavigate();
    const createNewChat = useCreateNewChat();
    const updateNewChat = useUpdateNewChat();

    return useMutation({
        mutationKey: ["getOrCreateNewChat"] as const,
        mutationFn: async ({ projectId }: { projectId: string }) => {
            const existingNewChat = await db.select<{ id: string }[]>(
                `SELECT id
                 FROM chats
                 WHERE is_new_chat = 1
                   AND project_id = ?
                   AND gc_prototype_chat = 0
                 ORDER BY updated_at DESC
                 LIMIT 1`,
                [projectId],
            );

            if (existingNewChat.length > 0) {
                await db.execute(
                    "UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
                    [existingNewChat[0].id],
                );
                await updateNewChat.mutateAsync({
                    chatId: existingNewChat[0].id,
                });
                return existingNewChat[0].id;
            }

            const chatId = await createNewChat.mutateAsync({ projectId });
            return chatId;
        },
        onSuccess: (chatId: string) => {
            navigate(`/chat/${chatId}`);
        },
    });
}

/**
 * Creates a new "quick chat" (AKA ambient chat).
 *
 * Checks if a user already has a new quick chat, returning the chatId if so.
 * If not, creates one and returns the new chatId.
 *
 * A "new chat" is one that has been created but no message has been sent yet.
 */
export function useGetOrCreateNewQuickChat() {
    const navigate = useNavigate();
    const createNewChat = useCreateNewChat();

    return useMutation({
        mutationKey: ["getOrCreateNewChat"] as const,
        mutationFn: async () => {
            await pruneDisposableQuickChats();

            const existingNewChat = await db.select<{ id: string }[]>(
                `SELECT chats.id
                 FROM chats
                 WHERE is_new_chat = 1
                   AND quick_chat = 1
                   AND project_id = 'quick-chat'
                   AND gc_prototype_chat = 0
                   AND (
                       EXISTS (
                           SELECT 1
                           FROM message_drafts
                           WHERE message_drafts.chat_id = chats.id
                             AND length(trim(message_drafts.content)) > 0
                       )
                       OR EXISTS (
                           SELECT 1
                           FROM draft_attachments
                           WHERE draft_attachments.chat_id = chats.id
                       )
                   )
                 ORDER BY updated_at DESC
                 LIMIT 1`,
                [],
            );

            if (existingNewChat.length > 0) {
                await db.execute(
                    "UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
                    [existingNewChat[0].id],
                );
                return existingNewChat[0].id;
            }

            const chatId = await createNewChat.mutateAsync({
                projectId: "quick-chat",
            });
            return chatId;
        },
        onSuccess: (chatId: string) => {
            navigate(`/chat/${chatId}`);
        },
    });
}

async function pruneDisposableQuickChats(chatId?: string) {
    const chatFilter = chatId ? "AND chats.id = $1" : "";
    const params = chatId ? [chatId] : [];

    await db.execute(
        `DELETE FROM message_drafts
         WHERE length(trim(content)) = 0
           AND chat_id IN (
               SELECT chats.id
               FROM chats
               WHERE chats.is_new_chat = 1
                 AND chats.quick_chat = 1
                 AND chats.project_id = 'quick-chat'
                 AND chats.gc_prototype_chat = 0
                 ${chatFilter}
                 AND NOT EXISTS (
                     SELECT 1 FROM message_sets
                     WHERE message_sets.chat_id = chats.id
                 )
                 AND NOT EXISTS (
                     SELECT 1 FROM draft_attachments
                     WHERE draft_attachments.chat_id = chats.id
                 )
           )`,
        params,
    );

    await db.execute(
        `DELETE FROM chats
         WHERE chats.is_new_chat = 1
           AND chats.quick_chat = 1
           AND chats.project_id = 'quick-chat'
           AND chats.gc_prototype_chat = 0
           ${chatFilter}
           AND NOT EXISTS (
               SELECT 1 FROM message_sets
               WHERE message_sets.chat_id = chats.id
           )
           AND NOT EXISTS (
               SELECT 1 FROM message_drafts
               WHERE message_drafts.chat_id = chats.id
                 AND length(trim(message_drafts.content)) > 0
           )
           AND NOT EXISTS (
               SELECT 1 FROM draft_attachments
               WHERE draft_attachments.chat_id = chats.id
           )`,
        params,
    );
}

export function useDiscardDisposableQuickChat() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["discardDisposableQuickChat"] as const,
        mutationFn: async ({ chatId }: { chatId: string }) => {
            const cachedDraft = queryClient.getQueryData<string>([
                "messageDraft",
                chatId,
            ]);
            const cachedAttachments = queryClient.getQueryData<unknown[]>([
                "messageDraftAttachments",
                chatId,
            ]);

            if (
                cachedDraft?.trim() ||
                (cachedAttachments && cachedAttachments.length > 0)
            ) {
                return;
            }

            await pruneDisposableQuickChats(chatId);
        },
        onSuccess: async (_data, variables) => {
            queryClient.removeQueries(chatQueries.detail(variables.chatId));
            await queryClient.invalidateQueries(chatQueries.list());
        },
    });
}

export function useConvertQuickChatToRegularChat() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["convertQuickChatToRegularChat"] as const,
        mutationFn: async ({ chatId }: { chatId: string }) => {
            await db.execute(
                "UPDATE chats SET quick_chat = 0, project_id = 'default' WHERE id = $1",
                [chatId],
            );
        },
        onSuccess: async (_data, variables) => {
            await queryClient.invalidateQueries(chatQueries.list());
            await queryClient.invalidateQueries(
                chatQueries.detail(variables.chatId),
            );
        },
    });
}

export function useDeleteChat() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["deleteChat"] as const,
        mutationFn: async ({ chatId }: { chatId: string }) => {
            await db.execute("DELETE FROM chats WHERE id = $1", [chatId]);
        },
        onMutate: async ({ chatId }) => {
            await queryClient.cancelQueries(chatQueries.list());
            const previousChats = queryClient.getQueryData<Chat[]>(
                chatQueries.list().queryKey,
            );
            queryClient.setQueryData<Chat[]>(
                chatQueries.list().queryKey,
                (chats) => chats?.filter((chat) => chat.id !== chatId) ?? [],
            );
            return { previousChats };
        },
        onError: (_error, _variables, context) => {
            if (context?.previousChats) {
                queryClient.setQueryData(
                    chatQueries.list().queryKey,
                    context.previousChats,
                );
            }
        },
        onSettled: async (_data, _error, variables) => {
            await queryClient.invalidateQueries(chatQueries.list());
            await queryClient.invalidateQueries(
                chatQueries.detail(variables.chatId),
            );

            // Invalidate all search results when a chat is deleted
            await queryClient.invalidateQueries({
                queryKey: ["search", "results"],
            });
        },
    });
}

export function useRenameChat() {
    const queryClient = useQueryClient();
    const cacheUpdateChat = useCacheUpdateChat();
    return useMutation({
        mutationKey: ["renameChat"] as const,
        mutationFn: async ({
            chatId,
            newTitle,
        }: {
            chatId: string;
            newTitle: string;
        }) => {
            await db.execute(
                "UPDATE chats SET title = $1, is_new_chat = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
                [newTitle, chatId],
            );
        },
        onSuccess: async (_data, variables) => {
            cacheUpdateChat(variables.chatId, (chat) => {
                chat.title = variables.newTitle;
                chat.isNewChat = false;
                chat.updatedAt = new Date().toISOString();
            });
            await queryClient.invalidateQueries(chatQueries.list());
            await queryClient.invalidateQueries(
                chatQueries.detail(variables.chatId),
            );
        },
    });
}

export function useTogglePinChat() {
    const queryClient = useQueryClient();
    const cacheUpdateChat = useCacheUpdateChat();

    return useMutation({
        mutationKey: ["togglePinChat"] as const,
        mutationFn: async ({
            chatId,
            pinned,
        }: {
            chatId: string;
            pinned: boolean;
        }) => {
            await db.execute("UPDATE chats SET pinned = $1 WHERE id = $2", [
                pinned ? 1 : 0,
                chatId,
            ]);
            return { chatId, pinned };
        },
        onSuccess: async (_data, variables) => {
            cacheUpdateChat(variables.chatId, (chat) => {
                chat.pinned = variables.pinned;
            });
            await queryClient.invalidateQueries(chatQueries.list());
        },
    });
}
