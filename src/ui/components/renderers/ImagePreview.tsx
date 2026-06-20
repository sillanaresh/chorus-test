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

export function ImagePreview({ src, alt }: ImagePreviewProps) {
    const [failed, setFailed] = useState(false);

    useEffect(() => setFailed(false), [src]);

    if (failed) {
        return (
            <a
                href={src}
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
                src={src}
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
                            src={src}
                            alt={alt}
                            className="max-h-[90vh] object-contain rounded-lg"
                        />
                    </div>
                    <DialogFooter>
                        {src.startsWith("asset://localhost/") && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    const path = src.replace(
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
