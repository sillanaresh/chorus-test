import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
    pickRecordingMimeType,
    transcribeAudio,
} from "@core/chorus/api/TranscriptionAPI";

export type VoiceRecorderState = "idle" | "recording" | "transcribing";

function errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "Something went wrong.";
}

/**
 * Records a short voice clip from the microphone and transcribes it to text.
 *
 * The recorded audio never leaves the device except as a single transcription
 * request to OpenAI. `onTranscript` receives the final text so the caller can
 * drop it into the composer draft.
 */
export function useVoiceRecorder(onTranscript: (text: string) => void) {
    const [state, setState] = useState<VoiceRecorderState>("idle");

    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const cancelledRef = useRef(false);

    // Keep the latest callback so the recorder's onstop handler always appends
    // to the current draft rather than a stale one.
    const onTranscriptRef = useRef(onTranscript);
    onTranscriptRef.current = onTranscript;

    const isSupported = useMemo(
        () =>
            typeof navigator !== "undefined" &&
            typeof navigator.mediaDevices?.getUserMedia === "function" &&
            typeof MediaRecorder !== "undefined",
        [],
    );

    const releaseStream = useCallback(() => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
    }, []);

    const start = useCallback(async () => {
        if (!isSupported) {
            toast.error("Voice input is not available on this device.");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });
            streamRef.current = stream;

            const mimeType = pickRecordingMimeType();
            const recorder = new MediaRecorder(
                stream,
                mimeType ? { mimeType } : undefined,
            );
            chunksRef.current = [];
            cancelledRef.current = false;

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            recorder.onstop = () => {
                releaseStream();

                if (cancelledRef.current) {
                    chunksRef.current = [];
                    setState("idle");
                    return;
                }

                const type = recorder.mimeType || mimeType || "audio/mp4";
                const blob = new Blob(chunksRef.current, { type });
                chunksRef.current = [];

                if (blob.size === 0) {
                    setState("idle");
                    return;
                }

                setState("transcribing");
                void transcribeAudio(blob)
                    .then((text) => {
                        if (text) {
                            onTranscriptRef.current(text);
                        } else {
                            toast("No speech detected. Try again.");
                        }
                    })
                    .catch((error: unknown) => {
                        toast.error("Could not transcribe audio", {
                            description: errorMessage(error),
                        });
                    })
                    .finally(() => setState("idle"));
            };

            recorder.start();
            recorderRef.current = recorder;
            setState("recording");
        } catch (error) {
            releaseStream();
            setState("idle");
            toast.error("Microphone unavailable", {
                description:
                    "Allow microphone access for Chorus in Settings to use voice input.",
            });
            console.warn("Voice recording could not start", error);
        }
    }, [isSupported, releaseStream]);

    const stop = useCallback(() => {
        const recorder = recorderRef.current;
        if (recorder && recorder.state !== "inactive") {
            recorder.stop();
        }
    }, []);

    const cancel = useCallback(() => {
        cancelledRef.current = true;
        stop();
    }, [stop]);

    const toggle = useCallback(() => {
        if (state === "recording") {
            stop();
        } else if (state === "idle") {
            void start();
        }
    }, [state, start, stop]);

    // Clean up if the component unmounts mid-recording.
    useEffect(() => {
        return () => {
            cancelledRef.current = true;
            const recorder = recorderRef.current;
            if (recorder && recorder.state !== "inactive") {
                recorder.stop();
            }
            releaseStream();
        };
    }, [releaseStream]);

    return {
        state,
        isRecording: state === "recording",
        isTranscribing: state === "transcribing",
        isSupported,
        toggle,
        cancel,
    };
}
