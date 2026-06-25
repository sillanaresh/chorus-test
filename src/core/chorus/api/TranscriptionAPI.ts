import { fetch as httpFetch } from "@tauri-apps/plugin-http";
import { getApiKeys } from "./AppMetadataAPI";

// The full gpt-4o-transcribe model handles accented English (including Indian
// English) noticeably better than the mini variant. Cost is still tiny: about
// a third of a cent for a 15 second clip. Swap to "gpt-4o-mini-transcribe" here
// if you ever want to halve the cost.
const TRANSCRIPTION_MODEL = "gpt-4o-transcribe";

// A language hint meaningfully improves accuracy and latency. English covers
// our use case; transcription still works for other languages, just without
// the hint advantage.
const TRANSCRIPTION_LANGUAGE = "en";

/**
 * Picks an audio container the current platform's MediaRecorder can actually
 * produce. iOS WKWebView only supports mp4/aac, while desktop Chromium prefers
 * webm. OpenAI accepts both.
 */
export function pickRecordingMimeType(): string | undefined {
    const candidates = [
        "audio/mp4",
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mpeg",
    ];
    if (
        typeof MediaRecorder === "undefined" ||
        typeof MediaRecorder.isTypeSupported !== "function"
    ) {
        return undefined;
    }
    return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

function fileNameForMimeType(mimeType: string): string {
    if (mimeType.includes("mp4")) return "audio.mp4";
    if (mimeType.includes("mpeg")) return "audio.mp3";
    if (mimeType.includes("webm")) return "audio.webm";
    if (mimeType.includes("wav")) return "audio.wav";
    return "audio.dat";
}

/**
 * Hand-encodes a multipart/form-data body as a Blob. We do this rather than
 * rely on FormData so the request behaves identically through Tauri's HTTP
 * plugin on every platform.
 */
function buildMultipartBody(
    fields: Record<string, string>,
    file: { name: string; mimeType: string; data: Blob },
): { body: Blob; contentType: string } {
    const boundary = `----ChorusAudio${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
    const parts: BlobPart[] = [];

    for (const [name, value] of Object.entries(fields)) {
        parts.push(
            `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
        );
    }

    parts.push(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: ${file.mimeType}\r\n\r\n`,
    );
    parts.push(file.data);
    parts.push(`\r\n--${boundary}--\r\n`);

    const contentType = `multipart/form-data; boundary=${boundary}`;
    return {
        body: new Blob(parts, { type: contentType }),
        contentType,
    };
}

/**
 * Transcribes a recorded audio clip to text using OpenAI. Returns the trimmed
 * transcript, or an empty string if nothing intelligible was captured.
 *
 * Throws a user-readable error when the OpenAI key is missing or the request
 * fails, so callers can surface it via a toast.
 */
export async function transcribeAudio(audio: Blob): Promise<string> {
    const apiKeys = await getApiKeys();
    const apiKey = apiKeys.openai?.trim();
    if (!apiKey) {
        throw new Error(
            "Add an OpenAI API key in Settings to use voice input.",
        );
    }

    if (audio.size === 0) {
        return "";
    }

    const mimeType = audio.type || "audio/mp4";
    const { body, contentType } = buildMultipartBody(
        {
            model: TRANSCRIPTION_MODEL,
            language: TRANSCRIPTION_LANGUAGE,
            response_format: "text",
        },
        {
            name: fileNameForMimeType(mimeType),
            mimeType,
            data: audio,
        },
    );

    const response = await httpFetch(
        "https://api.openai.com/v1/audio/transcriptions",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": contentType,
            },
            body,
        },
    );

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(
            `Transcription failed (${response.status}): ${detail}`,
        );
    }

    // response_format "text" returns the raw transcript as plain text.
    const transcript = await response.text();
    return transcript.trim();
}
