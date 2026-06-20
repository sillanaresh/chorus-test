import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
} from "@ui/components/ui/dialog";
import { Button } from "../ui/button";
import { openPath } from "@tauri-apps/plugin-opener";
import { dialogActions } from "@core/infra/DialogStore";
import { useEffect, useState } from "react";
import { appDataDir, join } from "@tauri-apps/api/path";
import { convertFileSrc } from "@tauri-apps/api/core";
interface ImagePreviewProps {
    src: string;
    alt?: string;
}

const imagePreviewDialogId = (src: string) => {
    let hash = 0;
    for (let index = 0; index < src.length; index += 1) {
        hash = (hash * 31 + src.charCodeAt(index)) | 0;
    }
    return `image-preview-dialog-${Math.abs(hash)}`;
};

async function resolvePersistentImageSource(src: string): Promise<string> {
    const stablePrefix = "chorus-generated-image://";
    if (src.startsWith(stablePrefix)) {
        const fileName = decodeURIComponent(src.slice(stablePrefix.length));
        return convertFileSrc(
            await join(await appDataDir(), "generated_images", fileName),
        );
    }

    const generatedImageFile = decodeURIComponent(src).match(
        /\/generated_images\/([^/?#]+)/,
    )?.[1];
    if (generatedImageFile) {
        return convertFileSrc(
            await join(
                await appDataDir(),
                "generated_images",
                generatedImageFile,
            ),
        );
    }

    return src;
}

export function ImagePreview({ src, alt }: ImagePreviewProps) {
    const [failed, setFailed] = useState(false);
    const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        setFailed(false);
        setResolvedSrc(null);
        void resolvePersistentImageSource(src)
            .then((nextSrc) => {
                if (active) {
                    setResolvedSrc(nextSrc);
                    setFailed(false);
                }
            })
            .catch((error) => {
                console.error("Could not resolve image source", error);
                if (active) setFailed(true);
            });
        return () => {
            active = false;
        };
    }, [src]);

    if (!resolvedSrc) {
        return (
            <div
                className="min-h-24 animate-pulse rounded-md bg-muted/60"
                aria-label="Loading image"
            />
        );
    }

    if (failed) {
        return (
            <a
                href={resolvedSrc}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center rounded-md border px-3 text-sm text-muted-foreground"
            >
                Open image
            </a>
        );
    }

    return (
        <>
            <img
                src={resolvedSrc}
                alt={alt}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                className="h-auto max-w-full cursor-zoom-in rounded-md transition-opacity hover:opacity-90"
                onError={() => setFailed(true)}
                onClick={() =>
                    dialogActions.openDialog(imagePreviewDialogId(src))
                }
            />
            <Dialog id={imagePreviewDialogId(src)}>
                <DialogContent aria-describedby={undefined}>
                    <DialogTitle className="sr-only">Image Preview</DialogTitle>
                    <div className="flex items-center justify-center">
                        <img
                            src={resolvedSrc}
                            alt={alt}
                            className="max-h-[90vh] object-contain rounded-lg"
                        />
                    </div>
                    <DialogFooter>
                        {resolvedSrc.startsWith("asset://localhost/") && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    const path = resolvedSrc.replace(
                                        "asset://localhost",
                                        "",
                                    );
                                    // decode the path
                                    const decodedPath =
                                        decodeURIComponent(path);
                                    console.log("openPath", decodedPath);
                                    void openPath(decodedPath);
                                }}
                            >
                                Open in Preview
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
